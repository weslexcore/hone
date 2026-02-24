"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils/cn";

interface WordCountBarProps {
  editor: Editor;
  lastSaved?: Date | null;
  isSaving?: boolean;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readingTime(words: number) {
  const minutes = Math.ceil(words / 238);
  if (minutes < 1) return "< 1 min read";
  return `${minutes} min read`;
}

export function WordCountBar({ editor, lastSaved, isSaving }: WordCountBarProps) {
  const words = editor.storage.characterCount?.words() ?? 0;
  const characters = editor.storage.characterCount?.characters() ?? 0;

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-muted">
      <div className="flex items-center gap-4">
        <span>{words.toLocaleString()} words</span>
        <span>{characters.toLocaleString()} characters</span>
        <span>{readingTime(words)}</span>
      </div>
      {lastSaved !== undefined && (
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="text-accent">Saving...</span>
          ) : lastSaved ? (
            <span>Saved {formatTime(lastSaved)}</span>
          ) : (
            <span className={cn("text-text-muted")}>Not saved</span>
          )}
        </div>
      )}
    </div>
  );
}
