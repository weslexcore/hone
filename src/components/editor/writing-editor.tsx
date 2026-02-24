"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import { createEditorExtensions } from "@/lib/editor/extensions";
import { EditorToolbar } from "./editor-toolbar";
import { WordCountBar } from "./word-count-bar";
import { useAutosave } from "@/hooks/use-autosave";

interface WritingEditorProps {
  sceneId: string;
  initialContent?: string;
  placeholder?: string;
  showToolbar?: boolean;
  showWordCount?: boolean;
  onWordCountChange?: (count: number) => void;
  className?: string;
}

export function WritingEditor({
  sceneId,
  initialContent,
  placeholder = "Begin writing...",
  showToolbar = true,
  showWordCount = true,
  onWordCountChange,
  className,
}: WritingEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions(placeholder),
    content: initialContent ? JSON.parse(initialContent) : undefined,
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.storage.characterCount?.words() ?? 0;
      onWordCountChange?.(words);
    },
  });

  const { lastSaved, isSaving } = useAutosave(editor, sceneId);

  // Update content when initialContent changes (e.g., navigating between scenes)
  useEffect(() => {
    if (editor && initialContent) {
      const currentContent = JSON.stringify(editor.getJSON());
      if (currentContent !== initialContent) {
        editor.commands.setContent(JSON.parse(initialContent));
      }
    }
  }, [editor, initialContent]);

  if (!editor) return null;

  return (
    <div className={className}>
      {showToolbar && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {showWordCount && <WordCountBar editor={editor} lastSaved={lastSaved} isSaving={isSaving} />}
    </div>
  );
}

// Simplified editor for practice mode (no auto-save to scene)
export function PracticeEditor({
  placeholder = "Start writing...",
  editable = true,
  onContentChange,
  className,
}: {
  placeholder?: string;
  editable?: boolean;
  onContentChange?: (json: string, html: string, wordCount: number) => void;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions(placeholder),
    editable,
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const html = editor.getHTML();
      const words = editor.storage.characterCount?.words() ?? 0;
      onContentChange?.(json, html, words);
    },
  });

  // Toggle editability when prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className={className}>
      <EditorContent editor={editor} />
      <WordCountBar editor={editor} />
    </div>
  );
}
