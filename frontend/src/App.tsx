import type { ReactNode } from 'react';
import { Route, Switch } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute, RoleProtectedRoute } from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import { ROLES, type UserRole } from './types';
import { HomeRedirect } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { SsoCallbackPage } from './pages/SsoCallbackPage';
import { NotFoundPage, UnauthorizedPage } from './pages/ErrorPages';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestWizardPage } from './pages/RequestWizardPage';
import { ManagementPage } from './pages/ManagementPages';
import { AuditPage, NotificationsPage, ReportsPage, SettingsPage } from './pages/OperationsPages';
import { ProfilePage } from './pages/ProfilePage';
import { SchedulePage } from './pages/SchedulePage';

function SecuredPage({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const page = roles ? <RoleProtectedRoute roles={roles}>{children}</RoleProtectedRoute> : children;
  return (
    <ProtectedRoute>
      <AppShell>{page}</AppShell>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Switch>
        <Route exact path="/giris">
          <LoginPage />
        </Route>
        <Route exact path="/sso/callback">
          <SsoCallbackPage />
        </Route>
        <Route exact path="/parolami-unuttum">
          <ForgotPasswordPage />
        </Route>
        <Route exact path="/yetkisiz">
          <ProtectedRoute>
            <UnauthorizedPage />
          </ProtectedRoute>
        </Route>
        <Route exact path="/baslangic">
          <SecuredPage>
            <HomeRedirect />
          </SecuredPage>
        </Route>
        <Route exact path="/talepler/:id/duzenle">
          <SecuredPage roles={[ROLES.academic, ROLES.administrative, ROLES.faculty, ROLES.administrator]}>
            <RequestWizardPage />
          </SecuredPage>
        </Route>
        <Route exact path="/talepler/:id">
          <SecuredPage>
            <RequestDetailPage />
          </SecuredPage>
        </Route>
        <Route exact path="/raporlar">
          <SecuredPage>
            <ReportsPage />
          </SecuredPage>
        </Route>
        <Route exact path="/bildirimler">
          <SecuredPage>
            <NotificationsPage />
          </SecuredPage>
        </Route>
        <Route exact path="/">
          <SecuredPage>
            <HomeRedirect />
          </SecuredPage>
        </Route>
        <Route exact path="/talepler">
          <SecuredPage>
            <RequestsPage />
          </SecuredPage>
        </Route>
        <Route exact path="/talep/yeni">
          <SecuredPage roles={[ROLES.academic, ROLES.administrative]}>
            <RequestWizardPage />
          </SecuredPage>
        </Route>
        <Route exact path="/programlar">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="software" />
          </SecuredPage>
        </Route>
        <Route exact path="/fakulteler">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="faculties" />
          </SecuredPage>
        </Route>
        <Route exact path="/laboratuvarlar">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="laboratories" />
          </SecuredPage>
        </Route>
        <Route exact path="/kullanicilar">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="users" />
          </SecuredPage>
        </Route>
        <Route exact path="/yetkiler">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="permissions" />
          </SecuredPage>
        </Route>
        <Route exact path="/donemler">
          <SecuredPage roles={[ROLES.administrator]}>
            <ManagementPage kind="terms" />
          </SecuredPage>
        </Route>
        <Route exact path="/ders-programi">
          <SecuredPage roles={[ROLES.administrator]}>
            <SchedulePage />
          </SecuredPage>
        </Route>
        <Route exact path="/audit">
          <SecuredPage roles={[ROLES.administrator]}>
            <AuditPage />
          </SecuredPage>
        </Route>
        <Route exact path="/ayarlar">
          <SecuredPage roles={[ROLES.administrator]}>
            <SettingsPage />
          </SecuredPage>
        </Route>
        <Route exact path="/profilim">
          <SecuredPage>
            <ProfilePage />
          </SecuredPage>
        </Route>
        <Route>
          <NotFoundPage />
        </Route>
      </Switch>
    </ToastProvider>
  );
}
