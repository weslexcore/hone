export type AIProvider = 'anthropic' | 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  enabledGlobally: boolean;
}

export interface AIRequest {
  type: 'suggestion' | 'consistency' | 'prompt_generation' | 'grading';
  systemPrompt: string;
  userMessage: string;
  context?: string;
}

export interface AISuggestion {
  id: string;
  type: 'style' | 'grammar' | 'pacing' | 'dialogue' | 'consistency' | 'general';
  title: string;
  description: string;
  originalText?: string;
  suggestedText?: string;
  confidence: number;
}

/** Persisted suggestion batch — stored in IndexedDB */
export interface SavedSuggestionBatch {
  id: string;
  /** Scene or chapter ID this batch belongs to */
  targetId: string;
  /** 'scene' or 'chapter' */
  targetType: 'scene' | 'chapter';
  projectId: string;
  /** 'suggestions' or 'consistency' */
  analysisType: 'suggestions' | 'consistency';
  suggestions: AISuggestion[];
  /** IDs of dismissed suggestions within this batch */
  dismissedIds: string[];
  createdAt: Date;
}
