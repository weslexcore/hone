const STORAGE_KEY = 'hone_theme';

export type ThemeId = 'default' | 'deep-black' | 'parchment';

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'default', label: 'Warm Dark', description: 'Muted dark grays with warm gold accent' },
  { id: 'deep-black', label: 'Deep Black', description: 'True black backgrounds for OLED displays' },
  { id: 'parchment', label: 'Parchment', description: 'Warm light tones inspired by aged paper' },
];

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getTheme(): ThemeId {
  if (!isBrowser()) return 'default';
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'default';
}

export function setTheme(theme: ThemeId): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, theme);
}
