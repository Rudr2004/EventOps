export const SessionStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  [SessionStatus.SCHEDULED]: 'Scheduled',
  [SessionStatus.IN_PROGRESS]: 'In Progress',
  [SessionStatus.COMPLETED]: 'Completed',
  [SessionStatus.CANCELLED]: 'Cancelled',
};

export interface SessionItem {
  id: string;
  event: string;
  title: string;
  description: string;
  room: string;
  startTime: string;
  endTime: string;
  speakers: string[];
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionPayload {
  title: string;
  description?: string;
  room: string;
  startTime: string;
  endTime: string;
  speakers?: string[];
}

export type UpdateSessionPayload = Partial<CreateSessionPayload>;
