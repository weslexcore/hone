import type { PracticeSession, PracticeRound } from "@/types/practice";

export function getCurrentRound(session: PracticeSession): PracticeRound | null {
  if (!session.rounds || session.rounds.length === 0) return null;
  return session.rounds[session.currentRound ?? session.rounds.length - 1];
}

export function getLatestGradedRound(session: PracticeSession): PracticeRound | null {
  if (!session.rounds) return null;
  for (let i = session.rounds.length - 1; i >= 0; i--) {
    if (session.rounds[i].status === "graded") return session.rounds[i];
  }
  return null;
}

export function getCompletedRoundCount(session: PracticeSession): number {
  if (!session.rounds) return session.status === "graded" ? 1 : 0;
  return session.rounds.filter((r) => r.status === "graded").length;
}
