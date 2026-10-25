/**
 * End to end: a real compiled Arduino sketch uses SPI.h, Wire.h and Serial;
 * the AVR simulator draws the bus on the scope pins; the protocol decoders
 * read the bytes back. This is what the logic analyzer shows a student.
 *
 * The firmware (fixtures/avr-bus) is precompiled, so no arduino-cli is needed.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVRSimulator } from '../simulation/AVRSimulator';
import { PinManager } from '../simulation/PinManager';
import { I2CMemoryDevice } from '../simulation/I2CBusManager';
import {
  decodeI2c,
  decodeSpi,
  decodeUart,
  detectBaud,
  type PinSample,
} from '../simulation/protocolDecode';

const HEX = readFileSync(join(__dirname, 'fixtures/avr-bus/avr-bus.hex'), 'utf-8');
const SDA = 18; // A4
const SCL = 19; // A5
const SCK = 13;
const MOSI = 11;
const MISO = 12;
const CS = 10;
const TX = 1;

describe('AVR hardware peripherals on the logic analyzer', () => {
  const pins = new Map<number, PinSample[]>();
  const eeprom = new I2CMemoryDevice(0x3c);

  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const sim = new AVRSimulator(new PinManager(), 'uno');
    sim.onPinChangeWithTime = (pin, state, timeMs) => {
      if (!pins.has(pin)) pins.set(pin, []);
      pins.get(pin)!.push({ timeMs, state });
    };
    sim.loadHex(HEX);
    sim.addI2CDevice(eeprom);
    for (let i = 0; i < 4_000_000; i++) sim.step();
  });

  const pin = (n: number) => pins.get(n) ?? [];

  it('the firmware really ran (I²C device received the bytes)', () => {
    expect(eeprom.registers[0]).toBe(0xaf);
  });

  it('I²C: Wire.write() shows up as S 0x3C W, 0x00, 0xAF, P', () => {
    const items = decodeI2c(pin(SDA), pin(SCL));
    expect(items.map((i) => i.label)).toEqual(['S', '0x3C W ✓', '0x00 ✓', '0xAF ✓', 'P']);
  });

  it('SPI: SPI.transfer() shows the two bytes while chip select is low', () => {
    const items = decodeSpi(pin(SCK), pin(MOSI), pin(MISO), pin(CS), 0);
    expect(items.map((i) => i.label.split(' ⇄ ')[0])).toEqual(['0x9F', '0xA5']);
  });

  it('SPI: chip select edges come from the real GPIO, in the right order', () => {
    const cs = pin(CS);
    const sck = pin(SCK);
    const low = cs.find((s) => !s.state)!;
    const high = [...cs].reverse().find((s) => s.state)!;
    expect(low.timeMs).toBeLessThan(sck.find((s) => s.timeMs > low.timeMs)!.timeMs);
    expect(sck[sck.length - 1].timeMs).toBeLessThan(high.timeMs);
  });

  it('SPI at 1 MHz: sixteen clock pulses over about 16 µs', () => {
    const sck = pin(SCK).filter((s) => s.state);
    expect(sck).toHaveLength(16);
    const span = sck[sck.length - 1].timeMs - sck[0].timeMs;
    expect(span * 1000).toBeGreaterThan(12); // µs
    expect(span * 1000).toBeLessThan(20);
  });

  it('UART: Serial.print("ok") at 9600 baud decodes to o, k', () => {
    const tx = pin(TX);
    expect(detectBaud(tx)).toBe(9600);
    const items = decodeUart(tx, { baud: 9600 });
    expect(items.map((i) => i.label)).toEqual(["0x6F 'o'", "0x6B 'k'"]);
  });
});
