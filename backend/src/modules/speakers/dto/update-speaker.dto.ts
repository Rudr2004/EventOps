import { PartialType } from '@nestjs/swagger';
import { CreateSpeakerDto } from './create-speaker.dto.js';

export class UpdateSpeakerDto extends PartialType(CreateSpeakerDto) {}
