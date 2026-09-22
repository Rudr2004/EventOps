import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Tech Summit' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'A gathering of industry leaders', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Grand Convention Center' })
  @IsString()
  @MinLength(2)
  venue: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-10-03T18:00:00.000Z' })
  @IsDateString()
  endDate: string;
}
