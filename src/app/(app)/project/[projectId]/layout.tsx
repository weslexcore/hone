'use client';

import { use } from 'react';
import Link from 'next/link';
import { useProject } from '@/lib/db/hooks';
import { ProjectTree } from '@/components/layout/project-tree';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const project = useProject(projectId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Project sidebar */}
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-surface-raised/30 py-3 px-2">
        <div className="px-2 mb-3">
          <Link
            href={`/project/${projectId}`}
            className="text-xs font-medium text-text-muted uppercase tracking-wider hover:text-accent transition-colors"
          >
            {project?.title || 'Project'}
          </Link>
        </div>
        <ProjectTree projectId={projectId} />
      </div>
      {/* Page content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
