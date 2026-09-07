import { EventStatus } from '../../../types/event';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function statusTone(status: EventStatus): BadgeTone {
  switch (status) {
    case EventStatus.DRAFT:
      return 'neutral';
    case EventStatus.PLANNING:
      return 'info';
    case EventStatus.APPROVAL_PENDING:
      return 'warning';
    case EventStatus.APPROVED:
      return 'info';
    case EventStatus.LIVE:
      return 'success';
    case EventStatus.COMPLETED:
      return 'success';
    case EventStatus.ARCHIVED:
      return 'danger';
    default:
      return 'neutral';
  }
}
