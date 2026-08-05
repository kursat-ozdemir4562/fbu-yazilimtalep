import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ProtectedRoute, RoleProtectedRoute } from '../components/ProtectedRoute';
import { ApiError } from '../lib/api';
import { ErrorState } from '../components/ui';
import { ROLES } from '../types';
import { jsonResponse } from './test-utils';

describe('Rota korumaları', () => {
  it('oturumu olmayan kullanıcıyı giriş sayfasına yönlendirir', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/gizli']}>
          <AuthProvider>
            <Switch>
              <Route path="/gizli">
                <ProtectedRoute>
                  <div>Gizli içerik</div>
                </ProtectedRoute>
              </Route>
              <Route path="/giris">
                <div>Giriş ekranı</div>
              </Route>
            </Switch>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(await screen.findByText('Giriş ekranı')).toBeInTheDocument();
  });

  it('yanlış role sahip kullanıcıyı yetkisiz sayfasına yönlendirir', async () => {
    localStorage.setItem('fbu-access-token', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            id: 'academic-1',
            fullName: 'Test Akademisyen',
            email: 'akademisyen@fbu.edu.tr',
            roles: [ROLES.academic],
          }),
        ),
      ),
    );
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/yonetim']}>
          <AuthProvider>
            <Switch>
              <Route path="/yonetim">
                <ProtectedRoute>
                  <RoleProtectedRoute roles={[ROLES.administrator]}>
                    <div>Yönetim içeriği</div>
                  </RoleProtectedRoute>
                </ProtectedRoute>
              </Route>
              <Route path="/yetkisiz">
                <div>Erişim reddedildi</div>
              </Route>
            </Switch>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(await screen.findByText('Erişim reddedildi')).toBeInTheDocument();
    expect(screen.queryByText('Yönetim içeriği')).not.toBeInTheDocument();
  });
});

describe('Hata durumları', () => {
  it('403 hatasını anlaşılır Türkçe mesajla gösterir', () => {
    render(<ErrorState error={new ApiError('Fakülte yetkisi bulunmuyor.', 403)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bu alan için yetkiniz yok');
    expect(screen.getByRole('alert')).toHaveTextContent('Fakülte yetkisi bulunmuyor.');
  });

  it('404 hatasını kayıt bulunamadı olarak gösterir', () => {
    render(<ErrorState error={new ApiError('Talep bulunamadı.', 404)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Kayıt bulunamadı');
  });
});
