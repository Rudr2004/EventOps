export const IncidentSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  [IncidentSeverity.CRITICAL]: 'Critical',
  [IncidentSeverity.HIGH]: 'High',
  [IncidentSeverity.MEDIUM]: 'Medium',
  [IncidentSeverity.LOW]: 'Low',
};

export const IncidentStatus = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  MITIGATED: 'mitigated',
  RESOLVED: 'resolved',
} as const;

export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  [IncidentStatus.OPEN]: 'Open',
  [IncidentStatus.INVESTIGATING]: 'Investigating',
  [IncidentStatus.MITIGATED]: 'Mitigated',
  [IncidentStatus.RESOLVED]: 'Resolved',
};

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]: [IncidentStatus.INVESTIGATING],
  [IncidentStatus.INVESTIGATING]: [IncidentStatus.MITIGATED],
  [IncidentStatus.MITIGATED]: [IncidentStatus.RESOLVED, IncidentStatus.INVESTIGATING],
  [IncidentStatus.RESOLVED]: [],
};

export interface IncidentActivityEntry {
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface IncidentItem {
  id: string;
  event: string;
  session: string | null;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignee: string | null;
  resolvedAt: string | null;
  activity: IncidentActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncidentPayload {
  title: string;
  description?: string;
  session?: string;
  severity: IncidentSeverity;
  assignee?: string;
}

export type UpdateIncidentPayload = Partial<CreateIncidentPayload>;

export interface IncidentsQueryParams {
  page?: number;
  limit?: number;
  event?: string;
  assignee?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}
