"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { Search, BookOpen, FileText, PenLine, Timer, CornerDownLeft } from "lucide-react";
import {
  useGlobalSearch,
  type SearchResult,
  type SearchResultCategory,
} from "@/hooks/use-global-search";

// --- Highlight matched text ---

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-accent/25 text-text-primary rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// --- Category config ---

const CATEGORY_META: Record<SearchResultCategory, { label: string; icon: ReactNode }> = {
  project: { label: "Projects", icon: <BookOpen size={14} /> },
  chapter: { label: "Chapters", icon: <FileText size={14} /> },
  scene: { label: "Scenes", icon: <PenLine size={14} /> },
  practice: { label: "Practice", icon: <Timer size={14} /> },
};

const CATEGORY_ORDER: SearchResultCategory[] = ["project", "chapter", "scene", "practice"];

function groupByCategory(results: SearchResult[]) {
  const groups = new Map<SearchResultCategory, SearchResult[]>();
  for (const r of results) {
    const existing = groups.get(r.category);
    if (existing) {
      existing.push(r);
    } else {
      groups.set(r.category, [r]);
    }
  }
  return groups;
}

// --- Main component ---

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { query, results, isSearching, search, clear } = useGlobalSearch();
  const [activeIndex, setActiveIndex] = useState(-1);

  // Build flat list of results ordered by category for keyboard navigation
  const flatResults = CATEGORY_ORDER.flatMap((cat) => results.filter((r) => r.category === cat));

  const navigateTo = useCallback(
    (result: SearchResult) => {
      router.push(result.href);
      clear();
      onClose();
    },
    [router, clear, onClose],
  );

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setActiveIndex(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      clear();
    }
  }, [open, clear]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const active = container.querySelector("[data-active='true']");
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        return;
      }

      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const result = flatResults[activeIndex];
        if (result) navigateTo(result);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, flatResults, activeIndex, navigateTo, onClose]);

  const grouped = groupByCategory(results);
  const hasResults = results.length > 0;
  const showEmpty = query.trim().length > 0 && !isSearching && !hasResults;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="fixed inset-0 bg-black/60" onClick={onClose} />

          <motion.div
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface-raised shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.12 }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} className="text-text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search projects, chapters, scenes, practice..."
                value={query}
                onChange={(e) => search(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              />
              <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-surface-overlay px-1.5 text-[10px] font-medium text-text-muted">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className={cn(
                "overflow-y-auto",
                hasResults || showEmpty || isSearching ? "max-h-[50vh] py-2" : "max-h-0",
              )}
            >
              {isSearching && !hasResults && (
                <div className="px-4 py-8 text-center text-sm text-text-muted">Searching...</div>
              )}

              {showEmpty && (
                <div className="px-4 py-8 text-center text-sm text-text-muted">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              )}

              {CATEGORY_ORDER.map((category) => {
                const items = grouped.get(category);
                if (!items?.length) return null;
                const meta = CATEGORY_META[category];

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                      {meta.icon}
                      {meta.label}
                    </div>
                    {items.map((result) => {
                      const flatIdx = flatResults.indexOf(result);
                      const isActive = flatIdx === activeIndex;
                      return (
                        <button
                          key={result.id}
                          data-active={isActive}
                          onClick={() => navigateTo(result)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          className={cn(
                            "w-full text-left px-4 py-2 flex flex-col gap-0.5 transition-colors cursor-pointer",
                            isActive ? "bg-surface-hover" : "hover:bg-surface-hover",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-text-primary truncate">
                              <HighlightedText text={result.title} query={query} />
                            </span>
                            {result.breadcrumb && (
                              <span className="text-xs text-text-muted truncate shrink-0">
                                {result.breadcrumb}
                              </span>
                            )}
                            {isActive && (
                              <CornerDownLeft
                                size={12}
                                className="text-text-muted ml-auto shrink-0"
                              />
                            )}
                          </div>
                          <span className="text-xs text-text-secondary line-clamp-1">
                            <HighlightedText text={result.snippet} query={query} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            {hasResults && (
              <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface-overlay px-1 font-medium">
                    &uarr;&darr;
                  </kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface-overlay px-1 font-medium">
                    &crarr;
                  </kbd>
                  open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center rounded border border-border bg-surface-overlay px-1 font-medium">
                    esc
                  </kbd>
                  close
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
