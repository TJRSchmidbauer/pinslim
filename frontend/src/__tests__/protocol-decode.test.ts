/**
 * UART / I²C / SPI decoding on synthetic waveforms, built the way a master or
 * transmitter would drive the pins.
 */
import { describe, it, expect } from 'vitest';
import {
  decodeI2c,
  decodeSpi,
  decodeUart,
  detectBaud,
  itemsToText,
  levelAt,
  type PinSample,
} from '../simulation/protocolDecode';

// ── waveform builders ──────────────────────────────────────────────────────
class Wave {
  samples: PinSample[] = [];
  level: boolean;
  constructor(idle: boolean) {
    this.level = idle;
  }
  set(t: number, state: boolean) {
    if (state !== this.level) {
      this.samples.push({ timeMs: t, state });
      this.level = state;
    }
  }
}

/** 8N1 bytes starting at t0 (ms), `gapBits` of idle between frames. */
function uart(bytes: number[], baud: number, t0 = 1, opts: { parity?: 'even' | 'odd'; badStop?: boolean } = {}) {
  const T = 1000 / baud;
  const w = new Wave(true);
  let t = t0;
  for (const b of bytes) {
    w.set(t, false); // start
    let ones = 0;
    for (let i = 0; i < 8; i++) {
      const bit = ((b >> i) & 1) === 1;
      if (bit) ones++;
      w.set(t + (1 + i) * T, bit);
    }
    let pos = 9;
    if (opts.parity) {
      const p = opts.parity === 'even' ? ones % 2 === 1 : ones % 2 === 0;
      w.set(t + pos * T, p);
      pos++;
    }
    w.set(t + pos * T, !opts.badStop); // stop
    t += (pos + 1) * T + T; // one bit of idle
    w.set(t - T / 2, true);
  }
  return w.samples;
}

function i2c(frames: { addr: number; read?: boolean; bytes: number[]; nackAt?: number }[], period = 0.01) {
  const sda = new Wave(true);
  const scl = new Wave(true);
  let t = 1;
  const q = period / 4;
  for (const f of frames) {
    // START: SDA falls while SCL high
    sda.set(t, false);
    t += q;
    scl.set(t, false);
    t += q;
    const bytes = [((f.addr << 1) | (f.read ? 1 : 0)) & 0xff, ...f.bytes];
    bytes.forEach((byte, idx) => {
      for (let i = 7; i >= 0; i--) {
        sda.set(t, ((byte >> i) & 1) === 1);
        t += q;
        scl.set(t, true);
        t += 2 * q;
        scl.set(t, false);
        t += q;
      }
      // ACK clock: slave pulls SDA low (or leaves it high for NACK)
      sda.set(t, f.nackAt === idx);
      t += q;
      scl.set(t, true);
      t += 2 * q;
      scl.set(t, false);
      t += q;
    });
    // STOP: SDA low, SCL rises, SDA rises
    sda.set(t, false);
    t += q;
    scl.set(t, true);
    t += q;
    sda.set(t, true);
    t += 4 * q;
  }
  return { sda: sda.samples, scl: scl.samples };
}

function spi(bytesOut: number[], bytesIn: number[], mode: 0 | 1 | 2 | 3 = 0, withCs = true) {
  const cpol = mode >> 1;
  const cpha = mode & 1;
  const sck = new Wave(cpol === 1);
  const mosi = new Wave(false);
  const miso = new Wave(false);
  const cs = new Wave(true);
  const half = 0.005;
  let t = 1;
  if (withCs) {
    cs.set(t, false);
    t += half;
  }
  bytesOut.forEach((out, k) => {
    for (let i = 7; i >= 0; i--) {
      const o = ((out >> i) & 1) === 1;
      const m = (((bytesIn[k] ?? 0) >> i) & 1) === 1;
      // CPHA 0: data valid before the first edge; CPHA 1: data changes on the first edge
      if (cpha === 0) {
        mosi.set(t, o);
        miso.set(t, m);
        t += half;
        sck.set(t, cpol === 0); // leading edge
        t += half;
        sck.set(t, cpol === 1); // trailing edge
      } else {
        sck.set(t, cpol === 0); // leading edge
        mosi.set(t, o);
        miso.set(t, m);
        t += half;
        sck.set(t, cpol === 1); // trailing edge
        t += half;
      }
    }
  });
  t += half;
  if (withCs) cs.set(t, true);
  return { sck: sck.samples, mosi: mosi.samples, miso: miso.samples, cs: cs.samples };
}

describe('levelAt', () => {
  const s: PinSample[] = [
    { timeMs: 1, state: false },
    { timeMs: 2, state: true },
  ];
  it('uses the idle level before the first change', () => {
    expect(levelAt(s, 0.5, true)).toBe(true);
    expect(levelAt(s, 1, true)).toBe(false);
    expect(levelAt(s, 1.5, true)).toBe(false);
    expect(levelAt(s, 99, true)).toBe(true);
  });
});

