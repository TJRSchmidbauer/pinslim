/**
 * CodeSymbolBar — a row of the characters that are a chore on a tablet keyboard
 * ({ } ( ) [ ] ; < > = " ' / & | ! #) plus Tab, shown above the on-screen
 * keyboard while the code editor has focus on a touch device.
 *
 * It sits at the bottom of the VISUAL viewport (`window.visualViewport`): when
 * the keyboard opens, the layout viewport keeps its size and the keyboard
 * covers the lower part, so a plain `position: fixed; bottom: 0` would hide
 * behind the keyboard. Taps insert at the cursor through the Monaco editor
 * instance and never take focus from it (mousedown/touchstart default is
 * prevented), so the keyboard stays up.
 */
import React, { useEffect, useState } from 'react';
import type { editor } from 'monaco-editor';

const SYMBOLS = ['{', '}', '(', ')', '[', ']', ';', '<', '>', '=', '"', "'", '/', '&', '|', '!', '#', '+', '-', '*'];

interface CodeSymbolBarProps {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  visible: boolean;
}

export const CodeSymbolBar: React.FC<CodeSymbolBarProps> = ({ editorRef, visible }) => {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [visible]);

  if (!visible) return null;

  const insert = (text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    // Pairs close themselves: typing "(" gives "()" with the cursor inside.
    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    const close = pairs[text];
    if (close && sel.isEmpty()) {
      ed.executeEdits('symbol-bar', [{ range: sel, text: text + close, forceMoveMarkers: true }]);
      const pos = ed.getPosition();
      if (pos) ed.setPosition({ lineNumber: pos.lineNumber, column: pos.column - 1 });
    } else {
      ed.executeEdits('symbol-bar', [{ range: sel, text, forceMoveMarkers: true }]);
    }
    ed.focus();
  };

  // Keep focus (and so the keyboard) in the editor.
  const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="code-symbol-bar"
      style={{ bottom }}
      onMouseDown={keepFocus}
      onTouchStart={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Code symbols"
    >
      <button
        type="button"
        className="code-symbol-bar__key code-symbol-bar__key--wide"
        onMouseDown={keepFocus}
        onTouchEnd={(e) => {
          e.preventDefault();
          editorRef.current?.trigger('symbol-bar', 'tab', null);
          editorRef.current?.focus();
        }}
        onClick={() => editorRef.current?.trigger('symbol-bar', 'tab', null)}
      >
        Tab
      </button>
      {SYMBOLS.map((s) => (
        <button
          key={s}
          type="button"
          className="code-symbol-bar__key"
          onMouseDown={keepFocus}
          onTouchEnd={(e) => {
            e.preventDefault();
            insert(s);
          }}
          onClick={() => insert(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
};
