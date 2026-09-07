import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '../../../api/sessions.api';
import { speakersApi } from '../../../api/speakers.api';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import type { SessionItem } from '../../../types/session';

interface SessionFormProps {
  eventId: string;
  sessionId?: string;
  initialValues?: Partial<SessionItem>;
  onSuccess: (session: SessionItem) => void;
  onCancel: () => void;
}

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

export function SessionForm({ eventId, sessionId, initialValues, onSuccess, onCancel }: SessionFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [room, setRoom] = useState(initialValues?.room ?? '');
  const [startTime, setStartTime] = useState(toDateTimeLocal(initialValues?.startTime));
  const [endTime, setEndTime] = useState(toDateTimeLocal(initialValues?.endTime));
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>(initialValues?.speakers ?? []);

  const speakersQuery = useQuery({
    queryKey: ['speakers', { page: 1, limit: 100 }],
    queryFn: () => speakersApi.list({ page: 1, limit: 100 }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        room,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        speakers: selectedSpeakers,
      };
      return sessionId ? sessionsApi.update(sessionId, payload) : sessionsApi.create(eventId, payload);
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', eventId] });
      onSuccess(session);
    },
  });

  const toggleSpeaker = (speakerId: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(speakerId) ? prev.filter((id) => id !== speakerId) : [...prev, speakerId],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {mutation.isError && <Alert message={extractErrorMessage(mutation.error)} />}
      <FormField id="session-title" label="Session title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <FormField id="session-room" label="Room" value={room} onChange={(e) => setRoom(e.target.value)} required />
      <FormField
        id="session-start"
        label="Start time"
        type="datetime-local"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        required
      />
      <FormField
        id="session-end"
        label="End time"
        type="datetime-local"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        required
      />
      <div className="form-field">
        <label htmlFor="session-description">Description</label>
        <textarea
          id="session-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {speakersQuery.data && speakersQuery.data.items.length > 0 && (
        <div className="form-field">
          <label>Speakers</label>
          <div className="speaker-chip-list">
            {speakersQuery.data.items.map((speaker) => (
              <button
                type="button"
                key={speaker.id}
                className={`speaker-chip ${selectedSpeakers.includes(speaker.id) ? 'speaker-chip-selected' : ''}`}
                onClick={() => toggleSpeaker(speaker.id)}
              >
                {speaker.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : sessionId ? 'Save changes' : 'Create session'}
        </button>
      </div>
    </form>
  );
}
