import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Field to sort by. Each endpoint documents its own allowed values.' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

/**
 * Resolves a requested sortBy against a module's whitelist of sortable
 * fields, falling back to defaultField when absent or not allowed — list
 * endpoints must never sort by an arbitrary, potentially unindexed field.
 */
export function resolveSortField(
  requested: string | undefined,
  allowedFields: readonly string[],
  defaultField: string,
): string {
  if (requested && allowedFields.includes(requested)) {
    return requested;
  }
  return defaultField;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
