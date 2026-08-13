import { CheckCircle2, FlaskConical, LockKeyhole, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { Redirect, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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
  const { isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const ssoError = new URLSearchParams(location.search).get('sso');
  const serverError =
    ssoError === 'pasif'
      ? 'Kurumsal hesabınız pasif durumda. Lütfen yöneticinize başvurun.'
      : ssoError === 'hata'
        ? 'Kurumsal hesap girişi tamamlanamadı. Lütfen tekrar deneyin.'
        : '';

  if (isAuthenticated) return <Redirect to="/baslangic" />;

  return (
    <main className="login-page">
      <button
        className="theme-fab"
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      >
        {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
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
          </div>

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
