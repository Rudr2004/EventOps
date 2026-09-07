import { apiClient } from './client';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  database: string;
}

export const healthApi = {
  check: async (): Promise<HealthStatus> => {
    const { data } = await apiClient.get<ApiEnvelope<HealthStatus>>('/health');
    return data.data;
  },
};
