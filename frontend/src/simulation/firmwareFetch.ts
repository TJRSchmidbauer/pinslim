/**
 * Firmware files that ship with the app (public/firmware/*) are the first
 * choice: they work without Internet and without telling a third party which
 * board a student opened. The download from micropython.org is only the
 * fallback when a file is missing.
 */

/** Smallest plausible MicroPython image; anything smaller is an error page. */
const MIN_FIRMWARE_BYTES = 100_000;

/**
 * Fetch a bundled firmware file. Returns null when it is not there — note a
 * single-page-app server answers a missing file with index.html and status
 * 200, so the content is checked, not just the status.
 */
export async function fetchBundledFirmware(path: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    if ((response.headers.get('content-type') ?? '').includes('text/html')) return null;
    const data = new Uint8Array(await response.arrayBuffer());
    return data.length >= MIN_FIRMWARE_BYTES ? data : null;
  } catch {
    return null;
  }
}
