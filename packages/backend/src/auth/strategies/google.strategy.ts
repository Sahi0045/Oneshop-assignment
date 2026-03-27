import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, emails, name, photos } = profile;

      const email = emails?.[0]?.value;
      if (!email) {
        this.logger.warn(`Google OAuth: No email found for profile ${id}`);
        return done(new Error('No email found in Google profile'), null);
      }

      const userProfile = {
        id,
        email,
        firstName: name?.givenName || '',
        lastName: name?.familyName || '',
        avatar: photos?.[0]?.value || null,
        provider: 'google',
      };

      const user = await this.authService.handleOAuthUser(userProfile);
      
      this.logger.log(`Google OAuth successful for user: ${user.email}`);
      done(null, user);
    } catch (error) {
      this.logger.error('Google OAuth validation error', error);
      done(error, null);
    }
  }
}
