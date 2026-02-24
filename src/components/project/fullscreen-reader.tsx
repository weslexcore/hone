'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface FullscreenReaderProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function FullscreenReader({ open, onClose, children }: FullscreenReaderProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 bg-surface flex flex-col"
    >
      {/* Close button — fades in on hover/mouse move */}
      <div className="absolute top-0 right-0 z-10 p-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-surface-overlay/80 backdrop-blur px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
          <span>Esc</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-12 px-6">
        {children}
      </div>
    </motion.div>
  );
}
