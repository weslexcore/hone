"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/db";
import type { Project, Chapter } from "@/types/project";

export type SearchResultCategory = "project" | "chapter" | "scene" | "practice";

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  /** Text snippet around the match with the query highlighted */
  snippet: string;
  /** Navigation href */
  href: string;
  /** Extra context shown as a breadcrumb trail */
  breadcrumb?: string;
}

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a snippet around the first match, with surrounding context */
function extractSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars * 2);

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

/** Check if any of the given fields match the query */
function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(q));
}

async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const q = query.trim();
  const results: SearchResult[] = [];

  // Fetch all data in parallel
  const [projects, chapters, scenes, sessions] = await Promise.all([
    db.projects.toArray(),
    db.chapters.toArray(),
    db.scenes.toArray(),
    db.practiceSessions.toArray(),
  ]);

  // Index chapters/scenes by parent ID for breadcrumb resolution
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const chapterMap = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));

  // Search projects
  for (const project of projects) {
    if (matchesQuery(q, project.title, project.description, project.notes, ...project.tags)) {
      const matchField = project.title.toLowerCase().includes(q.toLowerCase())
        ? project.title
        : project.description.toLowerCase().includes(q.toLowerCase())
          ? project.description
          : project.notes.toLowerCase().includes(q.toLowerCase())
            ? project.notes
            : project.tags.join(", ");

      results.push({
        id: project.id,
        category: "project",
        title: project.title,
        snippet: extractSnippet(matchField, q),
        href: `/project/${project.id}`,
      });
    }
  }

  // Search chapters
  for (const chapter of chapters) {
    if (matchesQuery(q, chapter.title, chapter.description, chapter.notes, ...chapter.tags)) {
      const matchField = chapter.title.toLowerCase().includes(q.toLowerCase())
        ? chapter.title
        : chapter.description.toLowerCase().includes(q.toLowerCase())
          ? chapter.description
          : chapter.notes.toLowerCase().includes(q.toLowerCase())
            ? chapter.notes
            : chapter.tags.join(", ");

      const project = projectMap.get(chapter.projectId);
      results.push({
        id: chapter.id,
        category: "chapter",
        title: chapter.title,
        snippet: extractSnippet(matchField, q),
        href: `/project/${chapter.projectId}/${chapter.id}`,
        breadcrumb: project?.title,
      });
    }
  }

  // Search scenes (title, content, notes, tags)
  for (const scene of scenes) {
    const plainContent = stripHtml(scene.contentHtml || scene.content);
    if (matchesQuery(q, scene.title, plainContent, scene.notes, ...scene.tags)) {
      const matchField = scene.title.toLowerCase().includes(q.toLowerCase())
        ? scene.title
        : plainContent.toLowerCase().includes(q.toLowerCase())
          ? plainContent
          : scene.notes.toLowerCase().includes(q.toLowerCase())
            ? scene.notes
            : scene.tags.join(", ");

      const chapter = chapterMap.get(scene.chapterId);
      const project = projectMap.get(scene.projectId);
      const breadcrumbParts = [project?.title, chapter?.title].filter(Boolean);

      results.push({
        id: scene.id,
        category: "scene",
        title: scene.title,
        snippet: extractSnippet(matchField, q),
        href: `/project/${scene.projectId}/${scene.chapterId}/${scene.id}`,
        breadcrumb: breadcrumbParts.join(" / "),
      });
    }
  }

  // Search practice sessions (prompt, feedback)
  for (const session of sessions) {
    const feedbackText = session.feedback
      ? [
          session.feedback.detailedNotes,
          ...session.feedback.strengths,
          ...session.feedback.improvements,
          ...session.feedback.tips,
        ].join(" ")
      : "";
    const responseText = stripHtml(session.responseHtml || session.response);

    if (matchesQuery(q, session.prompt, responseText, feedbackText, ...session.genres)) {
      const matchField = session.prompt.toLowerCase().includes(q.toLowerCase())
        ? session.prompt
        : responseText.toLowerCase().includes(q.toLowerCase())
          ? responseText
          : feedbackText.toLowerCase().includes(q.toLowerCase())
            ? feedbackText
            : session.genres.join(", ");

      const promptPreview =
        session.prompt.length > 50 ? session.prompt.slice(0, 47) + "..." : session.prompt;

      results.push({
        id: session.id,
        category: "practice",
        title: promptPreview || "Practice Session",
        snippet: extractSnippet(matchField, q),
        href: `/practice/${session.id}`,
        breadcrumb: session.score != null ? `Score: ${session.score}` : undefined,
      });
    }
  }

  return results;
}

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((q: string) => {
    setQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchAll(q);
      setResults(res);
      setIsSearching(false);
    }, 150);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { query, results, isSearching, search, clear };
}
