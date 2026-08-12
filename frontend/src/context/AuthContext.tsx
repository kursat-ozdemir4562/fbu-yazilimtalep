import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ACCESS_KEY, apiRequest, tokenStore } from '../lib/api';
import { unwrap } from '../lib/utils';
import { normalizeTheme, useTheme } from './ThemeContext';
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

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 10 * 1000;
const IDLE_ACTIVITY_WRITE_THROTTLE_MS = 2 * 1000;
const IDLE_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;
const LAST_ACTIVITY_KEY = 'fbu-last-activity';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(tokenStore.access()));
  const { setTheme } = useTheme();

  const applyUser = useCallback(
    (currentUser: User) => {
      setUser(currentUser);
      if (currentUser.themePreference)
        void setTheme(normalizeTheme(currentUser.themePreference), { persist: false });
    },
    [setTheme],
  );

  const loadUser = useCallback(async () => {
    if (!tokenStore.access()) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiRequest<unknown>('/auth/me');
      applyUser(unwrap<User>(response));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyUser]);

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
    applyUser(currentUser);
  }, [applyUser]);

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

  useEffect(() => {
    if (!user) return;
    let lastWriteAt = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWriteAt < IDLE_ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWriteAt = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    };
    markActive();
    IDLE_ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true }),
    );
    const interval = window.setInterval(() => {
      const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
      if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) void logout().catch(() => {});
    }, IDLE_CHECK_INTERVAL_MS);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCESS_KEY && event.newValue === null) setUser(null);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      IDLE_ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [user, logout]);

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
