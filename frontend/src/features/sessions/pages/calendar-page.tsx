import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { sessionsApi } from '../../../api/sessions.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Badge } from '../../../components/ui/badge';
import { SESSION_STATUS_LABELS, SessionStatus } from '../../../types/session';

function statusTone(status: SessionStatus): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
  switch (status) {
    case SessionStatus.CANCELLED:
      return 'danger';
    case SessionStatus.COMPLETED:
      return 'success';
    case SessionStatus.IN_PROGRESS:
      return 'info';
    default:
      return 'neutral';
  }
}

function formatDayHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

/** Default window: the next 30 days, so the view isn't overwhelmed with every session ever scheduled. */
function defaultWindow() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function CalendarPage() {
  const [{ from, to }] = useState(defaultWindow);
  const [roomFilter, setRoomFilter] = useState('');

  const calendarQuery = useQuery({
    queryKey: ['schedule', 'calendar', { from, to, roomFilter }],
    queryFn: () => sessionsApi.getCalendar({ from, to, room: roomFilter || undefined }),
  });

  const days = calendarQuery.data ?? [];

  const allRooms = useMemo(() => {
    const rooms = new Set<string>();
    for (const day of days) {
      for (const roomGroup of day.rooms) {
        rooms.add(roomGroup.room);
      }
    }
    return Array.from(rooms).sort((a, b) => a.localeCompare(b));
  }, [days]);

  return (
    <motion.div
      className="calendar-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Calendar</h1>
      </div>
      <p className="task-board-hint">Showing sessions across all visible events for the next 30 days.</p>

      <div className="filters-bar">
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="">All rooms</option>
          {allRooms.map((room) => (
            <option key={room} value={room}>
              {room}
            </option>
          ))}
        </select>
      </div>

      {calendarQuery.isLoading && <LoadingState label="Loading schedule…" />}
      {calendarQuery.isError && <ErrorState message="Could not load the calendar." />}
      {!calendarQuery.isLoading && !calendarQuery.isError && days.length === 0 && (
        <EmptyState message="No sessions scheduled in this window." />
      )}

      {!calendarQuery.isLoading &&
        days.map((day) => (
          <section className="calendar-day" key={day.date}>
            <h2 className="calendar-day-heading">{formatDayHeading(day.date)}</h2>
            <div className="calendar-day-rooms">
              {day.rooms.map((roomGroup) => (
                <div className="calendar-room-group" key={roomGroup.room}>
                  <h3 className="calendar-room-heading">{roomGroup.room}</h3>
                  <ul className="calendar-session-list">
                    {roomGroup.sessions.map((session) => (
                      <li className="calendar-session-item" key={session.id}>
                        <div className="calendar-session-time">
                          {formatTimeRange(session.startTime, session.endTime)}
                        </div>
                        <div className="calendar-session-body">
                          <span className="calendar-session-title">{session.title}</span>
                          <span className="calendar-session-event">{session.eventName}</span>
                        </div>
                        <Badge tone={statusTone(session.status)}>
                          {SESSION_STATUS_LABELS[session.status]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
    </motion.div>
  );
}
