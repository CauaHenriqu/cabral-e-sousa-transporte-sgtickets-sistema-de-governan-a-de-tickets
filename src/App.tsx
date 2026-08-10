import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Sobre from "./pages/Sobre";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProcessingProvider } from "@/contexts/ProcessingContext";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { installSupabaseProcessingInterceptor } from "@/lib/installSupabaseProcessingInterceptor";
import Layout from "@/components/Layout";

installSupabaseProcessingInterceptor();
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import FirstAccess from "@/pages/FirstAccess";
import Dashboard from "@/pages/Dashboard";
import TVDashboard from "@/pages/TVDashboard";

import TicketsList from "@/pages/TicketsList";
import AdminsPage from "@/pages/AdminsPage";
import UsersPage from "@/pages/UsersPage";
import AttendantsPage from "@/pages/AttendantsPage";
import TvUsersPage from "@/pages/TvUsersPage";
import ServicesPage from "@/pages/ServicesPage";
import ReturnReasonsPage from "@/pages/ReturnReasonsPage";
import FormsPage from "@/pages/FormsPage";
import AttendantServicesPage from "@/pages/AttendantServicesPage";
import SchedulesPage from "@/pages/SchedulesPage";
import ScheduledTicketsPage from "@/pages/ScheduledTicketsPage";
import LogsPage from "@/pages/LogsPage";
import MessagesPage from "@/pages/MessagesPage";
import SettingsPage from "@/pages/SettingsPage";
import ApprovalFlowsPage from "@/pages/ApprovalFlowsPage";
import MyApprovalsPage from "@/pages/MyApprovalsPage";
import NotFound from "@/pages/NotFound";
import Unsubscribe from "@/pages/Unsubscribe";
import InstallApp from "@/pages/InstallApp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const defaultPathFor = (role?: string) => {
  if (role === 'user') return '/tickets';
  if (role === 'tv') return '/tv';
  return '/dashboard';
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.firstLogin) return <Navigate to="/primeiro-acesso" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to={defaultPathFor(user.role)} replace />;
  return <Layout>{children}</Layout>;
};

const FirstAccessRoute: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user?.firstLogin) return <Navigate to={defaultPathFor(user?.role)} replace />;
  return <FirstAccess />;
};

const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated
            ? user?.firstLogin
              ? <Navigate to="/primeiro-acesso" replace />
              : <Navigate to={defaultPathFor(user?.role)} replace />
            : <Login />
        }
      />
      <Route path="/primeiro-acesso" element={<FirstAccessRoute />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'attendant']}><Dashboard /></ProtectedRoute>} />
      <Route path="/tv" element={<ProtectedRoute roles={['admin', 'attendant', 'tv']}><TVDashboard /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><TicketsList /></ProtectedRoute>} />
      <Route path="/admins" element={<ProtectedRoute roles={['admin']}><AdminsPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="/attendants" element={<ProtectedRoute roles={['admin']}><AttendantsPage /></ProtectedRoute>} />
      <Route path="/tv-users" element={<ProtectedRoute roles={['admin']}><TvUsersPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute roles={['admin']}><ServicesPage /></ProtectedRoute>} />
      <Route path="/return-reasons" element={<ProtectedRoute><ReturnReasonsPage /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute roles={['admin']}><FormsPage /></ProtectedRoute>} />
      <Route path="/attendant-services" element={<ProtectedRoute roles={['admin']}><AttendantServicesPage /></ProtectedRoute>} />
      <Route path="/schedules" element={<ProtectedRoute roles={['admin']}><SchedulesPage /></ProtectedRoute>} />
      <Route path="/scheduled-tickets" element={<ProtectedRoute roles={['admin']}><ScheduledTicketsPage /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute roles={['admin']}><LogsPage /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute roles={['admin']}><MessagesPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/approval-flows" element={<ProtectedRoute roles={['admin']}><ApprovalFlowsPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><MyApprovalsPage /></ProtectedRoute>} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/install" element={<InstallApp />} />
      <Route path="/sobre" element={<Sobre />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Main app component
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ProcessingProvider>
        <ProcessingOverlay />
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </ProcessingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
