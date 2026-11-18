/* Monaco themes wired to the app's workbench ramp.
 *
 * Monaco paints into a canvas-backed DOM of its own and cannot read CSS
 * custom properties, so the two themes below restate the ramp as literals.
 * They are the ONLY place in the app allowed to do that; if
 * tokens/colors.css moves a --wb-* value, move it here too or the editor
 * will sit a shade off the panel around it.
 *
 * `velxio-dark` is built on vs-dark and keeps its token colors — the dark
 * editor is unchanged from before the theme switch existed. `velxio-light`
 * is built on vs (Light+) for the same reason: readers know those syntax
 * colors from VS Code and the Arduino IDE.
 */
import type { Monaco } from '@monaco-editor/react';

export const MONACO_DARK = 'velxio-dark';
export const MONACO_LIGHT = 'velxio-light';

/** Editor chrome per theme. Mirrors --wb-* in tokens/colors.css. */
const DARK = {
  bg: '#2e2a28', // --wb-2 (Kohle)
  gutter: '#2e2a28',
  lineNumber: '#8e857e', // --wb-9
  lineNumberActive: '#e3dad0', // --wb-12
  indentGuide: '#5e5651', // --wb-7
  currentLine: '#36312f',
  selection: '#6b4a3a',
  widgetBg: '#36312f', // --wb-3
  widgetBorder: '#514a46',
  scrollShadow: '#1d1a19',
};

const LIGHT = {
  bg: '#fffdfa', // --wb-2 (light)
  gutter: '#fffdfa',
  lineNumber: '#8f7f70', // --wb-9 (light)
  lineNumberActive: '#3a3431', // --wb-12 (light)
  indentGuide: '#d4c0aa', // --wb-7 (light)
  currentLine: '#fbf4ec',
  selection: '#f6b48f',
  widgetBg: '#f6eadd', // --wb-3 (light)
  widgetBorder: '#e4d3c0',
  scrollShadow: '#f1e1cf',
};

function colors(c: typeof DARK): Record<string, string> {
  return {
    'editor.background': c.bg,
    'editorGutter.background': c.gutter,
    'editorLineNumber.foreground': c.lineNumber,
    'editorLineNumber.activeForeground': c.lineNumberActive,
    'editorIndentGuide.background1': c.indentGuide,
    'editor.lineHighlightBackground': c.currentLine,
    'editor.selectionBackground': c.selection,
    // The hover / suggest / signature popups. They escape the editor box as
    // fixed overlays (fixedOverflowWidgets), so they land on top of the
    // canvas and have to read as app chrome, not as a stray dark rectangle.
    'editorWidget.background': c.widgetBg,
    'editorWidget.border': c.widgetBorder,
    'editorSuggestWidget.background': c.widgetBg,
    'editorSuggestWidget.border': c.widgetBorder,
    'editorHoverWidget.background': c.widgetBg,
    'editorHoverWidget.border': c.widgetBorder,
    'input.background': c.bg,
    'dropdown.background': c.widgetBg,
    'scrollbar.shadow': c.scrollShadow,
    'minimap.background': c.bg,
  };
}

/** Register both themes on a monaco instance. Idempotent per instance —
 *  CodeEditor remounts per file (the `key` prop) and would otherwise
 *  redefine these on every tab switch. */
export function defineVelxioThemes(monaco: Monaco): void {
  const g = monaco as unknown as { __velxioThemes?: boolean };
  if (g.__velxioThemes) return;
  g.__velxioThemes = true;

  monaco.editor.defineTheme(MONACO_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'f6b48f' },
      { token: 'string', foreground: 'f6cfc6' },
      { token: 'number', foreground: 'e8836b' },
      { token: 'comment', foreground: '8e857e', fontStyle: 'italic' },
      { token: 'type', foreground: 'fde3d0' },
    ],
    colors: colors(DARK),
  });

  monaco.editor.defineTheme(MONACO_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'a0502c' },
      { token: 'string', foreground: '7a3a22' },
      { token: 'number', foreground: 'b3541e' },
      { token: 'comment', foreground: '8f7f70', fontStyle: 'italic' },
      { token: 'type', foreground: '5a4f49' },
    ],
    colors: colors(LIGHT),
  });
}

export function monacoThemeFor(resolved: 'dark' | 'light'): string {
  return resolved === 'light' ? MONACO_LIGHT : MONACO_DARK;
}
