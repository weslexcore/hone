'use client';

import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';

export function createEditorExtensions(placeholder = 'Begin writing...') {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    CharacterCount,
    Placeholder.configure({
      placeholder,
    }),
    Typography,
  ];
}
