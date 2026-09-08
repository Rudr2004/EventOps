import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { eventsApi } from '../../../api/events.api';
import { sessionsApi } from '../../../api/sessions.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { EventForm } from '../components/event-form';
import { SessionForm } from '../../sessions/components/session-form';
import { ScheduleTimeline } from '../../sessions/components/schedule-timeline';
import { ApprovalPanel } from '../../approvals/components/approval-panel';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { EVENT_STATUS_LABELS, EVENT_STATUS_TRANSITIONS, EventStatus } from '../../../types/event';
import {
  SESSION_STATUS_LABELS,
  SessionStatus,
  type SessionItem,
} from '../../../types/session';
import { statusTone } from '../utils/status-tone';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { Alert } from '../../../components/layout/alert';

const SESSION_STATUS_OPTIONS = Object.values(SessionStatus);

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [pendingTransition, setPendingTransition] = useState<EventStatus | null>(null);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getById(id!),
    enabled: Boolean(id),
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => sessionsApi.listByEvent(id!),
    enabled: Boolean(id),
  });

  const canManage =
    user?.role === Role.ADMIN ||
    (user?.role === Role.EVENT_MANAGER && eventQuery.data?.owner === user.id);

  const invalidateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ['event', id] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const transitionMutation = useMutation({
    mutationFn: (status: EventStatus) => eventsApi.updateStatus(id!, status),
    onSuccess: () => {
      invalidateEvent();
      setPendingTransition(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => eventsApi.archive(id!),
    onSuccess: () => {
      invalidateEvent();
      setIsArchiveConfirmOpen(false);
    },
  });

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions', id] });
  };

  const sessionStatusMutation = useMutation({
    mutationFn: (vars: { sessionId: string; status: SessionStatus }) =>
      sessionsApi.updateStatus(vars.sessionId, vars.status),
    onSuccess: (updatedSession) => {
      invalidateSessions();
      setSelectedSession(updatedSession);
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
  const sessions = sessionsQuery.data ?? [];
  const canUpdateSessionStatus =
    user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER || user?.role === Role.OPERATIONS_MEMBER;

  return (
    <motion.div
      className="event-detail-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
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
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/tasks?event=${event.id}`)}
          >
            View Tasks
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/incidents?event=${event.id}`)}
          >
            View Incidents
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
          {event.status === EventStatus.COMPLETED && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsArchiveConfirmOpen(true)}
              disabled={archiveMutation.isPending}
            >
              Archive event
            </button>
          )}
        </div>
      )}

      {(transitionMutation.isError || archiveMutation.isError) && (
        <Alert message={extractErrorMessage(transitionMutation.error ?? archiveMutation.error)} />
      )}

      <ApprovalPanel event={event} isOwner={event.owner === user?.id} />

      <section className="schedule-section">
        <div className="page-header">
          <h2>Schedule</h2>
          {canManage && (
            <button type="button" onClick={() => setIsSessionFormOpen(true)}>
              New Session
            </button>
          )}
        </div>

        {sessionsQuery.isLoading && <LoadingState label="Loading schedule…" />}
        {sessionsQuery.isError && <ErrorState message="Could not load the schedule." />}
        {!sessionsQuery.isLoading && !sessionsQuery.isError && sessions.length === 0 && (
          <EmptyState message="No sessions scheduled yet." />
        )}
        {!sessionsQuery.isLoading && sessions.length > 0 && (
          <ScheduleTimeline sessions={sessions} onSessionClick={setSelectedSession} />
        )}
      </section>

      <Modal isOpen={isEditOpen} title="Edit Event" onClose={() => setIsEditOpen(false)}>
        <EventForm
          eventId={event.id}
          initialValues={event}
          onSuccess={() => setIsEditOpen(false)}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>

      <Modal isOpen={isSessionFormOpen} title="New Session" onClose={() => setIsSessionFormOpen(false)}>
        <SessionForm
          eventId={event.id}
          onSuccess={() => setIsSessionFormOpen(false)}
          onCancel={() => setIsSessionFormOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={selectedSession !== null}
        title={selectedSession?.title ?? ''}
        onClose={() => setSelectedSession(null)}
      >
        {selectedSession && (
          <div className="session-detail">
            <Badge tone="info">{SESSION_STATUS_LABELS[selectedSession.status]}</Badge>
            <dl>
              <dt>Room</dt>
              <dd>{selectedSession.room}</dd>
              <dt>Starts</dt>
              <dd>{new Date(selectedSession.startTime).toLocaleString()}</dd>
              <dt>Ends</dt>
              <dd>{new Date(selectedSession.endTime).toLocaleString()}</dd>
              {selectedSession.description && (
                <>
                  <dt>Description</dt>
                  <dd>{selectedSession.description}</dd>
                </>
              )}
            </dl>
            {canUpdateSessionStatus && (
              <div className="session-status-menu">
                {SESSION_STATUS_OPTIONS.filter((s) => s !== selectedSession.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn-secondary"
                    disabled={sessionStatusMutation.isPending}
                    onClick={() =>
                      sessionStatusMutation.mutate({ sessionId: selectedSession.id, status })
                    }
                  >
                    Mark {SESSION_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            )}
            {sessionStatusMutation.isError && (
              <Alert message={extractErrorMessage(sessionStatusMutation.error)} />
            )}
          </div>
        )}
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

      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        title="Archive this event"
        message="Archiving preserves the event's full history — it moves to a read-only state and can't be reopened."
        confirmLabel="Archive"
        isPending={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setIsArchiveConfirmOpen(false)}
      />
    </motion.div>
  );
}
