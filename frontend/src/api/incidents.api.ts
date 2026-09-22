import { apiClient } from './client';
import type {
  CreateIncidentPayload,
  IncidentActivityEntry,
  IncidentItem,
  IncidentsQueryParams,
  IncidentStatus,
  UpdateIncidentPayload,
} from '../types/incident';
import type { PaginatedResponse } from '../types/event';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const incidentsApi = {
  list: async (params: IncidentsQueryParams): Promise<PaginatedResponse<IncidentItem>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<IncidentItem>>>('/incidents', {
      params,
    });
    return data.data;
  },

  getById: async (id: string): Promise<IncidentItem> => {
    const { data } = await apiClient.get<ApiEnvelope<IncidentItem>>(`/incidents/${id}`);
    return data.data;
  },

  create: async (eventId: string, payload: CreateIncidentPayload): Promise<IncidentItem> => {
    const { data } = await apiClient.post<ApiEnvelope<IncidentItem>>(
      `/events/${eventId}/incidents`,
      payload,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateIncidentPayload): Promise<IncidentItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<IncidentItem>>(`/incidents/${id}`, payload);
    return data.data;
  },

  updateStatus: async (id: string, status: IncidentStatus): Promise<IncidentItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<IncidentItem>>(`/incidents/${id}/status`, {
      status,
    });
    return data.data;
  },

  getTimeline: async (id: string): Promise<IncidentActivityEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<IncidentActivityEntry[]>>(
      `/incidents/${id}/timeline`,
    );
    return data.data;
  },
};
