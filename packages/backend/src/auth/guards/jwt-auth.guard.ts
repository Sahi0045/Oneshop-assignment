import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Guard that protects routes with JWT authentication.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)          — protect a single route
 *   @UseGuards(JwtAuthGuard)          — applied globally in main.ts
 *
 * Routes decorated with @Public() skip JWT validation entirely.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Allow routes explicitly marked as public to bypass auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Called by Passport after validation.  We override this to provide a
   * friendlier error message instead of the default Passport one.
   */
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    if (err || !user) {
      const message = this._extractMessage(info, err);
      throw err ?? new UnauthorizedException(message);
    }

    return user;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private _extractMessage(info: any, err: any): string {
    if (typeof info?.message === 'string') {
      // Map common passport-jwt error messages to user-friendly strings
      switch (info.message) {
        case 'No auth token':
          return 'Authentication token is missing. Please log in.';
        case 'jwt expired':
          return 'Your session has expired. Please log in again.';
        case 'invalid token':
        case 'invalid signature':
          return 'Invalid authentication token. Please log in again.';
        case 'jwt malformed':
          return 'Malformed authentication token. Please log in again.';
        case 'jwt not active':
          return 'Authentication token is not yet active.';
        default:
          return info.message;
      }
    }

    if (err?.message) {
      return err.message;
    }

    return 'Unauthorized. Please provide a valid authentication token.';
  }
}
