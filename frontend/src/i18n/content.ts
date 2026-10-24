/**
 * Translations for CONTENT that lives in code and data rather than in the
 * UI string bundles: example titles/descriptions, board blurbs and part
 * descriptions. Those come from upstream data files (examples*.ts, the
 * component metadata, the board tables) that are English-only and change
 * with every upstream merge, so they are not moved into the locale JSON.
 * Instead the German text is looked up here at render time:
 *
 *   - examples are keyed by example id (stable across upstream edits)
 *   - parts and board blurbs are keyed by their English text, because the
 *     same blurb appears in several tables (picker, starter dialog, board
 *     picker) and has no shared id
 *
 * Anything without a translation falls back to the original English, so a
 * new upstream example simply shows up untranslated instead of breaking.
 */

import { i18n } from './index';
import deExamples from './content/de-examples.json';
import deParts from './content/de-parts.json';

type ExampleText = { t: string; d: string };

const EXAMPLES: Record<string, Record<string, ExampleText>> = {
  de: deExamples as Record<string, ExampleText>,
};
const PARTS: Record<string, Record<string, string>> = {
  de: deParts as Record<string, string>,
};

function lang(): string {
  return (i18n.language || 'en').split('-')[0];
}

/** Translated part / board description, or the English original. */
export function trPart(english: string | undefined | null): string {
  if (!english) return english ?? '';
  return PARTS[lang()]?.[english] ?? english;
}

/** Example with title/description swapped for the active language. */
export function localizeExample<T extends { id: string; title: string; description: string }>(
  example: T,
): T {
  const hit = EXAMPLES[lang()]?.[example.id];
  if (!hit) return example;
  return { ...example, title: hit.t, description: hit.d };
}
