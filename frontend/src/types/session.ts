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

export interface CalendarQueryParams {
  from?: string;
  to?: string;
  room?: string;
}

export interface CalendarSessionEntry {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  room: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  speakers: string[];
}

export interface CalendarRoomGroup {
  room: string;
  sessions: CalendarSessionEntry[];
}

export interface CalendarDayGroup {
  date: string;
  rooms: CalendarRoomGroup[];
}
