import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../../api/health.api';

export function HealthIndicator() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.check,
    refetchInterval: 30_000,
    retry: false,
  });

  const isOk = !isError && data?.status === 'ok';

  return (
    <span className="app-health" title={isOk ? `Database ${data?.database}` : 'API unreachable'}>
      <span className={`app-health-dot ${isOk ? 'ok' : 'down'}`} />
      {isOk ? 'Systems normal' : 'Connection issue'}
    </span>
  );
}
