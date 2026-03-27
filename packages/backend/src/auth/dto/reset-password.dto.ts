import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The password reset token received via email.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reset token must not be empty.' })
  token: string;

  @ApiProperty({
    description:
      'New password. Must be at least 8 characters and contain at least one uppercase letter, ' +
      'one lowercase letter, one digit, and one special character.',
    example: 'NewSecurePass456!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, ' +
      'one number, and one special character.',
  })
  newPassword: string;
}
