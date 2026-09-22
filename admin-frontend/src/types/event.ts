export const EventStatus = {
  DRAFT: 'draft',
  PLANNING: 'planning',
  APPROVAL_PENDING: 'approval_pending',
  APPROVED: 'approved',
  LIVE: 'live',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  [EventStatus.DRAFT]: 'Draft',
  [EventStatus.PLANNING]: 'Planning',
  [EventStatus.APPROVAL_PENDING]: 'Approval Pending',
  [EventStatus.APPROVED]: 'Approved',
  [EventStatus.LIVE]: 'Live',
  [EventStatus.COMPLETED]: 'Completed',
  [EventStatus.ARCHIVED]: 'Archived',
};

export interface EventItem {
  id: string;
  name: string;
  description: string;
  venue: string;
  startDate: string;
  endDate: string;
  owner: string;
  status: EventStatus;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}
