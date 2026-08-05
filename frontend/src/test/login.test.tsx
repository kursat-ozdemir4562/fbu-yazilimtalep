import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { LoginPage } from '../pages/LoginPage';

describe('Giriş formu', () => {
  it('zorunlu alanları ve e-posta biçimini doğrular', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /yerel giriş/i }));
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));
    expect(await screen.findByText('E-posta adresinizi girin.')).toBeInTheDocument();
    expect(screen.getByText('Parolanızı girin.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('ad.soyad@fbu.edu.tr'), 'gecersiz');
    await user.click(screen.getByRole('button', { name: /giriş yap/i }));
    expect(await screen.findByText('Geçerli bir e-posta adresi girin.')).toBeInTheDocument();
  });

  it('parola görünürlüğünü değiştirir', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: /yerel giriş/i }));
    const password = screen.getByLabelText('Parola');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Parolayı göster' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
