import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type DialogVariant = 'warning' | 'danger' | 'info' | 'success' | 'location';

export interface ModernConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  type?: DialogVariant;
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ModernConfirmDialog: React.FC<ModernConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  variant,
  type,
  hideCancel = false,
  onConfirm,
  onCancel,
}) => {
  const effectiveVariant = variant || type || 'warning';
  const handleClose = onCancel || onConfirm;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (effectiveVariant) {
      case 'danger':
        return {
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md',
        };
      case 'success':
        return {
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md',
        };
      case 'location':
      case 'info':
      case 'warning':
      default:
        return {
          confirmBtn: 'bg-[#1E3A8A] hover:bg-[#172554] text-white shadow-sm hover:shadow-md',
        };
    }
  };

  const { confirmBtn } = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 text-slate-800 space-y-4 transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-base text-slate-900 tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!hideCancel && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all duration-200 cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 font-semibold rounded-xl text-xs transition-all duration-200 cursor-pointer ${confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
