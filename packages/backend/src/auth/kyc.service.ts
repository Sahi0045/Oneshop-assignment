import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export interface KycUploadResult {
  kycId: string;
  documentUrl: string;
  status: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET', '');
    
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /**
   * Upload KYC document (ID card, passport, etc.)
   */
  async uploadDocument(
    userId: string,
    documentType: string,
    file: Express.Multer.File,
  ): Promise<KycUploadResult> {
    // Check if user already has a pending or approved KYC
    const existingKyc = await this.prisma.kYCVerification.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existingKyc) {
      throw new ConflictException(
        'You already have a KYC verification in progress or approved.',
      );
    }

    // Upload to S3
    const fileKey = `kyc/${userId}/${uuidv4()}-${file.originalname}`;
    const documentUrl = await this.uploadToS3(fileKey, file);

    // Create KYC record
    const kyc = await this.prisma.kYCVerification.create({
      data: {
        userId,
        documentType,
        documentUrl,
        status: 'PENDING',
      },
    });

    this.logger.log(`KYC document uploaded for user ${userId}: ${kyc.id}`);

    return {
      kycId: kyc.id,
      documentUrl: kyc.documentUrl,
      status: kyc.status,
    };
  }

  /**
   * Upload face image for face matching (placeholder implementation)
   */
  async uploadFaceImage(
    userId: string,
    kycId: string,
    file: Express.Multer.File,
  ): Promise<{ faceImageUrl: string; faceMatchScore: number }> {
    const kyc = await this.prisma.kYCVerification.findUnique({
      where: { id: kycId },
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found.');
    }

    if (kyc.userId !== userId) {
      throw new BadRequestException('This KYC verification does not belong to you.');
    }

    if (kyc.status !== 'PENDING') {
      throw new BadRequestException('KYC verification is not in pending state.');
    }

    // Upload face image to S3
    const fileKey = `kyc/${userId}/face-${uuidv4()}-${file.originalname}`;
    const faceImageUrl = await this.uploadToS3(fileKey, file);

    // PLACEHOLDER: Face matching logic
    // In production, integrate with AWS Rekognition, Azure Face API, or similar
    const faceMatchScore = this.simulateFaceMatch();

    // Update KYC record
    await this.prisma.kYCVerification.update({
      where: { id: kycId },
      data: {
        faceImageUrl,
        faceMatchScore,
      },
    });

    this.logger.log(
      `Face image uploaded for KYC ${kycId}, match score: ${faceMatchScore}`,
    );

    return { faceImageUrl, faceMatchScore };
  }

  /**
   * Get user's KYC status
   */
  async getKycStatus(userId: string) {
    const kyc = await this.prisma.kYCVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!kyc) {
      return {
        hasKyc: false,
        status: null,
        message: 'No KYC verification found. Please upload your documents.',
      };
    }

    return {
      hasKyc: true,
      status: kyc.status,
      documentType: kyc.documentType,
      faceMatchScore: kyc.faceMatchScore?.toNumber() || null,
      verifiedAt: kyc.verifiedAt,
      rejectionReason: kyc.rejectionReason,
      createdAt: kyc.createdAt,
    };
  }

  /**
   * Admin: Approve KYC
   */
  async approveKyc(kycId: string, adminId: string): Promise<void> {
    const kyc = await this.prisma.kYCVerification.findUnique({
      where: { id: kycId },
      include: { user: true },
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found.');
    }

    if (kyc.status !== 'PENDING') {
      throw new BadRequestException('KYC is not in pending state.');
    }

    await this.prisma.$transaction([
      this.prisma.kYCVerification.update({
        where: { id: kycId },
        data: {
          status: 'APPROVED',
          verifiedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: kyc.userId },
        data: { isKycVerified: true },
      }),
    ]);

    this.logger.log(`KYC ${kycId} approved by admin ${adminId}`);
  }

  /**
   * Admin: Reject KYC
   */
  async rejectKyc(
    kycId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const kyc = await this.prisma.kYCVerification.findUnique({
      where: { id: kycId },
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found.');
    }

    if (kyc.status !== 'PENDING') {
      throw new BadRequestException('KYC is not in pending state.');
    }

    await this.prisma.kYCVerification.update({
      where: { id: kycId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    this.logger.log(`KYC ${kycId} rejected by admin ${adminId}: ${reason}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async uploadToS3(
    key: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private',
      });

      await this.s3Client.send(command);

      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw new BadRequestException('Failed to upload file to storage.');
    }
  }

  /**
   * PLACEHOLDER: Simulate face matching
   * In production, integrate with AWS Rekognition CompareFaces API or similar
   */
  private simulateFaceMatch(): number {
    // Return a random score between 85-99 for demo purposes
    // In production, this would call a real face recognition service
    const score = 85 + Math.random() * 14;
    return Math.round(score * 100) / 100;
  }
}
