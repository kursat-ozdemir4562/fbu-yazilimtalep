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

export type Theme =
  | 'midnight-command'
  | 'graphite-control'
  | 'deep-ocean'
  | 'secure-forest'
  | 'burgundy-ops'
  | 'violet-signal'
  | 'white-console';

export const THEME_OPTIONS: Array<{ id: Theme; label: string }> = [
  { id: 'midnight-command', label: 'Midnight Command' },
  { id: 'graphite-control', label: 'Graphite Control' },
  { id: 'deep-ocean', label: 'Deep Ocean' },
  { id: 'secure-forest', label: 'Secure Forest' },
  { id: 'burgundy-ops', label: 'Burgundy Ops' },
  { id: 'violet-signal', label: 'Violet Signal' },
  { id: 'white-console', label: 'White Console' },
];

const LIGHT_THEME: Theme = 'white-console';
const DEFAULT_DARK_THEME: Theme = 'midnight-command';
const KNOWN_THEMES = new Set<string>(THEME_OPTIONS.map((option) => option.id));
const LAST_DARK_THEME_KEY = 'fbu-lab-last-dark-theme';

// Hızlı üst bar ikonu beyaz moda geçerken kullanıcının o an açık olan koyu temayı
// (Profilim'den seçtiği 7 temadan biri olabilir) hatırlar, tekrar koyu moda dönünce
// hep 'midnight-command'a değil, en son kullanılan koyu temaya döner.
function readLastDarkTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_DARK_THEME;
  try {
    const stored = window.localStorage.getItem(LAST_DARK_THEME_KEY);
    if (stored && stored !== LIGHT_THEME && KNOWN_THEMES.has(stored)) return stored as Theme;
  } catch {
    // localStorage erişilemiyorsa (gizli sekme vb.) sessizce yok say.
  }
  return DEFAULT_DARK_THEME;
}

function writeLastDarkTheme(value: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_DARK_THEME_KEY, value);
  } catch {
    // yok say
  }
}

// Sunucuda önceden kaydedilmiş eski 'dark'/'light' değerlerini (7 temalı yapıdan önceki
// ikili sistem) yeni slug'lara eşler; tanınmayan/boş bir değer gelirse sistem tercihine düşer.
export function normalizeTheme(value?: string | null): Theme {
  if (value === 'dark') return DEFAULT_DARK_THEME;
  if (value === 'light') return LIGHT_THEME;
  if (value && KNOWN_THEMES.has(value)) return value as Theme;
  return systemTheme();
}

interface SetThemeOptions {
  // false when syncing a value already known to the server (e.g. loaded from /auth/me),
  // to avoid writing it straight back.
  persist?: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme, options?: SetThemeOptions) => Promise<void>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_DARK_THEME;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK_THEME : LIGHT_THEME;
  } catch {
    return DEFAULT_DARK_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(systemTheme);

  const setTheme = useCallback((nextTheme: Theme, options?: SetThemeOptions): Promise<void> => {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    if (nextTheme !== LIGHT_THEME) writeLastDarkTheme(nextTheme);
    if (options?.persist === false || !tokenStore.access()) return Promise.resolve();
    return apiRequest('/auth/me/theme', { method: 'POST', body: { theme: nextTheme } }).then(() => undefined);
  }, []);

  // Hızlı üst bar ikonu 7 temayı sığdıramaz; beyaz mod ile en son kullanılan koyu tema
  // arasında geçiş yapar (Profilim > Kişisel Görünüm'de seçilen tema neyse o hatırlanır).
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === LIGHT_THEME ? readLastDarkTheme() : LIGHT_THEME;
    setTheme(nextTheme).catch(() => {
      // Hızlı geçiş kritik değil; sunucuya yazılamazsa sessizce yok say.
    });
  }, [setTheme, theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isDark = theme !== LIGHT_THEME;
  const value = useMemo(
    () => ({ theme, isDark, setTheme, toggleTheme }),
    [isDark, setTheme, theme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme, ThemeProvider içinde kullanılmalıdır.');
  return context;
}
