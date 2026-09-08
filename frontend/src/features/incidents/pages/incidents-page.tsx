import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { incidentsApi } from '../../../api/incidents.api';
import { eventsApi } from '../../../api/events.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { IncidentForm } from '../components/incident-form';
import { IncidentDetail } from '../components/incident-detail';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import {
  IncidentSeverity,
  IncidentStatus,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  type IncidentItem,
} from '../../../types/incident';
import { incidentStatusTone, severityTone } from '../utils/incident-tone';

export function IncidentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [eventFilter, setEventFilter] = useState(searchParams.get('event') ?? '');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const eventsQuery = useQuery({
    queryKey: ['events', { page: 1, limit: 100 }],
    queryFn: () => eventsApi.list({ page: 1, limit: 100 }),
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', { eventFilter, severityFilter, statusFilter }],
    queryFn: () =>
      incidentsApi.list({
        page: 1,
        limit: 100,
        event: eventFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const incidents = incidentsQuery.data?.items ?? [];
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) ?? null;
  const openCriticalIncidents = incidents.filter(
    (i) => i.severity === IncidentSeverity.CRITICAL && i.status !== IncidentStatus.RESOLVED,
  );

  const columns: TableColumn<IncidentItem>[] = [
    { key: 'title', header: 'Title', render: (i) => i.title },
    {
      key: 'severity',
      header: 'Severity',
      render: (i) => <Badge tone={severityTone(i.severity)}>{INCIDENT_SEVERITY_LABELS[i.severity]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <Badge tone={incidentStatusTone(i.status)}>{INCIDENT_STATUS_LABELS[i.status]}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Reported',
      render: (i) => new Date(i.createdAt).toLocaleDateString(),
    },
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
        {canManage && eventFilter && (
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            Report Incident
          </button>
        )}
      </div>

      {openCriticalIncidents.length > 0 && (
        <div className="critical-banner">
          <span className="critical-banner-dot" />
          <span>
            <strong>{openCriticalIncidents.length}</strong> critical incident
            {openCriticalIncidents.length > 1 ? 's' : ''} unresolved
          </span>
          <div className="critical-banner-list">
            {openCriticalIncidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className="critical-banner-item"
                onClick={() => setSelectedIncidentId(incident.id)}
              >
                {incident.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filters-bar">
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">All events</option>
          {eventsQuery.data?.items.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | '')}
        >
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

      {!eventFilter && (
        <p className="task-board-hint">Select an event above to report a new incident for it.</p>
      )}

      {incidentsQuery.isLoading && <LoadingState label="Loading incidents…" />}
      {incidentsQuery.isError && <ErrorState message="Could not load incidents." />}
      {!incidentsQuery.isLoading && !incidentsQuery.isError && incidents.length === 0 && (
        <EmptyState message="No incidents match your filters." />
      )}
      {!incidentsQuery.isLoading && incidents.length > 0 && (
        <Table
          columns={columns}
          rows={incidents}
          getRowKey={(i) => i.id}
          onRowClick={(i) => setSelectedIncidentId(i.id)}
        />
      )}

      <Modal isOpen={isCreateOpen} title="Report Incident" onClose={() => setIsCreateOpen(false)}>
        {eventFilter && (
          <IncidentForm
            eventId={eventFilter}
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        )}
      </Modal>

      <Modal
        isOpen={selectedIncidentId !== null}
        title={selectedIncident?.title ?? ''}
        onClose={() => setSelectedIncidentId(null)}
      >
        {selectedIncident && (
          <IncidentDetail
            incident={selectedIncident}
            canAct={
              canManage ||
              (user?.role === Role.OPERATIONS_MEMBER && selectedIncident.assignee === user.id)
            }
          />
        )}
      </Modal>
    </motion.div>
  );
}
