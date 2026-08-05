import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button, FieldError } from '../components/ui';
import { useTheme } from '../context/ThemeContext';

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
});

export function ForgotPasswordPage() {
  const { isDark, toggleTheme } = useTheme();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <main className="auth-simple-page">
      <button
        className="theme-fab"
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      >
        {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
      <section className="auth-simple-card">
        <span className="brand-mark brand-mark--large">FBU</span>
        {sent ? (
          <>
            <span className="auth-icon auth-icon--success">
              <MailCheck aria-hidden="true" />
            </span>
            <h1>Talebiniz alındı</h1>
            <p>
              Hesabınız sistemde kayıtlıysa parola yenileme yönergeleri gönderilecektir. Development
              ortamında e-posta gönderimi mock servis üzerinden çalışır.
            </p>
            <Link className="button button--secondary" to="/giris">
              <ArrowLeft aria-hidden="true" /> Giriş ekranına dön
            </Link>
          </>
        ) : (
          <>
            <h1>Parolanızı mı unuttunuz?</h1>
            <p>Kurumsal e-posta adresinizi girin; size güvenli yenileme adımlarını iletelim.</p>
            <form
              onSubmit={(event) => void handleSubmit(async () => setSent(true))(event)}
              noValidate
            >
              <label className="field">
                <span>E-posta adresi</span>
                <input placeholder="ad.soyad@fbu.edu.tr" {...register('email')} />
                <FieldError>{errors.email?.message}</FieldError>
              </label>
              <Button type="submit" isLoading={isSubmitting} className="button--full">
                Yenileme bağlantısı iste
              </Button>
            </form>
            <Link className="auth-simple-card__back" to="/giris">
              <ArrowLeft aria-hidden="true" /> Giriş ekranına dön
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
