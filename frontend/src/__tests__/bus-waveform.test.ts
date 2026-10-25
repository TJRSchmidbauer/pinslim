/**
 * Round trip: byte-level bus events → wire edges → protocol decoder → the
 * same bytes. This is the path the AVR scope takes for Wire.h and SPI.h.
 */
import { describe, it, expect } from 'vitest';
import { I2cWaveform, SpiWaveform, type BusEdge, type I2cEvent } from '../simulation/busWaveform';
import { decodeI2c, decodeSpi, type PinSample } from '../simulation/protocolDecode';

const lines = (edges: BusEdge[], line: BusEdge['line']): PinSample[] =>
  edges.filter((e) => e.line === line).map((e) => ({ timeMs: e.timeMs, state: e.state }));

const run = (events: I2cEvent[], hz = 100_000) => {
  const w = new I2cWaveform();
  let now = 5;
  const edges: BusEdge[] = [];
  for (const e of events) edges.push(...w.event(e, now, hz));
  return { sda: lines(edges, 'sda'), scl: lines(edges, 'scl'), edges };
};

describe('I²C waveform → decoder', () => {
  it('SSD1306 command write', () => {
    const { sda, scl } = run([
      { type: 'start', repeated: false },
      { type: 'address', addr: 0x3c, write: true, ack: true },
      { type: 'write', value: 0x00, ack: true },
      { type: 'write', value: 0xaf, ack: true },
      { type: 'stop' },
    ]);
    expect(decodeI2c(sda, scl).map((i) => i.label)).toEqual(['S', '0x3C W ✓', '0x00 ✓', '0xAF ✓', 'P']);
  });
  it('write-then-read with a repeated start (register read)', () => {
    const { sda, scl } = run([
      { type: 'start', repeated: false },
      { type: 'address', addr: 0x68, write: true, ack: true },
      { type: 'write', value: 0x75, ack: true },
      { type: 'start', repeated: true },
      { type: 'address', addr: 0x68, write: false, ack: true },
      { type: 'read', value: 0x68, ack: false },
      { type: 'stop' },
    ]);
    expect(decodeI2c(sda, scl).map((i) => i.label)).toEqual([
      'S', '0x68 W ✓', '0x75 ✓', 'Sr', '0x68 R ✓', '0x68 ✗', 'P',
    ]);
  });
  it('an unanswered address shows a NACK', () => {
    const { sda, scl } = run([
      { type: 'start', repeated: false },
      { type: 'address', addr: 0x50, write: true, ack: false },
      { type: 'stop' },
    ]);
    expect(decodeI2c(sda, scl).map((i) => i.label)).toEqual(['S', '0x50 W ✗', 'P']);
  });
  it('back-to-back transactions never overlap in time', () => {
    const w = new I2cWaveform();
    const e1 = w.event({ type: 'start', repeated: false }, 1, 400_000);
    const e2 = w.event({ type: 'address', addr: 0x27, write: true, ack: true }, 1, 400_000); // same "now"
    const all = [...e1, ...e2];
    for (const line of ['sda', 'scl'] as const) {
      const times = all.filter((e) => e.line === line).map((e) => e.timeMs);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });
  it('runs at the configured clock (400 kHz is 4x faster than 100 kHz)', () => {
    const span = (hz: number) => {
      const { edges } = run([{ type: 'start', repeated: false }, { type: 'address', addr: 1, write: true, ack: true }, { type: 'stop' }], hz);
      return edges[edges.length - 1].timeMs - edges[0].timeMs;
    };
    expect(span(100_000) / span(400_000)).toBeCloseTo(4, 1);
  });
});

describe('SPI waveform → decoder', () => {
  const spiRun = (bytes: [number, number][], mode: 0 | 1 | 2 | 3, lsbFirst = false) => {
    const w = new SpiWaveform();
    const edges: BusEdge[] = [];
    let t = 2;
    for (const [mosi, miso] of bytes) {
      edges.push(...w.frame({ mosi, miso, startMs: t, sckHz: 1_000_000, mode, lsbFirst }));
    }
    return edges;
  };
  it('all four modes round trip', () => {
    for (const mode of [0, 1, 2, 3] as const) {
      const edges = spiRun([[0x9f, 0x00], [0xa5, 0x5a], [0x00, 0xff]], mode);
      const items = decodeSpi(lines(edges, 'sck'), lines(edges, 'mosi'), lines(edges, 'miso'), null, mode);
      expect(items.map((i) => i.label), `mode ${mode}`).toEqual(['0x9F ⇄ 0x00', '0xA5 ⇄ 0x5A', '0x00 ⇄ 0xFF']);
    }
  });
  it('bytes do not overlap', () => {
    const edges = spiRun([[0x01, 0x00], [0x02, 0x00]], 0);
    const sck = lines(edges, 'sck').map((s) => s.timeMs);
    expect([...sck].sort((a, b) => a - b)).toEqual(sck);
  });
  it('seeds the idle clock level (CPOL 1 idles high)', () => {
    const edges = spiRun([[0x80, 0x00]], 2);
    expect(lines(edges, 'sck')[0].state).toBe(true);
  });
});
