import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: false,
    });
  }

  /**
   * Called automatically by Passport when the 'local' strategy is invoked.
   * Passport extracts `email` and `password` from the request body and passes
   * them here.  We delegate credential validation to AuthService.
   *
   * Whatever is returned from this method is attached to `request.user`.
   * Throwing an exception causes Passport to respond with 401 Unauthorized.
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials. Please check your email and password.',
      );
    }

    return user;
  }
}
