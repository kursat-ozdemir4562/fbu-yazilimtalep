import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, tokenStore } from '../lib/api';
import { unwrap } from '../lib/utils';
import type { AuthTokens, LoginResponse, User, UserRole } from '../types';

interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  completeSsoLogin: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(tokenStore.access()));

  const loadUser = useCallback(async () => {
    if (!tokenStore.access()) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiRequest<unknown>('/auth/me');
      setUser(unwrap<User>(response));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUser]);

  useEffect(() => {
    const expire = () => {
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('fbu:auth-expired', expire);
    return () => window.removeEventListener('fbu:auth-expired', expire);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiRequest<unknown>('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: input,
    });
    const auth = unwrap<LoginResponse>(response);
    if (!auth.accessToken) throw new Error('Sunucu geçerli bir oturum anahtarı döndürmedi.');
    tokenStore.set(auth, input.rememberMe);
    const currentUser = auth.user ?? unwrap<User>(await apiRequest<unknown>('/auth/me'));
    setUser(currentUser);
  }, []);

  const completeSsoLogin = useCallback(
    async (tokens: AuthTokens) => {
      tokenStore.set(tokens, true);
      setIsLoading(true);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokenStore.refresh() },
        retryOnUnauthorized: false,
      });
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(user?.roles.some((role) => roles.includes(role))),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      completeSsoLogin,
      logout,
      hasRole,
    }),
    [completeSsoLogin, hasRole, isLoading, login, logout, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
