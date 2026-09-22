import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';
import { TaskPriority } from '../task-enums.js';

export class CreateTaskDto {
  @ApiProperty({ example: 'Confirm catering headcount' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ example: 'Call the vendor to lock the final number', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Optional session this task is scoped to' })
  @IsOptional()
  @IsMongoId()
  session?: string;

  @ApiProperty({ required: false, description: 'Operations Member user id' })
  @IsOptional()
  @IsMongoId()
  assignee?: string;

  @ApiProperty({ enum: TaskPriority, required: false, default: TaskPriority.P3 })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ example: '2026-10-05T17:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
