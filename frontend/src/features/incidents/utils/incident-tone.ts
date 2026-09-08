import { IncidentSeverity, IncidentStatus } from '../../../types/incident';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function severityTone(severity: IncidentSeverity): BadgeTone {
  switch (severity) {
    case IncidentSeverity.CRITICAL:
      return 'danger';
    case IncidentSeverity.HIGH:
      return 'warning';
    case IncidentSeverity.MEDIUM:
      return 'info';
    default:
      return 'neutral';
  }
}

export function incidentStatusTone(status: IncidentStatus): BadgeTone {
  switch (status) {
    case IncidentStatus.RESOLVED:
      return 'success';
    case IncidentStatus.MITIGATED:
      return 'info';
    case IncidentStatus.INVESTIGATING:
      return 'warning';
    default:
      return 'danger';
  }
}
