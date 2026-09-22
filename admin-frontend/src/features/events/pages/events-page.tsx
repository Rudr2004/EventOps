import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { eventsApi } from '../../../api/events.api';
import { usersApi } from '../../../api/users.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Pagination } from '../../../components/ui/pagination';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Role } from '../../../types/auth';
import { EVENT_STATUS_LABELS, EventStatus, type EventItem } from '../../../types/event';

function statusTone(status: EventStatus) {
  switch (status) {
    case EventStatus.LIVE:
    case EventStatus.COMPLETED:
      return 'success';
    case EventStatus.APPROVAL_PENDING:
      return 'warning';
    case EventStatus.ARCHIVED:
      return 'danger';
    case EventStatus.APPROVED:
    case EventStatus.PLANNING:
      return 'info';
    default:
      return 'neutral';
  }
}

export function EventsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [startDateFrom, setStartDateFrom] = useState('');
  const [startDateTo, setStartDateTo] = useState('');
  const limit = 15;

  const managersQuery = useQuery({
    queryKey: ['users', { role: Role.EVENT_MANAGER }],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: Role.EVENT_MANAGER }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', 'admin-overview', { page, limit, status, search, owner, startDateFrom, startDateTo }],
    queryFn: () =>
      eventsApi.list({
        page,
        limit,
        status: status || undefined,
        search: search || undefined,
        owner: owner || undefined,
        startDateFrom: startDateFrom ? new Date(startDateFrom).toISOString() : undefined,
        startDateTo: startDateTo ? new Date(startDateTo).toISOString() : undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const columns: TableColumn<EventItem>[] = [
    { key: 'name', header: 'Name', render: (e) => e.name },
    { key: 'venue', header: 'Venue', render: (e) => e.venue },
    { key: 'owner', header: 'Owner id', render: (e) => e.owner },
    { key: 'startDate', header: 'Start', render: (e) => new Date(e.startDate).toLocaleDateString() },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge tone={statusTone(e.status)}>{EVENT_STATUS_LABELS[e.status]}</Badge>,
    },
  ];

  return (
    <motion.div
      className="events-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Events</h1>
      </div>
      <p className="task-board-hint">Organization-wide overview — read-only.</p>

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Search events…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EventStatus | '');
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {Object.values(EventStatus).map((s) => (
            <option key={s} value={s}>
              {EVENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All owners</option>
          {managersQuery.data?.items.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Start date from"
          value={startDateFrom}
          onChange={(e) => {
            setStartDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="Start date to"
          value={startDateTo}
          onChange={(e) => {
            setStartDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading && <LoadingState label="Loading events…" />}
      {isError && <ErrorState message="Could not load events." />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState message="No events match your filters." />
      )}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Table columns={columns} rows={data.items} getRowKey={(e) => e.id} />
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </motion.div>
  );
}
