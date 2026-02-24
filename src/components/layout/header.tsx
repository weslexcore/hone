"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProject, useChapter, useScene } from "@/lib/db/hooks";

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

  return (
    <header className="flex h-14 items-center border-b border-border px-6">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-text-muted" />}
            {i === crumbs.length - 1 ? (
              <span className="text-text-primary font-medium truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className={cn(
                  "text-text-muted hover:text-text-secondary transition-colors truncate max-w-[200px]",
                )}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
}
