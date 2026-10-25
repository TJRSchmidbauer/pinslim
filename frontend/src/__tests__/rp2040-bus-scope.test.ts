/**
 * Raspberry Pi Pico: a real compiled sketch uses SPI.h, Wire.h and Serial1;
 * the simulator draws the buses on the pads (read from the GPIO function
 * select) and the protocol decoders read the bytes back — what the logic
 * analyzer shows a student. Firmware: fixtures/rp2040-bus (precompiled).
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RP2040Simulator } from '../simulation/RP2040Simulator';
import { PinManager } from '../simulation/PinManager';
import { I2CMemoryDevice } from '../simulation/I2CBusManager';
import { decodeI2c, decodeSpi, decodeUart, detectBaud, type PinSample } from '../simulation/protocolDecode';

const BIN = readFileSync(join(__dirname, 'fixtures/rp2040-bus/rp2040-bus.bin')).toString('base64');
const SDA = 4;
const SCL = 5;
const MISO = 16;
const CS = 17;
const SCK = 18;
const MOSI = 19;
const TX = 0;

describe('Pico hardware peripherals on the logic analyzer', () => {
  const pins = new Map<number, PinSample[]>();
  const device = new I2CMemoryDevice(0x3c);

  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const sim = new RP2040Simulator(new PinManager());
    sim.onPinChangeWithTime = (pin, state, timeMs) => {
      if (!pins.has(pin)) pins.set(pin, []);
      pins.get(pin)!.push({ timeMs, state });
    };
    sim.loadBinary(BIN);
    sim.addI2CDevice(device);
    sim.stepCycles(40_000_000);
  }, 120_000);

  const pin = (n: number) => pins.get(n) ?? [];

  it('the firmware really ran (I²C device received the bytes)', () => {
    expect(device.registers[0]).toBe(0xaf);
  });

  it('I²C: Wire.write() shows up as S 0x3C W, 0x00, 0xAF, P', () => {
    const items = decodeI2c(pin(SDA), pin(SCL));
    expect(items.map((i) => i.label)).toEqual(['S', '0x3C W ✓', '0x00 ✓', '0xAF ✓', 'P']);
  });

  it('SPI: SPI.transfer() shows the two bytes while chip select is low', () => {
    const items = decodeSpi(pin(SCK), pin(MOSI), pin(MISO), pin(CS), 0);
    expect(items.map((i) => i.label.split(' ⇄ ')[0])).toEqual(['0x9F', '0xA5']);
  });

  it('SPI: the clock runs while chip select is low, not after it rose', () => {
    const cs = pin(CS);
    const sck = pin(SCK);
    const low = cs.find((s) => !s.state && s.timeMs > 0)!;
    const high = [...cs].reverse().find((s) => s.state)!;
    const first = sck.find((s) => s.timeMs > low.timeMs)!;
    expect(first.timeMs).toBeGreaterThan(low.timeMs);
    expect(sck[sck.length - 1].timeMs).toBeLessThanOrEqual(high.timeMs);
  });

  it('SPI at 1 MHz: sixteen clock pulses', () => {
    expect(pin(SCK).filter((s) => s.state)).toHaveLength(16);
  });

  it('SPI clock is the 1 MHz the sketch asked for (clk_peri follows the firmware)', () => {
    const rising = pin(SCK).filter((s) => s.state);
    const span = (rising[rising.length - 1].timeMs - rising[0].timeMs) * 1000; // µs
    // 15 clock periods between the first and last of 16 rising edges, with a
    // gap between the two bytes
    expect(span).toBeGreaterThan(14);
    expect(span).toBeLessThan(26);
  });

  it('UART: Serial1.print("ok") at 9600 baud decodes to o, k', () => {
    const tx = pin(TX);
    expect(detectBaud(tx)).toBe(9600);
    expect(decodeUart(tx, { baud: 9600 }).map((i) => i.label)).toEqual(["0x6F 'o'", "0x6B 'k'"]);
  });
});
