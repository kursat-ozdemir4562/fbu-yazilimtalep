import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  LockKeyhole,
  Moon,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Redirect, useHistory, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button, FieldError } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../lib/utils';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'E-posta adresinizi girin.')
    .email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Parolanızı girin.').min(8, 'Parola en az 8 karakter olmalıdır.'),
  rememberMe: z.boolean(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

function MicrosoftLogo() {
  return (
    <svg className="ms-logo" width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const history = useHistory();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const ssoError = new URLSearchParams(location.search).get('sso');
  const [serverError, setServerError] = useState(
    ssoError === 'pasif'
      ? 'Kurumsal hesabınız pasif durumda. Lütfen yöneticinize başvurun.'
      : ssoError === 'hata'
        ? 'Kurumsal hesap girişi tamamlanamadı. Lütfen tekrar deneyin.'
        : '',
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  if (isAuthenticated) return <Redirect to="/baslangic" />;

  const submit = async (values: LoginFormData) => {
    setServerError('');
    try {
      await login(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      history.replace(from ?? '/baslangic');
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <main className="login-page">
      <button
        className="theme-fab"
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      >
        {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
      <section className="login-showcase" aria-label="Sistem tanıtımı">
        <div className="login-showcase__glow" />
        <div className="login-showcase__brand">
          <img
            className="brand-mark brand-mark--large"
            src="/fbu-logo.png"
            alt="Fenerbahçe Üniversitesi"
          />
          <div>
            <strong>Fenerbahçe Üniversitesi</strong>
            <span>Bilgi Teknolojileri Direktörlüğü</span>
          </div>
        </div>
        <div className="login-showcase__content">
          <span className="showcase-pill">
            <Sparkles aria-hidden="true" /> Tek merkezden süreç yönetimi
          </span>
          <h1>FBU Laboratuvar Yazılım Talep Sistemi</h1>
          <p>
            Derslerinizde kullanacağınız yazılımları bildirin; değerlendirme, lisanslama ve kurulum
            süreçlerini adım adım takip edin.
          </p>
          <div className="feature-list">
            <div>
              <span>
                <FlaskConical aria-hidden="true" />
              </span>
              <div>
                <strong>Laboratuvar planlama</strong>
                <small>Kapasite ve ders programıyla uyumlu seçimler</small>
              </div>
            </div>
            <div>
              <span>
                <ShieldCheck aria-hidden="true" />
              </span>
              <div>
                <strong>Yetki odaklı erişim</strong>
                <small>Kişi ve fakülte sınırlarında güvenli veri erişimi</small>
              </div>
            </div>
            <div>
              <span>
                <CheckCircle2 aria-hidden="true" />
              </span>
              <div>
                <strong>Şeffaf takip</strong>
                <small>Talep, onay ve kurulum durumlarını anlık görün</small>
              </div>
            </div>
          </div>
        </div>
        <small className="login-showcase__footer">© 2026 Fenerbahçe Üniversitesi</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand">
            <img className="brand-mark" src="/fbu-logo.png" alt="Fenerbahçe Üniversitesi" />
            <strong>Lab Yazılım Talep Sistemi</strong>
          </div>

          {serverError && (
            <div className="alert alert--error" role="alert">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>Giriş yapılamadı</strong>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          {!showLocalLogin ? (
            <div className="login-sso">
              <div className="login-card__heading login-card__heading--center">
                <span className="eyebrow">Güvenli oturum</span>
                <h2>Fenerbahçe Üniversitesi hesabınızla giriş yapın</h2>
              </div>

              <a href="/auth/saml/SignIn" className="button--sso">
                <MicrosoftLogo />
                Microsoft ile Giriş Yap
              </a>

              <p className="login-sso__hint">
                SAML girişi aktiftir. Giriş için Microsoft butonunu kullanın.
              </p>

              <button
                type="button"
                className="login-sso__local-toggle"
                onClick={() => setShowLocalLogin(true)}
              >
                <ShieldQuestion aria-hidden="true" />
                Yerel Giriş (Sistem Yöneticisi)
              </button>
            </div>
          ) : (
            <form
              className="login-local"
              onSubmit={(event) => void handleSubmit(submit)(event)}
              noValidate
            >
              <div className="login-card__heading">
                <span className="eyebrow">Sistem yöneticisi</span>
                <h2>Yerel hesapla giriş yap</h2>
                <p>Bu giriş yöntemi yalnızca sistem yöneticileri içindir.</p>
              </div>

              <label className="field">
                <span>E-posta adresi</span>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="ad.soyad@fbu.edu.tr"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </label>

              <label className="field">
                <span>Parola</span>
                <span className="input-with-action">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    aria-invalid={Boolean(errors.password)}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Parolayı gizle' : 'Parolayı göster'}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
                <FieldError>{errors.password?.message}</FieldError>
              </label>

              <div className="login-options">
                <label className="checkbox">
                  <input type="checkbox" {...register('rememberMe')} />
                  <span>Beni hatırla</span>
                </label>
                <Link to="/parolami-unuttum">Parolamı unuttum</Link>
              </div>

              <Button type="submit" isLoading={isSubmitting} className="button--full">
                Giriş yap <ArrowRight aria-hidden="true" />
              </Button>

              <button
                type="button"
                className="login-local__back"
                onClick={() => setShowLocalLogin(false)}
              >
                <ArrowLeft aria-hidden="true" />
                Kurumsal hesapla girişe dön
              </button>
            </form>
          )}

          <p className="login-help">
            Yardıma mı ihtiyacınız var?{' '}
            <a href="https://portal.fbu.edu.tr/helpdesk" target="_blank" rel="noreferrer">
              Destek
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
