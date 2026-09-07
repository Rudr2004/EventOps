import { PartialType } from '@nestjs/swagger';
import { CreateSessionDto } from './create-session.dto.js';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}
