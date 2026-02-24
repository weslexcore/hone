"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAI } from "@/providers/ai-provider";
import { usePracticeSessions, createPracticeSession, deletePracticeSession } from "@/lib/db/hooks";
import { GENRES, PRACTICE_DURATIONS } from "@/lib/constants/genres";
import { practicePromptGenerationPrompt, formatPromptForCopy } from "@/lib/ai/prompts";
import { PasteAIResponse } from "@/components/ai/paste-ai-response";
import { useFocusAreas } from "@/hooks/use-focus-areas";
import { FOCUS_AREA_CATEGORIES } from "@/lib/constants/focus-areas";
import { Timer, Play, Copy, Check, Clock, Loader2, Trash2, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDistanceToNow } from "date-fns";

export default function PracticePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasKey, sendRequest, isLoading } = useAI();
  const sessions = usePracticeSessions();

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [customGenreInput, setCustomGenreInput] = useState("");
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [customMinutes, setCustomMinutes] = useState("");
  const [copied, setCopied] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { focusAreas, strengths, totalGradedSessions } = useFocusAreas(sessions);

  // Defer hasKey() check to avoid SSR/client hydration mismatch (reads localStorage)
  const showManualFlow = mounted && !hasKey() && !customPrompt;

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const toggleCustomGenre = (genre: string) => {
    setCustomGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleAddCustomGenres = () => {
    const newGenres = customGenreInput
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0 && !customGenres.includes(g));
    if (newGenres.length > 0) {
      setCustomGenres((prev) => [...prev, ...newGenres]);
    }
    setCustomGenreInput("");
  };

  // Resolve all selected genre labels (built-in + custom)
  const allSelectedGenreLabels = [
    ...selectedGenres.map((id) => GENRES.find((g) => g.id === id)?.label || id),
    ...customGenres,
  ];

  const hasGenres = selectedGenres.length > 0 || customGenres.length > 0;

  // Effective duration: custom minutes override preset if set
  const effectiveDuration =
    customMinutes && Number(customMinutes) > 0
      ? Math.round(Number(customMinutes) * 60)
      : selectedDuration;

  const focusAreaLabels = selectedFocusAreas
    .map((id) => FOCUS_AREA_CATEGORIES.find((c) => c.id === id)?.label)
    .filter(Boolean) as string[];

  const topStrengthLabels = strengths.slice(0, 3).map((s) => s.category.label);

  const handleStart = useCallback(async () => {
    try {
      let prompt = "";

      if (customPrompt) {
        prompt = customPrompt;
      } else if (hasKey()) {
        const { systemPrompt, userMessage } = practicePromptGenerationPrompt(
          allSelectedGenreLabels,
          {
            focusAreas: focusAreaLabels.length > 0 ? focusAreaLabels : undefined,
            strengths: topStrengthLabels.length > 0 ? topStrengthLabels : undefined,
          },
        );
        prompt = await sendRequest(systemPrompt, userMessage);
      } else {
        const genreText = hasGenres ? `${allSelectedGenreLabels.join("/")} ` : "";
        const focusPart =
          focusAreaLabels.length > 0
            ? ` Focus especially on ${focusAreaLabels.join(" and ")}.`
            : "";
        prompt = `Write a short ${genreText}piece. Focus on vivid sensory detail and a compelling opening line.${focusPart} Your piece should have a clear beginning, middle, and end.`;
      }

      const id = await createPracticeSession({
        genres: [...selectedGenres, ...customGenres],
        focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : undefined,
        prompt,
        durationSeconds: effectiveDuration,
      });

      setCustomPrompt(null);
      router.push(`/practice/${id}`);
    } catch {
      toast("Failed to generate prompt", "error");
    }
  }, [
    hasGenres,
    selectedGenres,
    customGenres,
    selectedFocusAreas,
    effectiveDuration,
    customPrompt,
    hasKey,
    sendRequest,
    router,
    toast,
    allSelectedGenreLabels,
    focusAreaLabels,
    topStrengthLabels,
  ]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deletePracticeSession(id);
      setDeletingSessionId(null);
      toast("Session deleted", "info");
    },
    [toast],
  );

  const handlePastedPrompt = useCallback(
    (data: unknown) => {
      if (typeof data === "string") {
        setCustomPrompt(data);
        toast("Prompt loaded! Click Start Practice to begin.", "success");
      } else if (data && typeof data === "object" && "prompt" in data) {
        setCustomPrompt(String((data as Record<string, unknown>).prompt));
        toast("Prompt loaded! Click Start Practice to begin.", "success");
      } else {
        setCustomPrompt(String(data));
        toast("Prompt loaded! Click Start Practice to begin.", "success");
      }
    },
    [toast],
  );

  const handleCopyPromptRequest = useCallback(async () => {
    const { systemPrompt, userMessage } = practicePromptGenerationPrompt(allSelectedGenreLabels, {
      focusAreas: focusAreaLabels.length > 0 ? focusAreaLabels : undefined,
      strengths: topStrengthLabels.length > 0 ? topStrengthLabels : undefined,
    });
    const formatted = formatPromptForCopy("prompt_generation", systemPrompt, userMessage);

    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Prompt copied to clipboard", "success");
  }, [allSelectedGenreLabels, focusAreaLabels, topStrengthLabels, toast]);

  const scoreColor = (score: number | null) => {
    if (score === null) return "text-text-muted";
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-accent";
    return "text-danger";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Practice</h1>
          <p className="text-sm text-text-muted mt-1">Writing exercises with AI feedback</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Setup */}
          <div className="lg:col-span-2 space-y-6">
            {/* Genre Selection */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Genres <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <Badge
                    key={genre.id}
                    variant={selectedGenres.includes(genre.id) ? "accent" : "default"}
                    onClick={() => toggleGenre(genre.id)}
                    className="cursor-pointer text-xs py-1 px-2.5"
                  >
                    {genre.label}
                  </Badge>
                ))}
                {/* Custom genres */}
                {customGenres.map((genre) => (
                  <Badge
                    key={`custom-${genre}`}
                    variant="accent"
                    onClick={() => toggleCustomGenre(genre)}
                    className="cursor-pointer text-xs py-1 px-2.5"
                  >
                    {genre} ×
                  </Badge>
                ))}
              </div>

              {/* Custom genre input */}
              <div className="flex gap-2 mt-3">
                <Input
                  value={customGenreInput}
                  onChange={(e) => setCustomGenreInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomGenres()}
                  placeholder="Add custom genres (comma-separated)..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddCustomGenres}
                  disabled={!customGenreInput.trim()}
                  className="shrink-0"
                >
                  <Plus size={14} />
                  Add
                </Button>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">Duration</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedDuration(0);
                    setCustomMinutes("");
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
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
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
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
                      "w-24 text-center",
                      customMinutes && "border-accent ring-1 ring-accent/30",
                    )}
                  />
                  <span className="text-xs text-text-muted">min</span>
                </div>
              </div>
            </div>

            {/* Focus Areas */}
            {focusAreas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  <Target size={14} className="inline -mt-0.5 mr-1" />
                  Focus Areas
                  <span className="text-text-muted font-normal ml-1">
                    (from {totalGradedSessions} graded session
                    {totalGradedSessions !== 1 ? "s" : ""})
                  </span>
                </label>
                <p className="text-xs text-text-muted mb-3">
                  Select areas to focus your next prompt on
                </p>
                <div className="flex flex-wrap gap-2">
                  {focusAreas.map((area) => (
                    <Badge
                      key={area.category.id}
                      variant={selectedFocusAreas.includes(area.category.id) ? "accent" : "default"}
                      onClick={() =>
                        setSelectedFocusAreas((prev) =>
                          prev.includes(area.category.id)
                            ? prev.filter((id) => id !== area.category.id)
                            : [...prev, area.category.id],
                        )
                      }
                      className="cursor-pointer text-xs py-1 px-2.5"
                    >
                      {area.category.label}
                      <span className="ml-1 opacity-60">({area.count})</span>
                    </Badge>
                  ))}
                </div>
                {selectedFocusAreas.length > 0 && (
                  <p className="mt-2 text-[10px] text-accent">
                    Prompt will emphasize:{" "}
                    {selectedFocusAreas
                      .map((id) => focusAreas.find((a) => a.category.id === id)?.category.label)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Custom Prompt <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <Textarea
                value={customPrompt || ""}
                onChange={(e) => setCustomPrompt(e.target.value || null)}
                placeholder="Write your own prompt, or leave blank to auto-generate one…"
                rows={3}
                className="font-serif text-sm"
              />
              {customPrompt && (
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-accent">Custom prompt will be used</span>
                  <button
                    onClick={() => setCustomPrompt(null)}
                    className="text-[10px] text-text-muted hover:text-text-secondary"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Start */}
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleStart}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating prompt...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    {customPrompt
                      ? "Start with Custom Prompt"
                      : effectiveDuration === 0
                        ? "Start Practice (No limit)"
                        : `Start Practice (${customMinutes && Number(customMinutes) > 0 ? `${customMinutes} min` : PRACTICE_DURATIONS.find((d) => d.value === selectedDuration)?.label || `${Math.round(selectedDuration / 60)} min`})`}
                  </>
                )}
              </Button>
              {showManualFlow && (
                <Button variant="secondary" size="lg" onClick={handleCopyPromptRequest}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </Button>
              )}
            </div>

            {/* Paste AI prompt */}
            {showManualFlow && (
              <PasteAIResponse
                onParsed={handlePastedPrompt}
                placeholder="Paste the AI-generated prompt here..."
                allowPlainText
              />
            )}
          </div>

          {/* Recent Sessions */}
          <div>
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
              Recent Sessions
            </h2>
            {sessions && sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.slice(0, 10).map((session) => (
                  <Card
                    key={session.id}
                    hover
                    className="group py-3 px-4"
                    onClick={() => router.push(`/practice/${session.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-muted">
                        {formatDistanceToNow(session.createdAt, { addSuffix: true })}
                      </span>
                      <div className="flex items-center gap-2">
                        {session.score !== null && (
                          <span className={cn("text-sm font-semibold", scoreColor(session.score))}>
                            {session.score}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSessionId(session.id);
                          }}
                          className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">{session.prompt}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock size={10} />
                        {session.durationSeconds === 0
                          ? "Untimed"
                          : `${Math.round(session.durationSeconds / 60)}min`}
                      </span>
                      <span className="text-[10px] text-text-muted">{session.wordCount} words</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <Timer size={24} className="mx-auto text-text-muted mb-2" />
                <p className="text-xs text-text-muted">No practice sessions yet</p>
              </div>
            )}
          </div>
        </div>
        {/* Delete Session Confirmation */}
        <Dialog open={!!deletingSessionId} onClose={() => setDeletingSessionId(null)}>
          <DialogTitle>Delete Practice Session</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently delete this practice session and all its feedback. This cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingSessionId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingSessionId && handleDeleteSession(deletingSessionId)}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}
