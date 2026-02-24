'use client';

import { use, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAI } from '@/providers/ai-provider';
import { usePracticeSession, updatePracticeSession, deletePracticeSession } from '@/lib/db/hooks';
import { GENRES } from '@/lib/constants/genres';
import { practiceGradingPrompt, formatPromptForCopy } from '@/lib/ai/prompts';
import { stripCodeFences } from '@/lib/ai/client';
import { useTimer } from '@/hooks/use-timer';
import { PracticeEditor } from '@/components/editor/writing-editor';
import type { PracticeFeedback } from '@/types/practice';
import {
  Clock,
  Send,
  Copy,
  Check,
  Loader2,
  Trophy,
  TrendingUp,
  Lightbulb,
  Target,
  ArrowLeft,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PasteAIResponse } from '@/components/ai/paste-ai-response';
import Link from 'next/link';

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const session = usePracticeSession(sessionId);
  const { toast } = useToast();
  const { hasKey, sendRequest, isLoading } = useAI();
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const hasStartedWriting = useRef(false);
  const timerAutoStarted = useRef(false);

  // Escape exits fullscreen, Cmd+Shift+F toggles fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  const contentRef = useRef({ json: '', html: '', wordCount: 0 });

  const handleTimerComplete = useCallback(async () => {
    if (!session) return;
    // If the user never wrote anything, delete the session instead of saving
    if (!hasStartedWriting.current || contentRef.current.wordCount === 0) {
      await deletePracticeSession(sessionId);
      toast('Session ended with no content — discarded.', 'info');
      router.push('/practice');
      return;
    }
    await updatePracticeSession(sessionId, {
      status: 'submitted',
      response: contentRef.current.json,
      responseHtml: contentRef.current.html,
      wordCount: contentRef.current.wordCount,
      actualSeconds: session.durationSeconds,
      completedAt: new Date(),
    });
    toast('Time is up! Writing submitted.', 'info');
  }, [session, sessionId, toast, router]);

  const timer = useTimer({
    durationSeconds: session?.durationSeconds ?? 600,
    onComplete: handleTimerComplete,
  });

  const handleContentChange = useCallback(
    (json: string, html: string, wordCount: number) => {
      contentRef.current = { json, html, wordCount };
      if (wordCount > 0) {
        hasStartedWriting.current = true;
      }
      // Auto-start timer on first keystroke
      if (!timerAutoStarted.current && !timer.isRunning && (json.length > 20 || wordCount > 0)) {
        timerAutoStarted.current = true;
        timer.start();
      }
    },
    [timer]
  );

  const handleSubmitEarly = useCallback(async () => {
    if (!session) return;
    // If no content, discard
    if (!hasStartedWriting.current || contentRef.current.wordCount === 0) {
      timer.pause();
      await deletePracticeSession(sessionId);
      toast('No content written — session discarded.', 'info');
      router.push('/practice');
      return;
    }
    await updatePracticeSession(sessionId, {
      status: 'submitted',
      response: contentRef.current.json,
      responseHtml: contentRef.current.html,
      wordCount: contentRef.current.wordCount,
      actualSeconds: Math.round(timer.elapsed),
      completedAt: new Date(),
    });
    timer.pause();
    toast('Writing submitted!', 'success');
  }, [session, sessionId, timer, toast, router]);

  const handleDiscard = useCallback(async () => {
    timer.pause();
    await deletePracticeSession(sessionId);
    setShowDiscardDialog(false);
    toast('Session discarded', 'info');
    router.push('/practice');
  }, [sessionId, timer, toast, router]);

  const handleGrade = useCallback(async () => {
    if (!session) return;

    const div = document.createElement('div');
    div.innerHTML = session.responseHtml || '';
    const text = div.textContent || '';

    if (!text.trim()) {
      toast('No writing to grade', 'error');
      return;
    }

    const { systemPrompt, userMessage } = practiceGradingPrompt(
      session.prompt,
      text,
      session.actualSeconds
    );

    try {
      const result = await sendRequest(systemPrompt, userMessage);
      const feedback = JSON.parse(stripCodeFences(result)) as PracticeFeedback;
      await updatePracticeSession(sessionId, {
        status: 'graded',
        score: feedback.overallScore,
        feedback,
      });
      toast('Writing graded!', 'success');
    } catch {
      toast('Failed to grade writing', 'error');
    }
  }, [session, sessionId, sendRequest, toast]);

  const handlePastedGrading = useCallback(
    async (data: unknown) => {
      if (!session) return;
      try {
        const feedback = data as PracticeFeedback;
        if (typeof feedback.overallScore !== 'number' || !Array.isArray(feedback.strengths)) {
          toast('Invalid grading format', 'error');
          return;
        }
        await updatePracticeSession(sessionId, {
          status: 'graded',
          score: feedback.overallScore,
          feedback,
        });
        toast('Grading applied!', 'success');
      } catch {
        toast('Failed to apply grading', 'error');
      }
    },
    [session, sessionId, toast]
  );

  const handleDeleteSession = useCallback(async () => {
    await deletePracticeSession(sessionId);
    setShowDeleteDialog(false);
    toast('Session deleted', 'info');
    router.push('/practice');
  }, [sessionId, toast, router]);

  const handleCopyForGrading = useCallback(async () => {
    if (!session) return;

    const div = document.createElement('div');
    div.innerHTML = session.responseHtml || '';
    const text = div.textContent || '';

    const { systemPrompt, userMessage } = practiceGradingPrompt(
      session.prompt,
      text,
      session.actualSeconds
    );

    const formatted = formatPromptForCopy('grading', systemPrompt, userMessage);
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Grading prompt copied', 'success');
  }, [session, toast]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  // Resolve genre labels — handle both built-in IDs and custom genre strings
  const genreLabels = session.genres.map(
    (id) => GENRES.find((g) => g.id === id)?.label || id
  );

  // In-progress: show timer + editor
  if (session.status === 'in_progress') {
    return (
      <div
        className={cn(
          'flex flex-col h-full',
          isFullscreen && 'fixed inset-0 z-50 bg-surface'
        )}
      >
        {/* Timer bar */}
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-lg font-mono font-semibold text-text-primary">
                <Clock size={18} className={timer.isRunning ? 'text-accent' : 'text-text-muted'} />
                {formatSeconds(timer.remaining)}
              </div>
              {!isFullscreen && (
                <div className="flex gap-1.5">
                  {genreLabels.map((g) => (
                    <Badge key={g} variant="muted" className="text-[10px]">
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
                title={showPrompt ? 'Hide prompt' : 'Show prompt'}
              >
                {showPrompt ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              {!timer.isRunning ? (
                <>
                  <Button variant="primary" size="sm" onClick={() => {
                    timerAutoStarted.current = true;
                    timer.start();
                  }}>
                    Start Writing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await deletePracticeSession(sessionId);
                      toast('Session discarded', 'info');
                      router.push('/practice');
                    }}
                  >
                    <Trash2 size={14} />
                    Discard
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={handleSubmitEarly}>
                    <Send size={14} />
                    {!isFullscreen && 'Submit Early'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDiscardDialog(true)}
                    className="text-text-muted hover:text-danger"
                  >
                    <X size={14} />
                    {!isFullscreen && 'Discard'}
                  </Button>
                </>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              style={{ width: `${timer.progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {!timer.isRunning && (
            <p className="text-[10px] text-text-muted mt-1.5 text-center">
              Timer starts automatically when you begin typing
            </p>
          )}
        </div>

        {/* Prompt */}
        {showPrompt && (
          <div className="border-b border-border bg-surface-raised/30 px-6 py-3">
            <p className={cn(
              'text-sm text-text-secondary font-serif italic leading-relaxed',
              isFullscreen && 'max-w-[65ch] mx-auto'
            )}>
              {session.prompt}
            </p>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <PracticeEditor
            placeholder="Start writing..."
            onContentChange={handleContentChange}
          />
        </div>

        {/* Discard Confirmation Dialog */}
        <Dialog open={showDiscardDialog} onClose={() => setShowDiscardDialog(false)}>
          <DialogTitle>Discard Session?</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently discard your writing and delete this practice session. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              Keep Writing
            </Button>
            <Button variant="danger" onClick={handleDiscard}>
              Discard
            </Button>
          </div>
        </Dialog>
      </div>
    );
  }

  // Submitted or graded: show results
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/practice"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft size={14} />
            Back to Practice
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-text-muted hover:text-danger"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>

        {/* Prompt */}
        <Card className="mb-6">
          <p className="text-sm text-text-secondary font-serif italic leading-relaxed">
            {session.prompt}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
            <span>{session.wordCount} words</span>
            <span>{Math.round(session.actualSeconds / 60)} min</span>
            {genreLabels.map((g) => (
              <Badge key={g} variant="muted" className="text-[10px]">
                {g}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Grading */}
        {session.status === 'submitted' && (
          <div className="mb-6">
            {hasKey() ? (
              <Button
                variant="primary"
                onClick={handleGrade}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Grading...
                  </>
                ) : (
                  <>
                    <Trophy size={16} />
                    Grade My Writing
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={handleCopyForGrading}
                className="w-full"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy for AI Grading
                  </>
                )}
              </Button>
            )}
            {!hasKey() && (
              <PasteAIResponse
                onParsed={handlePastedGrading}
                expectedShape={'{ overallScore, strengths[], improvements[], tips[], detailedNotes }'}
                className="mt-3"
              />
            )}
          </div>
        )}

        {/* Feedback */}
        {session.feedback && (
          <div className="space-y-4">
            {/* Score */}
            <Card className="text-center py-6">
              <div
                className={cn(
                  'text-5xl font-bold mb-1',
                  session.score !== null && session.score >= 80
                    ? 'text-success'
                    : session.score !== null && session.score >= 60
                    ? 'text-accent'
                    : 'text-danger'
                )}
              >
                {session.score}
              </div>
              <p className="text-sm text-text-muted">out of 100</p>
            </Card>

            {/* Strengths */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-success" />
                <h3 className="text-sm font-medium text-text-primary">Strengths</h3>
              </div>
              <ul className="space-y-1.5">
                {session.feedback.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-success mt-0.5">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Areas for Improvement */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-accent" />
                <h3 className="text-sm font-medium text-text-primary">Areas for Improvement</h3>
              </div>
              <ul className="space-y-1.5">
                {session.feedback.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-accent mt-0.5">-</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Tips */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={16} className="text-accent" />
                <h3 className="text-sm font-medium text-text-primary">Tips & Tricks</h3>
              </div>
              <ul className="space-y-1.5">
                {session.feedback.tips.map((s, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="text-accent mt-0.5">*</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Detailed Notes */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-text-secondary" />
                <h3 className="text-sm font-medium text-text-primary">Detailed Feedback</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed font-serif whitespace-pre-wrap">
                {session.feedback.detailedNotes}
              </p>
            </Card>
          </div>
        )}

        {/* Response preview */}
        {session.responseHtml && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
              Your Response
            </h3>
            <Card>
              <div
                className="text-sm text-text-secondary font-serif leading-relaxed prose-invert"
                dangerouslySetInnerHTML={{ __html: session.responseHtml }}
              />
            </Card>
          </div>
        )}

        {/* Delete Session Confirmation */}
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete Practice Session</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently delete this practice session and all its feedback. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSession}>
              Delete
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}
