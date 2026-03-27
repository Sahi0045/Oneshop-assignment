import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

/**
 * RolesGuard
 *
 * Reads the roles metadata set by the @Roles() decorator and verifies
 * that the authenticated user (populated by JwtAuthGuard / JwtStrategy)
 * has at least one of the required roles.
 *
 * This guard MUST be applied AFTER JwtAuthGuard so that request.user is
 * already populated when canActivate() runs.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.CLIENT)
 *   @Post()
 *   createProject() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Retrieve the roles array defined by @Roles() — check the handler first,
    // then fall back to the class-level decorator (getAllAndOverride gives
    // the most specific decorator priority).
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator is present, the route is accessible to any
    // authenticated user — let the request through.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extract the user that was attached by JwtStrategy.validate()
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Access denied. You must be authenticated to access this resource.',
      );
    }

    const hasRole = requiredRoles.some((role) => role === user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. This action requires one of the following roles: ${requiredRoles.join(', ')}. ` +
          `Your current role is: ${user.role ?? 'unknown'}.`,
      );
    }

    return true;
  }
}
