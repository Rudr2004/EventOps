import { apiClient } from './client';
import type { IncidentItem, IncidentSeverity, IncidentStatus } from '../types/incident';
import type { PaginatedResponse } from '../types/pagination';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export interface IncidentsQueryParams {
  page?: number;
  limit?: number;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}

export const incidentsApi = {
  list: async (params: IncidentsQueryParams): Promise<PaginatedResponse<IncidentItem>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<IncidentItem>>>('/incidents', {
      params,
    });
    return data.data;
  },
};
