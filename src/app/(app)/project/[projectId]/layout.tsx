"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useProject } from "@/lib/db/hooks";
import { ProjectTree } from "@/components/layout/project-tree";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const project = useProject(projectId);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Project sidebar — hidden on mobile, collapsible on desktop */}
      <div
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-border bg-surface-raised/30 transition-all duration-200",
          collapsed ? "w-10" : "w-56",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center py-3">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
              title="Expand project tree"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-3">
              <Link
                href={`/project/${projectId}`}
                className="text-xs font-medium text-text-muted uppercase tracking-wider hover:text-accent transition-colors truncate"
              >
                {project?.title || "Project"}
              </Link>
              <button
                onClick={() => setCollapsed(true)}
                className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
                title="Collapse project tree"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <ProjectTree projectId={projectId} />
            </div>
          </>
        )}
      </div>
      {/* Page content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
