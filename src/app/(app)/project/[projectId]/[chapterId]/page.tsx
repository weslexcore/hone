'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  useChapter,
  useScenes,
  updateChapter,
  createScene,
  deleteScene,
  updateScene,
} from '@/lib/db/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { ChapterWriter } from '@/components/project/chapter-writer';
import { ReadChapterView } from '@/components/project/read-view';
import { FullscreenReader } from '@/components/project/fullscreen-reader';
import {
  Plus,
  Trash2,
  FileText,
  ChevronUp,
  ChevronDown,
  List,
  PenLine,
  BookOpen,
  Maximize2,
} from 'lucide-react';
import { ExpandableSection } from '@/components/ui/expandable-section';
import { cn } from '@/lib/utils/cn';

type ChapterTab = 'manage' | 'write' | 'read';

export default function ChapterPage({
  params,
}: {
  params: Promise<{ projectId: string; chapterId: string }>;
}) {
  const { projectId, chapterId } = use(params);
  const router = useRouter();
  const chapter = useChapter(chapterId);
  const scenes = useScenes(chapterId);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ChapterTab>('manage');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showCreateScene, setShowCreateScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);
  const [fullscreenRead, setFullscreenRead] = useState(false);
  const [fullscreenWrite, setFullscreenWrite] = useState(false);

  if (!chapter) return null;

  const handleTitleSave = async () => {
    if (titleInput.trim()) {
      await updateChapter(chapterId, { title: titleInput.trim() });
      toast('Title updated', 'success');
    }
    setEditingTitle(false);
  };

  const handleCreateScene = async () => {
    if (!newSceneTitle.trim()) return;
    const id = await createScene(chapterId, projectId, { title: newSceneTitle.trim() });
    setShowCreateScene(false);
    setNewSceneTitle('');
    toast('Scene created', 'success');
    router.push(`/project/${projectId}/${chapterId}/${id}`);
  };

  const handleDeleteScene = async (id: string) => {
    await deleteScene(id);
    setDeletingSceneId(null);
    toast('Scene deleted', 'info');
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (!scenes) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    await updateScene(scenes[index].id, { sortOrder: targetIndex });
    await updateScene(scenes[targetIndex].id, { sortOrder: index });
  };

  const tabs: { id: ChapterTab; label: string; icon: typeof List }[] = [
    { id: 'manage', label: 'Scenes', icon: List },
    { id: 'write', label: 'Write', icon: PenLine },
    { id: 'read', label: 'Read', icon: BookOpen },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Chapter Header */}
        <div className="mb-6">
          {editingTitle ? (
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              autoFocus
              className="text-2xl font-semibold"
            />
          ) : (
            <h1
              className="text-2xl font-semibold text-text-primary cursor-pointer hover:text-accent transition-colors"
              onClick={() => {
                setTitleInput(chapter.title);
                setEditingTitle(true);
              }}
            >
              {chapter.title}
            </h1>
          )}

          <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
            <span>{chapter.wordCount.toLocaleString()} words</span>
            <span>{scenes?.length ?? 0} scenes</span>
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
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'text-accent border-accent'
                    : 'text-text-muted hover:text-text-secondary border-transparent'
                )}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'manage' && (
          <>
            {/* Chapter Notes */}
            <ExpandableSection
              label="Chapter Notes"
              preview={chapter.notes || undefined}
              defaultOpen={!!chapter.notes}
              className="mb-6"
            >
              <Textarea
                value={chapter.notes}
                onChange={(e) => updateChapter(chapterId, { notes: e.target.value })}
                placeholder="Notes for this chapter..."
                rows={4}
                className="font-serif text-sm"
              />
            </ExpandableSection>

            {/* Scenes */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Scenes</h2>
              <Button size="sm" onClick={() => setShowCreateScene(true)}>
                <Plus size={14} />
                Add Scene
              </Button>
            </div>

            {scenes && scenes.length > 0 ? (
              <div className="space-y-2">
                {scenes.map((scene, index) => (
                  <Card
                    key={scene.id}
                    hover
                    className="group flex items-center gap-3 py-3 px-4"
                    onClick={() => router.push(`/project/${projectId}/${chapterId}/${scene.id}`)}
                  >
                    <FileText size={14} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {scene.title}
                      </h3>
                      <span className="text-xs text-text-muted">
                        {scene.wordCount.toLocaleString()} words
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(index, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(index, 'down');
                        }}
                        disabled={index === scenes.length - 1}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSceneId(scene.id);
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
                <FileText size={32} className="mx-auto text-text-muted mb-3" />
                <p className="text-sm text-text-muted mb-1">No scenes yet</p>
                <p className="text-xs text-text-muted">
                  Add scenes individually, or switch to the <strong>Write</strong> tab to write the full chapter and extract scenes automatically.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'write' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 rounded-lg bg-accent-muted/50 border border-accent/10 px-4 py-3">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Write your chapter as continuous prose below. Type{' '}
                  <code className="px-1 py-0.5 rounded bg-surface-overlay text-[11px]">---</code>{' '}
                  to mark scene boundaries, then click{' '}
                  <strong className="text-text-primary">Extract Scenes</strong> to split them out.
                  You can also use <strong className="text-text-primary">AI Split</strong> to
                  automatically identify scene breaks.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullscreenWrite(true)}
                className="shrink-0 mt-1"
              >
                <Maximize2 size={14} />
                Fullscreen
              </Button>
            </div>
            {!fullscreenWrite && (
              <ChapterWriter
                chapterId={chapterId}
                projectId={projectId}
                onScenesCreated={() => setActiveTab('manage')}
              />
            )}
            <FullscreenReader open={fullscreenWrite} onClose={() => setFullscreenWrite(false)}>
              <div className="max-w-4xl mx-auto">
                <ChapterWriter
                  chapterId={chapterId}
                  projectId={projectId}
                  onScenesCreated={() => {
                    setFullscreenWrite(false);
                    setActiveTab('manage');
                  }}
                />
              </div>
            </FullscreenReader>
          </div>
        )}

        {activeTab === 'read' && (
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullscreenRead(true)}
              >
                <Maximize2 size={14} />
                Fullscreen
              </Button>
            </div>
            <ReadChapterView chapterId={chapterId} chapterTitle={chapter.title} />
            <FullscreenReader open={fullscreenRead} onClose={() => setFullscreenRead(false)}>
              <ReadChapterView chapterId={chapterId} chapterTitle={chapter.title} />
            </FullscreenReader>
          </div>
        )}

        {/* Create Scene Dialog */}
        <Dialog open={showCreateScene} onClose={() => setShowCreateScene(false)}>
          <DialogTitle>New Scene</DialogTitle>
          <div className="space-y-4">
            <Input
              value={newSceneTitle}
              onChange={(e) => setNewSceneTitle(e.target.value)}
              placeholder="Scene title"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateScene()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreateScene(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateScene}
                disabled={!newSceneTitle.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Delete Scene Confirmation */}
        <Dialog open={!!deletingSceneId} onClose={() => setDeletingSceneId(null)}>
          <DialogTitle>Delete Scene</DialogTitle>
          <p className="text-sm text-text-secondary mb-6">
            This will permanently delete this scene and its content. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingSceneId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingSceneId && handleDeleteScene(deletingSceneId)}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}
