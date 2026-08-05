import type { AuthTokens } from '../types';
import { unwrap } from './utils';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
const ACCESS_KEY = 'fbu-access-token';
const REFRESH_KEY = 'fbu-refresh-token';
const REMEMBER_KEY = 'fbu-remember-session';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function selectedStorage(): Storage {
  return localStorage.getItem(REMEMBER_KEY) === 'true' ? localStorage : sessionStorage;
}

export const tokenStore = {
  access(): string | null {
    return localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
  },
  refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthTokens, remember: boolean): void {
    this.clear();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) storage.setItem(REFRESH_KEY, tokens.refreshToken);
    if (remember) localStorage.setItem(REMEMBER_KEY, 'true');
  },
  replace(tokens: AuthTokens): void {
    const storage = selectedStorage();
    storage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) storage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_KEY);
      storage.removeItem(REFRESH_KEY);
    }
    localStorage.removeItem(REMEMBER_KEY);
  },
};

let refreshPromise: Promise<boolean> | null = null;

async function readError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const payload = body as
    | { message?: string; title?: string; detail?: string; errors?: Record<string, string[]> }
    | undefined;
  const firstValidationError = payload?.errors
    ? Object.values(payload.errors).flat().find(Boolean)
    : undefined;
  const fallback: Record<number, string> = {
    400: 'Gönderilen bilgiler geçerli değil.',
    401: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
    403: 'Bu işlem için yetkiniz bulunmuyor.',
    404: 'Aradığınız kayıt bulunamadı.',
    409: 'Bu işlem mevcut kayıtla çakışıyor.',
    413: 'Yüklenen dosya izin verilen boyutu aşıyor.',
    429: 'Çok fazla istek gönderildi. Lütfen kısa süre sonra deneyin.',
    500: 'Sunucuda beklenmeyen bir hata oluştu.',
  };
  return new ApiError(
    firstValidationError ??
      payload?.message ??
      payload?.detail ??
      payload?.title ??
      fallback[response.status] ??
      'İşlem tamamlanamadı.',
    response.status,
    body,
  );
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    tokenStore.clear();
    return false;
  }
  const body = unwrap<AuthTokens>(await response.json());
  if (!body.accessToken) return false;
  tokenStore.replace(body);
  return true;
}

async function ensureRefreshed(): Promise<boolean> {
  refreshPromise ??= refreshSession().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  anonymous?: boolean;
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const {
    body,
    anonymous = false,
    retryOnUnauthorized = true,
    headers: customHeaders,
    ...requestOptions
  } = options;
  const headers = new Headers(customHeaders);
  const token = tokenStore.access();
  if (!anonymous && token) headers.set('Authorization', `Bearer ${token}`);
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 401 && !anonymous && retryOnUnauthorized) {
    if (await ensureRefreshed()) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
    tokenStore.clear();
    window.dispatchEvent(new Event('fbu:auth-expired'));
  }
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return (await response.text()) as T;
  return (await response.json()) as T;
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const headers = new Headers();
  const token = tokenStore.access();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    credentials: 'include',
  });
  if (!response.ok) throw await readError(response);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  const nameMatch = disposition?.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
  const filename = nameMatch?.[1] ? decodeURIComponent(nameMatch[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
