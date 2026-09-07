export interface Speaker {
  id: string;
  name: string;
  title: string;
  bio: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerPayload {
  name: string;
  title?: string;
  bio?: string;
  email?: string;
}

export type UpdateSpeakerPayload = Partial<CreateSpeakerPayload>;
