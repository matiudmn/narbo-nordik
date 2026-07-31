import { useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import type { ButtonVariant } from './Button';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal harmonisée — remplace les alert() natifs
 * et les bannières inline disparates de l'app.
 *
 * Scroll de fond verrouillé, focus piégé (bouton confirmer focusé à
 * l'ouverture), Escape ferme, click sur backdrop ferme, focus restauré
 * au déclencheur à la fermeture (cf. useModalA11y).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmVariant,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalA11y(open, panelRef, onCancel, { disableEscape: loading, initialFocusRef: confirmRef });

  if (!open) return null;

  const resolvedConfirmVariant: ButtonVariant =
    confirmVariant ?? (destructive ? 'danger' : 'accent');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 animate-fade-in"
      onClick={() => !loading && onCancel()}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-md bg-white rounded-t-2xl lg:rounded-2xl shadow-lg animate-slide-up lg:animate-scale-in"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {destructive && (
              <div className="w-10 h-10 shrink-0 rounded-full bg-danger-50 text-danger flex items-center justify-center">
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="confirm-dialog-title"
                className="text-base font-semibold text-neutral-900"
              >
                {title}
              </h2>
              {description && (
                <div className="text-sm text-neutral-600 mt-1.5">{description}</div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6 pt-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={resolvedConfirmVariant}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
