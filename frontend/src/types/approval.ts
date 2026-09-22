export interface ApprovalHistoryEntry {
  id: string;
  event: string;
  actor: string;
  previousStatus: string;
  newStatus: string;
  comment: string;
  createdAt: string;
}
