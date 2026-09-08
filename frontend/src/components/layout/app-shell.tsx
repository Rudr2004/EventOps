import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { HealthIndicator } from './health-indicator';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-brand">
            <span className="app-brand-mark">Eo</span>
            <span className="app-title">EventOps</span>
          </div>
          <nav className="app-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/speakers">Speakers</NavLink>
            <NavLink to="/tasks">Tasks</NavLink>
            <NavLink to="/incidents">Incidents</NavLink>
          </nav>
          <HealthIndicator />
        </div>
        {user && (
          <div className="app-user">
            <div className="app-user-info">
              <span className="app-user-name">{user.name}</span>
              <span className="app-user-role">{user.role.replace('_', ' ')}</span>
            </div>
            <button type="button" className="btn-logout" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
