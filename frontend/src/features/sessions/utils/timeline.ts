import type { SessionItem } from '../../../types/session';

export interface TimelineBounds {
  startHour: number;
  endHour: number;
}

export function computeTimelineBounds(sessions: SessionItem[]): TimelineBounds {
  if (sessions.length === 0) {
    return { startHour: 8, endHour: 18 };
  }

  let minHour = 24;
  let maxHour = 0;

  for (const session of sessions) {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    minHour = Math.min(minHour, start.getHours());
    maxHour = Math.max(maxHour, end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
  }

  return {
    startHour: Math.max(0, Math.min(minHour, 8)),
    endHour: Math.min(24, Math.max(maxHour, 18)),
  };
}

export function timeToOffsetPercent(date: Date, bounds: TimelineBounds): number {
  const totalMinutes = (bounds.endHour - bounds.startHour) * 60;
  const minutesFromStart =
    (date.getHours() - bounds.startHour) * 60 + date.getMinutes();
  return (minutesFromStart / totalMinutes) * 100;
}

export function durationToWidthPercent(start: Date, end: Date, bounds: TimelineBounds): number {
  const totalMinutes = (bounds.endHour - bounds.startHour) * 60;
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  return (durationMinutes / totalMinutes) * 100;
}

export function groupSessionsByRoom(sessions: SessionItem[]): Map<string, SessionItem[]> {
  const grouped = new Map<string, SessionItem[]>();
  for (const session of sessions) {
    const existing = grouped.get(session.room) ?? [];
    existing.push(session);
    grouped.set(session.room, existing);
  }
  return grouped;
}

export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}
