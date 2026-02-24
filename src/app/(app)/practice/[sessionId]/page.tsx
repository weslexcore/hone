"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAI } from "@/providers/ai-provider";
import {
  usePracticeSession,
  updatePracticeSession,
  deletePracticeSession,
  startNewRound,
  submitCurrentRound,
  gradeCurrentRound,
  convertSessionToProject,
} from "@/lib/db/hooks";
import { GENRES, PRACTICE_DURATIONS } from "@/lib/constants/genres";
import { FOCUS_AREA_CATEGORIES } from "@/lib/constants/focus-areas";
import {
  practiceGradingPrompt,
  practicePromptGenerationPrompt,
  formatPromptForCopy,
} from "@/lib/ai/prompts";
import { parseAIJson } from "@/lib/ai/client";
import { resolveActiveModel } from "@/lib/storage/api-keys";
import { DEFAULT_MODELS } from "@/lib/constants/models";
import { useTimer } from "@/hooks/use-timer";
import { PracticeEditor } from "@/components/editor/writing-editor";
import { getCurrentRound, getLatestGradedRound } from "@/lib/practice/utils";
import { VersionTimeline } from "@/components/practice/version-timeline";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { ContinueDialog } from "@/components/practice/continue-dialog";
import type { PracticeFeedback } from "@/types/practice";
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
  Timer,
  Plus,
  Infinity as InfinityIcon,
  RefreshCw,
  Play,
  FolderOpen,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PasteAIResponse } from "@/components/ai/paste-ai-response";
import Link from "next/link";

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const EXTEND_OPTIONS = [
  { seconds: 300, label: "+5 min" },
  { seconds: 600, label: "+10 min" },
  { seconds: 900, label: "+15 min" },
];

