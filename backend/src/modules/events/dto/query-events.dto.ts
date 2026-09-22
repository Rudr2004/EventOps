import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { EventStatus } from '../event-status.enum.js';

export class QueryEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Owner user id' })
  @IsOptional()
  @IsMongoId()
  owner?: string;

  @ApiPropertyOptional({ description: 'Free-text search across name, description and venue' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Only events starting on or after this date' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ description: 'Only events starting on or before this date' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;
}
