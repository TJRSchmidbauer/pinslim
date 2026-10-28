/**
 * Touch mode — big controls, tap-to-select, finger wiring, symbol row.
 *
 * Detecting a tablet is unreliable (iPadOS Safari reports itself as a Mac,
 * touchscreen laptops report a fine pointer, a tablet with a keyboard case and
 * trackpad is both), so touch mode is a user setting with an automatic
 * default, switched like light/dark:
 *
 *   key    'pinslim-touch'
 *   value  'on' | 'off'        explicit choice
 *   unset  → on when the primary pointer is coarse (finger), else off
 *
 * The resolved value lands on `<html data-touch="on|off">`; the touch styles
 * key off that attribute, the components off `useTouchMode()`.
 */

export type TouchPreference = 'on' | 'off';

export const TOUCH_STORAGE_KEY = 'pinslim-touch';
const COARSE_QUERY = '(pointer: coarse)';

function readPref(): TouchPreference | null {
  try {
    const v = localStorage.getItem(TOUCH_STORAGE_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

function detected(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COARSE_QUERY).matches;
}

let current: boolean = typeof window === 'undefined' ? false : (readPref() ?? (detected() ? 'on' : 'off')) === 'on';
const listeners = new Set<() => void>();

function apply(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.touch = current ? 'on' : 'off';
  }
  for (const l of listeners) l();
}

/** Whether touch mode is active right now. */
export function isTouchMode(): boolean {
  return current;
}

/** Switch touch mode on/off and remember the choice. */
export function setTouchMode(on: boolean): void {
  current = on;
  try {
    localStorage.setItem(TOUCH_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: still applies for this session */
  }
  apply();
}

export function subscribeTouchMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Put the attribute on <html> at startup, and follow the device if the user
 *  never chose (e.g. a keyboard case with a trackpad is attached later). */
export function initTouchMode(): void {
  if (typeof window === 'undefined') return;
  apply();
  if (typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia(COARSE_QUERY);
  const follow = () => {
    if (readPref() !== null) return;
    current = mq.matches;
    apply();
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', follow);
}
