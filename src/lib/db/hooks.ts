import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./index";
import type { Project, Chapter, Scene } from "@/types/project";
import type { PracticeSession, PracticeRound, PracticeFeedback } from "@/types/practice";
import type { AISuggestion, SavedSuggestionBatch } from "@/types/ai";
import { GENRES } from "@/lib/constants/genres";
import { nanoid } from "nanoid";

// --- Projects ---

export function useProjects() {
  return useLiveQuery(() => db.projects.orderBy("sortOrder").toArray());
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
    title: data.title || "Untitled Project",
    description: data.description || "",
    tags: data.tags || [],
    notes: data.notes || "",
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
  await db.transaction("rw", [db.projects, db.chapters, db.scenes], async () => {
    const chapters = await db.chapters.where("projectId").equals(id).toArray();
    for (const ch of chapters) {
      await db.scenes.where("chapterId").equals(ch.id).delete();
    }
    await db.chapters.where("projectId").equals(id).delete();
    await db.projects.delete(id);
  });
}

// --- Chapters ---

export function useChapters(projectId: string | undefined) {
  return useLiveQuery(
    () => (projectId ? db.chapters.where("projectId").equals(projectId).sortBy("sortOrder") : []),
    [projectId],
  );
}

export function useChapter(id: string | undefined) {
  return useLiveQuery(() => (id ? db.chapters.get(id) : undefined), [id]);
}

