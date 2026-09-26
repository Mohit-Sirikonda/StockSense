import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 transition-opacity" onClick={onClose} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg p-5 z-10 space-y-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              variant === 'danger'
                ? 'text-[var(--danger)]'
                : variant === 'warning'
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--accent)]'
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] rounded transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs font-medium text-white rounded transition-colors ${
              variant === 'danger'
                ? 'bg-[var(--danger)] hover:opacity-90'
                : variant === 'warning'
                  ? 'bg-[var(--warning)] hover:opacity-90'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
