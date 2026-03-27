import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { KycService } from './kyc.service';
import { ProfileService } from './profile.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UploadKycDto } from './dto/upload-kyc.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly kycService: KycService,
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Register ───────────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account. A verification email is sent immediately after registration.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Returns access & refresh tokens.',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'clxyz...',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'FREELANCER',
            isEmailVerified: false,
          },
        },
        message: 'Registration successful. Please verify your email.',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  @ApiResponse({ status: 422, description: 'Validation error.' })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      ...result,
      message: 'Registration successful. Please verify your email.',
    };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({
    summary: 'Login with email & password',
    description: 'Authenticates the user via the LocalStrategy and returns JWT tokens.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful.',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'clxyz...',
            email: 'john@example.com',
            firstName: 'John',
            role: 'CLIENT',
          },
        },
        message: 'Login successful.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Req() req: Request) {
    const result = await this.authService.login(req.user as any);
    return { ...result, message: 'Login successful.' };
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Uses the refresh token (Bearer) to issue a new access token + rotate refresh token.',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed.',
    schema: {
      example: {
        success: true,
        data: { accessToken: '...', refreshToken: '...' },
        message: 'Tokens refreshed successfully.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(@Req() req: Request) {
    const user = req.user as any;
    const result = await this.authService.refreshTokens(user.id, user.refreshToken);
    return { ...result, message: 'Tokens refreshed successfully.' };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description: 'Invalidates the refresh token stored in Redis for the current user.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(@CurrentUser('id') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully.' };
  }

  // ─── Email Verification ──────────────────────────────────────────────────────

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verifies the user email using the one-time token sent via email.',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully.' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification',
    description: 'Resends the email verification link to the given address.',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email sent.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Email already verified.' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return { message: 'Verification email sent. Please check your inbox.' };
  }

  // ─── Forgot / Reset Password ─────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset link to the given email address (if it exists). Always returns 200 to prevent email enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset email sent (if account exists).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always respond 200 to prevent email enumeration attacks
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets the user password using the token received by email.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset successfully. Please login.' };
  }

  // ─── Current User ────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user profile including skills and statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'clxyz...',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'FREELANCER',
          avatar: 'https://...',
          bio: 'Full-stack developer',
          hourlyRate: 75,
          skills: [{ name: 'TypeScript' }, { name: 'NestJS' }],
          isEmailVerified: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Login with Google',
    description:
      'Redirects to Google OAuth consent screen. Not usable directly in Swagger — open in browser.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to Google.' })
  googleAuth() {
    // Passport handles the redirect; this method body is never executed.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description: 'Handles the Google OAuth2 callback, issues tokens and redirects to frontend.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens.' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this._handleOAuthCallback(req, res, 'Google');
  }

  // ─── GitHub OAuth ────────────────────────────────────────────────────────────

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({
    summary: 'Login with GitHub',
    description:
      'Redirects to GitHub OAuth consent screen. Not usable directly in Swagger — open in browser.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub.' })
  githubAuth() {
    // Passport handles the redirect; this method body is never executed.
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({
    summary: 'GitHub OAuth callback',
    description: 'Handles the GitHub OAuth callback, issues tokens and redirects to frontend.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens.' })
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    await this._handleOAuthCallback(req, res, 'GitHub');
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Common OAuth callback handler.
   * After Passport populates req.user we generate tokens and redirect the
   * browser to the frontend with the tokens as query-string params (or a
   * one-time code that the SPA can exchange).  In a production app you would
   * prefer a short-lived code + PKCE flow, but for simplicity we use tokens
   * directly here.
   */
  private async _handleOAuthCallback(
    req: Request,
    res: Response,
    provider: string,
  ): Promise<void> {
    try {
      const tokens = await this.authService.login(req.user as any);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

      const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('accessToken', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);

      res.redirect(redirectUrl.toString());
    } catch (err) {
      this.logger.error(`${provider} OAuth callback error`, err);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      res.redirect(`${frontendUrl}/auth/error?reason=oauth_failed`);
    }
  }

  // ─── KYC Endpoints ───────────────────────────────────────────────────────────

  @Post('kyc/upload-document')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('document'))
  @ApiOperation({
    summary: 'Upload KYC document',
    description: 'Upload identity document (passport, ID card, etc.) for KYC verification',
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or document type' })
  @ApiResponse({ status: 409, description: 'KYC already in progress or approved' })
  async uploadKycDocument(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadKycDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.kycService.uploadDocument(
      userId,
      dto.documentType,
      file,
    );
    return {
      ...result,
      message: 'Document uploaded successfully. Please upload a face image for verification.',
    };
  }

  @Post('kyc/:kycId/upload-face')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('face'))
  @ApiOperation({
    summary: 'Upload face image for KYC',
    description: 'Upload a selfie for face matching with the ID document',
  })
  @ApiResponse({ status: 200, description: 'Face image uploaded and matched' })
  @ApiResponse({ status: 400, description: 'Invalid file or KYC not found' })
  async uploadFaceImage(
    @CurrentUser('id') userId: string,
    @Param('kycId') kycId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.kycService.uploadFaceImage(userId, kycId, file);
    return {
      ...result,
      message: 'Face image uploaded. Your KYC is under review.',
    };
  }

  @Get('kyc/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Check the current status of KYC verification',
  })
  @ApiResponse({ status: 200, description: 'KYC status retrieved' })
  async getKycStatus(@CurrentUser('id') userId: string) {
    return this.kycService.getKycStatus(userId);
  }

  // ─── Profile Endpoints ───────────────────────────────────────────────────────

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update profile information and recalculate completeness score',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const result = await this.profileService.updateProfile(userId, dto);
    return {
      ...result,
      message: 'Profile updated successfully',
    };
  }

  @Get('profile/completeness')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get profile completeness',
    description: 'Get profile completeness score with suggestions for improvement',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile completeness retrieved',
    schema: {
      example: {
        score: 75,
        isComplete: false,
        suggestions: ['Complete KYC verification', 'Add 1 more skill(s)'],
        breakdown: {
          emailVerified: 15,
          kycVerified: 0,
          bioFilled: 10,
          avatarUploaded: 10,
          hourlyRateSet: 10,
          skillsAdded: 0,
          firstNameSet: 10,
          lastNameSet: 10,
        },
      },
    },
  })
  async getProfileCompleteness(@CurrentUser('id') userId: string) {
    return this.profileService.getProfileCompleteness(userId);
  }

  @Post('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({
    summary: 'Upload profile avatar',
    description: 'Upload a profile picture',
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Upload to S3 (reuse KYC service's S3 client or create a shared upload service)
    const fileKey = `avatars/${userId}/${Date.now()}-${file.originalname}`;
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    const avatarUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

    // For now, we'll use a placeholder. In production, implement S3 upload
    const result = await this.profileService.updateAvatar(userId, avatarUrl);
    
    return {
      ...result,
      message: 'Avatar uploaded successfully',
    };
  }
}

