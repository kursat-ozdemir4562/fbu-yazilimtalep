import type { RequestStatus, UserRole } from '../types';
import { ROLES } from '../types';

export const APP_NAME = 'FBU Laboratuvar Yazılım Talep Sistemi';

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.academic]: 'Akademisyen',
  [ROLES.administrative]: 'İdari Personel',
  [ROLES.faculty]: 'Fakülte Yetkilisi',
  [ROLES.administrator]: 'Sistem Yöneticisi',
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  Draft: 'Taslak',
  Submitted: 'Gönderildi',
  UnderReview: 'İnceleniyor',
  AwaitingInformation: 'Eksik Bilgi Bekleniyor',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  InstallationScheduled: 'Kurulum Planlandı',
  InstallationPlanned: 'Kurulum Planlandı',
  InstallationCompleted: 'Kurulum Tamamlandı',
  Cancelled: 'İptal Edildi',
};

export const STATUS_TONES: Record<RequestStatus, string> = {
  Draft: 'neutral',
  Submitted: 'blue',
  UnderReview: 'purple',
  AwaitingInformation: 'amber',
  Approved: 'green',
  Rejected: 'red',
  InstallationScheduled: 'cyan',
  InstallationPlanned: 'cyan',
  InstallationCompleted: 'green',
  Cancelled: 'neutral',
};

export const WEEK_DAYS = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const;

export const DAY_API_VALUES: Record<(typeof WEEK_DAYS)[number], string> = {
  Pazartesi: 'Monday',
  Salı: 'Tuesday',
  Çarşamba: 'Wednesday',
  Perşembe: 'Thursday',
  Cuma: 'Friday',
  Cumartesi: 'Saturday',
  Pazar: 'Sunday',
};

export const LANGUAGES = [
  'Türkçe',
  'İngilizce',
  'Almanca',
  'Fransızca',
  'Arapça',
  'Diğer',
  'Dil Bağımsız',
] as const;

export const LICENSE_TYPES = [
  'Ücretsiz',
  'Ücretli',
  'Üniversite Lisanslı',
  'Deneme Sürümü',
  'Açık Kaynak',
  'Bilinmiyor',
] as const;

export const LICENSE_API_VALUES: Record<(typeof LICENSE_TYPES)[number], string> = {
  Ücretsiz: 'Free',
  Ücretli: 'Paid',
  'Üniversite Lisanslı': 'UniversityLicensed',
  'Deneme Sürümü': 'Trial',
  'Açık Kaynak': 'OpenSource',
  Bilinmiyor: 'Unknown',
};

export function licenseToApi(value: string): string {
  return LICENSE_API_VALUES[value as (typeof LICENSE_TYPES)[number]] ?? value;
}

export function licenseFromApi(value: string): string {
  const entry = Object.entries(LICENSE_API_VALUES).find(([, api]) => api === value);
  return entry?.[0] ?? value;
}

// Collapses any legacy LicenseType value (Free/Paid/UniversityLicensed/Trial/OpenSource/Unknown)
// down to the Ücretli/Ücretsiz distinction shown in the UI — mirrors the backend seed's historical
// IsPaid derivation (Paid/UniversityLicensed = paid, everything else = free).
export function licenseIsPaidLabel(value: string | null | undefined): string {
  return value === 'Paid' || value === 'UniversityLicensed' ? 'Ücretli' : 'Ücretsiz';
}

export const WIZARD_STEPS = [
  'Ders Bilgileri',
  'Program Bilgileri',
  'Eklenti Bilgileri',
  'Ders Gün ve Saatleri',
  'Laboratuvar Seçimi',
  'Kontrol ve Gönderim',
] as const;