export default function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const session = usePracticeSession(sessionId);
  const { toast } = useToast();
  const { config, hasKey, sendRequest, isLoading } = useAI();
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showTimerDialog, setShowTimerDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [viewingRoundIndex, setViewingRoundIndex] = useState<number | null>(null);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const hasStartedWriting = useRef(false);
  const timerAutoStarted = useRef(false);

  const isUntimed = session?.durationSeconds === 0;

  // Round detection
  const isMultiRound = !!(session?.rounds && session.rounds.length > 0);
  const currentRoundData = session ? getCurrentRound(session) : null;
  const previousGradedRound = session ? getLatestGradedRound(session) : null;
  const isRevisionRound = !!(currentRoundData && currentRoundData.roundNumber > 1);

  // Escape exits fullscreen, Cmd+Shift+F toggles fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const contentRef = useRef({ json: "", html: "", wordCount: 0 });

  const handleTimerComplete = useCallback(async () => {
    // Show dialog to let user extend or submit
    setShowTimerDialog(true);
  }, []);

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
      // Auto-start timer on first keystroke (both timed and untimed modes)
      if (!timerAutoStarted.current && !timer.isRunning && (json.length > 20 || wordCount > 0)) {
        timerAutoStarted.current = true;
        timer.start();
      }
    },
    [timer],
  );

  const handleSubmit = useCallback(async () => {
    if (!session) return;
    // If no content, discard
    if (!hasStartedWriting.current || contentRef.current.wordCount === 0) {
      timer.pause();
      await deletePracticeSession(sessionId);
      toast("No content written — session discarded.", "info");
      router.push("/practice");
      return;
    }

    const data = {
      response: contentRef.current.json,
      responseHtml: contentRef.current.html,
      wordCount: contentRef.current.wordCount,
      actualSeconds: Math.round(timer.elapsed),
    };

    if (isMultiRound) {
      await submitCurrentRound(sessionId, data);
    } else {
      await updatePracticeSession(sessionId, {
        ...data,
        status: "submitted",
        completedAt: new Date(),
      });
    }
    timer.pause();
    toast("Writing submitted!", "success");
  }, [session, sessionId, timer, toast, router, isMultiRound]);

  const handleExtend = useCallback(
    async (seconds: number) => {
      timer.extend(seconds);
      setShowTimerDialog(false);
      // Update session durationSeconds to reflect the extension
      if (session) {
        await updatePracticeSession(sessionId, {
          durationSeconds: session.durationSeconds + seconds,
        });
      }
      toast(`Added ${Math.round(seconds / 60)} minutes`, "success");
    },
    [timer, session, sessionId, toast],
  );

  const handleRemoveLimit = useCallback(async () => {
    timer.removeLimit();
    setShowTimerDialog(false);
    if (session) {
      await updatePracticeSession(sessionId, { durationSeconds: 0 });
    }
    toast("Timer removed — write as long as you want", "success");
  }, [timer, session, sessionId, toast]);

  const handleDurationChange = useCallback(
    async (newDuration: number) => {
      timer.setDuration(newDuration);
      if (session) {
        await updatePracticeSession(sessionId, { durationSeconds: newDuration });
      }
      setShowDurationPicker(false);
    },
    [timer, session, sessionId],
  );

  const handleRegeneratePrompt = useCallback(async () => {
    if (!session || hasStartedWriting.current || timerAutoStarted.current) return;
    setIsRegenerating(true);
    try {
      // Resolve genre labels for prompt generation
      const genreLabels = session.genres.map((id) => GENRES.find((g) => g.id === id)?.label || id);

      // Resolve focus area labels if stored on session
      const focusLabels = session.focusAreas
        ?.map((id) => FOCUS_AREA_CATEGORIES.find((c) => c.id === id)?.label)
        .filter(Boolean) as string[] | undefined;

      if (hasKey()) {
        const { systemPrompt, userMessage } = practicePromptGenerationPrompt(genreLabels, {
          focusAreas: focusLabels?.length ? focusLabels : undefined,
        });
        const newPrompt = await sendRequest(systemPrompt, userMessage);
        await updatePracticeSession(sessionId, { prompt: newPrompt });
        toast("Prompt regenerated!", "success");
      } else {
        const hasGenres = genreLabels.length > 0;
        const genreText = hasGenres ? `${genreLabels.join("/")} ` : "";
        const focusPart = focusLabels?.length
          ? ` Focus especially on ${focusLabels.join(" and ")}.`
          : "";
        const newPrompt = `Write a short ${genreText}piece. Focus on vivid sensory detail and a compelling opening line.${focusPart} Your piece should have a clear beginning, middle, and end.`;
        await updatePracticeSession(sessionId, { prompt: newPrompt });
        toast("Prompt regenerated!", "success");
      }
    } catch {
      toast("Failed to regenerate prompt", "error");
    } finally {
      setIsRegenerating(false);
    }
  }, [session, sessionId, hasKey, sendRequest, toast]);

  const handleDiscard = useCallback(async () => {
    timer.pause();
    await deletePracticeSession(sessionId);
    setShowDiscardDialog(false);
    toast("Session discarded", "info");
    router.push("/practice");
  }, [sessionId, timer, toast, router]);

  const handleGrade = useCallback(async () => {
    if (!session) return;

    const div = document.createElement("div");
    div.innerHTML = session.responseHtml || "";
    const text = div.textContent || "";

    if (!text.trim()) {
      toast("No writing to grade", "error");
      return;
    }

    // Build revision context if this is a round-based session
    const revisionCtx =
      isMultiRound && previousGradedRound && previousGradedRound.feedback
        ? {
            roundNumber: currentRoundData?.roundNumber ?? 2,
            previousFeedback: {
              overallScore: previousGradedRound.feedback.overallScore,
              improvements: previousGradedRound.feedback.improvements,
            },
          }
        : undefined;

    const { systemPrompt, userMessage } = practiceGradingPrompt(
      session.prompt,
      text,
      session.actualSeconds,
      revisionCtx,
    );

    try {
      const result = await sendRequest(systemPrompt, userMessage);
      const feedback = parseAIJson<PracticeFeedback>(result);
      feedback.gradedBy = resolveActiveModel(config.provider, DEFAULT_MODELS);

      if (isMultiRound) {
        await gradeCurrentRound(sessionId, feedback);
      } else {
        await updatePracticeSession(sessionId, {
          status: "graded",
          score: feedback.overallScore,
          feedback,
        });
      }
      toast("Writing graded!", "success");
    } catch {
      toast("Failed to grade writing", "error");
    }
  }, [
    session,
    sessionId,
    sendRequest,
    toast,
    isMultiRound,
    previousGradedRound,
    currentRoundData,
    config.provider,
  ]);

  const handlePastedGrading = useCallback(
    async (data: unknown) => {
      if (!session) return;
      try {
        const feedback = data as PracticeFeedback;
        if (typeof feedback.overallScore !== "number" || !Array.isArray(feedback.strengths)) {
          toast("Invalid grading format", "error");
          return;
        }
        if (isMultiRound) {
          await gradeCurrentRound(sessionId, feedback);
        } else {
          await updatePracticeSession(sessionId, {
            status: "graded",
            score: feedback.overallScore,
            feedback,
          });
        }
        toast("Grading applied!", "success");
      } catch {
        toast("Failed to apply grading", "error");
      }
    },
    [session, sessionId, toast, isMultiRound],
  );

  const handleDeleteSession = useCallback(async () => {
    await deletePracticeSession(sessionId);
    setShowDeleteDialog(false);
    toast("Session deleted", "info");
    router.push("/practice");
  }, [sessionId, toast, router]);

  const handleCopyForGrading = useCallback(async () => {
    if (!session) return;

    const div = document.createElement("div");
    div.innerHTML = session.responseHtml || "";
    const text = div.textContent || "";

    const revisionCtx =
      isMultiRound && previousGradedRound && previousGradedRound.feedback
        ? {
            roundNumber: currentRoundData?.roundNumber ?? 2,
            previousFeedback: {
              overallScore: previousGradedRound.feedback.overallScore,
              improvements: previousGradedRound.feedback.improvements,
            },
          }
        : undefined;

    const { systemPrompt, userMessage } = practiceGradingPrompt(
      session.prompt,
      text,
      session.actualSeconds,
      revisionCtx,
    );

    const formatted = formatPromptForCopy("grading", systemPrompt, userMessage);
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Grading prompt copied", "success");
  }, [session, toast, isMultiRound, previousGradedRound, currentRoundData]);

  const handleContinueRound = useCallback(
    async (durationSeconds: number) => {
      if (!session) return;
      await startNewRound(sessionId, durationSeconds);
      setShowContinueDialog(false);
      setViewingRoundIndex(null);
      hasStartedWriting.current = false;
      timerAutoStarted.current = false;
      toast("New round started!", "success");
    },
    [session, sessionId, toast],
  );

  const handleConvertToProject = useCallback(async () => {
    if (!session) return;
    setIsConverting(true);
    try {
      const projectId = await convertSessionToProject(sessionId);
      toast("Converted to project!", "success");
      router.push(`/projects/${projectId}`);
    } catch {
      toast("Failed to convert to project", "error");
    } finally {
      setIsConverting(false);
    }
  }, [session, sessionId, toast, router]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  // Resolve genre labels — handle both built-in IDs and custom genre strings
  const genreLabels = session.genres.map((id) => GENRES.find((g) => g.id === id)?.label || id);

  // For viewing specific rounds in graded state
  const displayRoundIdx = viewingRoundIndex ?? (session.rounds ? session.rounds.length - 1 : 0);
  const displayRound = session.rounds?.[displayRoundIdx] ?? null;
  const displayFeedback = displayRound?.feedback ?? session.feedback;
  const displayScore = displayRound?.score ?? session.score;
  const displayHtml = displayRound?.responseHtml ?? session.responseHtml;

  // In-progress: show timer + editor
  if (session.status === "in_progress") {
    return (
      <div className={cn("flex flex-col h-full", isFullscreen && "fixed inset-0 z-50 bg-surface")}>
        {/* Timer bar */}
        <div className="border-b border-border px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Timer display */}
              {isUntimed ? (
                <div className="flex items-center gap-1.5 text-lg font-mono font-semibold text-text-primary">
                  <Timer
                    size={18}
                    className={timer.isRunning ? "text-accent" : "text-text-muted"}
                  />
                  {formatSeconds(timer.elapsed)}
                  <span className="text-xs font-normal text-text-muted ml-1">elapsed</span>
                </div>
              ) : timer.isComplete ? (
                <div className="flex items-center gap-1.5 text-lg font-mono font-semibold text-accent">
                  <Clock size={18} className="text-accent" />
                  0:00
                  <span className="text-xs font-normal text-accent/70 ml-1">time&apos;s up</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 text-lg font-mono font-semibold text-text-primary">
                    <Clock
                      size={18}
                      className={timer.isRunning ? "text-accent" : "text-text-muted"}
                    />
                    {formatSeconds(timer.remaining)}
                  </div>
                  {/* Duration picker toggle (only before timer starts) */}
                  {!timer.isRunning && !timerAutoStarted.current && (
                    <button
                      onClick={() => setShowDurationPicker(!showDurationPicker)}
                      className="text-[10px] text-text-muted hover:text-accent transition-colors ml-1"
                    >
                      adjust
                    </button>
                  )}
                </div>
              )}
              {!isFullscreen && genreLabels.length > 0 && (
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
              {isRevisionRound && previousGradedRound?.feedback && (
                <button
                  onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
                  title={showFeedbackPanel ? "Hide feedback" : "Show feedback"}
                >
                  {showFeedbackPanel ? <MessageSquareOff size={15} /> : <MessageSquare size={15} />}
                </button>
              )}
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
                title={showPrompt ? "Hide prompt" : "Show prompt"}
              >
                {showPrompt ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              {timer.isComplete ? (
                <>
                  {/* Timer expired: button to re-open the dialog */}
                  <Button variant="secondary" size="sm" onClick={() => setShowTimerDialog(true)}>
                    <Clock size={14} />
                    {!isFullscreen && "Continue or Submit"}
                  </Button>
                </>
              ) : !timer.isRunning && !timerAutoStarted.current ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      timerAutoStarted.current = true;
                      timer.start();
                    }}
                  >
                    Start Writing
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await deletePracticeSession(sessionId);
                      toast("Session discarded", "info");
                      router.push("/practice");
                    }}
                  >
                    <Trash2 size={14} />
                    Discard
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={handleSubmit}>
                    <Send size={14} />
                    {!isFullscreen && (isUntimed ? "Submit" : "Submit Early")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDiscardDialog(true)}
                    className="text-text-muted hover:text-danger"
                  >
                    <X size={14} />
                    {!isFullscreen && "Discard"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress bar (only for timed mode, not when complete) */}
          {!isUntimed && !timer.isComplete && (
            <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                style={{ width: `${timer.progress * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}

          {/* Timer expired banner */}
          {timer.isComplete && <div className="h-1 rounded-full bg-accent overflow-hidden" />}

          {/* Duration picker (shown before timer starts) */}
          {showDurationPicker && !timer.isRunning && !timerAutoStarted.current && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
              {PRACTICE_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => handleDurationChange(d.value)}
                  className={cn(
                    "rounded border px-2.5 py-1 text-xs font-medium transition-colors",
                    session.durationSeconds === d.value
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {d.label}
                </button>
              ))}
              <button
                onClick={() => handleDurationChange(0)}
                className={cn(
                  "rounded border px-2.5 py-1 text-xs font-medium transition-colors",
                  session.durationSeconds === 0
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-border text-text-secondary hover:bg-surface-hover",
                )}
              >
                No limit
              </button>
            </div>
          )}

          {!timer.isRunning && !timerAutoStarted.current && !timer.isComplete && (
            <p className="text-[10px] text-text-muted mt-1.5 text-center">
              Timer starts automatically when you begin typing
            </p>
          )}
        </div>

        {/* Prompt */}
        {showPrompt && (
          <div className="border-b border-border bg-surface-raised/30 px-6 py-3">
            <div className={cn("flex items-start gap-3", isFullscreen && "max-w-[65ch] mx-auto")}>
              <p className="text-sm text-text-secondary font-serif italic leading-relaxed flex-1">
                {session.prompt}
              </p>
              {/* Regenerate button — only before writing starts */}
              {!hasStartedWriting.current && !timerAutoStarted.current && (
                <button
                  onClick={handleRegeneratePrompt}
                  disabled={isRegenerating}
                  className="shrink-0 p-1.5 rounded text-text-muted hover:text-accent transition-colors disabled:opacity-50"
                  title="Regenerate prompt"
                >
                  <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Previous round feedback (revision rounds only) */}
        {isRevisionRound && showFeedbackPanel && previousGradedRound?.feedback && (
          <FeedbackPanel
            feedback={previousGradedRound.feedback}
            roundNumber={previousGradedRound.roundNumber}
            score={previousGradedRound.score}
          />
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <PracticeEditor
            placeholder="Start writing..."
            editable={!timer.isComplete}
            onContentChange={handleContentChange}
            initialContent={isRevisionRound ? currentRoundData?.response : undefined}
            showToolbar={isRevisionRound}
          />
        </div>

        {/* Timer Expiry Dialog */}
        <Dialog open={showTimerDialog} onClose={() => setShowTimerDialog(false)}>
          <DialogTitle>Time&apos;s Up!</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            Your writing time has ended. Continue writing or submit your work.
          </p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {EXTEND_OPTIONS.map((opt) => (
                <Button
                  key={opt.seconds}
                  variant="secondary"
                  onClick={() => handleExtend(opt.seconds)}
                  className="flex-1"
                >
                  <Plus size={14} />
                  Continue for {Math.round(opt.seconds / 60)} min
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={handleRemoveLimit} className="w-full">
              <InfinityIcon size={14} />
              Remove time limit
            </Button>
            <div className="border-t border-border pt-3">
              <Button variant="primary" onClick={handleSubmit} className="w-full">
                <Send size={14} />
                Submit Writing
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Discard Confirmation Dialog */}
        <Dialog open={showDiscardDialog} onClose={() => setShowDiscardDialog(false)}>
          <DialogTitle>Discard Session?</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently discard your writing and delete this practice session. This cannot
            be undone.
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

        {/* Version Timeline */}
        {isMultiRound && session.rounds && session.rounds.length > 1 && (
          <VersionTimeline
            rounds={session.rounds}
            activeRoundIndex={viewingRoundIndex ?? session.rounds.length - 1}
            onSelectRound={setViewingRoundIndex}
          />
        )}

        {/* Prompt */}
        <Card className="mb-6">
          <p className="text-sm text-text-secondary font-serif italic leading-relaxed">
            {session.prompt}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
            <span>{displayRound?.wordCount ?? session.wordCount} words</span>
            <span>
              {(displayRound?.durationSeconds ?? session.durationSeconds) === 0
                ? "Untimed"
                : `${Math.round((displayRound?.actualSeconds ?? session.actualSeconds) / 60)} min`}
            </span>
            {genreLabels.map((g) => (
              <Badge key={g} variant="muted" className="text-[10px]">
                {g}
              </Badge>
            ))}
            {session.focusAreas &&
              session.focusAreas.length > 0 &&
              session.focusAreas.map((id) => {
                const cat = FOCUS_AREA_CATEGORIES.find((c) => c.id === id);
                return cat ? (
                  <Badge key={id} variant="accent" className="text-[10px]">
                    <Target size={8} className="shrink-0" />
                    {cat.label}
                  </Badge>
                ) : null;
              })}
          </div>
        </Card>

        {/* Grading */}
        {session.status === "submitted" && (
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
              <Button variant="secondary" onClick={handleCopyForGrading} className="w-full">
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
                expectedShape={
                  "{ overallScore, strengths[], improvements[], tips[], detailedNotes }"
                }
                className="mt-3"
              />
            )}
          </div>
        )}

        {/* Feedback */}
        {displayFeedback && (
          <div className="space-y-4">
            {/* Score */}
            <Card className="text-center py-6">
              <div
                className={cn(
                  "text-5xl font-bold mb-1",
                  displayScore !== null && displayScore !== undefined && displayScore >= 80
                    ? "text-success"
                    : displayScore !== null && displayScore !== undefined && displayScore >= 60
                      ? "text-accent"
                      : "text-danger",
                )}
              >
                {displayScore}
              </div>
              <p className="text-sm text-text-muted">out of 100</p>
              {displayFeedback?.gradedBy && (
                <p className="text-[10px] text-text-muted mt-1">
                  Graded by {displayFeedback.gradedBy}
                </p>
              )}
            </Card>

            {/* Continue Practicing & Convert to Project buttons */}
            {session.status === "graded" && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowContinueDialog(true)}
                  className="flex-1"
                >
                  <Play size={14} />
                  Continue Practicing
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleConvertToProject}
                  disabled={isConverting}
                  className="flex-1"
                >
                  {isConverting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FolderOpen size={14} />
                      Convert to Project
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Strengths */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-success" />
                <h3 className="text-sm font-medium text-text-primary">Strengths</h3>
              </div>
              <ul className="space-y-1.5">
                {displayFeedback.strengths.map((s, i) => (
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
                {displayFeedback.improvements.map((s, i) => (
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
                {displayFeedback.tips.map((s, i) => (
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
                {displayFeedback.detailedNotes}
              </p>
            </Card>
          </div>
        )}

        {/* Response preview */}
        {displayHtml && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
              Your Response
            </h3>
            <Card>
              <div
                className="text-sm text-text-secondary font-serif leading-relaxed prose-invert"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            </Card>
          </div>
        )}

        {/* Continue Dialog */}
        <ContinueDialog
          open={showContinueDialog}
          onClose={() => setShowContinueDialog(false)}
          onStart={handleContinueRound}
        />

        {/* Delete Session Confirmation */}
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete Practice Session</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently delete this practice session and all its feedback. This cannot be
            undone.
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
