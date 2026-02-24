'use client';

import { cn } from '@/lib/utils/cn';
import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export function Card({ children, hover, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-raised p-5',
        hover && 'transition-colors hover:border-border hover:bg-surface-hover cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
