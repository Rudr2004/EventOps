import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../../api/events.api';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import type { EventItem } from '../../../types/event';

interface EventFormProps {
  initialValues?: Partial<EventItem>;
  eventId?: string;
  onSuccess: (event: EventItem) => void;
  onCancel: () => void;
}

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

export function EventForm({ initialValues, eventId, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [venue, setVenue] = useState(initialValues?.venue ?? '');
  const [startDate, setStartDate] = useState(toDateTimeLocal(initialValues?.startDate));
  const [endDate, setEndDate] = useState(toDateTimeLocal(initialValues?.endDate));

  const isEditing = Boolean(eventId);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description,
        venue,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };
      return eventId ? eventsApi.update(eventId, payload) : eventsApi.create(payload);
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      }
      onSuccess(event);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const errorMessage = mutation.isError
    ? extractErrorMessage(mutation.error)
    : null;

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {errorMessage && <Alert message={errorMessage} />}
      <FormField id="name" label="Event name" value={name} onChange={(e) => setName(e.target.value)} required />
      <FormField
        id="venue"
        label="Venue"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        required
      />
      <FormField
        id="startDate"
        label="Start date"
        type="datetime-local"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
      />
      <FormField
        id="endDate"
        label="End date"
        type="datetime-local"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
      />
      <div className="form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
