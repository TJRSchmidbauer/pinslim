/** Visibility of the truth-table / timing-diagram panel (bottom dock). */
import { create } from 'zustand';

interface LogicTableState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const useLogicTableStore = create<LogicTableState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}));
