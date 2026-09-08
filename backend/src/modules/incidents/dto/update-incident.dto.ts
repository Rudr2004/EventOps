import { PartialType } from '@nestjs/swagger';
import { CreateIncidentDto } from './create-incident.dto.js';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {}
