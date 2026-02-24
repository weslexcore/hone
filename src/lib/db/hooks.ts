import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './index';
import type { Project, Chapter, Scene } from '@/types/project';
import type { PracticeSession } from '@/types/practice';
import { nanoid } from 'nanoid';

// --- Projects ---

export function useProjects() {
  return useLiveQuery(() => db.projects.orderBy('sortOrder').toArray());
}

export function useProject(id: string | undefined) {
  return useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id]);
}

export async function createProject(data: Partial<Project> = {}): Promise<string> {
  const id = nanoid();
  const count = await db.projects.count();
  const now = new Date();
  await db.projects.add({
    id,
    title: data.title || 'Untitled Project',
    description: data.description || '',
    tags: data.tags || [],
    notes: data.notes || '',
    aiEnabled: data.aiEnabled ?? true,
    sortOrder: count,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateProject(id: string, data: Partial<Project>) {
  await db.projects.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteProject(id: string) {
  await db.transaction('rw', [db.projects, db.chapters, db.scenes], async () => {
    const chapters = await db.chapters.where('projectId').equals(id).toArray();
    for (const ch of chapters) {
      await db.scenes.where('chapterId').equals(ch.id).delete();
    }
    await db.chapters.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

// --- Chapters ---

export function useChapters(projectId: string | undefined) {
  return useLiveQuery(
    () =>
      projectId
        ? db.chapters.where('projectId').equals(projectId).sortBy('sortOrder')
        : [],
    [projectId]
  );
}

export function useChapter(id: string | undefined) {
  return useLiveQuery(() => (id ? db.chapters.get(id) : undefined), [id]);
}

export async function createChapter(projectId: string, data: Partial<Chapter> = {}): Promise<string> {
  const id = nanoid();
  const count = await db.chapters.where('projectId').equals(projectId).count();
  const now = new Date();
  await db.chapters.add({
    id,
    projectId,
    title: data.title || 'Untitled Chapter',
    description: data.description || '',
    notes: data.notes || '',
    tags: data.tags || [],
    sortOrder: count,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateChapter(id: string, data: Partial<Chapter>) {
  await db.chapters.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteChapter(id: string) {
  const chapter = await db.chapters.get(id);
  await db.transaction('rw', [db.chapters, db.scenes], async () => {
    await db.scenes.where('chapterId').equals(id).delete();
    await db.chapters.delete(id);
  });

  // Recalculate project word count
  if (chapter) {
    const remainingChapters = await db.chapters.where('projectId').equals(chapter.projectId).toArray();
    const projectWordCount = remainingChapters.reduce((sum, c) => sum + c.wordCount, 0);
    await db.projects.update(chapter.projectId, { wordCount: projectWordCount, updatedAt: new Date() });
  }
}

// --- Scenes ---

export function useScenes(chapterId: string | undefined) {
  return useLiveQuery(
    () =>
      chapterId
        ? db.scenes.where('chapterId').equals(chapterId).sortBy('sortOrder')
        : [],
    [chapterId]
  );
}

export function useScene(id: string | undefined) {
  return useLiveQuery(() => (id ? db.scenes.get(id) : undefined), [id]);
}

export async function createScene(
  chapterId: string,
  projectId: string,
  data: Partial<Scene> = {}
): Promise<string> {
  const id = nanoid();
  const count = await db.scenes.where('chapterId').equals(chapterId).count();
  const now = new Date();
  await db.scenes.add({
    id,
    chapterId,
    projectId,
    title: data.title || 'Untitled Scene',
    content: data.content || '',
    contentHtml: data.contentHtml || '',
    notes: data.notes || '',
    tags: data.tags || [],
    sortOrder: count,
    wordCount: data.wordCount ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateScene(id: string, data: Partial<Scene>) {
  await db.scenes.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteScene(id: string) {
  const scene = await db.scenes.get(id);
  await db.scenes.delete(id);

  // Recalculate parent word counts
  if (scene) {
    const chapterScenes = await db.scenes.where('chapterId').equals(scene.chapterId).toArray();
    const chapterWordCount = chapterScenes.reduce((sum, s) => sum + s.wordCount, 0);
    await db.chapters.update(scene.chapterId, { wordCount: chapterWordCount, updatedAt: new Date() });

    const projectChapters = await db.chapters.where('projectId').equals(scene.projectId).toArray();
    const projectWordCount = projectChapters.reduce((sum, c) => sum + c.wordCount, 0);
    await db.projects.update(scene.projectId, { wordCount: projectWordCount, updatedAt: new Date() });
  }
}

// --- Word Count Propagation ---

export async function propagateWordCount(sceneId: string) {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return;

  const chapterScenes = await db.scenes.where('chapterId').equals(scene.chapterId).toArray();
  const chapterWordCount = chapterScenes.reduce((sum, s) => sum + s.wordCount, 0);
  await db.chapters.update(scene.chapterId, { wordCount: chapterWordCount, updatedAt: new Date() });

  const projectChapters = await db.chapters.where('projectId').equals(scene.projectId).toArray();
  const projectWordCount = projectChapters.reduce((sum, c) => sum + c.wordCount, 0);
  await db.projects.update(scene.projectId, { wordCount: projectWordCount, updatedAt: new Date() });
}

// --- Practice Sessions ---

export function usePracticeSessions() {
  return useLiveQuery(() => db.practiceSessions.orderBy('createdAt').reverse().toArray());
}

export function usePracticeSession(id: string | undefined) {
  return useLiveQuery(() => (id ? db.practiceSessions.get(id) : undefined), [id]);
}

export async function createPracticeSession(data: Partial<PracticeSession>): Promise<string> {
  const id = nanoid();
  const now = new Date();
  await db.practiceSessions.add({
    id,
    genres: data.genres || [],
    prompt: data.prompt || '',
    response: data.response || '',
    responseHtml: data.responseHtml || '',
    wordCount: 0,
    durationSeconds: data.durationSeconds || 600,
    actualSeconds: 0,
    score: null,
    feedback: null,
    status: 'in_progress',
    createdAt: now,
    completedAt: null,
  });
  return id;
}

export async function updatePracticeSession(id: string, data: Partial<PracticeSession>) {
  await db.practiceSessions.update(id, data);
}

export async function deletePracticeSession(id: string) {
  await db.practiceSessions.delete(id);
}
