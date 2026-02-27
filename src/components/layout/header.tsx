"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Menu, Search, LogIn, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProject, useChapter, useScene } from "@/lib/db/hooks";
import { useSidebar } from "@/providers/sidebar-provider";
import { GlobalSearch } from "@/components/search/global-search";
import { useAuth } from "@/providers/auth-provider";

/**
 * Build breadcrumbs from the URL. For project routes we resolve actual
 * entity names from IndexedDB so the user sees "My Novel › Chapter 1"
 * instead of nanoid strings.
 */
function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Detect project-route IDs by position:
  //   /project/[projectId]
  //   /project/[projectId]/[chapterId]
  //   /project/[projectId]/[chapterId]/[sceneId]
  const isProjectRoute = segments[0] === "project";
  const projectId = isProjectRoute ? segments[1] : undefined;
  const chapterId = isProjectRoute ? segments[2] : undefined;
  const sceneId = isProjectRoute ? segments[3] : undefined;

  const project = useProject(projectId);
  const chapter = useChapter(chapterId);
  const scene = useScene(sceneId);

  const crumbs: { label: string; href: string }[] = [];

  if (isProjectRoute) {
    crumbs.push({ label: "Projects", href: "/dashboard" });

    if (projectId) {
      crumbs.push({
        label: project?.title || "Project",
        href: `/project/${projectId}`,
      });
    }
    if (chapterId) {
      crumbs.push({
        label: chapter?.title || "Chapter",
        href: `/project/${projectId}/${chapterId}`,
      });
    }
    if (sceneId) {
      crumbs.push({
        label: scene?.title || "Scene",
        href: `/project/${projectId}/${chapterId}/${sceneId}`,
      });
    }
  } else {
    // Non-project routes — derive label from the URL segment
    let path = "";
    for (const segment of segments) {
      path += `/${segment}`;
      const label = segment
        .replace(/\[.*?\]/g, "")
        .replace(/-/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
      if (label) {
        crumbs.push({ label, href: path });
      }
    }
  }

  return crumbs;
}

export function Header() {
  const crumbs = useBreadcrumbs();
  const { setMobileOpen } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isSupabaseConfigured } = useAuth();

  // Global keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="flex h-14 items-center border-b border-border px-4 md:px-6">
        <button
          onClick={() => setMobileOpen(true)}
          className="mr-3 p-1 text-text-muted hover:text-text-primary transition-colors md:hidden"
        >
          <Menu size={20} />
        </button>
        <nav className="flex items-center gap-1 text-sm min-w-0">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={14} className="text-text-muted shrink-0" />}
              {i === crumbs.length - 1 ? (
                <span className="text-text-primary font-medium truncate max-w-[120px] md:max-w-[200px]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    "text-text-muted hover:text-text-secondary transition-colors truncate max-w-[120px] md:max-w-[200px]",
                  )}
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary hover:border-border-subtle transition-colors"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-surface-overlay px-1.5 text-[10px] font-medium">
              &#8984;K
            </kbd>
          </button>

          {isSupabaseConfigured && (
            user ? (
              <Link
                href="/settings"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-muted text-accent hover:bg-accent/20 transition-colors"
                title={user.email || "Account"}
              >
                <User size={14} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary hover:border-border-subtle transition-colors"
              >
                <LogIn size={14} />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            )
          )}
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
