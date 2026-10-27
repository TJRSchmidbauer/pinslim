/**
 * School-network guarantees: the app starts and runs MicroPython without
 * reaching out to third parties.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEsp32Firmware } from '../simulation/Esp32MicroPythonLoader';
import { getFirmware } from '../simulation/MicroPythonLoader';

afterEach(() => vi.unstubAllGlobals());

const bytes = (n: number) => new Uint8Array(n).fill(7).buffer;

function stubFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(String(url));
    return handler(String(url));
  });
  return calls;
}

describe('MicroPython firmware comes from the bundled copy first', () => {
  it('ESP32: no request leaves the site when the bundled file is there', async () => {
    const calls = stubFetch(() => new Response(bytes(200_000), { headers: { 'content-type': 'application/octet-stream' } }));
    const fw = await getEsp32Firmware('esp32-s3');
    expect(fw.length).toBe(200_000);
    expect(calls).toEqual(['/firmware/micropython-esp32s3.bin']);
  });

  it('Pico: same', async () => {
    const calls = stubFetch(() => new Response(bytes(300_000), { headers: { 'content-type': 'application/octet-stream' } }));
    const fw = await getFirmware('pico');
    expect(fw.length).toBe(300_000);
    expect(calls.every((u) => u.startsWith('/'))).toBe(true);
    expect(calls.some((u) => u.includes('micropython.org'))).toBe(false);
  });

  it('a single-page-app answer (index.html with status 200) is not taken for firmware', async () => {
    const calls = stubFetch((url) =>
      url.startsWith('/firmware/')
        ? new Response('<!doctype html><title>app</title>', { headers: { 'content-type': 'text/html' } })
        : new Response(bytes(250_000)),
    );
    const fw = await getEsp32Firmware('esp32-c6');
    expect(fw.length).toBe(250_000);
    expect(calls[0]).toBe('/firmware/micropython-esp32c6.bin');
    expect(calls.some((u) => u.includes('micropython.org'))).toBe(true); // only now the download
  });
});

describe('index.html loads nothing from third parties', () => {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf-8');

  it('no external scripts, stylesheets, fonts or connection hints', () => {
    const tags = [...html.matchAll(/<(script|link)\b[^>]*>/gi)].map((m) => m[0]);
    const external = tags.filter((t) => {
      const url = /(?:src|href)="(https?:\/\/[^"]+)"/i.exec(t)?.[1];
      if (!url) return false;
      // canonical / alternate / social-card URLs are metadata, not requests
      return !/rel="(canonical|alternate|author|license)"/i.test(t);
    });
    expect(external).toEqual([]);
  });

  it('the analytics tag stays gated to velxio.dev hostnames', () => {
    expect(html).toMatch(/h !== 'velxio\.dev'/);
  });
});
