/**
 * Pinslim starts in German. The routing convention keeps English as the
 * unprefixed variant (`/editor`), so a visitor landing on an unprefixed URL
 * is moved to the German one (`/de/editor`) before the router mounts.
 *
 * The last locale the user was actually on is remembered in localStorage
 * (written by LocaleSync), so someone who deliberately switched to English
 * — or any other language — keeps it on the next visit. A dedicated key
 * rather than the shared `velxio_locale` cookie, because that cookie already
 * says "en" for everyone who used the app before German became the default.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { getLocaleFromPath, localizedPath, stripLocaleFromPath } from "./path";

export const START_LOCALE: Locale = "de";
const STORAGE_KEY = "pinslim_locale";

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage denied — the URL still carries the locale for this visit */
  }
}

function preferredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    /* fall through */
  }
  return START_LOCALE;
}

/** Rewrite an unprefixed URL to the preferred locale. Call before render. */
export function applyStartLocale(): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (getLocaleFromPath(pathname) !== DEFAULT_LOCALE) return;
  const target = preferredLocale();
  if (target === DEFAULT_LOCALE) return;
  const next = localizedPath(stripLocaleFromPath(pathname), target);
  window.history.replaceState(window.history.state, "", next + search + hash);
}
