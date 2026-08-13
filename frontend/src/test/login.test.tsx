import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { LoginPage } from '../pages/LoginPage';

function renderLoginPage() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Giriş sayfası', () => {
  it('yalnızca kurumsal hesapla giriş seçeneğini gösterir', () => {
    renderLoginPage();

    expect(screen.getByRole('link', { name: /microsoft ile giriş yap/i })).toHaveAttribute(
      'href',
      '/auth/saml/SignIn',
    );
    expect(screen.queryByRole('button', { name: /yerel giriş/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('ad.soyad@fbu.edu.tr')).not.toBeInTheDocument();
  });
});
