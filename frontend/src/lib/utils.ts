import { STATUS_LABELS } from './constants';
import type { PaginatedResponse, RequestStatus } from '../types';

export function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object') {
    const envelope = value as { data?: T; result?: T };
    if (envelope.data !== undefined) return envelope.data;
    if (envelope.result !== undefined) return envelope.result;
  }
  return value as T;
}

export function normalizePage<T>(
  value: unknown,
  fallbackPage = 1,
  fallbackPageSize = 10,
): PaginatedResponse<T> {
  const unwrapped = unwrap<unknown>(value);
  if (Array.isArray(unwrapped)) {
    return {
      items: unwrapped as T[],
      page: fallbackPage,
      pageSize: fallbackPageSize,
      totalCount: unwrapped.length,
      totalPages: Math.max(1, Math.ceil(unwrapped.length / fallbackPageSize)),
    };
  }

  const page = (unwrapped ?? {}) as Partial<PaginatedResponse<T>> & {
    data?: T[];
    currentPage?: number;
  };
  const items = page.items ?? page.data ?? [];
  const pageSize = page.pageSize ?? fallbackPageSize;
  const totalCount = page.totalCount ?? items.length;
  return {
    items,
    page: page.page ?? page.currentPage ?? fallbackPage,
    pageSize,
    totalCount,
    totalPages: page.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export function formatDate(value?: string, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as RequestStatus] ?? status;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('');
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu. Lütfen yeniden deneyin.';
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
