import { AlertTriangle, ArrowLeft, Home, LockKeyhole, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../lib/utils';

function ErrorLayout({
  code,
  title,
  description,
  icon,
}: {
  code: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <main className="error-page">
      <div className="error-page__watermark">{code}</div>
      <section>
        <span className="error-page__icon">{icon}</span>
        <span className="eyebrow">Hata kodu · {code}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="error-page__actions">
          <Link className="button button--primary" to="/baslangic">
            <Home aria-hidden="true" /> Ana sayfaya dön
          </Link>
          <button className="button button--secondary" type="button" onClick={() => history.back()}>
            <ArrowLeft aria-hidden="true" /> Önceki sayfa
          </button>
        </div>
      </section>
    </main>
  );
}

export function UnauthorizedPage() {
  return (
    <ErrorLayout
      code="403"
      title="Bu sayfaya erişim yetkiniz yok"
      description="Hesabınıza atanan rol veya fakülte izni bu işlem için yeterli değil. Bunun bir hata olduğunu düşünüyorsanız sistem yöneticinize ulaşın."
      icon={<LockKeyhole aria-hidden="true" />}
    />
  );
}

export function NotFoundPage() {
  return (
    <ErrorLayout
      code="404"
      title="Aradığınız sayfa bulunamadı"
      description="Bağlantı değiştirilmiş, kayıt kaldırılmış veya adres yanlış yazılmış olabilir."
      icon={<SearchX aria-hidden="true" />}
    />
  );
}

export function RouteErrorPage() {
  return (
    <ErrorLayout
      code="500"
      title="Beklenmeyen bir sorun oluştu"
      description={getErrorMessage(new Error('Sayfa işlenirken beklenmeyen bir sorun oluştu.'))}
      icon={<AlertTriangle aria-hidden="true" />}
    />
  );
}
