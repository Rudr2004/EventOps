import type { EventStatusHistoryDocument } from '../events/schemas/event-status-history.schema.js';

export interface ApprovalHistoryEntryResponse {
  id: string;
  event: string;
  actor: string;
  previousStatus: string;
  newStatus: string;
  comment: string;
  createdAt: Date;
}

export function toApprovalHistoryResponse(
  entry: EventStatusHistoryDocument,
): ApprovalHistoryEntryResponse {
  return {
    id: entry._id.toString(),
    event: entry.event.toString(),
    actor: entry.actor.toString(),
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    comment: entry.comment,
    createdAt: (entry as unknown as { createdAt: Date }).createdAt,
  };
}
