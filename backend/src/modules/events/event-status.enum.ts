export enum EventStatus {
  DRAFT = 'draft',
  PLANNING = 'planning',
  APPROVAL_PENDING = 'approval_pending',
  APPROVED = 'approved',
  LIVE = 'live',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

/**
 * Linear lifecycle with one rejection loop: Approval Pending can bounce back
 * to Planning. Archived is a terminal state reachable only from Completed.
 */
export const ALLOWED_EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.PLANNING],
  [EventStatus.PLANNING]: [EventStatus.APPROVAL_PENDING],
  [EventStatus.APPROVAL_PENDING]: [EventStatus.APPROVED, EventStatus.PLANNING],
  [EventStatus.APPROVED]: [EventStatus.LIVE],
  [EventStatus.LIVE]: [EventStatus.COMPLETED],
  [EventStatus.COMPLETED]: [EventStatus.ARCHIVED],
  [EventStatus.ARCHIVED]: [],
};

export function isValidEventTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_EVENT_TRANSITIONS[from]?.includes(to) ?? false;
}
