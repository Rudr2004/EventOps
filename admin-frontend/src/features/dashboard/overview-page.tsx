import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { eventsApi } from '../../api/events.api';
import { incidentsApi } from '../../api/incidents.api';
import { EventStatus } from '../../types/event';
import { IncidentSeverity, IncidentStatus } from '../../types/incident';

const QUICK_LINKS = [
  { to: '/users', label: 'Users', desc: 'Roles & account status', icon: '◈' },
  { to: '/approvals', label: 'Approvals', desc: 'Org-wide approval queue', icon: '◆' },
  { to: '/incidents', label: 'Incidents', desc: 'Every incident, every event', icon: '▲' },
  { to: '/events', label: 'Events', desc: 'Full event directory', icon: '◇' },
  { to: '/analytics', label: 'Analytics', desc: 'Organization-wide dashboard', icon: '▤' },
];

export function OverviewPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  const pendingQuery = useQuery({
    queryKey: ['events', 'approval-queue-count'],
    queryFn: () => eventsApi.list({ page: 1, limit: 1, status: EventStatus.APPROVAL_PENDING }),
  });

  const criticalQuery = useQuery({
    queryKey: ['incidents', 'dashboard-critical'],
    queryFn: () => incidentsApi.list({ page: 1, limit: 20, severity: IncidentSeverity.CRITICAL }),
  });

  const openCritical = (criticalQuery.data?.items ?? []).filter(
    (i) => i.status !== IncidentStatus.RESOLVED,
  );

  return (
    <div className="dashboard-page">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1>Welcome back, {firstName}</h1>
        <p style={{ color: 'var(--text-soft)', margin: '0 0 28px', fontSize: 14.5 }}>
          Organization-wide oversight.
        </p>
      </motion.div>

      {openCritical.length > 0 && (
        <div className="critical-banner">
          <span className="critical-banner-dot" />
          <span>
            <strong>{openCritical.length}</strong> critical incident{openCritical.length > 1 ? 's' : ''}{' '}
            unresolved
          </span>
          <Link to="/incidents" className="critical-banner-item">
            View all
          </Link>
        </div>
      )}

      {(pendingQuery.data?.meta.total ?? 0) > 0 && (
        <div className="analytics-grid" style={{ marginBottom: 20 }}>
          <div className="stat-tile stat-tile-accent">
            <span className="stat-tile-label">Awaiting approval</span>
            <span className="stat-tile-value">{pendingQuery.data?.meta.total}</span>
          </div>
        </div>
      )}

      <h3 style={{ margin: '8px 0 14px' }}>Jump in</h3>
      <div className="quick-link-grid">
        {QUICK_LINKS.map((link, i) => (
          <motion.div
            key={link.to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to={link.to} className="quick-link-card">
              <span className="quick-link-icon">{link.icon}</span>
              <span className="quick-link-label">{link.label}</span>
              <span className="quick-link-desc">{link.desc}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
