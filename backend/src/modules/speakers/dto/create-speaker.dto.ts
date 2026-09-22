import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateSpeakerDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'Principal Engineer, Acme Corp', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Ada has 15 years of experience in...', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'ada@example.com', required: false })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  email?: string;
}
