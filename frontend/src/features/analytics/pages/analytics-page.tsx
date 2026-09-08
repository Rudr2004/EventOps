import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../api/analytics.api';
import { eventsApi } from '../../../api/events.api';
import { StatTile } from '../../../components/charts/stat-tile';
import { BarChart } from '../../../components/charts/bar-chart';
import { StackedBarChart, type StackedBarRow } from '../../../components/charts/stacked-bar-chart';
import { LoadingState, ErrorState } from '../../../components/ui/states';
import { useUserDisplayName } from '../../../lib/hooks/use-user-display-name';
import { EVENT_STATUS_LABELS, EventStatus } from '../../../types/event';
import { TASK_STATUS_LABELS, TaskStatus } from '../../../types/task';
import { INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS, IncidentSeverity, IncidentStatus } from '../../../types/incident';

const EVENT_STATUS_ORDER = Object.values(EventStatus);
const TASK_STATUS_ORDER = Object.values(TaskStatus);
const INCIDENT_SEVERITY_ORDER = Object.values(IncidentSeverity);
const INCIDENT_STATUS_ORDER = Object.values(IncidentStatus);

const TASK_STATUS_CHART_VAR: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: '--chart-2',
  [TaskStatus.IN_PROGRESS]: '--chart-4',
  [TaskStatus.BLOCKED]: '--chart-8',
  [TaskStatus.REVIEW]: '--chart-6',
  [TaskStatus.DONE]: '--chart-3',
};

function healthTone(score: number): string {
  if (score >= 80) return 'health-score-good';
  if (score >= 50) return 'health-score-warn';
  return 'health-score-bad';
}

