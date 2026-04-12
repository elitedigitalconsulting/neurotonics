import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import LoginPage          from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage    from './pages/OrdersPage';
import ProductsPage  from './pages/ProductsPage';
import ContentPage   from './pages/ContentPage';
import SettingsPage  from './pages/SettingsPage';
import MediaPage     from './pages/MediaPage';
import UsersPage     from './pages/UsersPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="*"                element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Routes>
          <Route path="/"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders"    element={<OrdersPage />} />
          <Route path="/products"  element={<ProductsPage />} />
          <Route path="/content"   element={<ContentPage />} />
          <Route path="/media"     element={<MediaPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
          {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/admin">
          <AppShell />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
