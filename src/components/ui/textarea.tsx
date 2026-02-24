'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary',
          'placeholder:text-text-muted resize-none',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50',
          'disabled:opacity-40 disabled:pointer-events-none',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
