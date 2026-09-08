import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Scope the analytics to a single event. Event Managers are always scoped to their own events regardless of this value.',
  })
  @IsOptional()
  @IsMongoId()
  event?: string;
}
