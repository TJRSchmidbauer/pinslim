/**
 * Touch-UI switch for components.
 *
 * Used to be a pure `(pointer: coarse)` media query. That guessed wrong both
 * ways (iPadOS Safari can report a fine pointer, touchscreen laptops a coarse
 * one), so it now reads the touch-mode setting (lib/touchMode): automatic by
 * default, overridable with the toggle next to light/dark. The names are kept
 * so every existing caller follows the setting.
 */
import { useSyncExternalStore } from 'react';
import { isTouchMode, subscribeTouchMode } from '../lib/touchMode';

/** Snapshot read for non-React call sites (event handlers, refs, module scope). */
export function isCoarsePointer(): boolean {
  return isTouchMode();
}

/** React hook — re-renders when touch mode is switched. */
export function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeTouchMode, isTouchMode, () => false);
}

/** Preferred name for new code. */
export const useTouchMode = useIsCoarsePointer;
