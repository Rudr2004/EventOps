import { useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentsApi } from '../../../api/incidents.api';
import { Badge } from '../../../components/ui/badge';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { useUserDisplayName } from '../../../lib/hooks/use-user-display-name';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TRANSITIONS,
  type IncidentItem,
  type IncidentStatus,
} from '../../../types/incident';
import { incidentStatusTone, severityTone } from '../utils/incident-tone';

interface IncidentDetailProps {
  incident: IncidentItem;
  canAct: boolean;
}

export function IncidentDetail({ incident, canAct }: IncidentDetailProps) {
  const queryClient = useQueryClient();
  const getUserDisplayName = useUserDisplayName();

  const statusMutation = useMutation({
    mutationFn: (status: IncidentStatus) => incidentsApi.updateStatus(incident.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const availableTransitions = INCIDENT_STATUS_TRANSITIONS[incident.status];

  return (
    <div className="task-detail">
      <div className="task-detail-badges">
        <Badge tone={incidentStatusTone(incident.status)}>{INCIDENT_STATUS_LABELS[incident.status]}</Badge>
        <Badge tone={severityTone(incident.severity)}>{INCIDENT_SEVERITY_LABELS[incident.severity]}</Badge>
      </div>

      {incident.description && <p className="task-detail-description">{incident.description}</p>}

      <dl className="task-detail-meta">
        <dt>Assignee</dt>
        <dd>{getUserDisplayName(incident.assignee)}</dd>
        {incident.resolvedAt && (
          <>
            <dt>Resolved</dt>
            <dd>{new Date(incident.resolvedAt).toLocaleString()}</dd>
          </>
        )}
      </dl>

      {canAct && availableTransitions.length > 0 && (
        <div className="task-detail-actions">
          {availableTransitions.map((status) => (
            <button
              key={status}
              type="button"
              className="btn-secondary"
              onClick={() => statusMutation.mutate(status)}
              disabled={statusMutation.isPending}
            >
              Move to {INCIDENT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}
      {statusMutation.isError && <Alert message={extractErrorMessage(statusMutation.error)} />}

      <div className="task-activity">
        <h3>Timeline</h3>
        {incident.activity.length === 0 ? (
          <p className="task-activity-empty">No activity yet.</p>
        ) : (
          <ul className="task-activity-list">
            {[...incident.activity].reverse().map((entry, i) => (
              <li key={i}>
                <span className="task-activity-action">{entry.action.replace('_', ' ')}</span>
                {entry.detail && <span className="task-activity-detail"> · {entry.detail}</span>}
                <span className="task-activity-time">
                  {getUserDisplayName(entry.actor)} · {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
