"use client";

import type { PracticeRound } from "@/types/practice";
import { cn } from "@/lib/utils/cn";
import { formatDistanceToNow } from "date-fns";

interface VersionTimelineProps {
  rounds: PracticeRound[];
  activeRoundIndex: number;
  onSelectRound: (index: number) => void;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-text-muted";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-accent";
  return "text-danger";
}

export function VersionTimeline({ rounds, activeRoundIndex, onSelectRound }: VersionTimelineProps) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
        Revision History
      </h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {rounds.map((round, i) => (
          <button
            key={i}
            onClick={() => onSelectRound(i)}
            className={cn(
              "flex flex-col items-center px-3 py-2 rounded-lg border transition-colors min-w-[80px] shrink-0",
              i === activeRoundIndex
                ? "border-accent bg-accent-muted"
                : "border-border hover:bg-surface-hover",
            )}
          >
            <span className="text-[10px] text-text-muted">Round {round.roundNumber}</span>
            <span className={cn("text-lg font-bold", scoreColor(round.score))}>
              {round.score ?? "—"}
            </span>
            <span className="text-[10px] text-text-muted">
              {round.completedAt
                ? formatDistanceToNow(round.completedAt, { addSuffix: true })
                : round.status === "in_progress"
                  ? "In progress"
                  : "Pending"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
