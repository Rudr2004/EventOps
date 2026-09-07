import { useAuth } from '../auth-context';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <h1>Welcome, {user?.name}</h1>
      <div className="profile-card">
        <dl>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
          <dt>Status</dt>
          <dd>{user?.isActive ? 'Active' : 'Deactivated'}</dd>
        </dl>
      </div>
    </div>
  );
}
