import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { eventsApi } from '../../../api/events.api';
import { approvalsApi } from '../../../api/approvals.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { EventStatus, type EventItem } from '../../../types/event';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const pendingQuery = useQuery({
    queryKey: ['events', 'approval-queue'],
    queryFn: () => eventsApi.list({ page: 1, limit: 100, status: EventStatus.APPROVAL_PENDING }),
  });

  const historyQuery = useQuery({
    queryKey: ['approval-history', selectedEvent?.id],
    queryFn: () => approvalsApi.getHistory(selectedEvent!.id),
    enabled: Boolean(selectedEvent),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events', 'approval-queue'] });
    setSelectedEvent(null);
    setIsRejecting(false);
    setRejectReason('');
  };

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => approvalsApi.approve(eventId),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { eventId: string; reason: string }) =>
      approvalsApi.reject(vars.eventId, vars.reason),
    onSuccess: invalidate,
  });

  const pendingEvents = pendingQuery.data?.items ?? [];

  return (
    <motion.div
      className="approvals-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Approval queue</h1>
      </div>
      <p className="task-board-hint">Every event across the organization currently awaiting a decision.</p>

      {pendingQuery.isLoading && <LoadingState label="Loading queue…" />}
      {pendingQuery.isError && <ErrorState message="Could not load the approval queue." />}
      {!pendingQuery.isLoading && !pendingQuery.isError && pendingEvents.length === 0 && (
        <EmptyState message="Nothing waiting on a decision right now." />
      )}

      {pendingEvents.length > 0 && (
        <div className="approval-queue-list">
          {pendingEvents.map((event) => (
            <div className="approval-queue-card" key={event.id}>
              <div>
                <h3>{event.name}</h3>
                <p className="analytics-section-sub">{event.venue}</p>
              </div>
              <div className="approval-queue-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedEvent(event)}
                >
                  View history
                </button>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate(event.id)}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    setSelectedEvent(event);
                    setIsRejecting(true);
                  }}
                  disabled={rejectMutation.isPending}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {approveMutation.isError && <Alert message={extractErrorMessage(approveMutation.error)} />}

      <Modal
        isOpen={Boolean(selectedEvent) && !isRejecting}
        title={selectedEvent ? `${selectedEvent.name} — history` : ''}
        onClose={() => setSelectedEvent(null)}
      >
        {historyQuery.isLoading && <p className="task-activity-empty">Loading…</p>}
        {historyQuery.data && historyQuery.data.length === 0 && (
          <p className="task-activity-empty">No status changes yet.</p>
        )}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <ul className="task-activity-list">
            {[...historyQuery.data].reverse().map((entry) => (
              <li key={entry.id}>
                <span className="task-activity-action">
                  {entry.previousStatus.replace('_', ' ')} → {entry.newStatus.replace('_', ' ')}
                </span>
                {entry.comment && <span className="task-activity-detail"> · {entry.comment}</span>}
                <span className="task-activity-time">{new Date(entry.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(selectedEvent) && isRejecting}
        title={selectedEvent ? `Reject ${selectedEvent.name}` : ''}
        onClose={() => {
          setSelectedEvent(null);
          setIsRejecting(false);
        }}
      >
        <div className="event-form">
          {rejectMutation.isError && <Alert message={extractErrorMessage(rejectMutation.error)} />}
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
              onClick={() => {
                setSelectedEvent(null);
                setIsRejecting(false);
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() =>
                selectedEvent && rejectMutation.mutate({ eventId: selectedEvent.id, reason: rejectReason })
              }
              disabled={rejectMutation.isPending || rejectReason.trim().length < 3}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
