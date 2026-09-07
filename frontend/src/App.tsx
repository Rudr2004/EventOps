import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/auth-context';
import { LoginPage } from './features/auth/pages/login-page';
import { RegisterPage } from './features/auth/pages/register-page';
import { DashboardPage } from './features/auth/pages/dashboard-page';
import { EventsListPage } from './features/events/pages/events-list-page';
import { EventDetailPage } from './features/events/pages/event-detail-page';
import { SpeakersPage } from './features/speakers/pages/speakers-page';
import { TaskBoardPage } from './features/tasks/pages/task-board-page';
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
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <EventsListPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <EventDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/speakers"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SpeakersPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <TaskBoardPage />
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
