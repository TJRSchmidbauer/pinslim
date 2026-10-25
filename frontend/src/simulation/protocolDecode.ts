/**
 * Protocol decoders for the logic analyzer: UART, I²C and SPI.
 *
 * Input is what the oscilloscope store records — a list of
 * `{ timeMs, state }` samples per pin, one per level change. Everything here
 * is a pure function of those lists, so it is testable with synthetic
 * waveforms and runs on every repaint without touching the store.
 */

export interface PinSample {
  timeMs: number;
  state: boolean;
}

export type DecodedKind = 'start' | 'stop' | 'addr' | 'data' | 'error';

export interface DecodedItem {
  startMs: number;
  endMs: number;
  label: string;
  kind: DecodedKind;
  /** I²C: the byte was not acknowledged. */
  nack?: boolean;
}

const hex2 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

/** Level of a pin at time `t`; `idle` before the first recorded change. */
export function levelAt(samples: PinSample[], t: number, idle: boolean): boolean {
  let lo = 0;
  let hi = samples.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].timeMs <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found < 0 ? idle : samples[found].state;
}

/** Only the samples that actually change the level (a state can be re-reported). */
function edgesOf(samples: PinSample[], idle: boolean): PinSample[] {
  const out: PinSample[] = [];
  let prev = idle;
  for (const s of samples) {
    if (s.state !== prev) out.push(s);
    prev = s.state;
  }
  return out;
}

// ── UART ──────────────────────────────────────────────────────────────────

export const STANDARD_BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

/**
 * Estimate the baud rate from the shortest pulse (one bit time) and snap it to
 * the nearest standard rate when it is within 10 %.
 */
export function detectBaud(samples: PinSample[]): number | null {
  const edges = edgesOf(samples, true);
  let shortest = Infinity;
  for (let i = 1; i < edges.length; i++) {
    const d = edges[i].timeMs - edges[i - 1].timeMs;
    if (d > 0.0005 && d < shortest) shortest = d; // ignore glitches below 0.5 µs
  }
  if (!Number.isFinite(shortest)) return null;
  const raw = 1000 / shortest;
  const near = STANDARD_BAUDS.find((b) => Math.abs(b - raw) / b < 0.1);
  return near ?? Math.round(raw);
}

export interface UartOptions {
  baud: number;
  dataBits?: 5 | 6 | 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
}

function printable(code: number): string {
  if (code === 0x0a) return '↵';
  if (code === 0x0d) return '⏎';
  if (code === 0x20) return '␣';
  if (code > 0x20 && code < 0x7f) return String.fromCharCode(code);
  return '';
}

/** 8N1 (or the configured frame), LSB first, idle high. */
export function decodeUart(samples: PinSample[], opts: UartOptions): DecodedItem[] {
  const { baud, dataBits = 8, parity = 'none', stopBits = 1 } = opts;
  if (!(baud > 0)) return [];
  const T = 1000 / baud;
  const items: DecodedItem[] = [];
  const edges = edgesOf(samples, true);
  const frameBits = 1 + dataBits + (parity === 'none' ? 0 : 1) + stopBits;
  let notBefore = -Infinity;

  for (const e of edges) {
    if (e.state || e.timeMs < notBefore) continue; // start bit = falling edge
    const t0 = e.timeMs;
    let value = 0;
    let ones = 0;
    for (let b = 0; b < dataBits; b++) {
      const bit = levelAt(samples, t0 + (1.5 + b) * T, true);
      if (bit) {
        value |= 1 << b;
        ones++;
      }
    }
    let cursor = 1 + dataBits;
    let parityOk = true;
    if (parity !== 'none') {
      const p = levelAt(samples, t0 + (cursor + 0.5) * T, true);
      if (p) ones++;
      parityOk = parity === 'even' ? ones % 2 === 0 : ones % 2 === 1;
      cursor++;
    }
    const stopOk = levelAt(samples, t0 + (cursor + 0.5) * T, true);
    const endMs = t0 + frameBits * T;
    const chr = printable(value);
    const label = chr ? `${hex2(value)} '${chr}'` : hex2(value);
    if (!stopOk) items.push({ startMs: t0, endMs, label: `${label} ✗ Frame`, kind: 'error' });
    else if (!parityOk) items.push({ startMs: t0, endMs, label: `${label} ✗ Parity`, kind: 'error' });
    else items.push({ startMs: t0, endMs, label, kind: 'data' });
    notBefore = t0 + (frameBits - 0.5) * T;
  }
  return items;
}

// ── I²C ───────────────────────────────────────────────────────────────────

interface BusEvent {
  t: number;
  pin: 'sda' | 'scl';
  state: boolean;
}

