/**
 * A thin handle on the live Monaco editor for code that lives elsewhere
 * (the messages panel): jump to a source line and underline compile errors.
 *
 * The editor remounts per file (`key={activeFileId}`), so the bridge holds the
 * current instance and re-applies a pending jump and the last markers when a
 * new one registers.
 */
import type { editor } from 'monaco-editor';
import { useEditorStore } from '../store/useEditorStore';

type Monaco = typeof import('monaco-editor');

export interface SourceMarker {
  file: string | null;
  line: number;
  col: number;
  message: string;
}

let current: { ed: editor.IStandaloneCodeEditor; monaco: Monaco } | null = null;
let pendingJump: { line: number; col: number } | null = null;
let lastMarkers: SourceMarker[] = [];
const OWNER = 'pinslim-compile';

function activeFileName(): string | null {
  const s = useEditorStore.getState();
  return s.files.find((f) => f.id === s.activeFileId)?.name ?? null;
}

/** The compiler always calls the first .ino "sketch.ino"; map it back. */
function sameFile(markerFile: string | null, activeName: string | null): boolean {
  if (!markerFile || !activeName) return false;
  if (markerFile === activeName) return true;
  return markerFile === 'sketch.ino' && activeName.endsWith('.ino');
}

function applyMarkers() {
  if (!current) return;
  const model = current.ed.getModel();
  if (!model) return;
  const name = activeFileName();
  const markers = lastMarkers
    .filter((m) => m.line > 0 && sameFile(m.file, name) && m.line <= model.getLineCount())
    .map((m) => ({
      severity: 8, // MarkerSeverity.Error
      message: m.message,
      startLineNumber: m.line,
      startColumn: Math.max(1, m.col),
      endLineNumber: m.line,
      endColumn: model.getLineMaxColumn(m.line),
    }));
  current.monaco.editor.setModelMarkers(model, OWNER, markers);
}

function reveal(line: number, col: number) {
  if (!current) return;
  const model = current.ed.getModel();
  if (!model) return;
  const ln = Math.min(Math.max(1, line), model.getLineCount());
  current.ed.revealLineInCenter(ln);
  current.ed.setSelection({
    startLineNumber: ln,
    startColumn: 1,
    endLineNumber: ln,
    endColumn: model.getLineMaxColumn(ln),
  });
  current.ed.setPosition({ lineNumber: ln, column: Math.max(1, col) });
  current.ed.focus();
}

export function registerEditor(ed: editor.IStandaloneCodeEditor, monaco: Monaco): () => void {
  current = { ed, monaco };
  // Once the student edits, the underlines no longer describe the code.
  const sub = ed.onDidChangeModelContent(() => {
    lastMarkers = [];
    monaco.editor.setModelMarkers(ed.getModel()!, OWNER, []);
  });
  applyMarkers();
  if (pendingJump) {
    const j = pendingJump;
    pendingJump = null;
    reveal(j.line, j.col);
  }
  return () => {
    sub.dispose();
    if (current?.ed === ed) current = null;
  };
}

/** Underline these errors in the open file (replaces the previous set). */
export function setCompileMarkers(markers: SourceMarker[]) {
  lastMarkers = markers;
  applyMarkers();
}

/** Open `file` (if it is not the active one) and put the cursor on `line`. */
export function goToSource(file: string | null, line: number, col = 1) {
  const st = useEditorStore.getState();
  const target =
    (file && st.files.find((f) => f.name === file)) ||
    (file === 'sketch.ino' ? st.files.find((f) => f.name.endsWith('.ino')) : undefined);
  if (target && target.id !== st.activeFileId) {
    pendingJump = { line, col };
    st.openFile(target.id);
    st.setActiveFile(target.id);
    return;
  }
  reveal(line, col);
}
