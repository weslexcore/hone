"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useProjects, createProject, deleteProject } from "@/lib/db/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, BookOpen, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const projects = useProjects();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const id = await createProject({ title: newTitle.trim(), description: newDescription.trim() });
    setShowCreateDialog(false);
    setNewTitle("");
    setNewDescription("");
    toast("Project created", "success");
    router.push(`/project/${id}`);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setDeletingId(null);
    toast("Project deleted", "info");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
            <p className="text-sm text-text-muted mt-1">Your writing projects</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
            <Plus size={16} />
            New Project
          </Button>
        </div>

        {!projects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl border border-border bg-surface-raised animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={48} className="mx-auto text-text-muted mb-4" />
            <h2 className="text-lg font-medium text-text-secondary mb-2">No projects yet</h2>
            <p className="text-sm text-text-muted mb-6">
              Create your first writing project to get started
            </p>
            <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
              <Plus size={16} />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
              >
                <Card
                  hover
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="group relative"
                >
                  <h3 className="font-semibold text-text-primary mb-1 pr-8">{project.title}</h3>
                  {project.description && (
                    <p className="text-sm text-text-muted line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{project.wordCount.toLocaleString()} words</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(project.id);
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
          <DialogTitle>New Project</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="My Novel"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Description (optional)
              </label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A brief description of your project..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} disabled={!newTitle.trim()}>
                Create
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deletingId} onClose={() => setDeletingId(null)}>
          <DialogTitle>Delete Project</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently delete the project and all its chapters and scenes. This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deletingId && handleDelete(deletingId)}>
              Delete
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}
