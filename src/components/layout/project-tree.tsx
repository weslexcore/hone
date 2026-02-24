'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useChapters, useScenes } from '@/lib/db/hooks';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  BookOpen,
} from 'lucide-react';

function ChapterItem({
  chapter,
  projectId,
}: {
  chapter: { id: string; title: string };
  projectId: string;
}) {
  const pathname = usePathname();
  const scenes = useScenes(chapter.id);
  const [expanded, setExpanded] = useState(
    pathname.includes(chapter.id)
  );

  const isChapterActive = pathname === `/project/${projectId}/${chapter.id}`;

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-text-muted hover:text-text-secondary"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Link
          href={`/project/${projectId}/${chapter.id}`}
          className={cn(
            'flex-1 flex items-center gap-2 rounded-md px-2 py-1 text-sm truncate transition-colors',
            isChapterActive
              ? 'text-accent bg-accent-muted'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          )}
        >
          <BookOpen size={14} className="shrink-0" />
          <span className="truncate">{chapter.title}</span>
        </Link>
      </div>

      {expanded && scenes && scenes.length > 0 && (
        <div className="ml-6 border-l border-border-subtle pl-2 mt-0.5 space-y-0.5">
          {scenes.map((scene) => {
            const isSceneActive = pathname.includes(scene.id);
            return (
              <Link
                key={scene.id}
                href={`/project/${projectId}/${chapter.id}/${scene.id}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-xs truncate transition-colors',
                  isSceneActive
                    ? 'text-accent bg-accent-muted'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
                )}
              >
                <FileText size={12} className="shrink-0" />
                <span className="truncate">{scene.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProjectTree({ projectId }: { projectId: string }) {
  const chapters = useChapters(projectId);

  if (!chapters) return null;

  return (
    <div className="space-y-0.5">
      {chapters.map((chapter) => (
        <ChapterItem key={chapter.id} chapter={chapter} projectId={projectId} />
      ))}
      {chapters.length === 0 && (
        <p className="px-4 py-2 text-xs text-text-muted italic">No chapters yet</p>
      )}
    </div>
  );
}
