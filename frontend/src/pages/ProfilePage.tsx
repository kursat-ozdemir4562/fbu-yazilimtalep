import { useMutation } from '@tanstack/react-query';
import { Moon, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { THEME_OPTIONS, useTheme, type Theme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';

// Tema tercihi tüm kullanıcılara açık (yalnızca admin değil) — bu yüzden bilinçli olarak
// admin-only "Sistem Ayarları" ekranı dışında, herkesin eriştiği bu profil sayfasında yaşıyor.
export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <PageHeader eyebrow="Hesap" title="Profilim" description="Kendi hesap bilgileriniz ve kişisel tercihleriniz." />
      <div className="settings-layout">
        <div>
          <Card className="settings-card">
            <div className="detail-card__heading">
              <div>
                <UserRound />
                <h2>Profil Bilgileri</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Tam ad</span>
                <input value={user.fullName} readOnly />
              </label>
              <label className="field">
                <span>E-posta</span>
                <input value={user.email} readOnly />
              </label>
              <label className="field">
                <span>Rol</span>
                <input value={user.roles.map((role) => ROLE_LABELS[role]).join(', ')} readOnly />
              </label>
              <label className="field">
                <span>Fakülte / Birim</span>
                <input value={user.facultyName ?? user.department ?? '—'} readOnly />
              </label>
            </div>
          </Card>
          <AppearanceCard />
        </div>
      </div>
    </>
  );
}

function AppearanceCard() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [selected, setSelected] = useState<Theme>(theme);
  // theme state'i önizleme sırasında da anında değiştiği için (bkz. handleSelect), "kaydedildi
  // mi" durumunu ayrı takip ediyoruz — yoksa Kaydet butonu seçim yapılır yapılmaz pasifleşirdi.
  const [savedTheme, setSavedTheme] = useState<Theme>(theme);
  const saveMutation = useMutation({
    mutationFn: async () => {
      setTheme(selected);
      setSavedTheme(selected);
    },
    onSuccess: () => showToast('Tema kaydedildi.'),
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const handleSelect = (next: Theme) => {
    setSelected(next);
    // Seçili anda önizleme için uygulanır ama sunucuya kaydedilmez — "Temayı Kaydet"e
    // basılana kadar geri dönülebilir bir deneme.
    setTheme(next, { persist: false });
  };

  return (
    <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <Moon />
          <h2>Kişisel Görünüm</h2>
        </div>
      </div>
      <p>Uygulama temasını seçin. Tercihiniz hesabınıza kaydedilir.</p>
      <div className="form-grid">
        <label className="field field--full">
          <span>Uygulama Teması</span>
          <select value={selected} onChange={(event) => handleSelect(event.target.value as Theme)}>
            {THEME_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-record__actions">
        <Button
          variant="secondary"
          disabled={selected === savedTheme}
          isLoading={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync()}
        >
          Temayı Kaydet
        </Button>
      </div>
    </Card>
  );
}
