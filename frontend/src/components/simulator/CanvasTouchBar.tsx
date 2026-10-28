/**
 * CanvasTouchBar — the thumb bar for tablets.
 *
 * Floats at the bottom-left of the canvas (the zoom controls sit bottom-right)
 * and only renders on a coarse pointer. It carries what a tablet user reaches
 * for while working on the circuit and otherwise has to fetch from the top
 * toolbar or a keyboard shortcut that a tablet does not have:
 * Run / Stop, Undo / Redo, Serial monitor and Add part.
 *
 * Run and Stop go through the editor command registry (EditorToolbar owns
 * compile + run); undo/redo and the serial monitor are plain store actions.
 *
 * Touch note: the canvas listens to native touch events and calls
 * preventDefault on touchend, which swallows the synthetic click of anything
 * floating above it. Every button therefore acts on its own native touchend
 * and stops the event there (same approach as SelectionActionBar).
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { runEditorCommand } from '../../lib/editorCommands';

interface CanvasTouchBarProps {
  onAddComponent: () => void;
}

const ICON = 22;

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    width={ICON}
    height={ICON}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** Fire `action` on a native touchend (and on click for mouse/pen). */
function useTapAction(ref: React.RefObject<HTMLButtonElement | null>, action: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const onEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!el.disabled) action();
    };
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchend', onEnd);
    };
  }, [ref, action]);
}

const BarButton: React.FC<{
  label: string;
  onAction: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'run' | 'stop';
  children: React.ReactNode;
}> = ({ label, onAction, disabled, active, variant, children }) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  useTapAction(ref, onAction);
  const cls = ['canvas-touch-bar__btn', active ? 'is-active' : '', variant ? `is-${variant}` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      onClick={onAction}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
};

export const CanvasTouchBar: React.FC<CanvasTouchBarProps> = ({ onAddComponent }) => {
  const { t } = useTranslation();
  const running = useSimulatorStore((s) => s.running);
  const serialOpen = useSimulatorStore((s) => s.serialMonitorOpen);
  const toggleSerial = useSimulatorStore((s) => s.toggleSerialMonitor);
  // Subscribing to the index re-renders on every push/undo/redo, so the
  // enabled state of the two buttons stays current.
  const historyIndex = useSimulatorStore((s) => s.historyIndex);
  const historyLength = useSimulatorStore((s) => s.history.length);
  const undo = useSimulatorStore((s) => s.undo);
  const redo = useSimulatorStore((s) => s.redo);
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < historyLength - 1;

  return (
    <div
      className="canvas-touch-bar"
      role="toolbar"
      aria-label={t('editor.touchBar.label', 'Quick actions')}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {running ? (
        <BarButton
          label={t('editor.touchBar.stop', 'Stop')}
          onAction={() => runEditorCommand('sim.stop')}
          variant="stop"
        >
          <Svg>
            <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
          </Svg>
        </BarButton>
      ) : (
        <BarButton
          label={t('editor.touchBar.run', 'Run')}
          onAction={() => runEditorCommand('sim.run')}
          variant="run"
        >
          <Svg>
            <polygon points="7 4 20 12 7 20 7 4" fill="currentColor" />
          </Svg>
        </BarButton>
      )}

      <span className="canvas-touch-bar__sep" aria-hidden="true" />

      <BarButton
        label={t('editor.touchBar.undo', 'Undo')}
        onAction={undo}
        disabled={!canUndo || running}
      >
        <Svg>
          <polyline points="9 14 4 9 9 4" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </Svg>
      </BarButton>
      <BarButton
        label={t('editor.touchBar.redo', 'Redo')}
        onAction={redo}
        disabled={!canRedo || running}
      >
        <Svg>
          <polyline points="15 14 20 9 15 4" />
          <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
        </Svg>
      </BarButton>

      <span className="canvas-touch-bar__sep" aria-hidden="true" />

      <BarButton
        label={t('editor.touchBar.serial', 'Serial monitor')}
        onAction={toggleSerial}
        active={serialOpen}
      >
        <Svg>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </Svg>
      </BarButton>
      <BarButton
        label={t('editor.touchBar.addPart', 'Add part')}
        onAction={onAddComponent}
        disabled={running}
      >
        <Svg>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      </BarButton>
    </div>
  );
};
