"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ExpandableSectionProps {
  label: string;
  /** Brief preview shown when collapsed (e.g. first line of notes) */
  preview?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ExpandableSection({
  label,
  preview,
  defaultOpen = false,
  children,
  className,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
      >
        <ChevronRight
          size={14}
          className={cn("text-text-muted transition-transform shrink-0", open && "rotate-90")}
        />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </span>
        {!open && preview && (
          <span className="text-xs text-text-muted/60 truncate ml-1 flex-1">— {preview}</span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
