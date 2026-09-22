import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { TaskPriority, TaskStatus } from '../task-enums.js';

export class QueryTasksDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event id' })
  @IsOptional()
  @IsMongoId()
  event?: string;

  @ApiPropertyOptional({ description: 'Filter by assignee user id' })
  @IsOptional()
  @IsMongoId()
  assignee?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Only tasks due on or after this date' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Only tasks due on or before this date' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter to only overdue tasks (true) or non-overdue (false)' })
  @IsOptional()
  @IsBooleanString()
  overdue?: string;
}
