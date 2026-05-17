import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignupPage } from './pages/auth/SignupPage';
import { LoginPage } from './pages/auth/LoginPage';
import { UserRegisterPage } from './pages/auth/UserRegisterPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { UploadPage } from './pages/admin/UploadPage';
import { BulkUploadPage } from './pages/admin/BulkUploadPage';
import { ProcessUploadPage } from './pages/admin/ProcessUploadPage';
import { StagingPage } from './pages/admin/StagingPage';
import { PublishedPage } from './pages/admin/PublishedPage';
import { ArchivedPage } from './pages/admin/ArchivedPage';
import { LibraryPage } from './pages/library/LibraryPage';
import { AudioDetailPage } from './pages/library/AudioDetailPage';
import { AdminLayout } from './components/layout/AdminLayout';
import { AuthProvider, useAuth } from './lib/auth';
import { TooltipProvider } from './components/ui/Tooltip';

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

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/library/:id" element={<AudioDetailPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<UserRegisterPage />} />

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
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
              <p className="text-slate-500 mt-2">Settings page coming soon.</p>
            </div>
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