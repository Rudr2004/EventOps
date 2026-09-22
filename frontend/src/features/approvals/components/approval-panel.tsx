import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../../../api/approvals.api';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { EVENT_STATUS_LABELS, EventStatus, type EventItem } from '../../../types/event';
import { statusTone } from '../../events/utils/status-tone';

interface ApprovalPanelProps {
  event: EventItem;
  isOwner: boolean;
}

export function ApprovalPanel({ event, isOwner }: ApprovalPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const historyQuery = useQuery({
    queryKey: ['approval-history', event.id],
    queryFn: () => approvalsApi.getHistory(event.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['approval-history', event.id] });
  };

  const submitMutation = useMutation({
    mutationFn: () => approvalsApi.submit(event.id),
    onSuccess: invalidate,
  });

  const approveMutation = useMutation({
    mutationFn: () => approvalsApi.approve(event.id),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => approvalsApi.reject(event.id, reason),
    onSuccess: () => {
      setIsRejectOpen(false);
      setRejectReason('');
      invalidate();
    },
  });

  const canSubmit = isOwner && user?.role === Role.EVENT_MANAGER && event.status === EventStatus.PLANNING;
  const canDecide = user?.role === Role.ADMIN && event.status === EventStatus.APPROVAL_PENDING;

  const activeError =
    submitMutation.error ?? approveMutation.error ?? rejectMutation.error;

  return (
    <section className="approval-panel">
      <div className="page-header">
        <h2>Approval</h2>
        <Badge tone={statusTone(event.status)}>{EVENT_STATUS_LABELS[event.status]}</Badge>
      </div>

      {activeError && <Alert message={extractErrorMessage(activeError)} />}

      {(canSubmit || canDecide) && (
        <div className="approval-actions">
          {canSubmit && (
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
            </button>
          )}
          {canDecide && (
            <>
              <button
                type="button"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setIsRejectOpen(true)}
                disabled={rejectMutation.isPending}
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}

      <div className="approval-history">
        <h3>History</h3>
        {historyQuery.isLoading && <p className="task-activity-empty">Loading history…</p>}
        {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 && (
          <p className="task-activity-empty">No status changes yet.</p>
        )}
        {!historyQuery.isLoading && historyQuery.data && historyQuery.data.length > 0 && (
          <ul className="task-activity-list">
            {[...historyQuery.data].reverse().map((entry) => (
              <li key={entry.id}>
                <span className="task-activity-action">
                  {EVENT_STATUS_LABELS[entry.previousStatus as EventStatus] ?? entry.previousStatus} →{' '}
                  {EVENT_STATUS_LABELS[entry.newStatus as EventStatus] ?? entry.newStatus}
                </span>
                {entry.comment && <span className="task-activity-detail"> · {entry.comment}</span>}
                <span className="task-activity-time">{new Date(entry.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={isRejectOpen} title="Reject Event" onClose={() => setIsRejectOpen(false)}>
        <div className="event-form">
          <div className="form-field">
            <label htmlFor="reject-reason">Reason</label>
            <textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain what needs to change before resubmitting…"
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={rejectMutation.isPending || rejectReason.trim().length < 3}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
