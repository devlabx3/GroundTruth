import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Diálogo modal base (accesible: role="dialog", Escape, click-fuera, foco al abrir).
 * Para acciones on-chain NO usar esto: usar OnchainProgressModal (regla §8 del índice).
 */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export default function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(16,19,18,0.55)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-porcelain-border bg-white outline-none"
      >
        {title && (
          <div className="border-b border-porcelain-border px-5 py-4 text-[15px] font-medium text-ink">
            {title}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-porcelain-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