describe('UART', () => {
  it('decodes "Hi!" at 9600 baud', () => {
    const items = decodeUart(uart([0x48, 0x69, 0x21], 9600), { baud: 9600 });
    expect(items.map((i) => i.label)).toEqual(["0x48 'H'", "0x69 'i'", "0x21 '!'"]);
    expect(items.every((i) => i.kind === 'data')).toBe(true);
  });
  it('decodes at 115200 baud, including 0x00 and 0xFF', () => {
    const items = decodeUart(uart([0x00, 0xff, 0xaa], 115200), { baud: 115200 });
    expect(items.map((i) => i.label)).toEqual(['0x00', '0xFF', '0xAA']);
  });
  it('shows control characters readably', () => {
    const items = decodeUart(uart([0x0a, 0x20], 9600), { baud: 9600 });
    expect(items.map((i) => i.label)).toEqual(["0x0A '↵'", "0x20 '␣'"]);
  });
  it('flags a framing error (stop bit low)', () => {
    const items = decodeUart(uart([0x41], 9600, 1, { badStop: true }), { baud: 9600 });
    expect(items[0].kind).toBe('error');
    expect(items[0].label).toContain('Frame');
  });
  it('checks even parity', () => {
    const good = decodeUart(uart([0x41], 9600, 1, { parity: 'even' }), { baud: 9600, parity: 'even' });
    expect(good[0].kind).toBe('data');
    const bad = decodeUart(uart([0x41], 9600, 1, { parity: 'odd' }), { baud: 9600, parity: 'even' });
    expect(bad[0].label).toContain('Parity');
  });
  it('detects the baud rate', () => {
    expect(detectBaud(uart([0x48, 0x65, 0x6c, 0x6c, 0x6f], 9600))).toBe(9600);
    expect(detectBaud(uart([0x55], 115200))).toBe(115200);
    expect(detectBaud(uart([0x55], 57600))).toBe(57600);
    expect(detectBaud([])).toBeNull();
  });
  it('a wrong baud does not crash', () => {
    expect(() => decodeUart(uart([0x41], 9600), { baud: 0 })).not.toThrow();
    expect(decodeUart(uart([0x41], 9600), { baud: 0 })).toEqual([]);
  });
});

describe('I²C', () => {
  it('writes 0x00 0xAF to address 0x3C (SSD1306 style)', () => {
    const { sda, scl } = i2c([{ addr: 0x3c, bytes: [0x00, 0xaf] }]);
    const items = decodeI2c(sda, scl);
    expect(items.map((i) => i.label)).toEqual(['S', '0x3C W ✓', '0x00 ✓', '0xAF ✓', 'P']);
    expect(items.map((i) => i.kind)).toEqual(['start', 'addr', 'data', 'data', 'stop']);
  });
  it('reads from 0x68 and marks a NACK', () => {
    const { sda, scl } = i2c([{ addr: 0x68, read: true, bytes: [0x12], nackAt: 1 }]);
    const items = decodeI2c(sda, scl);
    expect(items.map((i) => i.label)).toEqual(['S', '0x68 R ✓', '0x12 ✗', 'P']);
    expect(items[2].nack).toBe(true);
  });
  it('a NACKed address is reported', () => {
    const { sda, scl } = i2c([{ addr: 0x77, bytes: [], nackAt: 0 }]);
    expect(decodeI2c(sda, scl)[1].label).toBe('0x77 W ✗');
  });
  it('two transactions', () => {
    const { sda, scl } = i2c([
      { addr: 0x27, bytes: [0x08] },
      { addr: 0x27, bytes: [0x0c] },
    ]);
    const t = itemsToText(decodeI2c(sda, scl));
    expect(t).toBe('S  0x27 W ✓  0x08 ✓  P  S  0x27 W ✓  0x0C ✓  P');
  });
  it('silence decodes to nothing', () => {
    expect(decodeI2c([], [])).toEqual([]);
  });
});

describe('SPI', () => {
  it('mode 0 with chip select: MOSI and MISO bytes', () => {
    const w = spi([0x9f, 0x00, 0x00], [0x00, 0xef, 0x40], 0);
    const items = decodeSpi(w.sck, w.mosi, w.miso, w.cs, 0);
    expect(items.map((i) => i.label)).toEqual(['0x9F ⇄ 0x00', '0x00 ⇄ 0xEF', '0x00 ⇄ 0x40']);
  });
  it('all four modes decode the same bytes', () => {
    for (const mode of [0, 1, 2, 3] as const) {
      const w = spi([0xa5, 0x3c], [0x5a, 0xc3], mode);
      const items = decodeSpi(w.sck, w.mosi, w.miso, w.cs, mode);
      expect(items.map((i) => i.label), `mode ${mode}`).toEqual(['0xA5 ⇄ 0x5A', '0x3C ⇄ 0xC3']);
    }
  });
  it('works without MISO and without chip select', () => {
    const w = spi([0x12, 0x34], [], 0, false);
    const items = decodeSpi(w.sck, w.mosi, null, null, 0);
    expect(items.map((i) => i.label)).toEqual(['0x12', '0x34']);
  });
  it('ignores clock edges while chip select is high', () => {
    const w = spi([0xff], [0xff], 0);
    // a stray clock burst after CS went high
    const last = w.cs[w.cs.length - 1].timeMs;
    const stray: PinSample[] = [];
    for (let i = 0; i < 16; i++) stray.push({ timeMs: last + 0.1 + i * 0.01, state: i % 2 === 0 });
    const items = decodeSpi([...w.sck, ...stray], w.mosi, w.miso, w.cs, 0);
    expect(items).toHaveLength(1);
  });
});
