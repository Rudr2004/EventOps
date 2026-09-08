export enum IncidentSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  MITIGATED = 'mitigated',
  RESOLVED = 'resolved',
}

/**
 * Strictly linear lifecycle with one reopen loop: a Mitigated incident can
 * flare back up into Investigating if the fix didn't hold. Resolved is
 * terminal — matches the discipline used for Event and Task transitions.
 */
export const ALLOWED_INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]: [IncidentStatus.INVESTIGATING],
  [IncidentStatus.INVESTIGATING]: [IncidentStatus.MITIGATED],
  [IncidentStatus.MITIGATED]: [IncidentStatus.RESOLVED, IncidentStatus.INVESTIGATING],
  [IncidentStatus.RESOLVED]: [],
};

export function isValidIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_INCIDENT_TRANSITIONS[from]?.includes(to) ?? false;
}
