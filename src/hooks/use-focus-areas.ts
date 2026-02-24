import { useMemo } from "react";
import type { PracticeSession } from "@/types/practice";
import { FOCUS_AREA_CATEGORIES, type FocusAreaCategory } from "@/lib/constants/focus-areas";

export interface AggregatedFocusArea {
  category: FocusAreaCategory;
  count: number;
  recentExamples: string[];
}

function classifyString(text: string): string {
  const lower = text.toLowerCase();
  let bestId = "general";
  let bestScore = 0;

  for (const cat of FOCUS_AREA_CATEGORIES) {
    if (cat.id === "general") continue;
    let score = 0;
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = cat.id;
    }
  }

  return bestId;
}

export function useFocusAreas(sessions: PracticeSession[] | undefined) {
  return useMemo(() => {
    if (!sessions) {
      return {
        focusAreas: [] as AggregatedFocusArea[],
        strengths: [] as AggregatedFocusArea[],
        totalGradedSessions: 0,
      };
    }

    const gradedSessions = sessions.filter((s) => s.status === "graded" && s.feedback);

    if (gradedSessions.length === 0) {
      return {
        focusAreas: [] as AggregatedFocusArea[],
        strengths: [] as AggregatedFocusArea[],
        totalGradedSessions: 0,
      };
    }

    const categoryMap = new Map(FOCUS_AREA_CATEGORIES.map((c) => [c.id, c]));

    // Aggregate improvements
    const improvementMap = new Map<string, { count: number; examples: string[] }>();
    for (const session of gradedSessions) {
      for (const imp of session.feedback!.improvements) {
        const catId = classifyString(imp);
        const existing = improvementMap.get(catId) || { count: 0, examples: [] };
        existing.count += 1;
        if (existing.examples.length < 3) {
          existing.examples.push(imp);
        }
        improvementMap.set(catId, existing);
      }
    }

    // Aggregate strengths
    const strengthMap = new Map<string, { count: number; examples: string[] }>();
    for (const session of gradedSessions) {
      for (const str of session.feedback!.strengths) {
        const catId = classifyString(str);
        const existing = strengthMap.get(catId) || { count: 0, examples: [] };
        existing.count += 1;
        if (existing.examples.length < 3) {
          existing.examples.push(str);
        }
        strengthMap.set(catId, existing);
      }
    }

    const focusAreas: AggregatedFocusArea[] = Array.from(improvementMap.entries())
      .map(([id, data]) => ({
        category: categoryMap.get(id)!,
        count: data.count,
        recentExamples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);

    const strengths: AggregatedFocusArea[] = Array.from(strengthMap.entries())
      .map(([id, data]) => ({
        category: categoryMap.get(id)!,
        count: data.count,
        recentExamples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);

    return { focusAreas, strengths, totalGradedSessions: gradedSessions.length };
  }, [sessions]);
}
