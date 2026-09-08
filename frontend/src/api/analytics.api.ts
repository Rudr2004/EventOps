import { apiClient } from './client';
import type {
  ApprovalTurnaroundResponse,
  EventHealthEntry,
  IncidentAnalyticsResponse,
  OverviewResponse,
  RoomUtilizationEntry,
  WorkloadEntry,
} from '../types/analytics';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

interface AnalyticsParams {
  event?: string;
}

export const analyticsApi = {
  getOverview: async (params: AnalyticsParams): Promise<OverviewResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<OverviewResponse>>('/analytics/overview', { params });
    return data.data;
  },

  getWorkload: async (params: AnalyticsParams): Promise<WorkloadEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<WorkloadEntry[]>>('/analytics/workload', { params });
    return data.data;
  },

  getIncidentAnalytics: async (params: AnalyticsParams): Promise<IncidentAnalyticsResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<IncidentAnalyticsResponse>>('/analytics/incidents', {
      params,
    });
    return data.data;
  },

  getEventHealth: async (params: AnalyticsParams): Promise<EventHealthEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<EventHealthEntry[]>>('/analytics/event-health', {
      params,
    });
    return data.data;
  },

  getApprovalTurnaround: async (params: AnalyticsParams): Promise<ApprovalTurnaroundResponse> => {
    const { data } = await apiClient.get<ApiEnvelope<ApprovalTurnaroundResponse>>(
      '/analytics/approval-turnaround',
      { params },
    );
    return data.data;
  },

  getRoomUtilization: async (params: AnalyticsParams): Promise<RoomUtilizationEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<RoomUtilizationEntry[]>>(
      '/analytics/room-utilization',
      { params },
    );
    return data.data;
  },
};
