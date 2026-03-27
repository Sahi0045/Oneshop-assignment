import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Shape of the structured error response sent to clients
// ---------------------------------------------------------------------------

export interface ErrorResponse {
  success:    false;
  statusCode: number;
  message:    string;
  errors:     string[] | Record<string, any>[] | null;
  timestamp:  string;
  path:       string;
  method:     string;
  requestId?: string;
}

// ---------------------------------------------------------------------------
// HttpExceptionFilter
// ---------------------------------------------------------------------------

/**
 * HttpExceptionFilter
 *
 * A global NestJS exception filter that intercepts every HttpException (and
 * unhandled non-Http errors) and serialises them into a consistent JSON
 * envelope so that API consumers always receive the same error shape
 * regardless of where in the application the error was thrown.
 *
 * Response envelope
 * ─────────────────
 * ```json
 * {
 *   "success":    false,
 *   "statusCode": 400,
 *   "message":    "Validation failed",
 *   "errors":     [
 *     "email must be a valid email address",
 *     "password must be at least 8 characters"
 *   ],
 *   "timestamp":  "2025-01-15T10:30:00.000Z",
 *   "path":       "/api/v1/auth/register",
 *   "method":     "POST"
 * }
 * ```
 *
 * Validation errors
 * ─────────────────
 * NestJS's `ValidationPipe` throws a `BadRequestException` whose response
 * body is an object with a `message` array of constraint strings.
 * This filter detects that shape and surfaces the array under `errors` so
 * the client can display per-field feedback without additional parsing.
 *
 * Unhandled errors
 * ────────────────
 * Any error that is NOT an `HttpException` (e.g. a Prisma error, a native
 * `Error`, or an unhandled promise rejection that bubbles up through NestJS)
 * is caught here, logged at ERROR level, and returned as a 500 Internal
 * Server Error.  The raw error message is never exposed to clients in
 * production — only a generic "Internal server error" string is sent.
 *
 * Registration
 * ────────────
 * Register globally in `main.ts`:
 *   app.useGlobalFilters(new HttpExceptionFilter());
 *
 * Or provide it as a module-level filter:
 *   { provide: APP_FILTER, useClass: HttpExceptionFilter }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    // ── 1. Determine HTTP status code ─────────────────────────────────────────
    const statusCode = this.resolveStatus(exception);

    // ── 2. Extract a human-readable message and optional errors array ─────────
    const { message, errors } = this.resolveMessage(exception, statusCode);

    // ── 3. Log the error ──────────────────────────────────────────────────────
    this.logException(exception, statusCode, request);

    // ── 4. Build the response body ────────────────────────────────────────────
    const body: ErrorResponse = {
      success:    false,
      statusCode,
      message,
      errors:     errors.length > 0 ? errors : null,
      timestamp:  new Date().toISOString(),
      path:       request.url,
      method:     request.method,
    };

    // Attach request-id if the upstream proxy set one (useful for log correlation)
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      (request.headers['x-correlation-id'] as string | undefined);
    if (requestId) {
      body.requestId = requestId;
    }

    // ── 5. Send the response ──────────────────────────────────────────────────
    response.status(statusCode).json(body);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extracts the HTTP status code from the exception.
   * Falls back to 500 for non-HttpException errors.
   */
  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Resolves a user-facing message string and an optional array of
   * validation / field-level error strings from the exception.
   *
   * Handles three shapes:
   *
   *   A) HttpException with a string response:
   *      → message = response string, errors = []
   *
   *   B) HttpException with an object response (NestJS ValidationPipe):
   *      → message = response.error || response.message (if string)
   *      → errors  = response.message (if array)
   *
   *   C) Non-HttpException (unexpected error):
   *      → message = "Internal server error" (never expose raw error in prod)
   *      → errors  = []
   */
  private resolveMessage(
    exception: unknown,
    statusCode: number,
  ): { message: string; errors: string[] } {
    if (!(exception instanceof HttpException)) {
      // Unexpected / unhandled error — do NOT leak internal details to clients
      return {
        message: 'Internal server error. Please try again later.',
        errors:  [],
      };
    }

    const exceptionResponse = exception.getResponse();

    // ── Case A: string response ───────────────────────────────────────────────
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse, errors: [] };
    }

    // ── Case B: object response ───────────────────────────────────────────────
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, any>;

      // NestJS ValidationPipe produces:
      // { statusCode: 400, message: string[], error: 'Bad Request' }
      if (Array.isArray(resp.message)) {
        // Each item is either a string or an object with `constraints`
        const errors = this.flattenValidationErrors(resp.message);
        return {
          message: resp.error ?? this.statusCodeToMessage(statusCode),
          errors,
        };
      }

      // NestJS built-in exceptions produce:
      // { statusCode: 404, message: 'Not Found', error: 'Not Found' }
      if (typeof resp.message === 'string') {
        return { message: resp.message, errors: [] };
      }

      // Fallback for any other object shape
      return {
        message: resp.error ?? this.statusCodeToMessage(statusCode),
        errors:  [],
      };
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return {
      message: exception.message ?? this.statusCodeToMessage(statusCode),
      errors:  [],
    };
  }

  /**
   * Flattens the `message` array produced by NestJS's `ValidationPipe` into a
   * plain string array.
   *
   * Input examples:
   *   - ["email must be a valid email", "password is too short"]
   *   - [{ property: "email", constraints: { isEmail: "email must be valid" } }]
   *
   * Output: ["email must be a valid email", "password is too short"]
   */
  private flattenValidationErrors(messages: any[]): string[] {
    const errors: string[] = [];

    for (const item of messages) {
      if (typeof item === 'string') {
        errors.push(item);
        continue;
      }

      if (typeof item === 'object' && item !== null) {
        // class-validator ValidationError objects have a `constraints` map
        if (item.constraints) {
          errors.push(...Object.values(item.constraints as Record<string, string>));
        } else if (item.message) {
          errors.push(item.message);
        } else {
          errors.push(JSON.stringify(item));
        }
      }
    }

    return errors;
  }

  /**
   * Maps common HTTP status codes to human-readable fallback messages.
   * Used when the exception doesn't carry an explicit message.
   */
  private statusCodeToMessage(statusCode: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      410: 'Gone',
      413: 'Payload Too Large',
      415: 'Unsupported Media Type',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return map[statusCode] ?? 'An unexpected error occurred';
  }

  /**
   * Logs the exception with the appropriate severity level.
   *
   * - 4xx client errors → WARN  (expected, client's fault, no alert needed)
   * - 5xx server errors → ERROR (unexpected, may need investigation)
   * - Non-Http errors   → ERROR (always unexpected)
   *
   * Includes the request method + URL for easy log correlation without
   * needing to dig through request logs separately.
   */
  private logException(
    exception: unknown,
    statusCode: number,
    request: Request,
  ): void {
    const context = `${request.method} ${request.url}`;

    if (statusCode >= 500 || !(exception instanceof HttpException)) {
      // Server error or unhandled exception — log the full stack trace
      const stack =
        exception instanceof Error ? exception.stack : String(exception);

      this.logger.error(
        `[${statusCode}] ${context} — ${this.extractRawMessage(exception)}`,
        stack,
      );
    } else if (statusCode >= 400) {
      // Client error — log at WARN level without stack trace to reduce noise
      this.logger.warn(
        `[${statusCode}] ${context} — ${this.extractRawMessage(exception)}`,
      );
    }
  }

  /**
   * Extracts the raw error message for logging purposes (not shown to clients).
   */
  private extractRawMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') return resp;
      if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, any>;
        if (Array.isArray(r.message)) return r.message.join(', ');
        if (typeof r.message === 'string') return r.message;
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return String(exception);
  }
}
