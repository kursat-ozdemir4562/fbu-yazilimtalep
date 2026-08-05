const FRONTEND_ROUTES = [
  '/',
  '/audit',
  '/ayarlar',
  '/bildirimler',
  '/donemler',
  '/fakulteler',
  '/kullanicilar',
  '/laboratuvarlar',
  '/oneriler',
  '/programlar',
  '/raporlar',
  '/talep/',
  '/talepler',
  '/talepler/',
  '/yetkiler',
] as const;

/**
 * Backend notifications contain API/domain-oriented paths. Convert only known,
 * internal paths to routes exposed by the Turkish frontend router.
 */
export function normalizeNotificationLink(link?: string | null): string {
  const value = link?.trim();
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/bildirimler';

  const requestMatch = /^\/requests\/([^/?#]+)(.*)$/.exec(value);
  if (requestMatch) return `/talepler/${requestMatch[1]}${requestMatch[2]}`;

  if (
    value === '/software-suggestions/my' ||
    value.startsWith('/software/') ||
    value.startsWith('/admin/software-suggestions')
  ) {
    return '/oneriler';
  }

  return FRONTEND_ROUTES.some(
    (route) =>
      value === route ||
      (route !== '/' &&
        (value.startsWith(`${route}/`) || (route.endsWith('/') && value.startsWith(route)))),
  )
    ? value
    : '/bildirimler';
}
