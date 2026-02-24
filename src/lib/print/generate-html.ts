import type { Chapter, Scene } from "@/types/project";

export interface PrintOptions {
  fontFamily: "serif" | "sans-serif";
  fontSize: "small" | "medium" | "large";
  lineSpacing: "single" | "1.5" | "double";
  margins: "narrow" | "normal" | "wide";
  includeTitlePage: boolean;
  includeChapterHeadings: boolean;
  showSceneBreaks: boolean;
  showPageNumbers: boolean;
}

export const defaultPrintOptions: PrintOptions = {
  fontFamily: "serif",
  fontSize: "medium",
  lineSpacing: "1.5",
  margins: "normal",
  includeTitlePage: true,
  includeChapterHeadings: true,
  showSceneBreaks: true,
  showPageNumbers: true,
};

interface PrintData {
  title: string;
  chapters: Chapter[];
  scenesByChapter: Record<string, Scene[]>;
}

const FONT_MAP = {
  serif: "Georgia, 'Times New Roman', Times, serif",
  "sans-serif": "Helvetica, Arial, sans-serif",
} as const;

const SIZE_MAP = {
  small: "11pt",
  medium: "12pt",
  large: "14pt",
} as const;

const HEADING_SIZE_MAP = {
  small: "16pt",
  medium: "18pt",
  large: "22pt",
} as const;

const LINE_HEIGHT_MAP = {
  single: "1.4",
  "1.5": "1.6",
  double: "2.0",
} as const;

const MARGIN_MAP = {
  narrow: "0.5in",
  normal: "1in",
  wide: "1.25in",
} as const;

function buildStyles(options: PrintOptions): string {
  const font = FONT_MAP[options.fontFamily];
  const size = SIZE_MAP[options.fontSize];
  const headingSize = HEADING_SIZE_MAP[options.fontSize];
  const lineHeight = LINE_HEIGHT_MAP[options.lineSpacing];
  const margin = MARGIN_MAP[options.margins];

  return `
    @page {
      margin: ${margin};
      size: letter;
      ${options.showPageNumbers ? `@bottom-center { content: counter(page); font-size: 9pt; color: #888; }` : ""}
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ${font};
      font-size: ${size};
      line-height: ${lineHeight};
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .title-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      text-align: center;
      page-break-after: always;
      break-after: page;
    }

    .title-page h1 {
      font-size: calc(${headingSize} * 1.6);
      font-weight: 700;
      margin-bottom: 0.5em;
      letter-spacing: -0.01em;
    }

    .title-page .subtitle {
      font-size: ${size};
      color: #666;
    }

    .chapter {
      page-break-before: always;
      break-before: page;
    }

    .chapter:first-of-type {
      page-break-before: auto;
      break-before: auto;
    }

    .chapter-heading {
      text-align: center;
      margin-bottom: 2em;
      padding-top: 3em;
    }

    .chapter-heading .chapter-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.3em;
      color: #888;
      margin-bottom: 0.5em;
    }

    .chapter-heading h2 {
      font-size: ${headingSize};
      font-weight: 600;
    }

    .scene-break {
      text-align: center;
      margin: 2em 0;
      font-size: ${size};
      color: #888;
      letter-spacing: 0.5em;
    }

    .scene-content {
      max-width: 100%;
    }

    .scene-content p {
      margin-bottom: 0.75em;
      text-indent: 1.5em;
    }

    .scene-content p:first-child {
      text-indent: 0;
    }

    .scene-content blockquote {
      margin: 1em 0;
      padding-left: 1.5em;
      border-left: 2px solid #ccc;
      font-style: italic;
      color: #444;
    }

    .scene-content h1 {
      font-size: calc(${headingSize} * 1.2);
      font-weight: 700;
      margin: 1.5em 0 0.5em;
    }

    .scene-content h2 {
      font-size: ${headingSize};
      font-weight: 600;
      margin: 1.25em 0 0.4em;
    }

    .scene-content h3 {
      font-size: calc(${headingSize} * 0.85);
      font-weight: 600;
      margin: 1em 0 0.3em;
    }

    .scene-content ul, .scene-content ol {
      margin: 0.75em 0;
      padding-left: 2em;
    }

    .scene-content li {
      margin-bottom: 0.25em;
    }

    .scene-content hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }

    .scene-content strong { font-weight: 700; }
    .scene-content em { font-style: italic; }

    .end-mark {
      text-align: center;
      margin-top: 4em;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: #888;
    }

    @media screen {
      body { max-width: 700px; margin: 2em auto; padding: 0 1em; }
    }
  `;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generatePrintHtml(data: PrintData, options: PrintOptions): string {
  const { title, chapters, scenesByChapter } = data;
  const styles = buildStyles(options);

  let body = "";

  // Title page
  if (options.includeTitlePage) {
    const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
    body += `
      <div class="title-page">
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${totalWords.toLocaleString()} words</p>
      </div>
    `;
  }

  // Chapters
  chapters.forEach((chapter, chapterIndex) => {
    const scenes = scenesByChapter[chapter.id] || [];

    body += `<div class="chapter">`;

    if (options.includeChapterHeadings) {
      body += `
        <div class="chapter-heading">
          <p class="chapter-label">Chapter ${chapterIndex + 1}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
      `;
    }

    scenes.forEach((scene, sceneIndex) => {
      if (sceneIndex > 0 && options.showSceneBreaks) {
        body += `<div class="scene-break">***</div>`;
      }

      if (scene.contentHtml) {
        body += `<div class="scene-content">${scene.contentHtml}</div>`;
      }
    });

    body += `</div>`;
  });

  // End mark
  body += `<div class="end-mark">End</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
${body}
</body>
</html>`;
}
