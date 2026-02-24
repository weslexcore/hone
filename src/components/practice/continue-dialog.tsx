"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PRACTICE_DURATIONS } from "@/lib/constants/genres";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ContinueDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: (durationSeconds: number) => void;
}

export function ContinueDialog({ open, onClose, onStart }: ContinueDialogProps) {
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [customMinutes, setCustomMinutes] = useState("");

  const effectiveDuration =
    customMinutes && Number(customMinutes) > 0
      ? Math.round(Number(customMinutes) * 60)
      : selectedDuration;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Continue Practicing</DialogTitle>
      <p className="text-sm text-text-secondary mb-4">
        Your previous writing will be loaded so you can revise and improve it. Choose a duration for
        this round.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => {
            setSelectedDuration(0);
            setCustomMinutes("");
          }}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            selectedDuration === 0 && !customMinutes
              ? "border-accent bg-accent-muted text-accent"
              : "border-border text-text-secondary hover:bg-surface-hover",
          )}
        >
          No limit
        </button>
        {PRACTICE_DURATIONS.map((d) => (
          <button
            key={d.value}
            onClick={() => {
              setSelectedDuration(d.value);
              setCustomMinutes("");
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              selectedDuration === d.value && !customMinutes
                ? "border-accent bg-accent-muted text-accent"
                : "border-border text-text-secondary hover:bg-surface-hover",
            )}
          >
            {d.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={120}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Custom"
            className={cn(
              "w-20 text-center",
              customMinutes && "border-accent ring-1 ring-accent/30",
            )}
          />
          <span className="text-xs text-text-muted">min</span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onStart(effectiveDuration)}>
          <Play size={14} />
          Start Round
        </Button>
      </div>
    </Dialog>
  );
}
