import { db } from "./index";
import type { Project, Chapter, Scene } from "@/types/project";
import type { PracticeSession } from "@/types/practice";
import type { SavedSuggestionBatch } from "@/types/ai";
import type { AIProvider } from "@/types/ai";
import type { ThemeId } from "@/lib/storage/theme";
import { getTheme, setTheme } from "@/lib/storage/theme";
import {
  getProviderModel,
  setProviderModel,
  getOllamaUrl,
  setOllamaUrl,
  getOllamaModel,
  setOllamaModel,
} from "@/lib/storage/api-keys";

// --- Export Format ---

export interface HoneExportData {
  format: "hone-export";
  version: 1;
  exportedAt: string;
  data: {
    projects: Project[];
    chapters: Chapter[];
    scenes: Scene[];
    practiceSessions: PracticeSession[];
    suggestionBatches: SavedSuggestionBatch[];
  };
  settings?: {
    theme?: ThemeId;
    aiProvider?: AIProvider;
    modelAnthropic?: string;
    modelOpenai?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };
}

export interface ImportResult {
  projects: number;
  chapters: number;
  scenes: number;
  practiceSessions: number;
  suggestionBatches: number;
}

// --- Date Revival ---

const DATE_FIELDS: Record<string, string[]> = {
  projects: ["createdAt", "updatedAt"],
  chapters: ["createdAt", "updatedAt"],
  scenes: ["createdAt", "updatedAt"],
  practiceSessions: ["createdAt", "completedAt"],
  suggestionBatches: ["createdAt"],
};

function reviveDates<T>(record: T, tableName: string): T {
  const fields = DATE_FIELDS[tableName] || [];
  const result = { ...record } as Record<string, unknown>;
  for (const field of fields) {
    if (typeof result[field] === "string") {
      result[field] = new Date(result[field] as string);
    }
  }
  return result as T;
}

// --- Export ---

export async function exportAllData(includeSettings: boolean): Promise<string> {
  const [projects, chapters, scenes, practiceSessions, suggestionBatches] = await Promise.all([
    db.projects.toArray(),
    db.chapters.toArray(),
    db.scenes.toArray(),
    db.practiceSessions.toArray(),
    db.suggestionBatches.toArray(),
  ]);

  const exportData: HoneExportData = {
    format: "hone-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { projects, chapters, scenes, practiceSessions, suggestionBatches },
  };

  if (includeSettings) {
    exportData.settings = {
      theme: getTheme(),
      modelAnthropic: getProviderModel("anthropic") ?? undefined,
      modelOpenai: getProviderModel("openai") ?? undefined,
      ollamaUrl: getOllamaUrl(),
      ollamaModel: getOllamaModel(),
    };
  }

  return JSON.stringify(exportData, null, 2);
}

export function downloadJsonFile(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Validation ---

export function validateExportData(raw: unknown): {
  valid: boolean;
  error?: string;
  data?: HoneExportData;
} {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Invalid file: not a JSON object" };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.format !== "hone-export") {
    return { valid: false, error: "Invalid file: not a Hone export file" };
  }

  if (typeof obj.version !== "number" || obj.version > 1) {
    return {
      valid: false,
      error: `Unsupported export version: ${obj.version}. Update Hone and try again.`,
    };
  }

  if (!obj.data || typeof obj.data !== "object") {
    return { valid: false, error: "Invalid file: missing data section" };
  }

  const data = obj.data as Record<string, unknown>;
  for (const key of ["projects", "chapters", "scenes", "practiceSessions", "suggestionBatches"]) {
    if (!Array.isArray(data[key])) {
      return { valid: false, error: `Invalid file: data.${key} is not an array` };
    }
  }

  return { valid: true, data: raw as HoneExportData };
}

// --- File Reading ---

export function readFileAsJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// --- Settings ---

function applySettings(settings: NonNullable<HoneExportData["settings"]>): void {
  if (settings.theme) setTheme(settings.theme);
  if (settings.modelAnthropic) setProviderModel("anthropic", settings.modelAnthropic);
  if (settings.modelOpenai) setProviderModel("openai", settings.modelOpenai);
  if (settings.ollamaUrl) setOllamaUrl(settings.ollamaUrl);
  if (settings.ollamaModel) setOllamaModel(settings.ollamaModel);
}

// --- Import: Replace ---

export async function importDataReplace(exportData: HoneExportData): Promise<ImportResult> {
  const { data, settings } = exportData;

  await db.transaction(
    "rw",
    [db.projects, db.chapters, db.scenes, db.practiceSessions, db.suggestionBatches],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.chapters.clear(),
        db.scenes.clear(),
        db.practiceSessions.clear(),
        db.suggestionBatches.clear(),
      ]);

      await db.projects.bulkAdd(data.projects.map((r) => reviveDates(r, "projects")));
      await db.chapters.bulkAdd(data.chapters.map((r) => reviveDates(r, "chapters")));
      await db.scenes.bulkAdd(data.scenes.map((r) => reviveDates(r, "scenes")));
      await db.practiceSessions.bulkAdd(
        data.practiceSessions.map((r) => reviveDates(r, "practiceSessions")),
      );
      await db.suggestionBatches.bulkAdd(
        data.suggestionBatches.map((r) => reviveDates(r, "suggestionBatches")),
      );
    },
  );

  if (settings) applySettings(settings);

  return {
    projects: data.projects.length,
    chapters: data.chapters.length,
    scenes: data.scenes.length,
    practiceSessions: data.practiceSessions.length,
    suggestionBatches: data.suggestionBatches.length,
  };
}

// --- Import: Merge ---

export async function importDataMerge(exportData: HoneExportData): Promise<ImportResult> {
  const { data, settings } = exportData;
  const counts: ImportResult = {
    projects: 0,
    chapters: 0,
    scenes: 0,
    practiceSessions: 0,
    suggestionBatches: 0,
  };

  await db.transaction(
    "rw",
    [db.projects, db.chapters, db.scenes, db.practiceSessions, db.suggestionBatches],
    async () => {
      async function mergeTable<T extends { id: string }>(
        table: import("dexie").Table<T, string>,
        records: T[],
        tableName: string,
      ): Promise<number> {
        const existingIds = new Set(await table.toCollection().primaryKeys());
        const newRecords = records
          .filter((r) => !existingIds.has(r.id))
          .map((r) => reviveDates(r, tableName));
        if (newRecords.length > 0) {
          await table.bulkAdd(newRecords);
        }
        return newRecords.length;
      }

      counts.projects = await mergeTable(db.projects, data.projects, "projects");
      counts.chapters = await mergeTable(db.chapters, data.chapters, "chapters");
      counts.scenes = await mergeTable(db.scenes, data.scenes, "scenes");
      counts.practiceSessions = await mergeTable(
        db.practiceSessions,
        data.practiceSessions,
        "practiceSessions",
      );
      counts.suggestionBatches = await mergeTable(
        db.suggestionBatches,
        data.suggestionBatches,
        "suggestionBatches",
      );
    },
  );

  if (settings) applySettings(settings);

  return counts;
}
