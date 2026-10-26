import type { Languages } from '../interfaces/languages';

export const AVAILABLE_LANGUAGES = [
  { value: 'en', label: 'English', englishLabel: 'English' },
  { value: 'ko', label: '한국어', englishLabel: 'Korean' },
] as { label: string; value: Languages; englishLabel: string }[];
