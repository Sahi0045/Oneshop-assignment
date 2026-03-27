import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'The refresh token previously issued by the server (via login or register). ' +
      'Pass this as a Bearer token in the Authorization header when using the ' +
      'jwt-refresh strategy, or include it in the request body as a fallback.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token must not be empty.' })
  refreshToken: string;
}
