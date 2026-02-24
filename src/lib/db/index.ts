import Dexie, { type Table } from "dexie";
import type { Project, Chapter, Scene } from "@/types/project";
import type { PracticeSession } from "@/types/practice";
import type { SavedSuggestionBatch } from "@/types/ai";

export class HoneDB extends Dexie {
  projects!: Table<Project, string>;
  chapters!: Table<Chapter, string>;
  scenes!: Table<Scene, string>;
  practiceSessions!: Table<PracticeSession, string>;
  suggestionBatches!: Table<SavedSuggestionBatch, string>;

  constructor() {
    super("hone");

    this.version(1).stores({
      projects: "id, sortOrder, createdAt, updatedAt, *tags",
      chapters: "id, projectId, sortOrder, createdAt, *tags",
      scenes: "id, chapterId, projectId, sortOrder, createdAt, *tags",
      practiceSessions: "id, status, score, createdAt, *genres",
    });

    this.version(2).stores({
      projects: "id, sortOrder, createdAt, updatedAt, *tags",
      chapters: "id, projectId, sortOrder, createdAt, *tags",
      scenes: "id, chapterId, projectId, sortOrder, createdAt, *tags",
      practiceSessions: "id, status, score, createdAt, *genres",
      suggestionBatches: "id, targetId, targetType, projectId, analysisType, createdAt",
    });
  }
}

export const db = new HoneDB();
