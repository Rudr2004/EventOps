import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { eventsApi } from '../../../api/events.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Pagination } from '../../../components/ui/pagination';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { EventForm } from '../components/event-form';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { EVENT_STATUS_LABELS, EventStatus, type EventItem } from '../../../types/event';
import { statusTone } from '../utils/status-tone';

const STATUS_OPTIONS = Object.values(EventStatus);

export function EventsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const limit = 10;

  const canCreate = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', { page, limit, status, search }],
    queryFn: () =>
      eventsApi.list({
        page,
        limit,
        status: status || undefined,
        search: search || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const columns: TableColumn<EventItem>[] = [
    { key: 'name', header: 'Name', render: (event) => event.name },
    { key: 'venue', header: 'Venue', render: (event) => event.venue },
    {
      key: 'startDate',
      header: 'Start',
      render: (event) => new Date(event.startDate).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (event) => <Badge tone={statusTone(event.status)}>{EVENT_STATUS_LABELS[event.status]}</Badge>,
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
        {canCreate && (
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            New Event
          </button>
        )}
      </div>

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
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {EVENT_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingState label="Loading events…" />}
      {isError && <ErrorState message="Could not load events." />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState message="No events match your filters." />
      )}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Table
            columns={columns}
            rows={data.items}
            getRowKey={(event) => event.id}
            onRowClick={(event) => navigate(`/events/${event.id}`)}
          />
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal isOpen={isCreateOpen} title="Create Event" onClose={() => setIsCreateOpen(false)}>
        <EventForm
          onSuccess={(event) => {
            setIsCreateOpen(false);
            navigate(`/events/${event.id}`);
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>
    </motion.div>
  );
}
