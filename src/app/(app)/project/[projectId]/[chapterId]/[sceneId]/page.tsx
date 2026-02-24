"use client";

import { use, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useScene, useProject, updateScene } from "@/lib/db/hooks";
import { WritingEditor } from "@/components/editor/writing-editor";
import { AIPanel } from "@/components/ai/ai-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDistractionFree } from "@/hooks/use-distraction-free";
import { Sparkles, Maximize2, Minimize2, StickyNote, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function SceneEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; chapterId: string; sceneId: string }>;
}) {
  const { projectId, sceneId } = use(params);
  const scene = useScene(sceneId);
  const project = useProject(projectId);
  const { isActive: isDistractionFree, toggle: toggleDistractionFree } = useDistractionFree();
  const [showAI, setShowAI] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  const aiEnabled = project?.aiEnabled ?? false;

  const handleTitleSave = async () => {
    if (titleInput.trim()) {
      await updateScene(sceneId, { title: titleInput.trim() });
    }
    setEditingTitle(false);
  };

  return (
    <div className={cn("flex h-full", isDistractionFree && "fixed inset-0 z-50 bg-surface")}>
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scene header */}
        {!isDistractionFree && (
          <div className="flex items-center justify-between border-b border-border px-4 md:px-6 py-3">
            <div className="flex-1">
              {editingTitle ? (
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  autoFocus
                  className="text-lg font-semibold max-w-md"
                />
              ) : (
                <h2
                  className="text-lg font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
                  onClick={() => {
                    setTitleInput(scene.title);
                    setEditingTitle(true);
                  }}
                >
                  {scene.title}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotes(!showNotes)}
                title="Toggle notes"
              >
                <StickyNote size={16} />
              </Button>
              {aiEnabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAI(!showAI)}
                  title="AI Analysis"
                >
                  <Sparkles size={16} className={showAI ? "text-accent" : ""} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDistractionFree}
                title="Distraction-free mode (Cmd+Shift+F)"
              >
                <Maximize2 size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          {isDistractionFree && (
            <button
              onClick={toggleDistractionFree}
              className="fixed top-4 right-4 z-50 p-2 text-text-muted hover:text-text-primary opacity-0 hover:opacity-100 transition-opacity"
            >
              <Minimize2 size={20} />
            </button>
          )}
          <WritingEditor sceneId={sceneId} initialContent={scene.content || undefined} />
        </div>

        {/* Notes panel (inline below) */}
        <AnimatePresence>
          {showNotes && !isDistractionFree && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Scene Notes
                  </label>
                  <button
                    onClick={() => setShowNotes(false)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </div>
                <Textarea
                  value={scene.notes}
                  onChange={(e) => updateScene(sceneId, { notes: e.target.value })}
                  placeholder="Scene notes, character motivations, what happens next..."
                  rows={3}
                  className="font-serif text-sm"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Panel */}
      <AnimatePresence>
        {showAI && !isDistractionFree && (
          <AIPanel sceneId={sceneId} projectId={projectId} onClose={() => setShowAI(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
