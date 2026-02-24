'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Copy, Check, Loader2, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasteAIResponse } from '@/components/ai/paste-ai-response';
import { useAI } from '@/providers/ai-provider';
import { useScene } from '@/lib/db/hooks';
import { db } from '@/lib/db/index';
import { stripCodeFences } from '@/lib/ai/client';
import { writingSuggestionsPrompt, consistencyCheckPrompt, formatPromptForCopy } from '@/lib/ai/prompts';
import type { AISuggestion, SavedSuggestionBatch } from '@/types/ai';
import { cn } from '@/lib/utils/cn';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';

interface AIPanelProps {
  sceneId?: string;
  /** For chapter-level analysis when no sceneId, pass the chapterId */
  chapterId?: string;
  projectId: string;
  /** Optional callback to provide text directly (e.g. from a chapter editor). Takes priority over sceneId. */
  getText?: () => string;
  onClose: () => void;
}

function formatDate(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AIPanel({ sceneId, chapterId, projectId, getText, onClose }: AIPanelProps) {
  const scene = useScene(sceneId || '');
  const { hasKey, sendRequest, isLoading, error } = useAI();
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'consistency'>('suggestions');

  // The target for saving/loading suggestion batches
  const targetId = sceneId || chapterId || '';
  const targetType: 'scene' | 'chapter' = sceneId ? 'scene' : 'chapter';

  // Load saved batches from IndexedDB
  const savedBatches = useLiveQuery(
    async () => {
      if (!targetId) return [] as SavedSuggestionBatch[];
      const batches = await db.suggestionBatches
        .where('targetId')
        .equals(targetId)
        .toArray();
      // Sort newest first
      return batches.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    [targetId]
  );

  // Filter batches by active tab
  const filteredBatches = (savedBatches || []).filter(
    (b) => b.analysisType === activeTab
  );

  const getSceneText = useCallback(() => {
    if (getText) return getText();
    if (!scene?.contentHtml) return '';
    const div = document.createElement('div');
    div.innerHTML = scene.contentHtml;
    return div.textContent || '';
  }, [scene, getText]);

  const saveBatch = useCallback(
    async (suggestions: AISuggestion[], analysisType: 'suggestions' | 'consistency') => {
      const batch: SavedSuggestionBatch = {
        id: nanoid(),
        targetId,
        targetType,
        projectId,
        analysisType,
        suggestions,
        dismissedIds: [],
        createdAt: new Date(),
      };
      await db.suggestionBatches.add(batch);
    },
    [targetId, targetType, projectId]
  );

  const handleAnalyze = useCallback(async () => {
    const text = getSceneText();
    if (!text.trim()) return;

    setParseError(null);
    const { systemPrompt, userMessage } = writingSuggestionsPrompt(text);

    try {
      const result = await sendRequest(systemPrompt, userMessage);
      const cleaned = stripCodeFences(result);
      const parsed = JSON.parse(cleaned) as AISuggestion[];
      const suggestions = parsed.map((s, i) => ({
        ...s,
        id: `suggestion-${nanoid(6)}-${i}`,
        confidence: s.confidence ?? 0.8,
      }));
      await saveBatch(suggestions, 'suggestions');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setParseError('Failed to parse AI response. Try again.');
      }
    }
  }, [getSceneText, sendRequest, saveBatch]);

  const handleConsistencyCheck = useCallback(async () => {
    const allScenes = await db.scenes.where('projectId').equals(projectId).toArray();
    const allText = allScenes
      .map((s) => {
        if (!s.contentHtml) return '';
        const div = document.createElement('div');
        div.innerHTML = s.contentHtml;
        return `--- ${s.title} ---\n${div.textContent || ''}`;
      })
      .filter(Boolean)
      .join('\n\n');

    if (!allText.trim()) return;

    setParseError(null);
    const { systemPrompt, userMessage } = consistencyCheckPrompt(allText);

    try {
      const result = await sendRequest(systemPrompt, userMessage);
      const cleaned = stripCodeFences(result);
      const parsed = JSON.parse(cleaned) as AISuggestion[];
      const suggestions = parsed.map((s, i) => ({
        ...s,
        id: `consistency-${nanoid(6)}-${i}`,
        confidence: s.confidence ?? 0.8,
      }));
      await saveBatch(suggestions, 'consistency');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setParseError('Failed to parse AI response. Try again.');
      }
    }
  }, [projectId, sendRequest, saveBatch]);

  const handleDismissSuggestion = useCallback(
    async (batchId: string, suggestionId: string) => {
      const batch = await db.suggestionBatches.get(batchId);
      if (!batch) return;
      const updated = [...batch.dismissedIds, suggestionId];
      await db.suggestionBatches.update(batchId, { dismissedIds: updated });
    },
    []
  );

  const handleDeleteBatch = useCallback(async (batchId: string) => {
    await db.suggestionBatches.delete(batchId);
  }, []);

  const handleCopyForAI = useCallback(async () => {
    const text = getSceneText();
    if (!text.trim()) return;

    const promptData =
      activeTab === 'suggestions'
        ? writingSuggestionsPrompt(text)
        : consistencyCheckPrompt(text);

    const formatted = formatPromptForCopy(
      activeTab === 'suggestions' ? 'suggestion' : 'consistency',
      promptData.systemPrompt,
      promptData.userMessage
    );

    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab, getSceneText]);

  const handlePastedResponse = useCallback(
    async (data: unknown) => {
      try {
        const arr = Array.isArray(data) ? data : [data];
        const suggestions = arr.map((s: Record<string, unknown>, i: number) => ({
          id: `pasted-${nanoid(6)}-${i}`,
          type: (s.type as AISuggestion['type']) ?? 'general',
          title: (s.title as string) ?? 'Suggestion',
          description: (s.description as string) ?? '',
          originalText: s.originalText as string | undefined,
          suggestedText: s.suggestedText as string | undefined,
          confidence: (s.confidence as number) ?? 0.8,
        }));
        await saveBatch(suggestions, activeTab);
      } catch {
        // invalid shape, ignore
      }
    },
    [saveBatch, activeTab]
  );

  const apiKeyConfigured = hasKey();

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-l border-border bg-surface-raised overflow-hidden shrink-0"
    >
      <div className="flex flex-col h-full w-[380px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="text-sm font-medium">AI Analysis</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={cn(
              'flex-1 px-4 py-2 text-xs font-medium transition-colors',
              activeTab === 'suggestions'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Suggestions
          </button>
          <button
            onClick={() => setActiveTab('consistency')}
            className={cn(
              'flex-1 px-4 py-2 text-xs font-medium transition-colors',
              activeTab === 'consistency'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Consistency
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-border">
          {apiKeyConfigured ? (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={activeTab === 'suggestions' ? handleAnalyze : handleConsistencyCheck}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {activeTab === 'suggestions' ? 'Analyze Writing' : 'Check Consistency'}
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleCopyForAI}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy for AI
                </>
              )}
            </Button>
          )}
          {!apiKeyConfigured && (
            <p className="text-xs text-text-muted mt-2 text-center">
              No API key configured. Copy the prompt to use with your own AI service, or add a key in Settings.
            </p>
          )}
          {!apiKeyConfigured && (
            <PasteAIResponse
              onParsed={handlePastedResponse}
              expectedShape={'JSON array of { type, title, description, suggestedText }'}
              className="mt-3"
            />
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {(error || parseError) && (
            <div className="rounded-lg bg-danger-muted border border-danger/20 p-3 mb-4">
              <p className="text-xs text-danger">{error || parseError}</p>
            </div>
          )}

          {filteredBatches.length > 0 ? (
            <div className="space-y-5">
              {filteredBatches.map((batch) => {
                const visibleSuggestions = batch.suggestions.filter(
                  (s) => !batch.dismissedIds.includes(s.id)
                );
                if (visibleSuggestions.length === 0) return null;

                return (
                  <div key={batch.id}>
                    {/* Batch header with date */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        <Clock size={10} />
                        {formatDate(batch.createdAt)}
                        <span className="text-text-muted/50">·</span>
                        <span>{visibleSuggestions.length}/{batch.suggestions.length}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-text-muted hover:text-danger transition-colors"
                        title="Delete this analysis"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {/* Suggestions in this batch */}
                    <div className="space-y-2">
                      {visibleSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="rounded-lg border border-border bg-surface p-3 group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-medium text-text-primary">
                              {suggestion.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted uppercase">
                                {suggestion.type}
                              </span>
                              <button
                                onClick={() => handleDismissSuggestion(batch.id, suggestion.id)}
                                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all"
                                title="Dismiss"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {suggestion.description}
                          </p>
                          {suggestion.suggestedText && (
                            <div className="mt-2 rounded bg-accent-muted px-2 py-1.5">
                              <p className="text-xs text-accent font-serif italic">
                                {suggestion.suggestedText}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !isLoading ? (
            <div className="text-center py-8">
              <Sparkles size={24} className="mx-auto text-text-muted mb-2" />
              <p className="text-xs text-text-muted">
                {activeTab === 'suggestions'
                  ? 'Click Analyze to get writing suggestions'
                  : 'Click Check to find consistency issues'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
