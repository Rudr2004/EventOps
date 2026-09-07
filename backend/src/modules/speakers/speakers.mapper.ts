import type { SpeakerDocument } from './schemas/speaker.schema.js';

export interface SpeakerResponse {
  id: string;
  name: string;
  title: string;
  bio: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toSpeakerResponse(speaker: SpeakerDocument): SpeakerResponse {
  return {
    id: speaker._id.toString(),
    name: speaker.name,
    title: speaker.title,
    bio: speaker.bio,
    email: speaker.email,
    createdAt: (speaker as unknown as { createdAt: Date }).createdAt,
    updatedAt: (speaker as unknown as { updatedAt: Date }).updatedAt,
  };
}
