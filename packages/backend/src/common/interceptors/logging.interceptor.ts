import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// LoggingInterceptor
// ---------------------------------------------------------------------------

/**
 * LoggingInterceptor
 *
 * A global NestJS interceptor that logs every incoming HTTP request and its
 * corresponding response (or error) with structured metadata:
 *
 *   → [method] [path] — incoming request
 *   ← [method] [path] [statusCode] [duration ms] — outgoing response
 *
 * Example log lines
 * ─────────────────
 * (info)  → POST  /api/v1/auth/login
 * (log)   ← POST  /api/v1/auth/login  200  42ms
 *
 * (info)  → GET   /api/v1/projects?page=1&limit=20
 * (log)   ← GET   /api/v1/projects?page=1&limit=20  200  87ms
 *
 * (warn)  ← POST  /api/v1/auth/login  401  15ms
 *
 * (error) ← DELETE /api/v1/projects/bad-uuid  500  12ms  [Prisma error: ...]
 *
 * Sensitive data
 * ──────────────
 * Request bodies and response payloads are intentionally NOT logged to avoid
 * leaking passwords, tokens, PII, or payment data into log aggregators.
 * Only the method, URL, status code, and duration are recorded.
 *
 * Slow request detection
 * ──────────────────────
 * Requests that take longer than SLOW_REQUEST_THRESHOLD_MS are additionally
 * logged at WARN level with a [SLOW] prefix so they can be easily filtered
 * in log aggregators (e.g. CloudWatch, Datadog, Loki).
 *
 * Path exclusions
 * ───────────────
 * Health-check and metrics endpoints (/health, /metrics) are logged at DEBUG
 * level instead of INFO to keep noise out of production logs.
 *
 * Registration
 * ────────────
 * Register globally in `main.ts`:
 * ```typescript
 * app.useGlobalInterceptors(new LoggingInterceptor());
 * ```
 *
 * Or provide at the module level:
 * ```typescript
 * { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }
 * ```
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  /** Requests exceeding this duration (ms) are flagged as slow. */
  private static readonly SLOW_REQUEST_THRESHOLD_MS = 1_000;

  /**
   * Paths whose log level is demoted to DEBUG to reduce noise in production.
   * Matched against the request URL using a simple startsWith check.
   */
  private static readonly QUIET_PATHS: string[] = [
    '/health',
    '/metrics',
    '/favicon.ico',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only handle HTTP contexts (skip WebSocket / RPC contexts)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx      = context.switchToHttp();
    const request  = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent  = (headers['user-agent'] ?? '-') as string;
    const requestId  = (
      (headers['x-request-id'] as string | undefined) ??
      (headers['x-correlation-id'] as string | undefined) ??
      this.generateShortId()
    );

    const startTime  = Date.now();
    const isQuiet    = LoggingInterceptor.QUIET_PATHS.some((p) =>
      url.startsWith(p),
    );

    // ── Log the incoming request ──────────────────────────────────────────────
    const incomingMsg = this.formatIncoming(method, url, ip, userAgent, requestId);

    if (isQuiet) {
      this.logger.debug(incomingMsg);
    } else {
      this.logger.log(incomingMsg);
    }

    // ── Observe the handler and log the outgoing response ─────────────────────
    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        const duration   = Date.now() - startTime;
        const isSlow     = duration >= LoggingInterceptor.SLOW_REQUEST_THRESHOLD_MS;

        const outgoingMsg = this.formatOutgoing(
          method,
          url,
          statusCode,
          duration,
          requestId,
          isSlow,
        );

        if (isQuiet) {
          this.logger.debug(outgoingMsg);
        } else if (isSlow) {
          this.logger.warn(outgoingMsg);
        } else if (statusCode >= 400) {
          this.logger.warn(outgoingMsg);
        } else {
          this.logger.log(outgoingMsg);
        }
      }),

      catchError((err) => {
        const duration   = Date.now() - startTime;
        // For errors the status code may not yet be set on the response object;
        // derive it from the exception if possible.
        const statusCode =
          typeof err?.status === 'number'
            ? err.status
            : typeof err?.statusCode === 'number'
            ? err.statusCode
            : 500;

        const errMsg = this.formatOutgoing(
          method,
          url,
          statusCode,
          duration,
          requestId,
          false,
          this.extractErrorMessage(err),
        );

        if (statusCode >= 500) {
          this.logger.error(errMsg, err?.stack);
        } else {
          this.logger.warn(errMsg);
        }

        return throwError(() => err);
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Formatters
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Formats the incoming request log line.
   *
   * Example:
   *   → POST  /api/v1/auth/login  [::1]  Mozilla/5.0...  [req-abc123]
   */
  private formatIncoming(
    method:     string,
    url:        string,
    ip:         string,
    userAgent:  string,
    requestId:  string,
  ): string {
    const paddedMethod = method.padEnd(7);
    const safeIp       = ip ?? 'unknown';
    const shortAgent   = this.truncate(userAgent, 60);

    return (
      `→ ${paddedMethod} ${url}` +
      `  [${safeIp}]` +
      `  "${shortAgent}"` +
      `  [${requestId}]`
    );
  }

  /**
   * Formats the outgoing response log line.
   *
   * Examples:
   *   ← POST  /api/v1/auth/login  200  42ms  [req-abc123]
   *   ← GET   /api/v1/projects    200  1234ms  [SLOW]  [req-abc123]
   *   ← POST  /api/v1/auth/login  401  15ms  [req-abc123]
   *   ← DELETE /api/v1/things/x  500  12ms  [Error: ...]  [req-abc123]
   */
  private formatOutgoing(
    method:     string,
    url:        string,
    statusCode: number,
    duration:   number,
    requestId:  string,
    isSlow:     boolean,
    errorMsg?:  string,
  ): string {
    const paddedMethod  = method.padEnd(7);
    const statusEmoji   = this.statusEmoji(statusCode);
    const slowTag       = isSlow ? '  [SLOW]' : '';
    const errorTag      = errorMsg ? `  [${this.truncate(errorMsg, 80)}]` : '';

    return (
      `← ${paddedMethod} ${url}` +
      `  ${statusEmoji}${statusCode}` +
      `  ${duration}ms` +
      slowTag +
      errorTag +
      `  [${requestId}]`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a coloured status code prefix for terminal readability.
   * (Colours appear in local development; stripped by most log aggregators.)
   */
  private statusEmoji(statusCode: number): string {
    if (statusCode >= 500) return '🔴 ';
    if (statusCode >= 400) return '🟡 ';
    if (statusCode >= 300) return '🔵 ';
    if (statusCode >= 200) return '🟢 ';
    return '';
  }

  /**
   * Extracts a short human-readable message from an error for log context.
   * Avoids logging full stack traces here — those are logged separately via
   * the `catchError` branch's `this.logger.error(msg, err.stack)` call.
   */
  private extractErrorMessage(err: unknown): string {
    if (!err) return 'Unknown error';

    if (typeof err === 'string') return err;

    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'object') {
      const e = err as Record<string, any>;
      return e.message ?? e.error ?? JSON.stringify(err).slice(0, 100);
    }

    return String(err);
  }

  /**
   * Truncates a string to `maxLength` characters and appends `…` if needed.
   */
  private truncate(value: string, maxLength: number): string {
    if (!value) return '';
    return value.length <= maxLength
      ? value
      : `${value.slice(0, maxLength - 1)}…`;
  }

  /**
   * Generates a short random alphanumeric ID for request correlation.
   * Used when no upstream `x-request-id` header is present.
   *
   * Format: 8 alphanumeric characters — short enough to be readable in logs,
   * long enough to be unique within a reasonable time window.
   */
  private generateShortId(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}
