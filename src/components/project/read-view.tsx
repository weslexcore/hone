'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useScenes, useChapters } from '@/lib/db/hooks';
import { db } from '@/lib/db/index';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils/cn';

// --- Read Chapter: all scenes in a chapter combined ---

export function ReadChapterView({ chapterId, chapterTitle }: { chapterId: string; chapterTitle: string }) {
  const scenes = useScenes(chapterId);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted italic">No scenes in this chapter yet.</p>
      </div>
    );
  }

  const totalWords = scenes.reduce((sum, s) => sum + s.wordCount, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-text-primary font-serif">{chapterTitle}</h2>
        <p className="text-xs text-text-muted mt-2">
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''} &middot; {totalWords.toLocaleString()} words
        </p>
      </div>

      <div className="max-w-[65ch] mx-auto">
        {scenes.map((scene, i) => (
          <div key={scene.id}>
            {/* Scene divider (not before the first scene) */}
            {i > 0 && (
              <div className="flex items-center justify-center gap-3 my-10">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-text-muted uppercase tracking-widest shrink-0">
                  {scene.title}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            {i === 0 && scenes.length > 1 && (
              <p className="text-[10px] text-text-muted uppercase tracking-widest text-center mb-6">
                {scene.title}
              </p>
            )}

            {/* Scene content */}
            {scene.contentHtml ? (
              <div
                className="font-serif text-lg leading-[1.8] text-text-primary [&>p]:mb-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:font-sans [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-4 [&>h2]:mt-6 [&>h2]:font-sans [&>blockquote]:border-l-2 [&>blockquote]:border-accent [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-text-secondary"
                dangerouslySetInnerHTML={{ __html: scene.contentHtml }}
              />
            ) : (
              <p className="text-sm text-text-muted italic">Empty scene</p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Read Project: all chapters and scenes combined ---

export function ReadProjectView({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const chapters = useChapters(projectId);

  // Fetch all scenes for this project, grouped by chapter
  const allScenes = useLiveQuery(
    () => db.scenes.where('projectId').equals(projectId).sortBy('sortOrder'),
    [projectId]
  );

  const scenesByChapter = useMemo(() => {
    if (!allScenes) return {};
    const map: Record<string, typeof allScenes> = {};
    for (const scene of allScenes) {
      if (!map[scene.chapterId]) map[scene.chapterId] = [];
      map[scene.chapterId].push(scene);
    }
    return map;
  }, [allScenes]);

  if (!chapters || chapters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-muted italic">No chapters in this project yet.</p>
      </div>
    );
  }

  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const totalScenes = allScenes?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Project title page */}
      <div className="mb-16 text-center py-12">
        <h1 className="text-4xl font-bold text-text-primary font-serif mb-3">{projectTitle}</h1>
        <p className="text-xs text-text-muted">
          {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} &middot;{' '}
          {totalScenes} scene{totalScenes !== 1 ? 's' : ''} &middot;{' '}
          {totalWords.toLocaleString()} words
        </p>
      </div>

      <div className="max-w-[65ch] mx-auto">
        {chapters.map((chapter, chapterIndex) => {
          const scenes = scenesByChapter[chapter.id] || [];

          return (
            <div key={chapter.id}>
              {/* Chapter break */}
              {chapterIndex > 0 && (
                <div className="my-16 flex items-center justify-center">
                  <div className="flex gap-1.5">
                    <span className="block w-1.5 h-1.5 rounded-full bg-accent/40" />
                    <span className="block w-1.5 h-1.5 rounded-full bg-accent/60" />
                    <span className="block w-1.5 h-1.5 rounded-full bg-accent/40" />
                  </div>
                </div>
              )}

              {/* Chapter heading */}
              <div className="text-center mb-10">
                <p className="text-[10px] text-text-muted uppercase tracking-[0.3em] mb-2">
                  Chapter {chapterIndex + 1}
                </p>
                <h2 className="text-2xl font-semibold text-text-primary font-serif">
                  {chapter.title}
                </h2>
              </div>

              {/* Scenes in this chapter */}
              {scenes.length > 0 ? (
                scenes.map((scene, sceneIndex) => (
                  <div key={scene.id}>
                    {sceneIndex > 0 && (
                      <div className="flex items-center justify-center my-8">
                        <div className="h-px w-16 bg-border" />
                      </div>
                    )}

                    {scene.contentHtml ? (
                      <div
                        className="font-serif text-lg leading-[1.8] text-text-primary [&>p]:mb-4 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:font-sans [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-4 [&>h2]:mt-6 [&>h2]:font-sans [&>blockquote]:border-l-2 [&>blockquote]:border-accent [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-text-secondary"
                        dangerouslySetInnerHTML={{ __html: scene.contentHtml }}
                      />
                    ) : (
                      <p className="text-sm text-text-muted italic text-center">Empty scene</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted italic text-center">No scenes</p>
              )}
            </div>
          );
        })}
      </div>

      {/* End mark */}
      <div className="text-center my-16">
        <span className="text-xs text-text-muted tracking-widest uppercase">End</span>
      </div>
    </motion.div>
  );
}
