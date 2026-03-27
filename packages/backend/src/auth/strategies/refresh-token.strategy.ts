import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET', 'fallback-refresh-secret'),
      issuer: 'freelancer-platform',
      audience: 'freelancer-platform-users',
      passReqToCallback: true,
    });
  }

  /**
   * Called by Passport after the refresh token signature has been verified.
   * We attach the raw refresh token to the returned object so that
   * AuthService.refreshTokens() can compare it against the hash stored in Redis
   * (token-rotation / reuse-detection pattern).
   *
   * Whatever we return here is available as `request.user` in the controller.
   */
  async validate(req: Request, payload: JwtRefreshPayload) {
    // Extract the raw Bearer token from the Authorization header
    const authHeader = req.get('Authorization') ?? '';
    const refreshToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken, // raw token — will be compared against the Redis hash
    };
  }
}
