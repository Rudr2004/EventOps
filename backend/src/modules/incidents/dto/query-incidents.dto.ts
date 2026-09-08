import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { IncidentSeverity, IncidentStatus } from '../incident-enums.js';

export class QueryIncidentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event id' })
  @IsOptional()
  @IsMongoId()
  event?: string;

  @ApiPropertyOptional({ description: 'Filter by assignee user id' })
  @IsOptional()
  @IsMongoId()
  assignee?: string;

  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;
}
