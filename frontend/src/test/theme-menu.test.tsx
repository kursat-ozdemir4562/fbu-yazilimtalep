import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleMenu } from '../components/AppShell';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ROLES } from '../types';
import { jsonResponse, renderWithProviders } from './test-utils';

function ThemeProbe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <>
      <button onClick={toggleTheme}>Tema: {theme}</button>
      <button onClick={() => void setTheme('violet-signal')}>Violet Signal seç</button>
    </>
  );
}

function themeButton() {
  return screen.getByRole('button', { name: /^Tema:/ });
}

describe('Tema yönetimi', () => {
  it('oturum yokken sistem tercihine göre koyu temayla açılır ve sunucuya yazmadan değişir', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(themeButton()).toHaveTextContent('Tema: midnight-command');
    expect(document.documentElement.dataset.theme).toBe('midnight-command');
    await user.click(themeButton());
    expect(themeButton()).toHaveTextContent('Tema: white-console');
    expect(document.documentElement.dataset.theme).toBe('white-console');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('girişte kayıtlı tema tercihini sunucudan geri yükler ve değişiklikleri sunucuya kaydeder', async () => {
    // Sunucu eski (7 temalı yapıdan önceki) 'light' değerini döndürüyor — normalizeTheme bunu
    // 'white-console'a eşlemeli (geriye dönük uyumluluk).
    localStorage.setItem('fbu-access-token', 'test-token');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(
          jsonResponse({
            id: 'academic-1',
            fullName: 'Test Akademisyen',
            email: 'akademisyen@fbu.edu.tr',
            roles: [ROLES.academic],
            themePreference: 'light',
          }),
        );
      }
      if (url.endsWith('/auth/me/theme')) return Promise.resolve(jsonResponse({}, 204));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AuthProvider>
          <ThemeProbe />
        </AuthProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByText('Tema: white-console')).toBeInTheDocument();

    await user.click(themeButton());
    expect(themeButton()).toHaveTextContent('Tema: midnight-command');
    const themeCall = fetchMock.mock.calls.find(([input]) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      return url.endsWith('/auth/me/theme');
    }) as [RequestInfo | URL, RequestInit] | undefined;
    expect(themeCall).toBeDefined();
    expect(JSON.parse(themeCall![1].body as string)).toEqual({ theme: 'midnight-command' });
  });

  it('beyaz moda geçip geri dönünce en son seçilen koyu temayı (varsayılanı değil) geri getirir', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Violet Signal seç' }));
    expect(themeButton()).toHaveTextContent('Tema: violet-signal');

    await user.click(themeButton());
    expect(themeButton()).toHaveTextContent('Tema: white-console');

    await user.click(themeButton());
    expect(themeButton()).toHaveTextContent('Tema: violet-signal');
  });
});

describe('Rol bazlı menü', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ isOpen: true, enabled: true, startDate: null, endDate: null }))),
    );
  });

  it('akademisyene yönetim menülerini göstermez', () => {
    renderWithProviders(<RoleMenu roles={[ROLES.academic]} />);
    expect(screen.getByText('Taleplerim')).toBeInTheDocument();
    expect(screen.getByText('Yeni Talep')).toBeInTheDocument();
    expect(screen.queryByText('Kullanıcı Yönetimi')).not.toBeInTheDocument();
  });

  it('sistem yöneticisine yönetim menülerini gösterir', () => {
    renderWithProviders(<RoleMenu roles={[ROLES.administrator]} />);
    expect(screen.getByText('Sistem Ayarları')).toBeInTheDocument();
    expect(screen.getByText('Fakülte Yönetimi')).toBeInTheDocument();
    expect(screen.queryByText('Yeni Talep')).not.toBeInTheDocument();
  });
});
