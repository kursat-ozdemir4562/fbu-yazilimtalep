import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { classNames, getErrorMessage, statusLabel } from '../lib/utils';
import { STATUS_TONES } from '../lib/constants';
import type { RequestStatus } from '../types';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames('button', `button--${variant}`, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoaderCircle className="spin" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={classNames('card', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header__actions">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status as RequestStatus] ?? 'neutral';
  return <span className={`badge badge--${tone}`}>{statusLabel(status)}</span>;
}

export function LoadingState({ label = 'Veriler yükleniyor…' }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <span className="icon-glow">
        <LoaderCircle className="spin state-panel__icon" aria-hidden="true" />
      </span>
      <strong>{label}</strong>
      <span>Lütfen kısa bir süre bekleyin.</span>
    </div>
  );
}

export function EmptyState({
  title = 'Henüz kayıt bulunmuyor',
  description = 'Aradığınız ölçütlere uygun bir kayıt bulunamadı.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <span className="icon-glow">
        <Inbox className="state-panel__icon" aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined;
  const title =
    status === 403
      ? 'Bu alan için yetkiniz yok'
      : status === 404
        ? 'Kayıt bulunamadı'
        : 'Veriler alınamadı';
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertTriangle className="state-panel__icon" aria-hidden="true" />
      <strong>{title}</strong>
      <span>{getErrorMessage(error)}</span>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Yeniden dene
        </Button>
      )}
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <span className="field-error" role="alert">
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Pencereyi kapat"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Sayfalama">
      <span>
        Toplam <strong>{totalCount}</strong> kayıt
      </span>
      <div>
        <button
          className="icon-button"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <span aria-current="page">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          className="icon-button"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
