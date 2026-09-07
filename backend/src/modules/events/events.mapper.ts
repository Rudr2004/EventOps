import type { EventDocument } from './schemas/event.schema.js';

export interface EventResponse {
  id: string;
  name: string;
  description: string;
  venue: string;
  startDate: Date;
  endDate: Date;
  owner: string;
  status: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toEventResponse(event: EventDocument): EventResponse {
  return {
    id: event._id.toString(),
    name: event.name,
    description: event.description,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    owner: event.owner.toString(),
    status: event.status,
    isArchived: event.isArchived,
    createdAt: (event as unknown as { createdAt: Date }).createdAt,
    updatedAt: (event as unknown as { updatedAt: Date }).updatedAt,
  };
}