/** START / repeated START / STOP and 8+ACK byte framing on SDA + SCL. */
export function decodeI2c(sda: PinSample[], scl: PinSample[]): DecodedItem[] {
  const events: BusEvent[] = [
    ...edgesOf(sda, true).map((s) => ({ t: s.timeMs, pin: 'sda' as const, state: s.state })),
    ...edgesOf(scl, true).map((s) => ({ t: s.timeMs, pin: 'scl' as const, state: s.state })),
  ].sort((a, b) => a.t - b.t || (a.pin === 'scl' ? -1 : 1));

  const items: DecodedItem[] = [];
  let sdaLevel = true;
  let sclLevel = true;
  let active = false;
  let bits = 0;
  let byte = 0;
  let byteStart = 0;
  let firstByte = true;

  for (const ev of events) {
    if (ev.pin === 'sda') {
      const was: boolean = sdaLevel;
      sdaLevel = ev.state;
      if (sclLevel && was !== sdaLevel) {
        if (!sdaLevel) {
          items.push({ startMs: ev.t, endMs: ev.t, label: active ? 'Sr' : 'S', kind: 'start' });
          active = true;
          bits = 0;
          byte = 0;
          firstByte = true;
        } else if (active) {
          items.push({ startMs: ev.t, endMs: ev.t, label: 'P', kind: 'stop' });
          active = false;
        }
      }
    } else {
      const rising = ev.state && !sclLevel;
      sclLevel = ev.state;
      if (!rising || !active) continue;
      if (bits < 8) {
        if (bits === 0) byteStart = ev.t;
        byte = (byte << 1) | (sdaLevel ? 1 : 0);
        bits++;
      } else {
        const nack = sdaLevel; // 9th clock: SDA low = ACK
        const bitMs = (ev.t - byteStart) / 8;
        const label = firstByte
          ? `${hex2(byte >> 1)} ${byte & 1 ? 'R' : 'W'}`
          : hex2(byte);
        items.push({
          startMs: byteStart,
          endMs: ev.t + bitMs,
          label: `${label} ${nack ? '✗' : '✓'}`,
          kind: firstByte ? 'addr' : 'data',
          nack,
        });
        firstByte = false;
        bits = 0;
        byte = 0;
      }
    }
  }
  return items;
}

// ── SPI ───────────────────────────────────────────────────────────────────

export type SpiMode = 0 | 1 | 2 | 3;

/**
 * MSB-first, 8 bits per word. `cs` is optional and active low; without it
 * every 8 clock edges form a byte. Samples on the rising SCK edge for modes 0
 * and 3 (CPOL = CPHA) and on the falling edge for modes 1 and 2.
 */
export function decodeSpi(
  sck: PinSample[],
  mosi: PinSample[],
  miso: PinSample[] | null,
  cs: PinSample[] | null,
  mode: SpiMode = 0,
): DecodedItem[] {
  const cpol = mode >> 1;
  const cpha = mode & 1;
  const sampleOnRising = cpol === cpha;
  const idle = cpol === 1;
  const items: DecodedItem[] = [];
  const csEdges = cs ? edgesOf(cs, true) : [];

  let bits = 0;
  let outByte = 0;
  let inByte = 0;
  let wordStart = 0;
  let lastEdge = 0;
  let period = 0;
  let prevCs = true;

  const edges = edgesOf(sck, idle);
  let csIdx = 0;
  for (const e of edges) {
    // Apply chip-select changes that happened before this clock edge.
    while (csIdx < csEdges.length && csEdges[csIdx].timeMs <= e.timeMs) {
      if (csEdges[csIdx].state !== prevCs) {
        bits = 0;
        outByte = 0;
        inByte = 0;
      }
      prevCs = csEdges[csIdx].state;
      csIdx++;
    }
    if (cs && prevCs) continue; // not selected
    if (lastEdge > 0) period = Math.max(period, e.timeMs - lastEdge);
    lastEdge = e.timeMs;
    if (e.state !== sampleOnRising) continue;
    if (bits === 0) wordStart = e.timeMs;
    outByte = (outByte << 1) | (levelAt(mosi, e.timeMs, false) ? 1 : 0);
    inByte = (inByte << 1) | (miso && levelAt(miso, e.timeMs, false) ? 1 : 0);
    bits++;
    if (bits === 8) {
      items.push({
        startMs: wordStart,
        endMs: e.timeMs + (period || 0),
        label: miso ? `${hex2(outByte)} ⇄ ${hex2(inByte)}` : hex2(outByte),
        kind: 'data',
      });
      bits = 0;
      outByte = 0;
      inByte = 0;
    }
  }
  return items;
}

/** One-line transcript for copying into notes: `S 0x3C W ✓ 0x00 ✓ P`. */
export function itemsToText(items: DecodedItem[]): string {
  return items.map((i) => i.label).join('  ');
}
