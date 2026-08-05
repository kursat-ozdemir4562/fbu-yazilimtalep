import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SsoCallbackPage() {
  const { completeSsoLogin } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error' | 'done'>('processing');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') ?? undefined;
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken) {
      setStatus('error');
      return;
    }

    completeSsoLogin({ accessToken, refreshToken })
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [completeSsoLogin]);

  if (status === 'error') return <Redirect to="/giris?sso=hata" />;
  if (status === 'done') return <Redirect to="/baslangic" />;
  return (
    <main className="login-page">
      <p style={{ margin: 'auto', color: 'var(--text-muted)' }}>Oturum açılıyor…</p>
    </main>
  );
}
