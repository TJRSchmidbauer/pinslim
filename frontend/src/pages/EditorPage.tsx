/**
 * Editor Page — main editor + simulator with resizable panels
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { startSimulation } from '../simulation/spice/start';
import { useSEO } from '../utils/useSEO';
import { getLocaleFromPath, localizedPath } from '../i18n/path';
import { restoreStashedWorkspace } from '../utils/workspaceDraft';
import { CodeEditor } from '../components/editor/CodeEditor';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { FileExplorer } from '../components/editor/FileExplorer';

// Lazy-load Pi workspace so xterm.js isn't in the main bundle
import { CompilationConsole } from '../components/editor/CompilationConsole';
import { SimulatorCanvas } from '../components/simulator/SimulatorCanvas';
import { SerialMonitor } from '../components/simulator/SerialMonitor';
import { Oscilloscope } from '../components/simulator/Oscilloscope';
import { LogicTablePanel } from '../components/simulator/LogicTablePanel';
import { useLogicTableStore } from '../store/useLogicTableStore';
import { useDockStore } from '../store/useDockStore';
import { AppHeader } from '../components/layout/AppHeader';
import { triggerSaveAction } from '../lib/proSaveAction';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { useEditorStore } from '../store/useEditorStore';
import { useCompileLogsStore } from '../store/useCompileLogsStore';
import { useOscilloscopeStore } from '../store/useOscilloscopeStore';
import { useProjectStore } from '../store/useProjectStore';
import {
  NewProjectDialog,
  clearWorkspaceForStarter,
} from '../components/editor/NewProjectDialog';
import { useAutoSaveProject } from '../hooks/useAutoSaveProject';
import { registerEditorCommand } from '../lib/editorCommands';
import { EditorMenuBar } from '../components/editor/EditorMenuBar';
import { useTouchMode } from '../utils/useTouchDevice';
import '../App.css';

// Tab layout (Code | Circuit) instead of side-by-side panes: phones, and — in
// touch mode — tablets held upright: at 810 px a portrait iPad squeezed
// explorer, code and circuit into three narrow columns. The layout CSS keys
// off `html.layout-tabs` (set below) besides its own phone media query.
const PHONE_QUERY = '(max-width: 768px)';
const TABLET_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 1100px)';

/** Re-render on a media query change. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const BOTTOM_PANEL_MIN = 80;
const BOTTOM_PANEL_MAX = 600;
const BOTTOM_PANEL_DEFAULT = 200;
/** Roomier start height for the bottom panels on tall screens (a scope needs its traces). */
const bottomPanelStart = () =>
  typeof window === 'undefined'
    ? BOTTOM_PANEL_DEFAULT
    : Math.round(Math.min(340, Math.max(BOTTOM_PANEL_DEFAULT, window.innerHeight * 0.32)));

const EXPLORER_MIN = 100;
const EXPLORER_MAX = 500;
// Narrow by default: the explorer rows are compact and both headers stack
// their actions ABOVE their label instead of beside it (see
// FileExplorer.css), so nothing has to share a line — 124px fits a board
// name and typical file names, and every px saved here goes to the code
// editor.
const EXPLORER_DEFAULT = 124;

// Once per full page load: the pristine-visit starter dialog must not pop
// again when the user closes it and later navigates away from and back to
// /editor within the same SPA session.
let starterDialogShownThisLoad = false;

const resizeHandleStyle: React.CSSProperties = {
  height: 5,
  flexShrink: 0,
  cursor: 'row-resize',
  background: 'var(--wb-5)',
  borderTop: '1px solid var(--wb-7)',
  borderBottom: '1px solid var(--wb-7)',
};

