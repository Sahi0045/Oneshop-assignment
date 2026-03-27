import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  NATIONAL_ID = 'NATIONAL_ID',
  RESIDENCE_PERMIT = 'RESIDENCE_PERMIT',
}

export class UploadKycDto {
  @ApiProperty({
    description: 'Type of identity document being uploaded',
    enum: DocumentType,
    example: DocumentType.PASSPORT,
  })
  @IsEnum(DocumentType, { message: 'Invalid document type' })
  @IsNotEmpty()
  documentType: DocumentType;
}
