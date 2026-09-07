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

/**
 * Ordinary lifecycle transitions reachable via PATCH /events/:id/status.
 * Planning->ApprovalPending, ApprovalPending->Approved and
 * ApprovalPending->Planning are approval-specific and only available via
 * the dedicated submit/approve/reject actions (see the approvals feature).
 */
export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.PLANNING],
  [EventStatus.PLANNING]: [],
  [EventStatus.APPROVAL_PENDING]: [],
  [EventStatus.APPROVED]: [EventStatus.LIVE],
  [EventStatus.LIVE]: [EventStatus.COMPLETED],
  [EventStatus.COMPLETED]: [EventStatus.ARCHIVED],
  [EventStatus.ARCHIVED]: [],
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

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  venue: string;
  startDate: string;
  endDate: string;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface EventsQueryParams {
  page?: number;
  limit?: number;
  status?: EventStatus;
  search?: string;
  owner?: string;
  startDateFrom?: string;
  startDateTo?: string;
}
