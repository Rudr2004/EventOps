import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../../api/events.api';
import { LoadingState, ErrorState } from '../../../components/ui/states';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { EventForm } from '../components/event-form';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { EVENT_STATUS_LABELS, EVENT_STATUS_TRANSITIONS, EventStatus } from '../../../types/event';
import { statusTone } from '../utils/status-tone';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { Alert } from '../../../components/layout/alert';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<EventStatus | null>(null);

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getById(id!),
    enabled: Boolean(id),
  });

  const canManage =
    user?.role === Role.ADMIN ||
    (user?.role === Role.EVENT_MANAGER && eventQuery.data?.owner === user.id);

  const transitionMutation = useMutation({
    mutationFn: (status: EventStatus) => eventsApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setPendingTransition(null);
    },
  });

  if (eventQuery.isLoading) {
    return <LoadingState label="Loading event…" />;
  }

  if (eventQuery.isError || !eventQuery.data) {
    return <ErrorState message="Could not load this event." />;
  }

  const event = eventQuery.data;
  const availableTransitions = EVENT_STATUS_TRANSITIONS[event.status];

  return (
    <div className="event-detail-page">
      <button type="button" className="btn-link" onClick={() => navigate('/events')}>
        ← Back to events
      </button>

      <div className="page-header">
        <h1>{event.name}</h1>
        <Badge tone={statusTone(event.status)}>{EVENT_STATUS_LABELS[event.status]}</Badge>
      </div>

      <div className="event-meta-card">
        <dl>
          <dt>Venue</dt>
          <dd>{event.venue}</dd>
          <dt>Starts</dt>
          <dd>{new Date(event.startDate).toLocaleString()}</dd>
          <dt>Ends</dt>
          <dd>{new Date(event.endDate).toLocaleString()}</dd>
          {event.description && (
            <>
              <dt>Description</dt>
              <dd>{event.description}</dd>
            </>
          )}
        </dl>
      </div>

      {canManage && (
        <div className="event-actions">
          <button type="button" className="btn-secondary" onClick={() => setIsEditOpen(true)}>
            Edit details
          </button>
          {availableTransitions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setPendingTransition(status)}
              disabled={transitionMutation.isPending}
            >
              Move to {EVENT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      {transitionMutation.isError && (
        <Alert message={extractErrorMessage(transitionMutation.error)} />
      )}

      <Modal isOpen={isEditOpen} title="Edit Event" onClose={() => setIsEditOpen(false)}>
        <EventForm
          eventId={event.id}
          initialValues={event}
          onSuccess={() => setIsEditOpen(false)}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={pendingTransition !== null}
        title="Confirm status change"
        message={
          pendingTransition
            ? `Move this event to "${EVENT_STATUS_LABELS[pendingTransition]}"?`
            : ''
        }
        confirmLabel="Confirm"
        isPending={transitionMutation.isPending}
        onConfirm={() => pendingTransition && transitionMutation.mutate(pendingTransition)}
        onCancel={() => setPendingTransition(null)}
      />
    </div>
  );
}
