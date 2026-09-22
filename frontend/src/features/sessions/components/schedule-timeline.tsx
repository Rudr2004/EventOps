import { motion } from 'framer-motion';
import type { SessionItem } from '../../../types/session';
import { SESSION_STATUS_LABELS, SessionStatus } from '../../../types/session';
import {
  computeTimelineBounds,
  durationToWidthPercent,
  formatHourLabel,
  groupSessionsByRoom,
  timeToOffsetPercent,
} from '../utils/timeline';

interface ScheduleTimelineProps {
  sessions: SessionItem[];
  onSessionClick?: (session: SessionItem) => void;
}

function statusClass(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.CANCELLED:
      return 'timeline-block-cancelled';
    case SessionStatus.COMPLETED:
      return 'timeline-block-completed';
    case SessionStatus.IN_PROGRESS:
      return 'timeline-block-live';
    default:
      return 'timeline-block-scheduled';
  }
}

export function ScheduleTimeline({ sessions, onSessionClick }: ScheduleTimelineProps) {
  if (sessions.length === 0) {
    return null;
  }

  const bounds = computeTimelineBounds(sessions);
  const roomGroups = groupSessionsByRoom(sessions);
  const hours = Array.from(
    { length: bounds.endHour - bounds.startHour + 1 },
    (_, i) => bounds.startHour + i,
  );

  return (
    <div className="schedule-timeline">
      <div className="timeline-hours">
        <div className="timeline-room-label-spacer" />
        {hours.map((hour) => (
          <div key={hour} className="timeline-hour-label">
            {formatHourLabel(hour)}
          </div>
        ))}
      </div>

      {Array.from(roomGroups.entries()).map(([room, roomSessions], rowIndex) => (
        <div className="timeline-row" key={room}>
          <div className="timeline-room-label">{room}</div>
          <div className="timeline-track">
            {hours.map((hour, hourIndex) => (
              <div
                key={hour}
                className="timeline-grid-line"
                style={{ left: `${(hourIndex / (hours.length - 1)) * 100}%` }}
              />
            ))}
            {roomSessions.map((session, index) => {
              const start = new Date(session.startTime);
              const end = new Date(session.endTime);
              const left = timeToOffsetPercent(start, bounds);
              const width = durationToWidthPercent(start, end, bounds);

              return (
                <motion.button
                  type="button"
                  key={session.id}
                  className={`timeline-block ${statusClass(session.status)}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  initial={{ opacity: 0, scaleX: 0.85 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.2, delay: rowIndex * 0.05 + index * 0.03 }}
                  whileHover={{ scale: 1.03, zIndex: 5 }}
                  onClick={() => onSessionClick?.(session)}
                  title={`${session.title} · ${SESSION_STATUS_LABELS[session.status]}`}
                >
                  <span className="timeline-block-title">{session.title}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
