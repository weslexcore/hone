"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  useProject,
  useChapters,
  updateProject,
  createChapter,
  deleteChapter,
  updateChapter,
} from "@/lib/db/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ReadProjectView } from "@/components/project/read-view";
import { FullscreenReader } from "@/components/project/fullscreen-reader";
import { ExpandableSection } from "@/components/ui/expandable-section";
import {
  Plus,
  Trash2,
  GripVertical,
  BookOpen,
  Sparkles,
  ChevronUp,
  ChevronDown,
  List,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ProjectTab = "manage" | "read";

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const project = useProject(projectId);
  const chapters = useChapters(projectId);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ProjectTab>("manage");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [fullscreenRead, setFullscreenRead] = useState(false);

  if (!project) return null;

  const handleTitleSave = async () => {
    if (titleInput.trim()) {
      await updateProject(projectId, { title: titleInput.trim() });
      toast("Title updated", "success");
    }
    setEditingTitle(false);
  };

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return;
    const id = await createChapter(projectId, { title: newChapterTitle.trim() });
    setShowCreateChapter(false);
    setNewChapterTitle("");
    toast("Chapter created", "success");
    router.push(`/project/${projectId}/${id}`);
  };

  const handleDeleteChapter = async (id: string) => {
    await deleteChapter(id);
    setDeletingChapterId(null);
    toast("Chapter deleted", "info");
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    if (!chapters) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    await updateChapter(chapters[index].id, { sortOrder: targetIndex });
    await updateChapter(chapters[targetIndex].id, { sortOrder: index });
  };

  const tabs: { id: ProjectTab; label: string; icon: typeof List }[] = [
    { id: "manage", label: "Chapters", icon: List },
    { id: "read", label: "Read", icon: BookOpen },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Project Header */}
        <div className="mb-6">
          {editingTitle ? (
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              autoFocus
              className="text-2xl font-semibold"
            />
          ) : (
            <h1
              className="text-2xl font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
              onClick={() => {
                setTitleInput(project.title);
                setEditingTitle(true);
              }}
            >
              {project.title}
            </h1>
          )}

          <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
            <span>{project.wordCount.toLocaleString()} words</span>
            <span>{chapters?.length ?? 0} chapters</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "text-accent border-accent"
                    : "text-text-muted hover:text-text-secondary border-transparent",
                )}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "manage" && (
          <>
            <div className="space-y-3 mb-6">
              {/* Description */}
              <ExpandableSection
                label="Description"
                preview={project.description || undefined}
                defaultOpen={!!project.description}
              >
                <Textarea
                  value={project.description}
                  onChange={(e) => updateProject(projectId, { description: e.target.value })}
                  placeholder="Add a project description..."
                  rows={3}
                  className="resize-none"
                />
              </ExpandableSection>

              {/* Notes */}
              <ExpandableSection
                label="Project Notes"
                preview={project.notes || undefined}
                defaultOpen={!!project.notes}
              >
                <Textarea
                  value={project.notes}
                  onChange={(e) => updateProject(projectId, { notes: e.target.value })}
                  placeholder="Characters, plot points, world-building notes..."
                  rows={6}
                  className="font-serif text-sm"
                />
              </ExpandableSection>

              {/* AI Toggle */}
              <div className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg">
                <Sparkles size={16} className="text-accent" />
                <Switch
                  checked={project.aiEnabled}
                  onChange={(checked) => updateProject(projectId, { aiEnabled: checked })}
                  label="AI recommendations"
                />
              </div>
            </div>

            {/* Chapters */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Chapters</h2>
              <Button size="sm" onClick={() => setShowCreateChapter(true)}>
                <Plus size={14} />
                Add Chapter
              </Button>
            </div>

            {chapters && chapters.length > 0 ? (
              <div className="space-y-2">
                {chapters.map((chapter, index) => (
                  <Card
                    key={chapter.id}
                    hover
                    className="group flex items-center gap-3 py-3 px-4"
                    onClick={() => router.push(`/project/${projectId}/${chapter.id}`)}
                  >
                    <GripVertical size={14} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {chapter.title}
                      </h3>
                      <span className="text-xs text-text-muted">
                        {chapter.wordCount.toLocaleString()} words
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(index, "up");
                        }}
                        disabled={index === 0}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(index, "down");
                        }}
                        disabled={index === chapters.length - 1}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingChapterId(chapter.id);
                        }}
                        className="p-1 text-text-muted hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <BookOpen size={32} className="mx-auto text-text-muted mb-3" />
                <p className="text-sm text-text-muted">No chapters yet</p>
              </div>
            )}
          </>
        )}

        {activeTab === "read" && (
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="sm" onClick={() => setFullscreenRead(true)}>
                <Maximize2 size={14} />
                Fullscreen
              </Button>
            </div>
            <ReadProjectView projectId={projectId} projectTitle={project.title} />
            <FullscreenReader open={fullscreenRead} onClose={() => setFullscreenRead(false)}>
              <ReadProjectView projectId={projectId} projectTitle={project.title} />
            </FullscreenReader>
          </div>
        )}

        {/* Create Chapter Dialog */}
        <Dialog open={showCreateChapter} onClose={() => setShowCreateChapter(false)}>
          <DialogTitle>New Chapter</DialogTitle>
          <div className="space-y-4">
            <Input
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Chapter title"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateChapter()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateChapter(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateChapter}
                disabled={!newChapterTitle.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Delete Chapter Confirmation */}
        <Dialog open={!!deletingChapterId} onClose={() => setDeletingChapterId(null)}>
          <DialogTitle>Delete Chapter</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will delete the chapter and all its scenes. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingChapterId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingChapterId && handleDeleteChapter(deletingChapterId)}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}
