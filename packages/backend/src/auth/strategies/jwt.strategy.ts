import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface RequestUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'fallback-secret'),
      issuer: 'freelancer-platform',
      audience: 'freelancer-platform-users',
    });
  }

  /**
   * Called automatically by Passport after the token signature has been
   * verified and the expiry has been checked.  Whatever we return here is
   * attached to `request.user` by Passport.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const { sub: id, email, role } = payload;

    // Lightweight existence check — keeps sessions invalidatable via DB soft-delete / ban
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isEmailVerified: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
