export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  notes: string;
  aiEnabled: boolean;
  sortOrder: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
  sortOrder: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scene {
  id: string;
  chapterId: string;
  projectId: string;
  title: string;
  content: string;
  contentHtml: string;
  notes: string;
  tags: string[];
  sortOrder: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}
