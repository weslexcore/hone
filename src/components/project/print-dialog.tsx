"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/db/index";
import { Printer, Download } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  generatePrintHtml,
  defaultPrintOptions,
  type PrintOptions,
} from "@/lib/print/generate-html";

interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text-secondary shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text-primary",
          "focus:outline-none focus:ring-2 focus:ring-accent/50",
          "cursor-pointer appearance-none",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

async function fetchPrintData(projectId: string) {
  const chapters = await db.chapters.where("projectId").equals(projectId).sortBy("sortOrder");
  const allScenes = await db.scenes.where("projectId").equals(projectId).sortBy("sortOrder");

  const scenesByChapter: Record<string, typeof allScenes> = {};
  for (const scene of allScenes) {
    if (!scenesByChapter[scene.chapterId]) scenesByChapter[scene.chapterId] = [];
    scenesByChapter[scene.chapterId].push(scene);
  }

  return { chapters, scenesByChapter };
}

export function PrintDialog({ open, onClose, projectId, projectTitle }: PrintDialogProps) {
  const [options, setOptions] = useState<PrintOptions>(defaultPrintOptions);
  const [loading, setLoading] = useState(false);

  const update = useCallback(
    <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const generate = useCallback(async () => {
    const { chapters, scenesByChapter } = await fetchPrintData(projectId);
    return generatePrintHtml(
      { title: projectTitle, chapters, scenesByChapter },
      options,
    );
  }, [projectId, projectTitle, options]);

  const handlePrint = useCallback(async () => {
    setLoading(true);
    try {
      const html = await generate();
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      // Wait for content to render before printing
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      // Fallback if onload doesn't fire (already loaded)
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } finally {
      setLoading(false);
    }
  }, [generate]);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const html = await generate();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectTitle.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [generate, projectTitle]);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogTitle>Print / Export</DialogTitle>

      <div className="space-y-5">
        {/* Typography */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Typography
          </h3>
          <Select
            label="Font"
            value={options.fontFamily}
            onChange={(v) => update("fontFamily", v as PrintOptions["fontFamily"])}
            options={[
              { value: "serif", label: "Serif (Georgia)" },
              { value: "sans-serif", label: "Sans-serif (Helvetica)" },
            ]}
          />
          <Select
            label="Size"
            value={options.fontSize}
            onChange={(v) => update("fontSize", v as PrintOptions["fontSize"])}
            options={[
              { value: "small", label: "Small (11pt)" },
              { value: "medium", label: "Medium (12pt)" },
              { value: "large", label: "Large (14pt)" },
            ]}
          />
          <Select
            label="Line spacing"
            value={options.lineSpacing}
            onChange={(v) => update("lineSpacing", v as PrintOptions["lineSpacing"])}
            options={[
              { value: "single", label: "Single" },
              { value: "1.5", label: "1.5 spacing" },
              { value: "double", label: "Double" },
            ]}
          />
          <Select
            label="Margins"
            value={options.margins}
            onChange={(v) => update("margins", v as PrintOptions["margins"])}
            options={[
              { value: "narrow", label: 'Narrow (0.5")' },
              { value: "normal", label: 'Normal (1")' },
              { value: "wide", label: 'Wide (1.25")' },
            ]}
          />
        </div>

        {/* Layout */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Layout</h3>
          <div className="space-y-2.5">
            <Switch
              checked={options.includeTitlePage}
              onChange={(v) => update("includeTitlePage", v)}
              label="Title page"
            />
            <Switch
              checked={options.includeChapterHeadings}
              onChange={(v) => update("includeChapterHeadings", v)}
              label="Chapter headings"
            />
            <Switch
              checked={options.showSceneBreaks}
              onChange={(v) => update("showSceneBreaks", v)}
              label="Scene break dividers"
            />
            <Switch
              checked={options.showPageNumbers}
              onChange={(v) => update("showPageNumbers", v)}
              label="Page numbers"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleDownload} disabled={loading}>
            <Download size={14} />
            Download HTML
          </Button>
          <Button variant="primary" onClick={handlePrint} disabled={loading}>
            <Printer size={14} />
            Print
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
