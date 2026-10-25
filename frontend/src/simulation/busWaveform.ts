/**
 * Wire-level waveforms for hardware I²C and SPI peripherals.
 *
 * The AVR / RP2040 peripherals are emulated at the byte level, so no pin ever
 * moves when a sketch calls `Wire.write()` or `SPI.transfer()`. The logic
 * analyzer would show flat lines. These synthesizers turn the byte-level
 * events into the SDA/SCL and SCK/MOSI/MISO edges a real bus would show, at
 * the peripheral's configured clock, so the protocol decoders have something
 * to read — the same idea as `emitUartTxFrame` for the serial port.
 *
 * Pure and time-based (milliseconds): the caller maps lines to pins and feeds
 * the edges to the scope.
 */

export type BusLine = 'sda' | 'scl' | 'sck' | 'mosi' | 'miso';

export interface BusEdge {
  line: BusLine;
  state: boolean;
  timeMs: number;
}

/** Byte-level I²C master events (what the TWI peripheral reports). */
export type I2cEvent =
  | { type: 'start'; repeated: boolean }
  | { type: 'stop' }
  | { type: 'address'; addr: number; write: boolean; ack: boolean }
  | { type: 'write'; value: number; ack: boolean }
  | { type: 'read'; value: number; ack: boolean };

/**
 * I²C: one bit cell = one SCL period. SDA changes while SCL is low, SCL is
 * high in the middle of the cell; START/STOP are SDA edges while SCL is high.
 */
export class I2cWaveform {
  private sda = true;
  private scl = true;
  private cursorMs = 0;
  private seeded = false;

  /** Edges for one event. `nowMs` is the simulator time the event happened at. */
  event(e: I2cEvent, nowMs: number, sclHz: number): BusEdge[] {
    const P = 1000 / (sclHz > 0 ? sclHz : 100_000);
    const q = P / 4;
    const out: BusEdge[] = [];
    let t = Math.max(this.cursorMs, nowMs);
    const set = (line: 'sda' | 'scl', state: boolean, at: number) => {
      if (this[line] === state) return;
      this[line] = state;
      out.push({ line, state, timeMs: at });
    };
    if (!this.seeded) {
      // Idle-high baseline, so the scope draws the lines high before traffic.
      out.push({ line: 'sda', state: true, timeMs: t }, { line: 'scl', state: true, timeMs: t });
      this.seeded = true;
    }

    const byte = (value: number, acked: boolean) => {
      for (let i = 7; i >= 0; i--) {
        set('sda', ((value >> i) & 1) === 1, t);
        set('scl', true, t + q);
        set('scl', false, t + 3 * q);
        t += P;
      }
      set('sda', !acked, t); // ACK = SDA pulled low on the ninth clock
      set('scl', true, t + q);
      set('scl', false, t + 3 * q);
      t += P;
    };

    switch (e.type) {
      case 'start':
        set('sda', true, t);
        set('scl', true, t + q);
        set('sda', false, t + 2 * q);
        set('scl', false, t + 3 * q);
        t += P;
        break;
      case 'address':
        byte(((e.addr & 0x7f) << 1) | (e.write ? 0 : 1), e.ack);
        break;
      case 'write':
      case 'read':
        byte(e.value & 0xff, e.ack);
        break;
      case 'stop':
        set('sda', false, t);
        set('scl', true, t + q);
        set('sda', true, t + 2 * q);
        t += P;
        break;
    }
    this.cursorMs = t;
    return out;
  }
}

export interface SpiFrame {
  mosi: number;
  miso: number;
  startMs: number;
  sckHz: number;
  mode: 0 | 1 | 2 | 3;
  lsbFirst?: boolean;
  /** Word width (default 8; the RP2040 does 4-16 bit frames). */
  bits?: number;
}

/** SPI: one clock pulse per bit, data valid on the sampling edge. */
export class SpiWaveform {
  private mosiLevel = false;
  private misoLevel = false;
  private sckLevel: boolean | null = null;
  private cursorMs = 0;

  frame(f: SpiFrame): BusEdge[] {
    const P = 1000 / (f.sckHz > 0 ? f.sckHz : 1_000_000);
    const q = P / 4;
    const cpol = f.mode >> 1 === 1;
    const cpha = (f.mode & 1) === 1;
    const out: BusEdge[] = [];
    let t = Math.max(this.cursorMs, f.startMs);
    const set = (line: 'sck' | 'mosi' | 'miso', state: boolean, at: number) => {
      const key = line === 'sck' ? 'sckLevel' : line === 'mosi' ? 'mosiLevel' : 'misoLevel';
      if (this[key] === state) return;
      this[key] = state;
      out.push({ line, state, timeMs: at });
    };
    if (this.sckLevel === null) {
      this.sckLevel = cpol;
      out.push({ line: 'sck', state: cpol, timeMs: t });
    }
    const bits = f.bits ?? 8;
    for (let k = 0; k < bits; k++) {
      const bit = f.lsbFirst ? k : bits - 1 - k;
      const o = ((f.mosi >> bit) & 1) === 1;
      const i = ((f.miso >> bit) & 1) === 1;
      const lead = !cpol; // level of the leading edge
      if (!cpha) {
        // Data is stable before the leading edge, which is the sampling edge.
        set('mosi', o, t);
        set('miso', i, t);
        set('sck', lead, t + q);
        set('sck', cpol, t + 3 * q);
      } else {
        // Data changes on the leading edge; the trailing edge samples.
        set('sck', lead, t + q);
        set('mosi', o, t + q);
        set('miso', i, t + q);
        set('sck', cpol, t + 3 * q);
      }
      t += P;
    }
    this.cursorMs = t;
    return out;
  }
}

// ── Delivery to the scope ──────────────────────────────────────────────────

export interface PinEdge {
  pin: number;
  state: boolean;
  timeMs: number;
}

/** A scope pin callback that can also take a whole burst of edges at once. */
export type PinTimeCallback = ((pin: number, state: boolean, timeMs: number) => void) & {
  batch?: (edges: PinEdge[]) => void;
};

/**
 * Hand edges to the scope callback: in one go when it supports batching (the
 * store's does), else one by one. Keeps hundreds of thousands of edges per
 * display refresh from becoming hundreds of thousands of store updates.
 */
export function deliverEdges(cb: PinTimeCallback | null, edges: PinEdge[]): void {
  if (!cb || edges.length === 0) return;
  if (cb.batch) cb.batch(edges);
  else for (const e of edges) cb(e.pin, e.state, e.timeMs);
}