export async function createChapter(
  projectId: string,
  data: Partial<Chapter> = {},
): Promise<string> {
  const id = nanoid();
  const count = await db.chapters.where("projectId").equals(projectId).count();
  const now = new Date();
  await db.chapters.add({
    id,
    projectId,
    title: data.title || "Untitled Chapter",
    description: data.description || "",
    notes: data.notes || "",
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
  await db.transaction("rw", [db.chapters, db.scenes], async () => {
    await db.scenes.where("chapterId").equals(id).delete();
    await db.chapters.delete(id);
  });

  // Recalculate project word count
  if (chapter) {
    const remainingChapters = await db.chapters
      .where("projectId")
      .equals(chapter.projectId)
      .toArray();
    const projectWordCount = remainingChapters.reduce((sum, c) => sum + c.wordCount, 0);
    await db.projects.update(chapter.projectId, {
      wordCount: projectWordCount,
      updatedAt: new Date(),
    });
  }
}

// --- Scenes ---

export function useScenes(chapterId: string | undefined) {
  return useLiveQuery(
    () => (chapterId ? db.scenes.where("chapterId").equals(chapterId).sortBy("sortOrder") : []),
    [chapterId],
  );
}

export function useScene(id: string | undefined) {
  return useLiveQuery(() => (id ? db.scenes.get(id) : undefined), [id]);
}

export async function createScene(
  chapterId: string,
  projectId: string,
  data: Partial<Scene> = {},
): Promise<string> {
  const id = nanoid();
  const count = await db.scenes.where("chapterId").equals(chapterId).count();
  const now = new Date();
  await db.scenes.add({
    id,
    chapterId,
    projectId,
    title: data.title || "Untitled Scene",
    content: data.content || "",
    contentHtml: data.contentHtml || "",
    notes: data.notes || "",
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
    const chapterScenes = await db.scenes.where("chapterId").equals(scene.chapterId).toArray();
    const chapterWordCount = chapterScenes.reduce((sum, s) => sum + s.wordCount, 0);
    await db.chapters.update(scene.chapterId, {
      wordCount: chapterWordCount,
      updatedAt: new Date(),
    });

    const projectChapters = await db.chapters.where("projectId").equals(scene.projectId).toArray();
    const projectWordCount = projectChapters.reduce((sum, c) => sum + c.wordCount, 0);
    await db.projects.update(scene.projectId, {
      wordCount: projectWordCount,
      updatedAt: new Date(),
    });
  }
}

// --- Word Count Propagation ---

export async function propagateWordCount(sceneId: string) {
  const scene = await db.scenes.get(sceneId);
  if (!scene) return;

  const chapterScenes = await db.scenes.where("chapterId").equals(scene.chapterId).toArray();
  const chapterWordCount = chapterScenes.reduce((sum, s) => sum + s.wordCount, 0);
  await db.chapters.update(scene.chapterId, { wordCount: chapterWordCount, updatedAt: new Date() });

  const projectChapters = await db.chapters.where("projectId").equals(scene.projectId).toArray();
  const projectWordCount = projectChapters.reduce((sum, c) => sum + c.wordCount, 0);
  await db.projects.update(scene.projectId, { wordCount: projectWordCount, updatedAt: new Date() });
}

// --- Practice Sessions ---

export function usePracticeSessions() {
  return useLiveQuery(() => db.practiceSessions.orderBy("createdAt").reverse().toArray());
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
    prompt: data.prompt || "",
    response: data.response || "",
    responseHtml: data.responseHtml || "",
    wordCount: 0,
    durationSeconds: data.durationSeconds ?? 600,
    actualSeconds: 0,
    score: null,
    feedback: null,
    status: "in_progress",
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

// --- Practice Round Management ---

export async function startNewRound(sessionId: string, durationSeconds: number): Promise<void> {
  const session = await db.practiceSessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const rounds: PracticeRound[] = session.rounds ? [...session.rounds] : [];

  // Migrate existing data into round 1 if this is the first time adding rounds
  if (rounds.length === 0 && (session.status === "graded" || session.status === "submitted")) {
    rounds.push({
      roundNumber: 1,
      response: session.response,
      responseHtml: session.responseHtml,
      wordCount: session.wordCount,
      durationSeconds: session.durationSeconds,
      actualSeconds: session.actualSeconds,
      score: session.score,
      feedback: session.feedback,
      status: session.status,
      startedAt: session.createdAt,
      completedAt: session.completedAt,
    });
  }

  const latestRound = rounds[rounds.length - 1];

  const newRound: PracticeRound = {
    roundNumber: rounds.length + 1,
    response: latestRound?.response ?? session.response,
    responseHtml: latestRound?.responseHtml ?? session.responseHtml,
    wordCount: latestRound?.wordCount ?? session.wordCount,
    durationSeconds,
    actualSeconds: 0,
    score: null,
    feedback: null,
    status: "in_progress",
    startedAt: new Date(),
    completedAt: null,
  };

  rounds.push(newRound);

  await db.practiceSessions.update(sessionId, {
    rounds,
    currentRound: rounds.length - 1,
    status: "in_progress",
    durationSeconds,
  });
}

export async function submitCurrentRound(
  sessionId: string,
  data: { response: string; responseHtml: string; wordCount: number; actualSeconds: number },
): Promise<void> {
  const session = await db.practiceSessions.get(sessionId);
  if (!session?.rounds) {
    // Legacy: no rounds, fall back to direct update
    await db.practiceSessions.update(sessionId, {
      ...data,
      status: "submitted",
      completedAt: new Date(),
    });
    return;
  }

  const idx = session.currentRound ?? session.rounds.length - 1;
  const rounds = [...session.rounds];
  rounds[idx] = {
    ...rounds[idx],
    ...data,
    status: "submitted",
    completedAt: new Date(),
  };

  await db.practiceSessions.update(sessionId, {
    rounds,
    status: "submitted",
    response: data.response,
    responseHtml: data.responseHtml,
    wordCount: data.wordCount,
    actualSeconds: data.actualSeconds,
    completedAt: new Date(),
  });
}

export async function gradeCurrentRound(
  sessionId: string,
  feedback: PracticeFeedback,
): Promise<void> {
  const session = await db.practiceSessions.get(sessionId);
  if (!session?.rounds) {
    // Legacy: no rounds
    await db.practiceSessions.update(sessionId, {
      status: "graded",
      score: feedback.overallScore,
      feedback,
    });
    return;
  }

  const idx = session.currentRound ?? session.rounds.length - 1;
  const rounds = [...session.rounds];
  rounds[idx] = {
    ...rounds[idx],
    score: feedback.overallScore,
    feedback,
    status: "graded",
  };

  await db.practiceSessions.update(sessionId, {
    rounds,
    status: "graded",
    score: feedback.overallScore,
    feedback,
  });
}

// --- Convert Practice Session to Project ---

export async function convertSessionToProject(sessionId: string): Promise<string> {
  const session = await db.practiceSessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  // Use latest round content, or session's own content for legacy
  const latestRound = session.rounds?.[session.rounds.length - 1];
  const content = latestRound?.response ?? session.response;
  const contentHtml = latestRound?.responseHtml ?? session.responseHtml;
  const wordCount = latestRound?.wordCount ?? session.wordCount;

  const genreLabels = session.genres.map((id) => GENRES.find((g) => g.id === id)?.label || id);

  const promptExcerpt =
    session.prompt.length > 60 ? session.prompt.substring(0, 57) + "..." : session.prompt;

  const projectId = await createProject({
    title: promptExcerpt,
    description: session.prompt,
    tags: genreLabels,
  });

  const chapterId = await createChapter(projectId, {
    title: "Practice Writing",
  });

  const sceneId = await createScene(chapterId, projectId, {
    title: "Draft",
    content,
    contentHtml,
    wordCount,
  });

  await propagateWordCount(sceneId);

  // Convert feedback into suggestion batch
  const feedback = latestRound?.feedback ?? session.feedback;
  if (feedback) {
    const suggestions: AISuggestion[] = [
      ...feedback.improvements.map((imp, i) => ({
        id: `imp-${nanoid(6)}-${i}`,
        type: "general" as const,
        title: imp.length > 50 ? imp.substring(0, 47) + "..." : imp,
        description: imp,
        confidence: 0.8,
      })),
      ...feedback.tips.map((tip, i) => ({
        id: `tip-${nanoid(6)}-${i}`,
        type: "general" as const,
        title: tip.length > 50 ? tip.substring(0, 47) + "..." : tip,
        description: tip,
        confidence: 0.7,
      })),
    ];

    if (suggestions.length > 0) {
      const batch: SavedSuggestionBatch = {
        id: nanoid(),
        targetId: sceneId,
        targetType: "scene",
        projectId,
        analysisType: "suggestions",
        suggestions,
        dismissedIds: [],
        createdAt: new Date(),
      };
      await db.suggestionBatches.add(batch);
    }
  }

  return projectId;
}
