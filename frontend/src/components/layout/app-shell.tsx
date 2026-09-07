import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-title">EventOps</span>
          <nav className="app-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/speakers">Speakers</NavLink>
            <NavLink to="/tasks">Tasks</NavLink>
          </nav>
        </div>
        {user && (
          <div className="app-user">
            <span>
              {user.name} · {user.role.replace('_', ' ')}
            </span>
            <button type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
