import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveEventDto {
  @ApiProperty({ example: 'Looks good, approved for the venue booking.', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
