export const GENRES = [
  { id: 'literary-fiction', label: 'Literary Fiction' },
  { id: 'science-fiction', label: 'Science Fiction' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'romance', label: 'Romance' },
  { id: 'horror', label: 'Horror' },
  { id: 'historical-fiction', label: 'Historical Fiction' },
  { id: 'dystopian', label: 'Dystopian' },
  { id: 'memoir', label: 'Memoir' },
  { id: 'creative-nonfiction', label: 'Creative Nonfiction' },
  { id: 'poetry', label: 'Poetry' },
  { id: 'flash-fiction', label: 'Flash Fiction' },
  { id: 'satire', label: 'Satire' },
  { id: 'noir', label: 'Noir' },
  { id: 'magical-realism', label: 'Magical Realism' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'slice-of-life', label: 'Slice of Life' },
] as const;

export type GenreId = (typeof GENRES)[number]['id'];

export const PRACTICE_DURATIONS = [
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
] as const;