export const EditorPage: React.FC = () => {
  const { t } = useTranslation();
  useSEO({
    title: 'Pinslim',
    description:
      'Write, compile and simulate Arduino, ESP32, Raspberry Pi Pico, ESP32-C3, and Raspberry Pi 3 code in your browser. 19 boards, 5 CPU architectures, 48+ components. Free and open-source.',
    url: 'https://velxio.dev/editor',
  });

  // Silent auto-save for the loaded project (only fires when authed AND
  // currentProject has a UUID — see useAutoSaveProject for the gating rules).
  const autoSave = useAutoSaveProject();

  const [editorWidthPct, setEditorWidthPct] = useState(45);
  // Desktop-only 3-way layout switch (code-only / circuit-only / both).
  // Lets users hide a pane to give the right-docked chat more room.
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const explorerOpen = useEditorStore((s) => s.explorerOpen);
  const setExplorerOpen = useEditorStore((s) => s.setExplorerOpen);
  const toggleExplorer = useEditorStore((s) => s.toggleExplorer);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const serialMonitorOpen = useSimulatorStore((s) => s.serialMonitorOpen);
  const oscilloscopeOpen = useOscilloscopeStore((s) => s.open);
  const logicTableOpen = useLogicTableStore((s) => s.open);

  // ── Bottom dock ───────────────────────────────────────────────────────────
  // Serial monitor, oscilloscope and truth table used to stack under the
  // circuit, each with its own height, so opening two squeezed the circuit
  // and cut the lower one off. They now share ONE dock with tabs; the tab
  // that was opened last is the one shown. All open panes stay mounted (data
  // keeps flowing into the scope while the serial tab is in front).
  type DockKey = 'messages' | 'serial' | 'scope' | 'logic';
  const DOCK_ORDER: DockKey[] = ['messages', 'serial', 'scope', 'logic'];
  const consoleOpen = useDockStore((s) => s.messagesOpen);
  const setConsoleOpen = useDockStore((s) => s.setMessagesOpen);
  const [dockActive, setDockActive] = useState<DockKey | null>(null);
  const toggleSerial = useSimulatorStore((s) => s.toggleSerialMonitor);
  const toggleScope = useOscilloscopeStore((s) => s.toggleOscilloscope);
  const setLogicOpen = useLogicTableStore((s) => s.setOpen);
  const dockOpen: Record<DockKey, boolean> = {
    messages: consoleOpen,
    serial: serialMonitorOpen,
    scope: oscilloscopeOpen,
    logic: logicTableOpen,
  };
  const dockKeys = DOCK_ORDER.filter((k) => dockOpen[k]);
  // Newest-opened wins. Done while rendering (compare with the previous
  // flags) instead of in an effect, so there is no extra render pass.
  const [prevDockOpen, setPrevDockOpen] = useState(dockOpen);
  if (DOCK_ORDER.some((k) => prevDockOpen[k] !== dockOpen[k])) {
    setPrevDockOpen(dockOpen);
    const justOpened = DOCK_ORDER.find((k) => dockOpen[k] && !prevDockOpen[k]);
    if (justOpened) setDockActive(justOpened);
  }
  const shownDock: DockKey | null =
    dockActive && dockOpen[dockActive] ? dockActive : (dockKeys[0] ?? null);
  // compileLogs live in a Zustand store so the velxio-pro agent overlay
  // (mounted in a separate React tree via slotMounter) can subscribe and
  // build a "diagnose this failure" prompt without prop-drilling.
  const compileLogs = useCompileLogsStore((s) => s.logs);
  const setCompileLogs = useCompileLogsStore((s) => s.setLogs);
  // One dock for messages, serial monitor, oscilloscope and truth table.
  const [dockHeight, setDockHeight] = useState(bottomPanelStart);

  // ── Electrical simulation (one-time mount) ────────────────────────────────
  // `startSimulation()` is the single entry point: it constructs the
  // CircuitSimulationService, mounts the ADC bridge, and subscribes
  // PinManager → service.handleMcuEdge.  No more legacy paths — the
  // WASM ngspice (via NgSpiceWorkerAdapter) is the only solver.
  useEffect(() => {
    return startSimulation();
  }, []);

  // Restore an in-progress workspace stashed before a login redirect, so a
  // user who was building something and signed in lands back on their circuit
  // (not the empty starter board). One-shot; see utils/workspaceDraft.
  useEffect(() => {
    restoreStashedWorkspace();
  }, []);

  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

  // Pristine-visit starter dialog: a bare /editor landing still holds the
  // hardcoded Uno + LED starter (see useSimulatorStore INITIAL_BOARD /
  // builtin components). Clear it and offer the template picker over an
  // EMPTY canvas instead of silently dropping the user into the Arduino
  // blink (cancelling the dialog leaves a blank workspace). Guarded so it
  // never fires over a loaded project/example URL, a restored login draft
  // (both leave the stores non-pristine), or twice per page load. Declared
  // AFTER the restoreStashedWorkspace effect — mount order is what makes
  // the pristine check see the restored draft.
  useEffect(() => {
    if (starterDialogShownThisLoad) return;
    const locale = getLocaleFromPath(window.location.pathname);
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const edPath = localizedPath('/editor', locale);
    const rootPath = localizedPath('/', locale);
    if (currentPath !== edPath && currentPath !== rootPath && currentPath !== '') return;
    if (window.location.search) return;
    if (useProjectStore.getState().currentProject) return;
    const sim = useSimulatorStore.getState();
    const pristine =
      sim.boards.length === 1 &&
      sim.boards[0].id === 'arduino-uno' &&
      sim.components.length === 2 &&
      sim.components.every((c) => c.id === 'led_builtin' || c.id === 'r_builtin');
    if (!pristine) return;
    starterDialogShownThisLoad = true;
    clearWorkspaceForStarter();
    setShowNewProjectDialog(true);
  }, []);

  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_DEFAULT);
  // Phones proper. A portrait tablet uses the tab layout too but has the
  // width for the File/Edit/View menu bar, which phones swap for a hamburger.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isTabletPortrait = useMediaQuery(TABLET_PORTRAIT_QUERY);
  const touchMode = useTouchMode();
  const isMobile = isPhone || (touchMode && isTabletPortrait);
  useEffect(() => {
    document.documentElement.classList.toggle('layout-tabs', isMobile);
    return () => document.documentElement.classList.remove('layout-tabs');
  }, [isMobile]);
  // Slot element for SimulatorCanvas to portal its header into. When set, the
  // canvas board selector / Serial / Scope / zoom / Add buttons render here
  // instead of above the canvas — keeping the top bar a single full-width row
  // that doesn't reflow when the editor/canvas splitter is dragged.
  const [canvasHeaderSlot, setCanvasHeaderSlot] = useState<HTMLDivElement | null>(null);
  // Default to 'code' on mobile — show the editor so users can write/view code
  const [mobileView, setMobileView] = useState<'code' | 'circuit'>('code');

  // Save is dispatched to the pro overlay, which inspects auth state and
  // shows the right modal (Save vs Login prompt). In OSS without the
  // overlay this is a no-op today and becomes the .vlx Export entry
  // point in Phase 4 of the OSS split.
  const handleSaveClick = useCallback(() => {
    triggerSaveAction();
  }, []);

  // "New workspace" opens the starter-template dialog. Destruction moved
  // from here into the dialog's selection handler — Cancel/ESC now leaves
  // the current workspace untouched, so the old confirm dialog is gone.
  const handleNewClick = useCallback(() => {
    setShowNewProjectDialog(true);
  }, []);

  // The tab layout and touch mode start with the file explorer folded away: on
  // a 10" screen it took a fifth of the width from code and circuit, and the
  // projects used in class have a single sketch. The explorer button brings
  // it back.
  useEffect(() => {
    if (isMobile || touchMode) setExplorerOpen(false);
  }, [isMobile, touchMode, setExplorerOpen]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveClick]);

  // File-menu commands owned by this page. Registered here (not in the
  // menu) so the menu never duplicates the confirm-dialog / autosave logic.
  useEffect(() => {
    const offSave = registerEditorCommand('project.save', handleSaveClick);
    const offNew = registerEditorCommand('project.new', () => {
      void handleNewClick();
    });
    const offExplorer = registerEditorCommand('view.toggleExplorer', () => toggleExplorer());
    return () => {
      offSave();
      offNew();
      offExplorer();
    };
  }, [handleSaveClick, handleNewClick, toggleExplorer]);

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — canvas undo/redo. Skipped when the
  // user is typing in any input/textarea/contenteditable so the Monaco
  // editor's per-file history (and the AI chat composer, etc.) keep
  // working untouched.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          return;
        }
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const sim = useSimulatorStore.getState();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        sim.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        sim.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll on the editor page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = '';
      body.style.overflow = '';
    };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current || !containerRef.current) return;
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();
      // The panels' percentage widths resolve against the container's CONTENT
      // box, but getBoundingClientRect() returns the border box — and overlays
      // may reserve space by padding .app-container (e.g. a docked side panel).
      // Measuring against the padded box makes the handle jump away from the
      // cursor, so strip borders and padding first.
      const cs = getComputedStyle(el);
      const padLeft = parseFloat(cs.paddingLeft) || 0;
      const padRight = parseFloat(cs.paddingRight) || 0;
      const contentLeft = rect.left + el.clientLeft + padLeft;
      const contentWidth = el.clientWidth - padLeft - padRight;
      if (contentWidth <= 0) return;
      const pct = ((ev.clientX - contentLeft) / contentWidth) * 100;
      setEditorWidthPct(Math.max(20, Math.min(80, pct)));
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleBottomPanelResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = dockHeight;

      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        setDockHeight(Math.max(BOTTOM_PANEL_MIN, Math.min(BOTTOM_PANEL_MAX, startHeight + delta)));
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [dockHeight],
  );

  const handleExplorerResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = explorerWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        setExplorerWidth(Math.max(EXPLORER_MIN, Math.min(EXPLORER_MAX, startWidth + delta)));
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [explorerWidth],
  );

  /* ── Unified toolbar (desktop) ──
     Editor controls + canvas controls in one strip; the canvas side is
     portaled into `canvasHeaderSlot` from SimulatorCanvas. Since the
     marketing nav left the editor header, the header's middle is empty
     space — so this strip now rides INSIDE the AppHeader row (via the
     editorToolbar prop) instead of being a second bar: one 44px row where
     there used to be 44+38. On narrow widths the strip wraps internally
     and the header grows; the docked AI chat is avoided by the same
     padding-right the strip always had. */
  /* Account block. Fused as the explorer panel's footer so a long file
     tree scrolls ABOVE it instead of disappearing underneath a floating
     box; when the explorer is collapsed it falls back to the small fixed
     corner box (avatar only there — no room for a name). */
  const accountBlock = !isMobile ? (
    // Just the account button. Language lives in the menubar's Language
    // menu (for everyone) and inside the account menu (for signed-in
    // users) — the standalone globe crowded the footer for no gain.
    <div data-velxio-slot="header-auth" style={{ display: 'contents' }} />
  ) : undefined;

  const unifiedToolbar = !isMobile ? (
        <div className="unified-toolbar">
          {/* View-mode toggle: explorer | Code / Both / Circuit — one
              segmented group so the four pane switches read as one control.
              Hidden on mobile — there's already a code/circuit toggle in
              the mobile bottom-nav. */}
          <div
            role="group"
            aria-label={t('editor.shell.viewMode')}
            className="view-mode-toggle"
            style={{
              // display comes from App.css (flex; none on a narrow bar or mobile).
              // Never squeezed below its buttons: flexbox used to crush
              // this block to a third of its width and clip two of them.
              flexShrink: 0,
              gap: 8,
              alignSelf: 'center',
              margin: '0 6px',
            }}
          >
            <button
              onClick={() => toggleExplorer()}
              aria-pressed={explorerOpen}
              title={explorerOpen ? t('editor.menu.hideExplorer', 'Hide file explorer') : t('editor.menu.showExplorer', 'Show file explorer')}
              style={{
                background: explorerOpen ? 'var(--wb-2)' : 'transparent',
                color: explorerOpen ? 'var(--wb-13)' : 'var(--wb-11)',
                boxShadow: explorerOpen ? 'inset 0 -2px 0 var(--brand-ziegel)' : 'none',
                border: '1px solid var(--wb-7)',
                borderRadius: 4,
                height: 28,
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            {/* The three view modes are one segmented control; the file-explorer
                toggle next to it is a different kind of switch, so it stands apart. */}
            <div
              className="view-mode-seg"
              style={{
                display: 'flex',
                gap: 1,
                background: 'var(--wb-3)',
                border: '1px solid var(--wb-7)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
            {(
              [
                { key: 'code', label: t('editor.shell.code'), path: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
                { key: 'both', label: t('editor.shell.both'), path: 'M3 3h7v18H3zM14 3h7v18h-7z' },
                { key: 'circuit', label: t('editor.shell.circuit'), path: 'M9 9h6v6H9zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setViewMode(m.key)}
                aria-pressed={viewMode === m.key}
                style={{
                  // Selected = the shared "on" look (light bed, ink text, Ziegel
                  // underline); only Start is a filled colour button.
                  background: viewMode === m.key ? 'var(--wb-2)' : 'transparent',
                  color: viewMode === m.key ? 'var(--wb-13)' : 'var(--wb-11)',
                  fontWeight: viewMode === m.key ? 700 : 400,
                  boxShadow: viewMode === m.key ? 'inset 0 -2px 0 var(--brand-ziegel)' : 'none',
                  border: 'none',
                  height: 28,
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={m.path} />
                </svg>
                <span className="vm-label">{m.label}</span>
              </button>
            ))}
            </div>
          </div>
          <div className="unified-toolbar-editor">
            <EditorToolbar
              consoleOpen={consoleOpen}
              setConsoleOpen={setConsoleOpen}
              compileLogs={compileLogs}
              setCompileLogs={setCompileLogs}
            />
          </div>
          <div className="unified-toolbar-canvas" ref={setCanvasHeaderSlot} />
        </div>
  ) : undefined;

  // Where the dock lives: under the circuit, except when only the code is on
  // screen (code view; the phone's code tab) — then under the editor, so a
  // compile error is never hidden behind a collapsed circuit pane.
  const dockInEditor = (!isMobile && viewMode === 'code') || (isMobile && mobileView === 'code');
  const compileErrorTotal = compileLogs.filter((l) => l.type === 'error').length;
  const dockLabel = (k: DockKey) =>
    k === 'messages'
      ? t('editor.console.title', 'Meldungen')
      : k === 'serial'
        ? t('editor.shell.dockSerial', 'Serieller Monitor')
        : k === 'scope'
          ? t('editor.shell.dockScope', 'Oszilloskop')
          : t('editor.shell.dockLogic', 'Wahrheitstabelle');
  const closeDockTab = (k: DockKey) => {
    if (k === 'messages') setConsoleOpen(false);
    else if (k === 'serial') toggleSerial();
    else if (k === 'scope') toggleScope();
    else setLogicOpen(false);
  };
  const dockJsx =
    dockKeys.length === 0 ? null : (
      <>
        <div
          onMouseDown={handleBottomPanelResizeMouseDown}
          style={resizeHandleStyle}
          title={t('editor.shell.dragResize')}
        />
        <div className="bottom-dock" style={{ height: dockHeight, flexShrink: 0 }}>
          <div className="bottom-dock-tabs" role="tablist">
            {dockKeys.map((k) => (
              <div key={k} className={`bottom-dock-tab${shownDock === k ? ' is-active' : ''}`}>
                <button
                  role="tab"
                  aria-selected={shownDock === k}
                  className="bottom-dock-tab-label"
                  onClick={() => setDockActive(k)}
                >
                  {dockLabel(k)}
                  {k === 'messages' && compileErrorTotal > 0 && (
                    <span className="bottom-dock-badge">✕ {compileErrorTotal}</span>
                  )}
                </button>
                <button
                  className="bottom-dock-tab-close"
                  aria-label={`${dockLabel(k)}: ${t('editor.shell.dockClose', 'Schließen')}`}
                  title={t('editor.shell.dockClose', 'Schließen')}
                  onClick={() => closeDockTab(k)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="bottom-dock-body">
            {consoleOpen && (
              <div className="bottom-dock-pane" hidden={shownDock !== 'messages'}>
                <CompilationConsole
                  embedded
                  isOpen={consoleOpen}
                  onClose={() => setConsoleOpen(false)}
                  logs={compileLogs}
                  onClear={() => setCompileLogs([])}
                />
              </div>
            )}
            {serialMonitorOpen && (
              <div className="bottom-dock-pane" hidden={shownDock !== 'serial'}>
                <SerialMonitor />
              </div>
            )}
            {oscilloscopeOpen && (
              <div className="bottom-dock-pane" hidden={shownDock !== 'scope'}>
                <Oscilloscope />
              </div>
            )}
            {logicTableOpen && (
              <div className="bottom-dock-pane" hidden={shownDock !== 'logic'}>
                <LogicTablePanel />
              </div>
            )}
          </div>
        </div>
      </>
    );

  return (
    <div className="app">
      <AppHeader
        editorMenu={!isPhone ? <EditorMenuBar /> : undefined}
        editorToolbar={unifiedToolbar}
      />

      {/* ── Mobile tab bar (top, above panels) ── */}
      {isMobile && (
        <nav className="mobile-tab-bar">
          <button
            className={`mobile-tab-btn${mobileView === 'code' ? ' mobile-tab-btn--active' : ''}`}
            onClick={() => setMobileView('code')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>{t('editor.shell.code')}</span>
          </button>
          <button
            className={`mobile-tab-btn${mobileView === 'circuit' ? ' mobile-tab-btn--active' : ''}`}
            onClick={() => setMobileView('circuit')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
            <span>{t('editor.shell.circuit')}</span>
          </button>
        </nav>
      )}


      <div className="app-container" ref={containerRef}>
        {/* ── Editor side ── */}
        <div
          className="editor-panel"
          style={{
            width: isMobile
              ? '100%'
              : viewMode === 'code'
              ? '100%'
              : viewMode === 'circuit'
              ? '0%'
              : `${editorWidthPct}%`,
            display:
              (isMobile && mobileView !== 'code') || (!isMobile && viewMode === 'circuit')
                ? 'none'
                : 'flex',
            flexDirection: 'row',
          }}
        >
          {/* File explorer sidebar + resize handle */}
          {explorerOpen && (
            <>
              <div
                style={{
                  width: explorerWidth,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                  <FileExplorer onSaveClick={handleSaveClick} onNewClick={handleNewClick} autoSave={autoSave} />
                </div>
                {accountBlock && (
                  <div className="explorer-account-footer">{accountBlock}</div>
                )}
              </div>
              {!isMobile && (
                <div
                  className="explorer-resize-handle"
                  onMouseDown={handleExplorerResizeMouseDown}
                />
              )}
            </>
          )}

          {!explorerOpen && accountBlock && (
            <div className="editor-corner-box">{accountBlock}</div>
          )}

          {/* Editor main area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* Mobile-only: explorer toggle + editor toolbar inside the panel.
                On desktop these are hoisted into the unified top toolbar. */}
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
                <button
                  className="explorer-toggle-btn"
                  onClick={() => toggleExplorer()}
                  title={explorerOpen ? t('editor.menu.hideExplorer', 'Hide file explorer') : t('editor.menu.showExplorer', 'Show file explorer')}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <EditorToolbar
                    consoleOpen={consoleOpen}
                    setConsoleOpen={setConsoleOpen}
                    compileLogs={compileLogs}
                    setCompileLogs={setCompileLogs}
                  />
                </div>
              </div>
            )}

            {/* Editor area — Monaco for every board, QEMU-Linux included.
                Pi boards edit script.py here like any other board edits its
                sketch; their interactive terminal lives in the bottom serial
                panel (SerialMonitor renders an xterm for Pi kinds). The old
                RaspberryPiWorkspace (own file tree + own editor + upload
                button) confused users with three competing file surfaces. */}
            <div className="editor-wrapper" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <CodeEditor />
            </div>

            {/* Code-only (and the phone's code tab): the dock sits under the editor. */}
            {dockInEditor && dockJsx}
          </div>
        </div>

        {/* Resize handle (desktop only, and only when both panes are visible) */}
        {!isMobile && viewMode === 'both' && (
          <div className="resize-handle" onMouseDown={handleResizeMouseDown}>
            <div className="resize-handle-grip" />
          </div>
        )}

        {/* ── Simulator side ── */}
        <div
          className="simulator-panel"
          style={{
            width: isMobile
              ? '100%'
              : viewMode === 'circuit'
              ? '100%'
              : viewMode === 'code'
              ? '0%'
              : `${100 - editorWidthPct}%`,
            display:
              (isMobile && mobileView !== 'circuit') || (!isMobile && viewMode === 'code')
                ? 'none'
                : 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            <SimulatorCanvas headerSlot={!isMobile ? canvasHeaderSlot : null} />
          </div>
          {!dockInEditor && dockJsx}
        </div>
      </div>

      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
      />
      {/* Slot reserved for the private pro overlay (e.g. agent chat panel).
          Self-hosted builds without an overlay see nothing here. */}
      <div data-velxio-slot="agent-chat" />
    </div>
  );
};
