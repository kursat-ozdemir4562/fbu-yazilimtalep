import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleMenu } from '../components/AppShell';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { THEME_STORAGE_KEY } from '../lib/constants';
import { ROLES } from '../types';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Tema: {theme}</button>;
}

describe('Tema yönetimi', () => {
  it('kayıtlı tercih yoksa koyu temayla açılır ve tercihi saklar', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Tema: dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('kayıtlı açık tema tercihini geri yükler', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Tema: light');
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
    expect(screen.getByText('Kullanıcı Yönetimi')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.queryByText('Yeni Talep')).not.toBeInTheDocument();
  });
});
