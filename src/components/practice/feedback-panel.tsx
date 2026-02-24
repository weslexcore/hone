"use client";

import type { PracticeFeedback } from "@/types/practice";
import { ExpandableSection } from "@/components/ui/expandable-section";
import { Trophy, TrendingUp, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FeedbackPanelProps {
  feedback: PracticeFeedback;
  roundNumber: number;
  score: number | null;
}

export function FeedbackPanel({ feedback, roundNumber, score }: FeedbackPanelProps) {
  const scoreLabel = score !== null ? ` — Score: ${score}` : "";

  return (
    <ExpandableSection
      label={`Round ${roundNumber} Feedback${scoreLabel}`}
      defaultOpen={false}
      className="mx-6 mt-2"
    >
      <div className="space-y-3">
        {/* Strengths */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy size={12} className="text-success" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Strengths</span>
          </div>
          <ul className="space-y-0.5">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                <span className="text-success mt-0.5 shrink-0">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-accent" />
            <span className="text-[10px] font-medium text-text-muted uppercase">
              Areas for Improvement
            </span>
          </div>
          <ul className="space-y-0.5">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                <span className={cn("mt-0.5 shrink-0", "text-accent")}>-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Tips */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={12} className="text-accent" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Tips</span>
          </div>
          <ul className="space-y-0.5">
            {feedback.tips.map((s, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                <span className="text-accent mt-0.5 shrink-0">*</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ExpandableSection>
  );
}
