import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/auth-context';
import { LoginPage } from './features/auth/pages/login-page';
import { OverviewPage } from './features/dashboard/overview-page';
import { UsersPage } from './features/users/pages/users-page';
import { ApprovalsPage } from './features/approvals/pages/approvals-page';
import { IncidentsPage } from './features/incidents/pages/incidents-page';
import { EventsPage } from './features/events/pages/events-page';
import { AnalyticsPage } from './features/analytics/pages/analytics-page';
import { ProtectedRoute } from './routes/protected-route';
import { AppShell } from './components/layout/app-shell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <OverviewPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <UsersPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ApprovalsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <IncidentsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <EventsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AnalyticsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
