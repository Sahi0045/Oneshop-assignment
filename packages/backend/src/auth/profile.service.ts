import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate profile completeness score (0-100)
   * 
   * Scoring breakdown:
   * - Email verified: 15 points
   * - KYC verified: 20 points
   * - Bio filled: 10 points
   * - Avatar uploaded: 10 points
   * - Hourly rate set: 10 points
   * - At least 3 skills: 15 points
   * - First & last name: 10 points each (20 total)
   */
  async calculateProfileCompleteness(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let score = 0;

    // Email verified (15 points)
    if (user.isEmailVerified) score += 15;

    // KYC verified (20 points)
    if (user.isKycVerified) score += 20;

    // Bio filled (10 points)
    if (user.bio && user.bio.length >= 50) score += 10;

    // Avatar uploaded (10 points)
    if (user.avatar) score += 10;

    // Hourly rate set (10 points)
    if (user.hourlyRate && user.hourlyRate.toNumber() > 0) score += 10;

    // At least 3 skills (15 points)
    if (user.skills.length >= 3) score += 15;

    // First name (10 points)
    if (user.firstName && user.firstName.length >= 2) score += 10;

    // Last name (10 points)
    if (user.lastName && user.lastName.length >= 2) score += 10;

    return score;
  }

  /**
   * Update user profile and recalculate completeness
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { skillIds, ...profileData } = dto;

    // Update basic profile data
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: profileData,
    });

    // Update skills if provided
    if (skillIds && skillIds.length > 0) {
      // Remove existing skills
      await this.prisma.userSkill.deleteMany({
        where: { userId },
      });

      // Add new skills
      await this.prisma.userSkill.createMany({
        data: skillIds.map((skillId) => ({
          userId,
          skillId,
        })),
        skipDuplicates: true,
      });
    }

    // Recalculate profile completeness
    const completeness = await this.calculateProfileCompleteness(userId);

    // Update completeness score
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileCompleteness: completeness },
    });

    this.logger.log(
      `Profile updated for user ${userId}, completeness: ${completeness}%`,
    );

    return {
      ...user,
      profileCompleteness: completeness,
    };
  }

  /**
   * Get profile completeness with suggestions
   */
  async getProfileCompleteness(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const score = await this.calculateProfileCompleteness(userId);

    // Generate suggestions for incomplete items
    const suggestions: string[] = [];

    if (!user.isEmailVerified) {
      suggestions.push('Verify your email address');
    }
    if (!user.isKycVerified) {
      suggestions.push('Complete KYC verification');
    }
    if (!user.bio || user.bio.length < 50) {
      suggestions.push('Add a detailed bio (at least 50 characters)');
    }
    if (!user.avatar) {
      suggestions.push('Upload a profile picture');
    }
    if (!user.hourlyRate || user.hourlyRate.toNumber() === 0) {
      suggestions.push('Set your hourly rate');
    }
    if (user.skills.length < 3) {
      suggestions.push(`Add ${3 - user.skills.length} more skill(s)`);
    }
    if (!user.firstName || user.firstName.length < 2) {
      suggestions.push('Add your first name');
    }
    if (!user.lastName || user.lastName.length < 2) {
      suggestions.push('Add your last name');
    }

    return {
      score,
      isComplete: score === 100,
      suggestions,
      breakdown: {
        emailVerified: user.isEmailVerified ? 15 : 0,
        kycVerified: user.isKycVerified ? 20 : 0,
        bioFilled: user.bio && user.bio.length >= 50 ? 10 : 0,
        avatarUploaded: user.avatar ? 10 : 0,
        hourlyRateSet: user.hourlyRate && user.hourlyRate.toNumber() > 0 ? 10 : 0,
        skillsAdded: user.skills.length >= 3 ? 15 : 0,
        firstNameSet: user.firstName && user.firstName.length >= 2 ? 10 : 0,
        lastNameSet: user.lastName && user.lastName.length >= 2 ? 10 : 0,
      },
    };
  }

  /**
   * Upload avatar
   */
  async updateAvatar(userId: string, avatarUrl: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    // Recalculate completeness
    const completeness = await this.calculateProfileCompleteness(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileCompleteness: completeness },
    });

    this.logger.log(`Avatar updated for user ${userId}`);

    return { avatarUrl, profileCompleteness: completeness };
  }
}
