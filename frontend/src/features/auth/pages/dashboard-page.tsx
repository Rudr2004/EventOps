import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth-context';
import { Role } from '../../../types/auth';
import { incidentsApi } from '../../../api/incidents.api';
import { IncidentSeverity, IncidentStatus } from '../../../types/incident';
import { Badge } from '../../../components/ui/badge';

const QUICK_LINKS = [
  { to: '/events', label: 'Events', desc: 'Lifecycle, approvals & schedules', icon: '◆' },
  { to: '/speakers', label: 'Speakers', desc: 'Shared speaker directory', icon: '◇' },
  { to: '/tasks', label: 'Tasks', desc: 'Operational task board', icon: '▤' },
  { to: '/incidents', label: 'Incidents', desc: 'Severity, status & timelines', icon: '▲' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  const criticalIncidentsQuery = useQuery({
    queryKey: ['incidents', 'dashboard-critical'],
    queryFn: () =>
      incidentsApi.list({ page: 1, limit: 20, severity: IncidentSeverity.CRITICAL }),
  });

  const openCritical = (criticalIncidentsQuery.data?.items ?? []).filter(
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
          Here's your workspace at a glance.
        </p>
      </motion.div>

      {openCritical.length > 0 && (
        <motion.div
          className="critical-banner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="critical-banner-dot" />
          <span>
            <strong>{openCritical.length}</strong> critical incident
            {openCritical.length > 1 ? 's' : ''} need attention
          </span>
          <div className="critical-banner-list">
            {openCritical.slice(0, 5).map((incident) => (
              <Link key={incident.id} to="/incidents" className="critical-banner-item">
                {incident.title}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="dashboard-grid">
        <motion.div
          className="profile-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 style={{ marginBottom: 14 }}>Your profile</h3>
          <dl>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
            <dt>Role</dt>
            <dd style={{ textTransform: 'capitalize' }}>{user?.role.replace('_', ' ')}</dd>
            <dt>Status</dt>
            <dd>
              {user?.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}
            </dd>
          </dl>
        </motion.div>
      </div>

      <h3 style={{ margin: '32px 0 14px' }}>Jump in</h3>
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

      {user?.role === Role.ADMIN && (
        <p className="dashboard-note">
          Organization-wide analytics and the admin user-management console are on the roadmap for a later phase.
        </p>
      )}
    </div>
  );
}
