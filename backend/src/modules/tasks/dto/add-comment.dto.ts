import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({ example: 'Vendor confirmed 250 headcount.' })
  @IsString()
  @MinLength(1)
  text: string;
}
