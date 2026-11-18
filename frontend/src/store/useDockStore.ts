import { create } from 'zustand';

/**
 * Whether the "Meldungen" (compiler messages) tab of the bottom dock is open.
 * A store instead of EditorPage state because two places need it: the toolbar
 * (auto-opens it on a failed build) and the canvas header (its toggle button).
 */
interface DockState {
  messagesOpen: boolean;
  setMessagesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const useDockStore = create<DockState>((set) => ({
  messagesOpen: false,
  setMessagesOpen: (v) =>
    set((s) => ({ messagesOpen: typeof v === 'function' ? v(s.messagesOpen) : v })),
}));
