export interface PracticeFeedback {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  tips: string[];
  detailedNotes: string;
}

export interface PracticeSession {
  id: string;
  genres: string[];
  prompt: string;
  response: string;
  responseHtml: string;
  wordCount: number;
  durationSeconds: number;
  actualSeconds: number;
  score: number | null;
  feedback: PracticeFeedback | null;
  status: "in_progress" | "submitted" | "graded";
  createdAt: Date;
  completedAt: Date | null;
}
