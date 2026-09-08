export interface OverviewResponse {
  eventsByStatus: Record<string, number>;
  upcomingEvents: { next7Days: number; next30Days: number };
  tasks: { open: number; overdue: number };
}

export interface WorkloadEntry {
  assignee: string;
  total: number;
  done: number;
  completionRate: number;
  byStatus: Record<string, number>;
}

export interface IncidentAnalyticsResponse {
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  averageResolutionHours: number | null;
}

export interface ApprovalTurnaroundResponse {
  averageHours: number | null;
  sampleSize: number;
}

export interface RoomUtilizationEntry {
  room: string;
  sessionCount: number;
  totalMinutes: number;
}

export interface EventHealthEntry {
  eventId: string;
  eventName: string;
  status: string;
  overdueTaskCount: number;
  unresolvedIncidentCount: number;
  criticalIncidentCount: number;
  healthScore: number;
}
