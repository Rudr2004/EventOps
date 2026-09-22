import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { incidentsApi } from '../../../api/incidents.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import {
  IncidentSeverity,
  IncidentStatus,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  type IncidentItem,
} from '../../../types/incident';

function severityTone(severity: IncidentSeverity) {
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

function statusTone(status: IncidentStatus) {
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

export function IncidentsPage() {
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'org-wide', { severityFilter, statusFilter }],
    queryFn: () =>
      incidentsApi.list({
        page: 1,
        limit: 100,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const incidents = incidentsQuery.data?.items ?? [];
  const criticalOpen = incidents.filter(
    (i) => i.severity === IncidentSeverity.CRITICAL && i.status !== IncidentStatus.RESOLVED,
  );

  const columns: TableColumn<IncidentItem>[] = [
    { key: 'title', header: 'Title', render: (i) => i.title },
    { key: 'event', header: 'Event id', render: (i) => i.event },
    {
      key: 'severity',
      header: 'Severity',
      render: (i) => <Badge tone={severityTone(i.severity)}>{INCIDENT_SEVERITY_LABELS[i.severity]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <Badge tone={statusTone(i.status)}>{INCIDENT_STATUS_LABELS[i.status]}</Badge>,
    },
    { key: 'createdAt', header: 'Reported', render: (i) => new Date(i.createdAt).toLocaleDateString() },
  ];

  return (
    <motion.div
      className="incidents-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Incidents</h1>
      </div>
      <p className="task-board-hint">Organization-wide — across every event, not just ones you own.</p>

      {criticalOpen.length > 0 && (
        <div className="critical-banner">
          <span className="critical-banner-dot" />
          <span>
            <strong>{criticalOpen.length}</strong> critical incident{criticalOpen.length > 1 ? 's' : ''}{' '}
            unresolved
          </span>
        </div>
      )}

      <div className="filters-bar">
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | '')}>
          <option value="">All severities</option>
          {Object.values(IncidentSeverity).map((s) => (
            <option key={s} value={s}>
              {INCIDENT_SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}>
          <option value="">All statuses</option>
          {Object.values(IncidentStatus).map((s) => (
            <option key={s} value={s}>
              {INCIDENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {incidentsQuery.isLoading && <LoadingState label="Loading incidents…" />}
      {incidentsQuery.isError && <ErrorState message="Could not load incidents." />}
      {!incidentsQuery.isLoading && !incidentsQuery.isError && incidents.length === 0 && (
        <EmptyState message="No incidents match your filters." />
      )}
      {!incidentsQuery.isLoading && incidents.length > 0 && (
        <Table columns={columns} rows={incidents} getRowKey={(i) => i.id} />
      )}
    </motion.div>
  );
}
