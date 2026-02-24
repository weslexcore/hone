"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { createEditorExtensions } from "@/lib/editor/extensions";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { WordCountBar } from "@/components/editor/word-count-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { PasteAIResponse } from "@/components/ai/paste-ai-response";
import { useAI } from "@/providers/ai-provider";
import { useToast } from "@/components/ui/toast";
import { useScenes, createScene, deleteScene, propagateWordCount } from "@/lib/db/hooks";
import { sceneExtractionPrompt, formatPromptForCopy } from "@/lib/ai/prompts";
import { parseAIJson } from "@/lib/ai/client";
import { AnimatePresence } from "motion/react";
import { AIPanel } from "@/components/ai/ai-panel";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  SplitSquareHorizontal,
  FileText,
  Scissors,
} from "lucide-react";

interface ChapterWriterProps {
  chapterId: string;
  projectId: string;
  onScenesCreated: () => void;
}

interface ExtractedScene {
  title: string;
  content: string;
}

/** Generate a title from the first few words of content */
function titleFromContent(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Untitled Scene";
  const slice = words.slice(0, 5).join(" ");
  return words.length > 5 ? `${slice}…` : slice;
}

export function ChapterWriter({ chapterId, projectId, onScenesCreated }: ChapterWriterProps) {
  const scenes = useScenes(chapterId);
  const hasLoadedScenes = useRef(false);

  // Keep a stable snapshot of existing scene titles (in order) so we can
  // re-use them when the user re-splits. This only captures on first load.
  const existingSceneTitles = useRef<string[]>([]);

  // Combine existing scenes into a single Tiptap document
  const initialContent = useMemo(() => {
    if (!scenes || scenes.length === 0) return undefined;

    // Capture titles once
    if (existingSceneTitles.current.length === 0) {
      existingSceneTitles.current = scenes.map((s) => s.title);
    }

    const combinedNodes: unknown[] = [];

    scenes.forEach((scene, index) => {
      if (index > 0) {
        combinedNodes.push({ type: "horizontalRule" });
      }

      if (scene.content) {
        try {
          const parsed = JSON.parse(scene.content);
          if (parsed.content && Array.isArray(parsed.content)) {
            combinedNodes.push(...parsed.content);
          }
        } catch {
          if (scene.contentHtml) {
            const div = document.createElement("div");
            div.innerHTML = scene.contentHtml;
            const text = div.textContent || "";
            text
              .split(/\n\n+/)
              .filter(Boolean)
              .forEach((p) => {
                combinedNodes.push({
                  type: "paragraph",
                  content: [{ type: "text", text: p.trim() }],
                });
              });
          }
        }
      } else if (scene.contentHtml) {
        const div = document.createElement("div");
        div.innerHTML = scene.contentHtml;
        const text = div.textContent || "";
        text
          .split(/\n\n+/)
          .filter(Boolean)
          .forEach((p) => {
            combinedNodes.push({
              type: "paragraph",
              content: [{ type: "text", text: p.trim() }],
            });
          });
      }
    });

    if (combinedNodes.length === 0) return undefined;
    return { type: "doc", content: combinedNodes };
  }, [scenes]);

  // ---- Editor ----

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions("Write your chapter here… Type --- to mark scene breaks."),
    editorProps: {
      attributes: { class: "ProseMirror" },
    },
    onUpdate: () => {
      // Re-derive the live scene count whenever content changes
      recountScenes();
    },
  });

  // Load existing scenes into editor on first availability
  useEffect(() => {
    if (editor && initialContent && !hasLoadedScenes.current) {
      editor.commands.setContent(initialContent as Record<string, unknown>);
      hasLoadedScenes.current = true;
    }
  }, [editor, initialContent]);

  // ---- Live scene count from <hr> markers ----

  const [liveSceneCount, setLiveSceneCount] = useState(1);

  const recountScenes = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const parts = html.split(/<hr\s*\/?>/i).filter((p) => p.trim());
    setLiveSceneCount(Math.max(parts.length, 1));
  }, [editor]);

  // Initial count once editor is ready
  useEffect(() => {
    if (editor) recountScenes();
  }, [editor, recountScenes]);

  // ---- State ----

  const { hasKey, sendRequest, isLoading } = useAI();
  const { toast } = useToast();
  const [extractedScenes, setExtractedScenes] = useState<ExtractedScene[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // ---- Helpers ----

  const getPlainText = useCallback(() => {
    if (!editor) return "";
    const html = editor.getHTML();
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  }, [editor]);

  /**
   * Assign a title for position `i` in a list of extracted scenes.
   * Re-uses the existing scene title if one exists at that position,
   * otherwise generates one from the first few words.
   */
  const titleForScene = useCallback((content: string, index: number): string => {
    if (index < existingSceneTitles.current.length) {
      return existingSceneTitles.current[index];
    }
    return titleFromContent(content);
  }, []);

  // ---- Split on --- (automatic — primary action) ----

  const handleSplit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();

    // Split on <hr> tags
    const htmlParts = html.split(/<hr\s*\/?>/i).filter((p) => p.trim());

    if (htmlParts.length <= 1) {
      // Also try plain-text --- fallback
      const text = getPlainText();
      const textParts = text.split(/\n\s*---\s*\n/).filter((p) => p.trim());

      if (textParts.length <= 1) {
        toast(
          "No scene breaks found. Type --- on its own line to mark where scenes should split.",
          "info",
        );
        return;
      }

      setExtractedScenes(
        textParts.map((content, i) => ({
          title: titleForScene(content.trim(), i),
          content: content.trim(),
        })),
      );
    } else {
      setExtractedScenes(
        htmlParts.map((htmlPart, i) => {
          const div = document.createElement("div");
          div.innerHTML = htmlPart;
          const content = (div.textContent || "").trim();
          return {
            title: titleForScene(content, i),
            content,
          };
        }),
      );
    }

    setShowPreview(true);
  }, [editor, getPlainText, toast, titleForScene]);

  // ---- AI extraction ----

  const handleAIExtract = useCallback(async () => {
    const text = getPlainText();
    if (!text.trim()) {
      toast("Write some content first", "error");
      return;
    }

    const { systemPrompt, userMessage } = sceneExtractionPrompt(text);

    try {
      const result = await sendRequest(systemPrompt, userMessage);
      const parsed = parseAIJson<ExtractedScene[]>(result);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast("AI returned no scenes", "error");
        return;
      }
      // AI provides its own titles — leave them as-is
      setExtractedScenes(parsed);
      setShowPreview(true);
    } catch {
      toast("Failed to extract scenes", "error");
    }
  }, [getPlainText, sendRequest, toast]);

  // ---- Copy for AI ----

  const handleCopyForExtraction = useCallback(async () => {
    const text = getPlainText();
    if (!text.trim()) {
      toast("Write some content first", "error");
      return;
    }

    const { systemPrompt, userMessage } = sceneExtractionPrompt(text);
    const formatted = formatPromptForCopy("scene_extraction", systemPrompt, userMessage);

    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Extraction prompt copied", "success");
  }, [getPlainText, toast]);

  // ---- Pasted AI response ----

  const handlePastedExtraction = useCallback(
    (data: unknown) => {
      try {
        const arr = Array.isArray(data) ? data : [data];
        const parsed = arr.map((s: Record<string, unknown>) => ({
          title: (s.title as string) || "Untitled Scene",
          content: (s.content as string) || "",
        }));
        if (parsed.length === 0 || !parsed[0].content) {
          toast("Invalid scene data", "error");
          return;
        }
        setExtractedScenes(parsed);
        setShowPreview(true);
      } catch {
        toast("Could not parse scenes", "error");
      }
    },
    [toast],
  );

  // ---- Save scenes to DB ----

  const handleConfirmScenes = useCallback(async () => {
    if (extractedScenes.length === 0) return;
    setIsSaving(true);

    try {
      // Delete existing scenes first so we replace them cleanly
      if (scenes && scenes.length > 0) {
        for (const existing of scenes) {
          await deleteScene(existing.id);
        }
      }

      for (const scene of extractedScenes) {
        const paragraphs = scene.content.split(/\n\n+/).filter(Boolean);
        const tiptapDoc = {
          type: "doc",
          content: paragraphs.map((p) => ({
            type: "paragraph",
            content: [{ type: "text", text: p.trim() }],
          })),
        };
        const contentJson = JSON.stringify(tiptapDoc);
        const contentHtml = paragraphs.map((p) => `<p>${p.trim()}</p>`).join("");
        const wordCount = scene.content.split(/\s+/).filter(Boolean).length;

        const id = await createScene(chapterId, projectId, {
          title: scene.title,
          content: contentJson,
          contentHtml,
          wordCount,
        });
        await propagateWordCount(id);
      }

      // Update the snapshot of titles for next time
      existingSceneTitles.current = extractedScenes.map((s) => s.title);

      toast(
        `${extractedScenes.length} scene${extractedScenes.length > 1 ? "s" : ""} created`,
        "success",
      );
      setShowPreview(false);
      setExtractedScenes([]);
      editor?.commands.clearContent();
      onScenesCreated();
    } catch {
      toast("Failed to save scenes", "error");
    } finally {
      setIsSaving(false);
    }
  }, [extractedScenes, scenes, chapterId, projectId, editor, toast, onScenesCreated]);

  // ---- Update title in preview ----

  const updateSceneTitle = useCallback((index: number, title: string) => {
    setExtractedScenes((prev) => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  }, []);

  if (!editor) return null;

  return (
    <div className="flex gap-0">
      <div className="flex-1 min-w-0 border border-border rounded-xl overflow-hidden bg-surface-raised">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-surface-raised">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Full Chapter
            </span>
            {liveSceneCount > 1 && (
              <span className="text-[10px] text-accent bg-accent-muted rounded-full px-2 py-0.5 font-medium">
                {liveSceneCount} scenes detected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAI(!showAI)}
              title="AI Analysis"
              className={showAI ? "text-accent" : ""}
            >
              <Sparkles size={14} />
              Analyze
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSplit}
              title="Split on --- markers into scenes"
            >
              <Scissors size={14} />
              Extract Scenes
            </Button>
            {hasKey() ? (
              <Button variant="secondary" size="sm" onClick={handleAIExtract} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    AI…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    AI Split
                  </>
                )}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleCopyForExtraction}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy for AI"}
              </Button>
            )}
          </div>
        </div>

        {/* Editor */}
        <EditorToolbar editor={editor} />
        <EditorContent editor={editor} />
        <WordCountBar editor={editor} />

        {/* Paste response (when no API key) */}
        {!hasKey() && (
          <div className="border-t border-border px-4 py-3">
            <PasteAIResponse
              onParsed={handlePastedExtraction}
              expectedShape={"JSON array of { title, content }"}
            />
          </div>
        )}

        {/* Scene Preview Dialog */}
        <Dialog open={showPreview} onClose={() => setShowPreview(false)} className="max-w-2xl">
          <DialogTitle>
            <div className="flex items-center gap-2">
              <SplitSquareHorizontal size={18} className="text-accent" />
              Extracted Scenes ({extractedScenes.length})
            </div>
          </DialogTitle>

          <p className="text-xs text-text-muted mb-4">
            Review the scenes below. Click a title to rename it. Confirm to create all scenes in
            this chapter
            {scenes && scenes.length > 0 ? " (existing scenes will be replaced)." : "."}
          </p>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 mb-4">
            {extractedScenes.map((scene, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={13} className="text-text-muted shrink-0" />
                  <input
                    value={scene.title}
                    onChange={(e) => updateSceneTitle(i, e.target.value)}
                    className="text-sm font-medium text-text-primary bg-transparent border-none outline-none flex-1 focus:text-accent"
                    placeholder="Scene title"
                  />
                  <span className="text-[10px] text-text-muted shrink-0">
                    {scene.content.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <p className="text-xs text-text-secondary font-serif leading-relaxed line-clamp-4">
                  {scene.content}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmScenes} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check size={14} />
                  Create {extractedScenes.length} Scene
                  {extractedScenes.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </Dialog>
      </div>

      {/* AI Analysis Panel */}
      <AnimatePresence>
        {showAI && (
          <AIPanel
            chapterId={chapterId}
            projectId={projectId}
            getText={getPlainText}
            onClose={() => setShowAI(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
