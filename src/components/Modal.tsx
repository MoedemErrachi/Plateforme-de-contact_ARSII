import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  maxWidth?: string;
  variant?: 'centered' | 'drawer';
  noPadding?: boolean;
  showClose?: boolean;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  maxWidth = 'max-w-lg',
  variant = 'centered',
  noPadding = false,
  showClose = true,
  children
}) => {
  useEffect(() => {
    if (!open) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  if (variant === 'drawer') {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm overflow-hidden"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg h-full flex flex-col bg-white shadow-2xl overflow-y-auto animate-slide-in-right"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-y-auto animate-scale-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 pt-5 pb-4 shrink-0">
            <div className="flex items-center gap-2">{title}</div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors cursor-pointer shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className={noPadding ? 'flex-1' : 'p-6'}>{children}</div>
      </div>
    </div>,
    document.body
  );
};
