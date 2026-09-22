import type { IncidentDocument } from './schemas/incident.schema.js';

export interface IncidentActivityResponse {
  actor: string;
  action: string;
  detail: string;
  createdAt: Date;
}

export interface IncidentResponse {
  id: string;
  event: string;
  session: string | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignee: string | null;
  resolvedAt: Date | null;
  activity: IncidentActivityResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export function toIncidentResponse(incident: IncidentDocument): IncidentResponse {
  return {
    id: incident._id.toString(),
    event: incident.event.toString(),
    session: incident.session ? incident.session.toString() : null,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    assignee: incident.assignee ? incident.assignee.toString() : null,
    resolvedAt: incident.resolvedAt,
    activity: incident.activity.map((entry) => ({
      actor: entry.actor.toString(),
      action: entry.action,
      detail: entry.detail,
      createdAt: (entry as unknown as { createdAt: Date }).createdAt,
    })),
    createdAt: (incident as unknown as { createdAt: Date }).createdAt,
    updatedAt: (incident as unknown as { updatedAt: Date }).updatedAt,
  };
}
