import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The email verification token received via email.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification token must not be empty.' })
  @IsUUID('4', { message: 'Invalid verification token format.' })
  token: string;
}
