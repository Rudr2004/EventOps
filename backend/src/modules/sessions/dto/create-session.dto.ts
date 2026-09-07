import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsDateString, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'Opening Keynote' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ example: 'Kicking off the summit', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Main Hall' })
  @IsString()
  @MinLength(1)
  room: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ type: [String], required: false, example: [] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  speakers?: string[];
}
