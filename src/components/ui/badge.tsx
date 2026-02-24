'use client';

import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'muted';
  className?: string;
  onClick?: () => void;
}

export function Badge({ children, variant = 'default', className, onClick }: BadgeProps) {
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        {
          'bg-surface-overlay text-text-secondary': variant === 'default',
          'bg-accent-muted text-accent': variant === 'accent',
          'bg-surface-raised text-text-muted': variant === 'muted',
        },
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
    >
      {children}
    </Component>
  );
}
