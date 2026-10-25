/**
 * ESP32: the worker's `bus_trace` message (I²C / SPI bytes, GPIO-matrix pins)
 * becomes SDA/SCL and SCK/MOSI/MISO edges on the scope, and the decoders read
 * the same bytes back. The WebSocket and QEMU are out of the picture here; the
 * message shape is what esp32_worker.py really sends (verified against all
 * four chips).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Esp32Bridge } from '../simulation/Esp32Bridge';
import { decodeI2c, decodeSpi, type PinSample } from '../simulation/protocolDecode';



function setup() {
  const bridge = new Esp32Bridge('esp-1', 'esp32');
  const pins = new Map<number, PinSample[]>();
  bridge.onPinChangeWithTime = (pin, state, timeMs) => {
    if (!pins.has(pin)) pins.set(pin, []);
    pins.get(pin)!.push({ timeMs, state });
  };
  const draw = (t: unknown) => (bridge as unknown as { drawBusTrace(t: unknown): void }).drawBusTrace(t);
  return { bridge, pins, draw, pin: (n: number) => pins.get(n) ?? [] };
}

const PINS = {
  i2c: [{ scl: 22, sda: 21 }, { scl: null, sda: null }],
  spi: { sck: 18, mosi: 23, miso: 19 },
};

beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(10_000);
});

describe('Esp32Bridge bus_trace → scope edges', () => {
  it('I²C write to 0x3C shows on the routed SDA/SCL pads', () => {
    const { draw, pin } = setup();
    draw({
      events: [
        ['a', 5, 0, 0x3c, 1, 1],
        ['w', 4, 0, 0x00, 1],
        ['w', 3, 0, 0xaf, 1],
        ['p', 2, 0],
      ],
      pins: PINS,
    });
    expect(decodeI2c(pin(21), pin(22)).map((i) => i.label)).toEqual(['S', '0x3C W ✓', '0x00 ✓', '0xAF ✓', 'P']);
  });

  it('a read ends with a NACK from the master and a repeated start is detected', () => {
    const { draw, pin } = setup();
    draw({
      events: [
        ['a', 9, 0, 0x68, 1, 1],
        ['w', 8, 0, 0x75, 1],
        ['a', 7, 0, 0x68, 0, 1], // second address without STOP → repeated start
        ['r', 6, 0, 0x68],
        ['n', 5, 0],
        ['p', 4, 0],
      ],
      pins: PINS,
    });
    expect(decodeI2c(pin(21), pin(22)).map((i) => i.label)).toEqual([
      'S', '0x68 W ✓', '0x75 ✓', 'Sr', '0x68 R ✓', '0x68 ✗', 'P',
    ]);
  });

  it('a NACKed address (no device) is shown as such', () => {
    const { draw, pin } = setup();
    draw({ events: [['a', 3, 0, 0x50, 1, 0], ['p', 2, 0]], pins: PINS });
    expect(decodeI2c(pin(21), pin(22)).map((i) => i.label)).toEqual(['S', '0x50 W ✗', 'P']);
  });

  it('SPI bytes come out on SCK/MOSI/MISO', () => {
    const { draw, pin } = setup();
    draw({
      events: [
        ['s', 5, 1, 0x9f, 0x00],
        ['s', 5, 1, 0xa5, 0xff],
      ],
      pins: PINS,
    });
    expect(decodeSpi(pin(18), pin(23), pin(19), null, 0).map((i) => i.label)).toEqual([
      '0x9F ⇄ 0x00',
      '0xA5 ⇄ 0xFF',
    ]);
  });

  it('draws nothing when the firmware did not route the bus (pad unknown)', () => {
    const { draw, pins } = setup();
    draw({
      events: [['a', 3, 0, 0x3c, 1, 1], ['s', 3, 1, 1, 1]],
      pins: { i2c: [{ scl: null, sda: null }], spi: null },
    });
    expect(pins.size).toBe(0);
  });

  it('timestamps are "now minus age", so ordering across batches holds', () => {
    const { draw, pin } = setup();
    draw({ events: [['a', 50, 0, 0x3c, 1, 1], ['p', 40, 0]], pins: PINS });
    const first = pin(21)[0].timeMs;
    expect(first).toBeLessThan(10_000 - 39); // not later than the newest event
    expect(first).toBeGreaterThan(10_000 - 51);
  });
});

describe('Esp32Bridge UART frames queue up', () => {
  it('two bytes in one chunk do not overlap on the TX pad', () => {
    const { bridge, pin } = setup();
    (bridge as unknown as { uartBaudRate: number }).uartBaudRate = 9600;
    const emit = (b: number) => (bridge as unknown as { emitUartTxFrame(b: number): void }).emitUartTxFrame(b);
    emit(0x6f);
    emit(0x6b);
    const tx = pin(1);
    const gaps = tx.slice(1).map((s, i) => s.timeMs - tx[i].timeMs).filter((d) => d > 0);
    expect(Math.min(...gaps)).toBeGreaterThan(0.09); // ≥ one bit time at 9600 baud (0.104 ms)
  });
});
