import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    try {
      const { id, emails, displayName, photos, username } = profile;

      // GitHub may not always provide email in the profile
      const email = emails?.[0]?.value;
      if (!email) {
        this.logger.warn(`GitHub OAuth: No email found for profile ${id}`);
        return done(new Error('No email found in GitHub profile'), null);
      }

      // Parse display name or use username
      const nameParts = displayName ? displayName.split(' ') : [username];
      const firstName = nameParts[0] || username;
      const lastName = nameParts.slice(1).join(' ') || '';

      const userProfile = {
        id,
        email,
        firstName,
        lastName,
        avatar: photos?.[0]?.value || null,
        provider: 'github',
      };

      const user = await this.authService.handleOAuthUser(userProfile);
      
      this.logger.log(`GitHub OAuth successful for user: ${user.email}`);
      done(null, user);
    } catch (error) {
      this.logger.error('GitHub OAuth validation error', error);
      done(error, null);
    }
  }
}
