import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

// ---------------------------------------------------------------------------
// Metadata key — used with @SkipTransform() decorator to opt out
// ---------------------------------------------------------------------------

export const SKIP_TRANSFORM_KEY = 'skipTransform';

// ---------------------------------------------------------------------------
// Response envelope shape
// ---------------------------------------------------------------------------

export interface TransformedResponse<T = any> {
  success:    true;
  data:       T;
  message:    string;
  meta?:      Record<string, any>;
  timestamp:  string;
  path?:      string;
}

// ---------------------------------------------------------------------------
// TransformInterceptor
// ---------------------------------------------------------------------------

/**
 * TransformInterceptor
 *
 * A global NestJS interceptor that wraps every successful HTTP response in a
 * consistent JSON envelope so that API consumers always receive the same
 * response shape regardless of which controller / service produced the data.
 *
 * Response envelope
 * ─────────────────
 * ```json
 * {
 *   "success":   true,
 *   "data":      { ... },           // original handler return value
 *   "message":   "OK",              // controller-supplied or default "OK"
 *   "timestamp": "2025-01-15T10:30:00.000Z",
 *   "path":      "/api/v1/projects"
 * }
 * ```
 *
 * Pagination meta
 * ───────────────
 * If the handler returns an object that contains `items` + `total` + `page`
 * + `limit` fields (standard paginated result), those fields are hoisted into
 * a `meta` key and only `items` is placed under `data`:
 *
 * ```json
 * {
 *   "success": true,
 *   "data": [ ... ],          // items array
 *   "meta": {
 *     "total":      42,
 *     "page":       1,
 *     "limit":      20,
 *     "totalPages": 3
 *   },
 *   "message":   "OK",
 *   "timestamp": "2025-01-15T10:30:00.000Z"
 * }
 * ```
 *
 * Message extraction
 * ──────────────────
 * If the handler return value contains a top-level `message` string, it is
 * lifted out and used as the envelope message.  The `message` key is then
 * removed from `data` to avoid duplication:
 *
 * ```typescript
 * // Controller:
 * return { data: project, message: 'Project created successfully.' };
 *
 * // Transformed to:
 * {
 *   "success": true,
 *   "data":    { ...project },
 *   "message": "Project created successfully."
 * }
 * ```
 *
 * Opt-out
 * ───────
 * Decorate a handler with @SkipTransform() to bypass the transformation and
 * return the raw handler value (useful for file downloads, binary responses,
 * or Stripe webhooks that return a simple `{ received: true }` body):
 *
 * ```typescript
 * import { SetMetadata } from '@nestjs/common';
 * export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
 *
 * @SkipTransform()
 * @Post('webhooks')
 * stripeWebhook() { ... }
 * ```
 *
 * Null / undefined responses
 * ──────────────────────────
 * If the handler returns `null` or `undefined` (e.g. a 204 No Content
 * endpoint), the envelope `data` field is set to `null` so the client always
 * receives valid JSON.
 *
 * Registration
 * ────────────
 * Register globally in `main.ts` (after creating the app):
 * ```typescript
 * const reflector = app.get(Reflector);
 * app.useGlobalInterceptors(new TransformInterceptor(reflector));
 * ```
 *
 * Or provide it at the module level:
 * ```typescript
 * { provide: APP_INTERCEPTOR, useClass: TransformInterceptor }
 * ```
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<TransformedResponse<T> | T> {
    // ── Check opt-out metadata ────────────────────────────────────────────────
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      // Return the raw handler value without transformation
      return next.handle();
    }

    // ── Extract request metadata for envelope ─────────────────────────────────
    const request = context.switchToHttp().getRequest<Request>();
    const path    = request?.url ?? undefined;

    return next.handle().pipe(
      map((handlerValue) => this.transform(handlerValue, path)),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core transformation logic
  // ─────────────────────────────────────────────────────────────────────────────

  private transform(
    value: any,
    path?: string,
  ): TransformedResponse<any> {
    // ── 1. Handle null / undefined ────────────────────────────────────────────
    if (value === null || value === undefined) {
      return this.buildEnvelope(null, 'OK', undefined, path);
    }

    // ── 2. Handle primitive values (string, number, boolean) ──────────────────
    if (typeof value !== 'object' || Array.isArray(value)) {
      return this.buildEnvelope(value, 'OK', undefined, path);
    }

    // ── 3. Detect paginated results ───────────────────────────────────────────
    //    Shape: { items: T[], total: number, page: number, limit: number, ... }
    if (this.isPaginatedResult(value)) {
      const { items, total, page, limit, totalPages, ...rest } = value;

      // Check for an embedded message
      const message = typeof rest.message === 'string' ? rest.message : 'OK';
      if (rest.message) delete rest.message;

      const meta: Record<string, any> = {
        total,
        page,
        limit,
        totalPages: totalPages ?? Math.ceil(total / limit),
      };

      // Carry forward any extra pagination keys (e.g. nextCursor)
      if (rest.nextCursor !== undefined) {
        meta.nextCursor = rest.nextCursor;
        delete rest.nextCursor;
      }

      return this.buildEnvelope(items, message, meta, path);
    }

    // ── 4. Lift top-level `message` out of the payload ────────────────────────
    //    Many controllers return:  { data: T, message: string }
    //    OR the raw entity with an incidentally-named `message` field.
    //
    //    We only lift `message` if the object also has a `data` key, which is
    //    the deliberate  { data, message } pattern used across this project.
    if (
      Object.prototype.hasOwnProperty.call(value, 'message') &&
      Object.prototype.hasOwnProperty.call(value, 'data') &&
      typeof value.message === 'string'
    ) {
      const { message, data, meta, ...extra } = value;

      // If `data` itself is a paginated result, recurse
      if (data !== null && data !== undefined && this.isPaginatedResult(data)) {
        const inner = this.transform(data, path);
        return {
          ...inner,
          message: message || inner.message,
        } as TransformedResponse<any>;
      }

      // Merge any extra keys into meta
      const mergedMeta: Record<string, any> | undefined =
        meta || Object.keys(extra).length > 0
          ? { ...(meta ?? {}), ...extra }
          : undefined;

      return this.buildEnvelope(
        data ?? null,
        message || 'OK',
        mergedMeta,
        path,
      );
    }

    // ── 5. Plain object / entity — wrap as-is ─────────────────────────────────
    //    Also handle the rare case where a controller returns
    //    { message: string } without a `data` key (e.g. logout, mark-read).
    if (
      Object.prototype.hasOwnProperty.call(value, 'message') &&
      !Object.prototype.hasOwnProperty.call(value, 'data') &&
      typeof value.message === 'string' &&
      Object.keys(value).length <= 3
    ) {
      const { message, ...rest } = value;
      const data = Object.keys(rest).length > 0 ? rest : null;
      return this.buildEnvelope(data, message || 'OK', undefined, path);
    }

    // Default — wrap the entire object under `data`
    return this.buildEnvelope(value, 'OK', undefined, path);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Constructs the standard response envelope.
   */
  private buildEnvelope(
    data:      any,
    message:   string,
    meta?:     Record<string, any>,
    path?:     string,
  ): TransformedResponse<any> {
    const envelope: TransformedResponse<any> = {
      success:   true,
      data:      data ?? null,
      message:   message || 'OK',
      timestamp: new Date().toISOString(),
    };

    if (meta && Object.keys(meta).length > 0) {
      envelope.meta = meta;
    }

    if (path) {
      envelope.path = path;
    }

    return envelope;
  }

  /**
   * Returns true if the value looks like a paginated result object:
   *   { items: any[], total: number, page: number, limit: number }
   *
   * All four fields must be present and of the correct types.
   */
  private isPaginatedResult(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Array.isArray(value.items) &&
      typeof value.total === 'number' &&
      typeof value.page  === 'number' &&
      typeof value.limit === 'number'
    );
  }
}
