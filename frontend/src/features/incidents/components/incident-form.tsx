import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentsApi } from '../../../api/incidents.api';
import { usersApi } from '../../../api/users.api';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { Role } from '../../../types/auth';
import { IncidentSeverity, INCIDENT_SEVERITY_LABELS, type IncidentItem } from '../../../types/incident';

interface IncidentFormProps {
  eventId: string;
  incidentId?: string;
  initialValues?: Partial<IncidentItem>;
  onSuccess: (incident: IncidentItem) => void;
  onCancel: () => void;
}

export function IncidentForm({ eventId, incidentId, initialValues, onSuccess, onCancel }: IncidentFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [severity, setSeverity] = useState<IncidentSeverity>(
    initialValues?.severity ?? IncidentSeverity.MEDIUM,
  );
  const [assignee, setAssignee] = useState(initialValues?.assignee ?? '');

  const opsMembersQuery = useQuery({
    queryKey: ['users', { role: Role.OPERATIONS_MEMBER }],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: Role.OPERATIONS_MEMBER }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description: description || undefined,
        severity,
        assignee: assignee || undefined,
      };
      return incidentId ? incidentsApi.update(incidentId, payload) : incidentsApi.create(eventId, payload);
    },
    onSuccess: (incident) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      onSuccess(incident);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {mutation.isError && <Alert message={extractErrorMessage(mutation.error)} />}
      <FormField
        id="incident-title"
        label="Incident title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="form-field">
        <label htmlFor="incident-description">Description</label>
        <textarea
          id="incident-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened, and what's the impact?"
        />
      </div>

      <div className="form-field">
        <label htmlFor="incident-severity">Severity</label>
        <select
          id="incident-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
        >
          {Object.values(IncidentSeverity).map((s) => (
            <option key={s} value={s}>
              {INCIDENT_SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="incident-assignee">Assignee</label>
        <select id="incident-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {opsMembersQuery.data?.items.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : incidentId ? 'Save changes' : 'Report incident'}
        </button>
      </div>
    </form>
  );
}
