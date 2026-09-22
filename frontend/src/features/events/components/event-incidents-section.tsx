import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi } from '../../../api/incidents.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { IncidentForm } from '../../incidents/components/incident-form';
import { IncidentDetail } from '../../incidents/components/incident-detail';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import {
  IncidentSeverity,
  IncidentStatus,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  type IncidentItem,
} from '../../../types/incident';
import { incidentStatusTone, severityTone } from '../../incidents/utils/incident-tone';

interface EventIncidentsSectionProps {
  eventId: string;
}

export function EventIncidentsSection({ eventId }: EventIncidentsSectionProps) {
  const { user } = useAuth();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;
  const canCreate = canManage || user?.role === Role.OPERATIONS_MEMBER;

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'event-section', eventId],
    queryFn: () => incidentsApi.list({ page: 1, limit: 100, event: eventId }),
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
    <section className="schedule-section">
      <div className="page-header">
        <h2>Incidents</h2>
        {canCreate && (
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

      {incidentsQuery.isLoading && <LoadingState label="Loading incidents…" />}
      {incidentsQuery.isError && <ErrorState message="Could not load incidents for this event." />}
      {!incidentsQuery.isLoading && !incidentsQuery.isError && incidents.length === 0 && (
        <EmptyState message="No incidents reported for this event." />
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
        <IncidentForm
          eventId={eventId}
          onSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
        />
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
    </section>
  );
}
