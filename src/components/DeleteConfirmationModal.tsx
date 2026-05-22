import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName?: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
          >
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-500" />
              </div>
              <h3 className="text-2xl font-bold text-ink mb-2">{title}</h3>
              <p className="text-muted mb-6">
                {message}
                {itemName && <span className="block font-bold text-ink mt-1">"{itemName}"</span>}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-border text-muted font-bold rounded-2xl hover:bg-bg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-muted hover:text-ink transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
