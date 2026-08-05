import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleMenu } from '../components/AppShell';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ROLES } from '../types';
import { jsonResponse } from './test-utils';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Tema: {theme}</button>;
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
    expect(screen.getByRole('button')).toHaveTextContent('Tema: midnight-command');
    expect(document.documentElement.dataset.theme).toBe('midnight-command');
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Tema: white-console');
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

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Tema: midnight-command');
    const themeCall = fetchMock.mock.calls.find(([input]) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      return url.endsWith('/auth/me/theme');
    }) as [RequestInfo | URL, RequestInit] | undefined;
    expect(themeCall).toBeDefined();
    expect(JSON.parse(themeCall![1].body as string)).toEqual({ theme: 'midnight-command' });
  });
});

describe('Rol bazlı menü', () => {
  it('akademisyene yönetim menülerini göstermez', () => {
    render(
      <MemoryRouter>
        <RoleMenu roles={[ROLES.academic]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Taleplerim')).toBeInTheDocument();
    expect(screen.getByText('Yeni Talep')).toBeInTheDocument();
    expect(screen.queryByText('Kullanıcı Yönetimi')).not.toBeInTheDocument();
  });

  it('sistem yöneticisine yönetim menülerini gösterir', () => {
    render(
      <MemoryRouter>
        <RoleMenu roles={[ROLES.administrator]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sistem Ayarları')).toBeInTheDocument();
    expect(screen.getByText('Fakülte Yönetimi')).toBeInTheDocument();
    expect(screen.queryByText('Yeni Talep')).not.toBeInTheDocument();
  });
});
