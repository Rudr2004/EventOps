import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { IncidentSeverity } from '../incident-enums.js';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Main stage sound system failure' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ example: 'Audio cut out mid-keynote, backup mics not working', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Optional session this incident occurred during' })
  @IsOptional()
  @IsMongoId()
  session?: string;

  @ApiProperty({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiProperty({ required: false, description: 'Operations Member user id' })
  @IsOptional()
  @IsMongoId()
  assignee?: string;
}
