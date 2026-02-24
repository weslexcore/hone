"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import { updateScene, propagateWordCount } from "@/lib/db/hooks";

export function useAutosave(editor: Editor | null, sceneId: string | undefined) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async () => {
    if (!editor || !sceneId) return;

    setIsSaving(true);
    try {
      const content = JSON.stringify(editor.getJSON());
      const contentHtml = editor.getHTML();
      const wordCount = editor.storage.characterCount?.words() ?? 0;

      await updateScene(sceneId, { content, contentHtml, wordCount });
      await propagateWordCount(sceneId);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [editor, sceneId]);

  useEffect(() => {
    if (!editor || !sceneId) return;

    const handler = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(save, 1000);
    };

    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [editor, sceneId, save]);

  return { save, lastSaved, isSaving };
}
