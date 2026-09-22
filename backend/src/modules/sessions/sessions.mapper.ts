import type { SessionDocument } from './schemas/session.schema.js';

export interface SessionResponse {
  id: string;
  event: string;
  title: string;
  description: string;
  room: string;
  startTime: Date;
  endTime: Date;
  speakers: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toSessionResponse(session: SessionDocument): SessionResponse {
  return {
    id: session._id.toString(),
    event: session.event.toString(),
    title: session.title,
    description: session.description,
    room: session.room,
    startTime: session.startTime,
    endTime: session.endTime,
    speakers: session.speakers.map((speakerId) => speakerId.toString()),
    status: session.status,
    createdAt: (session as unknown as { createdAt: Date }).createdAt,
    updatedAt: (session as unknown as { updatedAt: Date }).updatedAt,
  };
}
