import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface ModalConfirmationProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  /** Pendant l'action : le bouton passe en chargement et les fermetures sont bloquées. */
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Modale de confirmation générique (suppression de contact, validation de
 * formulaire…). Gère elle-même l'asynchronisme du bouton de confirmation :
 * `onConfirm` peut être synchrone ou renvoyer une promesse.
 */
export const ModalConfirmation: React.FC<ModalConfirmationProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const busy = isLoading || isSubmitting;

  // Réinitialise l'état interne à chaque ouverture.
  useEffect(() => {
    if (open) setIsSubmitting(false);
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    try {
      setIsSubmitting(true);
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDanger = variant === 'danger';

  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} maxWidth="max-w-md">
      <div className="space-y-5 text-xs">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${isDanger ? 'bg-rose-50 text-rose-500' : 'bg-[#005596]/10 text-[#005596]'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 pt-1">
            <h3 className="font-extrabold text-sm text-[#1C2529]">{title}</h3>
            <div className="text-[#55636B] leading-relaxed">{message}</div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 font-extrabold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white'
                : 'bg-gradient-to-r from-[#005596] to-[#004275] hover:from-[#004275] hover:to-[#003B66] text-white'
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
