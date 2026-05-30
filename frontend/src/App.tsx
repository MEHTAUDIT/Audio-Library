import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import { TooltipProvider } from './components/ui/Tooltip';
import { AuthProvider, getAuthRedirectPath, useAuth } from './lib/auth';
import { ArchivedPage } from './pages/admin/ArchivedPage';
import { BulkUploadPage } from './pages/admin/BulkUploadPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ProcessUploadPage } from './pages/admin/ProcessUploadPage';
import { PublishedPage } from './pages/admin/PublishedPage';
import { StagingPage } from './pages/admin/StagingPage';
import { SeriesListPage } from './pages/admin/SeriesListPage';
import { SeriesManagePage } from './pages/admin/SeriesManagePage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { SeriesDetailPage } from './pages/library/SeriesDetailPage';
import { UploadPage } from './pages/admin/UploadPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/Registerpage';
import { AudioDetailPage } from './pages/library/AudioDetailPage';
import { LibraryPage } from './pages/library/LibraryPage';
import { QueuePage } from './pages/library/QueuePage';
import { SpeakerProfilePage } from './pages/SpeakerProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return <AdminLayout>{children}</AdminLayout>;
};

const PublicAuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={getAuthRedirectPath()} replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route
        path="/queue"
        element={
          <PrivateRoute>
            <QueuePage />
          </PrivateRoute>
        }
      />
        <Route path="/speaker/:speakerId" element={<SpeakerProfilePage />} />
        <Route path="/library/:id" element={<AudioDetailPage />} />
      <Route path="/series/:id" element={<SeriesDetailPage />} />  {/* ADDED */}
      <Route
        path="/login"
        element={
          <PublicAuthRoute>
            <LoginPage />
          </PublicAuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicAuthRoute>
            <RegisterPage />
          </PublicAuthRoute>
        }
      />
      <Route path="/signup" element={<Navigate to="/register" replace />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <DashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/upload"
        element={
          <AdminRoute>
            <UploadPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/bulk-upload"
        element={
          <AdminRoute>
            <BulkUploadPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/process-upload"
        element={
          <AdminRoute>
            <ProcessUploadPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/staging"
        element={
          <AdminRoute>
            <StagingPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/published"
        element={
          <AdminRoute>
            <PublishedPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/archived"
        element={
          <AdminRoute>
            <ArchivedPage />
          </AdminRoute>
        }
      />
      {/* Series management */}
      <Route
        path="/admin/series"
        element={
          <AdminRoute>
            <SeriesListPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/series/:id"
        element={
          <AdminRoute>
            <SeriesManagePage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <SettingsPage />
          </AdminRoute>
        }
      />

      {/* Legacy Routes */}
      <Route
        path="/owner"
        element={
          <PrivateRoute>
            <div className="p-8">Owner Portal</div>
          </PrivateRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router>
            <AppRoutes />
          </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;