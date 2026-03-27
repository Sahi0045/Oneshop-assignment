import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser
 *
 * A custom parameter decorator that extracts the authenticated user (or a
 * specific property of the user) from the Express request object.
 *
 * The user object is attached to the request by Passport's JwtStrategy after
 * a successful token verification.  It contains at minimum:
 *   { id: string, email: string, role: string }
 *
 * Usage examples
 * ──────────────
 *
 * Get the full user object:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: RequestUser) { ... }
 *
 * Get a single property by name:
 *   @Get('me')
 *   getMe(@CurrentUser('id') userId: string) { ... }
 *
 *   @Delete(':id')
 *   delete(@CurrentUser('role') role: string) { ... }
 *
 * Combined with JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('dashboard')
 *   dashboard(@CurrentUser('id') userId: string) { ... }
 *
 * Type safety
 * ───────────
 * When using without a property key, type the parameter as `RequestUser`
 * (exported from jwt.strategy.ts) for full IntelliSense support.
 * When using with a property key, the return type is `any` — cast as needed.
 *
 * @param data  Optional dot-notation property name to extract from the user
 *              object.  If omitted the entire user object is returned.
 *              Nested paths (e.g. `'profile.avatar'`) are NOT supported —
 *              extract the top-level field and destructure in the handler.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    // If a specific property key was provided, return only that field.
    // This keeps controller method signatures concise:
    //   @CurrentUser('id') userId: string
    // instead of:
    //   @CurrentUser() user: RequestUser  →  user.id
    return data ? user?.[data] : user;
  },
);
