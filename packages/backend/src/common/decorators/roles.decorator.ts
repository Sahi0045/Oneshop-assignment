import { SetMetadata } from '@nestjs/common';

/**
 * ROLES_KEY
 *
 * The metadata key under which the required roles array is stored.
 * Used by RolesGuard to retrieve the roles via Reflector.
 *
 * Keep this constant in sync with the key used in RolesGuard:
 *   const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [...]);
 */
export const ROLES_KEY = 'roles';

/**
 * UserRole
 *
 * Local mirror of the UserRole enum from @freelancer/shared.
 * Declared here so the decorator is self-contained and compiles without
 * a build-order dependency on the shared package.
 *
 * Keep in sync with the Prisma schema enum and @freelancer/shared.
 */
export enum UserRole {
  CLIENT     = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN      = 'ADMIN',
}

/**
 * @Roles(...roles)
 *
 * A custom route-level or controller-level decorator that declares which
 * user roles are permitted to access the decorated handler or controller.
 *
 * Works in conjunction with RolesGuard — the guard reads the metadata set
 * by this decorator and compares it against the authenticated user's role.
 *
 * RolesGuard must be applied AFTER JwtAuthGuard so that request.user is
 * already populated when the guard runs.
 *
 * Usage examples
 * ──────────────
 *
 * Single role — only CLIENTs can create projects:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.CLIENT)
 *   @Post()
 *   createProject() { ... }
 *
 * Multiple roles — CLIENTs and ADMINs can view all bids:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.CLIENT, UserRole.ADMIN)
 *   @Get(':id/bids')
 *   getBids() { ... }
 *
 * Controller-level — every route in the controller requires ADMIN:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 *   @Controller('admin')
 *   export class AdminController { ... }
 *
 * String literals also work (for flexibility when the enum is not imported):
 *   @Roles('CLIENT', 'FREELANCER')
 *   @Get('dashboard')
 *   dashboard() { ... }
 *
 * How it works
 * ────────────
 * @Roles is a thin wrapper around NestJS's built-in SetMetadata helper.
 * SetMetadata stores the roles array under the ROLES_KEY metadata key on
 * the route handler (or class).  RolesGuard retrieves this metadata via
 * Reflector.getAllAndOverride() — handler metadata takes precedence over
 * class metadata, enabling fine-grained per-route overrides even when a
 * class-level @Roles decorator is present.
 *
 * @param roles  One or more UserRole enum values (or plain strings) that
 *               are permitted to access the decorated route / controller.
 */
export const Roles = (...roles: (UserRole | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
