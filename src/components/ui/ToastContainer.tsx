import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />;

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />;
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />;
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 p-3 rounded border border-[var(--border)] shadow-md bg-[var(--surface)] text-[var(--text)] transition-all duration-150"
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 text-xs">
              {toast.title && (
                <div className="font-semibold mb-0.5 text-[var(--text)]">{toast.title}</div>
              )}
              <div className="text-[var(--text-secondary)] leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
