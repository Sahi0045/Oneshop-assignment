import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import sgMail from '@sendgrid/mail';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatar: string | null;
    isEmailVerified: boolean;
  };
}

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const EMAIL_VERIFY_PREFIX = 'email_verify:';
const PASSWORD_RESET_PREFIX = 'password_reset:';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60;       // 24 hours
const PASSWORD_RESET_TTL_SECONDS = 15 * 60;          // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendgridKey) {
      sgMail.setApiKey(sendgridKey);
    }
  }

  // ─── Profile Completeness Helper ─────────────────────────────────────────────

  private async updateProfileCompleteness(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true },
    });

    if (!user) return;

    let score = 0;
    if (user.isEmailVerified) score += 15;
    if (user.isKycVerified) score += 20;
    if (user.bio && user.bio.length >= 50) score += 10;
    if (user.avatar) score += 10;
    if (user.hourlyRate && user.hourlyRate.toNumber() > 0) score += 10;
    if (user.skills.length >= 3) score += 15;
    if (user.firstName && user.firstName.length >= 2) score += 10;
    if (user.lastName && user.lastName.length >= 2) score += 10;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileCompleteness: score },
    });
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResult> {
    const { email, password, firstName, lastName, role } = dto;

    // Check for duplicate email
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user inside a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role,
          isEmailVerified: false,
        },
      });
      return newUser;
    });

    // Send verification email (non-blocking)
    this.sendVerificationEmail(user).catch((err) =>
      this.logger.error('Failed to send verification email', err),
    );

    // Calculate initial profile completeness
    this.updateProfileCompleteness(user.id).catch((err) =>
      this.logger.error('Failed to update profile completeness', err),
    );

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(user: any): Promise<AuthResult> {
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  // ─── Refresh Tokens ──────────────────────────────────────────────────────────

  async refreshTokens(userId: string, incomingRefreshToken: string): Promise<AuthTokens> {
    const storedHash = await this.redisService.get(`${REFRESH_TOKEN_PREFIX}${userId}`);

    if (!storedHash) {
      throw new UnauthorizedException('Refresh token not found. Please log in again.');
    }

    const isValid = await bcrypt.compare(incomingRefreshToken, storedHash);
    if (!isValid) {
      // Possible token reuse attack — invalidate all sessions for this user
      await this.redisService.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
      throw new UnauthorizedException('Invalid refresh token. All sessions have been invalidated.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    return tokens;
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.redisService.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
    this.logger.log(`User ${userId} logged out — refresh token invalidated.`);
  }

  // ─── Email Verification ──────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redisService.get(`${EMAIL_VERIFY_PREFIX}${token}`);

    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isEmailVerified) {
      // Idempotent — just clean up Redis and return
      await this.redisService.del(`${EMAIL_VERIFY_PREFIX}${token}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    await this.redisService.del(`${EMAIL_VERIFY_PREFIX}${token}`);
    
    // Update profile completeness after email verification
    this.updateProfileCompleteness(userId).catch((err) =>
      this.logger.error('Failed to update profile completeness', err),
    );
    
    this.logger.log(`Email verified for user ${userId}`);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    if (user.isEmailVerified) {
      throw new ConflictException('This email address has already been verified.');
    }

    await this.sendVerificationEmail(user);
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always resolve — do not reveal whether the email exists
    if (!user) {
      this.logger.log(`Forgot password requested for non-existent email: ${email}`);
      return;
    }

    const token = uuidv4();
    const redisKey = `${PASSWORD_RESET_PREFIX}${token}`;

    await this.redisService.setex(redisKey, PASSWORD_RESET_TTL_SECONDS, user.id);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

    await this.sendEmail({
      to: user.email,
      subject: 'Reset your Freelancer Platform password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.firstName},</p>
          <p>We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </p>
          <p>If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">This link expires in 15 minutes. If it has expired, please request a new one.</p>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  // ─── Reset Password ──────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const redisKey = `${PASSWORD_RESET_PREFIX}${token}`;
    const userId = await this.redisService.get(redisKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate the reset token and all existing sessions
    await Promise.all([
      this.redisService.del(redisKey),
      this.redisService.del(`${REFRESH_TOKEN_PREFIX}${userId}`),
    ]);

    this.logger.log(`Password reset completed for user ${userId}`);
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: true,
        _count: {
          select: {
            projectsAsClient: true,
            bids: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const { passwordHash, ...safeUser } = user as any;
    return safeUser;
  }

  // ─── Validate User (LocalStrategy) ──────────────────────────────────────────

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    // OAuth-only users have no password hash
    if (!user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    const { passwordHash, ...result } = user as any;
    return result;
  }

  // ─── Handle OAuth User ────────────────────────────────────────────────────────

  async handleOAuthUser(profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    provider: string;
  }): Promise<any> {
    const { email, firstName, lastName, avatar, provider, id: providerId } = profile;

    // Look up by provider account first
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          // If you store provider IDs in a separate table, extend here
        ],
      },
    });

    if (user) {
      // Update avatar/name if changed on the OAuth provider side
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: user.firstName || firstName,
          lastName: user.lastName || lastName,
          avatar: user.avatar || avatar,
          isEmailVerified: true, // OAuth emails are pre-verified
        },
      });
    } else {
      // Create a new user for this OAuth account
      user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          role: 'CLIENT', // Default role; user can switch in onboarding
          isEmailVerified: true,
          passwordHash: null,
        },
      });

      this.logger.log(`New OAuth user created via ${provider}: ${user.id}`);
    }

    const { passwordHash, ...safeUser } = user as any;
    return safeUser;
  }

  // ─── Token Generation ────────────────────────────────────────────────────────

  async generateTokens(user: { id: string; email: string; role: string }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'fallback-secret');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'fallback-refresh-secret');
    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const jwtRefreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
        issuer: 'freelancer-platform',
        audience: 'freelancer-platform-users',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: jwtRefreshExpiresIn,
        issuer: 'freelancer-platform',
        audience: 'freelancer-platform-users',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // ─── Send Verification Email ─────────────────────────────────────────────────

  async sendVerificationEmail(user: { id: string; email: string; firstName: string }): Promise<void> {
    const token = uuidv4();
    const redisKey = `${EMAIL_VERIFY_PREFIX}${token}`;

    await this.redisService.setex(redisKey, EMAIL_VERIFY_TTL_SECONDS, user.id);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verifyLink = `${frontendUrl}/auth/verify-email?token=${token}`;

    await this.sendEmail({
      to: user.email,
      subject: 'Verify your Freelancer Platform email address',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Freelancer Platform!</h2>
          <p>Hi ${user.firstName},</p>
          <p>Thanks for registering. Please verify your email address by clicking the button below. This link expires in <strong>24 hours</strong>.</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${verifyLink}"
               style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Verify Email Address
            </a>
          </p>
          <p>If you did not create an account, please ignore this email.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `,
    });

    this.logger.log(`Verification email sent to ${user.email}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.redisService.setex(
      `${REFRESH_TOKEN_PREFIX}${userId}`,
      REFRESH_TOKEN_TTL_SECONDS,
      hash,
    );
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar ?? null,
      isEmailVerified: user.isEmailVerified ?? false,
    };
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const fromEmail = this.configService.get<string>(
      'SENDGRID_FROM_EMAIL',
      'noreply@freelancerplatform.com',
    );
    const fromName = this.configService.get<string>(
      'SENDGRID_FROM_NAME',
      'Freelancer Platform',
    );

    try {
      await sgMail.send({
        to: options.to,
        from: { email: fromEmail, name: fromName },
        subject: options.subject,
        html: options.html,
      });
    } catch (err) {
      this.logger.error(`SendGrid error sending to ${options.to}`, err?.response?.body ?? err);
      // Do not rethrow — email failures should not break the auth flow
    }
  }
}
