import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import Dialog from './Dialog';
import Button from './Button';

/**
 * Confirmación con consecuencias explícitas en texto — obligatoria en toda
 * acción sensible (notas transversales de casos de uso). Nunca `confirm()` nativo.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  title?: ReactNode;
  body?: ReactNode;
  confirmLabel?: ReactNode;
  danger?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger = false,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {body && <p className="text-sm text-ink">{body}</p>}
      {children}
    </Dialog>
  );
}
