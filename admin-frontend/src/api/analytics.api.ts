import { apiClient } from './client';
import type {
  ApprovalTurnaroundResponse,
  EventHealthEntry,
  IncidentAnalyticsResponse,
  OverviewResponse,
  WorkloadEntry,
} from '../types/analytics';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const analyticsApi = {
  getOverview: async (): Promise<OverviewResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<OverviewResponse>>('/analytics/overview');
    return data.data;
  },

  getWorkload: async (): Promise<WorkloadEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<WorkloadEntry[]>>('/analytics/workload');
    return data.data;
  },

  getIncidentAnalytics: async (): Promise<IncidentAnalyticsResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<IncidentAnalyticsResponse>>('/analytics/incidents');
    return data.data;
  },

  getEventHealth: async (): Promise<EventHealthEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<EventHealthEntry[]>>('/analytics/event-health');
    return data.data;
  },

  getApprovalTurnaround: async (): Promise<ApprovalTurnaroundResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<ApprovalTurnaroundResponse>>(
      '/analytics/approval-turnaround',
    );
    return data.data;
  },
};
