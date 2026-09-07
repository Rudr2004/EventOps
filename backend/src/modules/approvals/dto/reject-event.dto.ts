import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectEventDto {
  @ApiProperty({ example: 'Budget line item for catering is missing.' })
  @IsString()
  @MinLength(3)
  reason: string;
}
