import { Redirect, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LoadingState } from './ui';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState label="Oturum doğrulanıyor…" />;
  if (!isAuthenticated) return <Redirect to={{ pathname: '/giris', state: { from: location } }} />;
  return <>{children}</>;
}

export function RoleProtectedRoute({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) return <Redirect to="/yetkisiz" />;
  return <>{children}</>;
}