export function AnalyticsPage() {
  const [eventFilter, setEventFilter] = useState('');
  const getUserDisplayName = useUserDisplayName();

  const eventsQuery = useQuery({
    queryKey: ['events', { page: 1, limit: 100 }],
    queryFn: () => eventsApi.list({ page: 1, limit: 100 }),
  });

  const params = { event: eventFilter || undefined };

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', eventFilter],
    queryFn: () => analyticsApi.getOverview(params),
  });

  const workloadQuery = useQuery({
    queryKey: ['analytics', 'workload', eventFilter],
    queryFn: () => analyticsApi.getWorkload(params),
  });

  const incidentAnalyticsQuery = useQuery({
    queryKey: ['analytics', 'incidents', eventFilter],
    queryFn: () => analyticsApi.getIncidentAnalytics(params),
  });

  const healthQuery = useQuery({
    queryKey: ['analytics', 'event-health', eventFilter],
    queryFn: () => analyticsApi.getEventHealth(params),
  });

  const turnaroundQuery = useQuery({
    queryKey: ['analytics', 'approval-turnaround', eventFilter],
    queryFn: () => analyticsApi.getApprovalTurnaround(params),
  });

  const roomUtilizationQuery = useQuery({
    queryKey: ['analytics', 'room-utilization', eventFilter],
    queryFn: () => analyticsApi.getRoomUtilization(params),
  });

  const isLoading = overviewQuery.isLoading;
  const isError = overviewQuery.isError;

  const eventStatusData = EVENT_STATUS_ORDER.map((status) => ({
    label: EVENT_STATUS_LABELS[status],
    value: overviewQuery.data?.eventsByStatus[status] ?? 0,
  })).filter((d) => d.value > 0);

  const workloadRows: StackedBarRow[] =
    workloadQuery.data?.map((entry) => ({
      rowLabel: getUserDisplayName(entry.assignee),
      segments: TASK_STATUS_ORDER.map((status) => ({
        key: status,
        label: TASK_STATUS_LABELS[status],
        value: entry.byStatus[status] ?? 0,
        colorVar: TASK_STATUS_CHART_VAR[status],
      })),
    })) ?? [];

  const severityData = INCIDENT_SEVERITY_ORDER.map((severity) => ({
    label: INCIDENT_SEVERITY_LABELS[severity],
    value: incidentAnalyticsQuery.data?.bySeverity[severity] ?? 0,
  })).filter((d) => d.value > 0);

  const incidentStatusData = INCIDENT_STATUS_ORDER.map((status) => ({
    label: INCIDENT_STATUS_LABELS[status],
    value: incidentAnalyticsQuery.data?.byStatus[status] ?? 0,
  })).filter((d) => d.value > 0);

  const roomData =
    roomUtilizationQuery.data?.map((r) => ({
      label: r.room,
      value: r.totalMinutes,
    })) ?? [];

  return (
    <motion.div
      className="analytics-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Analytics</h1>
      </div>

      <div className="filters-bar">
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">All events</option>
          {eventsQuery.data?.items.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingState label="Loading analytics…" />}
      {isError && <ErrorState message="Could not load analytics." />}

      {!isLoading && !isError && overviewQuery.data && (
        <>
          <div className="analytics-grid">
            <StatTile label="Events in next 7 days" value={overviewQuery.data.upcomingEvents.next7Days} />
            <StatTile label="Events in next 30 days" value={overviewQuery.data.upcomingEvents.next30Days} />
            <StatTile label="Open tasks" value={overviewQuery.data.tasks.open} />
            <StatTile
              label="Overdue tasks"
              value={overviewQuery.data.tasks.overdue}
              tone={overviewQuery.data.tasks.overdue > 0 ? 'danger' : 'neutral'}
            />
            <StatTile
              label="Avg. approval turnaround"
              value={
                turnaroundQuery.data?.averageHours != null
                  ? `${turnaroundQuery.data.averageHours}h`
                  : '—'
              }
            />
            <StatTile
              label="Avg. incident resolution"
              value={
                incidentAnalyticsQuery.data?.averageResolutionHours != null
                  ? `${incidentAnalyticsQuery.data.averageResolutionHours}h`
                  : '—'
              }
            />
          </div>

          <div className="analytics-section">
            <h2>Events by lifecycle status</h2>
            <p className="analytics-section-sub">Count of events currently in each status.</p>
            <BarChart data={eventStatusData} emptyMessage="No events in this scope." />
          </div>

          <div className="analytics-section">
            <h2>Task workload by assignee</h2>
            <p className="analytics-section-sub">
              Stacked by status — completion rate is done ÷ total tasks assigned.
            </p>
            <StackedBarChart rows={workloadRows} emptyMessage="No assigned tasks in this scope." />
          </div>

          <div className="analytics-two-col">
            <div className="analytics-section">
              <h2>Incidents by severity</h2>
              <BarChart data={severityData} emptyMessage="No incidents in this scope." />
            </div>
            <div className="analytics-section">
              <h2>Incidents by status</h2>
              <BarChart data={incidentStatusData} emptyMessage="No incidents in this scope." />
            </div>
          </div>

          <div className="analytics-section">
            <h2>Session-room utilization</h2>
            <p className="analytics-section-sub">Total scheduled minutes per room.</p>
            <BarChart
              data={roomData}
              emptyMessage="No sessions in this scope."
              valueFormatter={(v) => `${v}m`}
            />
          </div>

          <div className="analytics-section">
            <h2>Event health</h2>
            <p className="analytics-section-sub">
              100 minus overdue tasks, unresolved incidents (critical incidents weighted heaviest), and a
              pending-approval penalty.
            </p>
            {(healthQuery.data?.length ?? 0) === 0 ? (
              <p className="analytics-empty-scope">No events in this scope.</p>
            ) : (
              <table className="data-table health-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Overdue tasks</th>
                    <th>Unresolved incidents</th>
                    <th>Health score</th>
                  </tr>
                </thead>
                <tbody>
                  {healthQuery.data?.map((row) => (
                    <tr key={row.eventId}>
                      <td>{row.eventName}</td>
                      <td style={{ textTransform: 'capitalize' }}>{row.status.replace('_', ' ')}</td>
                      <td>{row.overdueTaskCount}</td>
                      <td>
                        {row.unresolvedIncidentCount}
                        {row.criticalIncidentCount > 0 && ` (${row.criticalIncidentCount} critical)`}
                      </td>
                      <td className={`health-score-cell ${healthTone(row.healthScore)}`}>
                        {row.healthScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
