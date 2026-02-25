import { db } from "@/lib/db/index";
import { exportAllData, validateExportData, type HoneExportData } from "@/lib/db/export-import";
import { setTheme } from "@/lib/storage/theme";
import {
  setProviderModel,
  setOllamaUrl,
  setOllamaModel,
  setActiveProvider,
} from "@/lib/storage/api-keys";
import type { ThemeId } from "@/lib/storage/theme";
import type { AIProvider } from "@/types/ai";

export interface SyncResult {
  projects: { added: number; updated: number };
  chapters: { added: number; updated: number };
  scenes: { added: number; updated: number };
  practiceSessions: { added: number; updated: number };
  suggestionBatches: { added: number; updated: number };
  settingsApplied: boolean;
}

function reviveDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "string") return new Date(val);
  return null;
}

export async function getExportPayload(): Promise<string> {
  return exportAllData(true);
}

export async function applySyncData(jsonString: string): Promise<SyncResult> {
  const raw = JSON.parse(jsonString);
  const validation = validateExportData(raw);

  if (!validation.valid || !validation.data) {
    throw new Error(validation.error || "Invalid sync data");
  }

  const incoming = validation.data;
  const result: SyncResult = {
    projects: { added: 0, updated: 0 },
    chapters: { added: 0, updated: 0 },
    scenes: { added: 0, updated: 0 },
    practiceSessions: { added: 0, updated: 0 },
    suggestionBatches: { added: 0, updated: 0 },
    settingsApplied: false,
  };

  await db.transaction(
    "rw",
    [db.projects, db.chapters, db.scenes, db.practiceSessions, db.suggestionBatches],
    async () => {
      // Last-write-wins merge for each table
      result.projects = await mergeTable(db.projects, incoming.data.projects, "updatedAt");
      result.chapters = await mergeTable(db.chapters, incoming.data.chapters, "updatedAt");
      result.scenes = await mergeTable(db.scenes, incoming.data.scenes, "updatedAt");
      result.practiceSessions = await mergeTable(
        db.practiceSessions,
        incoming.data.practiceSessions,
        "createdAt",
      );
      result.suggestionBatches = await mergeTable(
        db.suggestionBatches,
        incoming.data.suggestionBatches,
        "createdAt",
      );
    },
  );

  // Apply settings if present (sync everything mode)
  if (incoming.settings) {
    applySettingsIfNewer(incoming.settings);
    result.settingsApplied = true;
  }

  return result;
}

async function mergeTable<T extends { id: string }>(
  table: import("dexie").Table<T, string>,
  incomingRecords: T[],
  timestampField: string,
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  for (const incoming of incomingRecords) {
    const existing = await table.get(incoming.id);

    if (!existing) {
      // New record — add it
      await table.add(reviveDatesInRecord(incoming));
      added++;
    } else {
      // Existing record — last-write-wins
      const existingTs = reviveDate((existing as Record<string, unknown>)[timestampField]);
      const incomingTs = reviveDate((incoming as Record<string, unknown>)[timestampField]);

      if (existingTs && incomingTs && incomingTs > existingTs) {
        await table.put(reviveDatesInRecord(incoming));
        updated++;
      }
    }
  }

  return { added, updated };
}

function reviveDatesInRecord<T>(record: T): T {
  const result = { ...record } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
      result[key] = new Date(val);
    }
    // Handle nested arrays (like practice rounds)
    if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        typeof item === "object" && item !== null ? reviveDatesInRecord(item) : item,
      );
    }
  }
  return result as T;
}

function applySettingsIfNewer(settings: NonNullable<HoneExportData["settings"]>): void {
  if (settings.theme) setTheme(settings.theme as ThemeId);
  if (settings.aiProvider) setActiveProvider(settings.aiProvider as AIProvider);
  if (settings.modelAnthropic) setProviderModel("anthropic", settings.modelAnthropic);
  if (settings.modelOpenai) setProviderModel("openai", settings.modelOpenai);
  if (settings.ollamaUrl) setOllamaUrl(settings.ollamaUrl);
  if (settings.ollamaModel) setOllamaModel(settings.ollamaModel);
}

export function formatSyncResult(result: SyncResult): string {
  const parts: string[] = [];
  const { projects, chapters, scenes, practiceSessions, suggestionBatches } = result;

  const total =
    projects.added +
    projects.updated +
    chapters.added +
    chapters.updated +
    scenes.added +
    scenes.updated +
    practiceSessions.added +
    practiceSessions.updated +
    suggestionBatches.added +
    suggestionBatches.updated;

  if (total === 0) {
    return "Everything is already in sync!";
  }

  if (projects.added > 0)
    parts.push(`${projects.added} new project${projects.added > 1 ? "s" : ""}`);
  if (projects.updated > 0)
    parts.push(`${projects.updated} project${projects.updated > 1 ? "s" : ""} updated`);
  if (scenes.added > 0) parts.push(`${scenes.added} new scene${scenes.added > 1 ? "s" : ""}`);
  if (scenes.updated > 0)
    parts.push(`${scenes.updated} scene${scenes.updated > 1 ? "s" : ""} updated`);
  if (practiceSessions.added > 0)
    parts.push(
      `${practiceSessions.added} new practice session${practiceSessions.added > 1 ? "s" : ""}`,
    );

  if (parts.length === 0) {
    // Only chapters/suggestions changed
    return `Synced ${total} record${total > 1 ? "s" : ""}`;
  }

  return parts.join(", ");
}
