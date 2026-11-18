/**
 * Which buses does the sketch use, and on which pins?
 *
 * The oscilloscope's logic analyzer needs the pins of a bus (SDA/SCL, SCK/MOSI/…)
 * before it can decode anything. A student should not have to look those up:
 * the sketch already says `Wire.begin()` and the board has fixed default pins.
 * This module reads the source and returns one suggestion per bus, which the
 * scope turns into channels + decoder with a single click.
 *
 * Pure on purpose (no stores, no DOM) so it is unit-tested. Pin numbers follow
 * the scope's own numbering: Arduino D0..D13 = 0..13, A0..A5 = 14..19; Pico
 * GPn = n; ESP32 GPIOn = n.
 */

export type BusProtocol = 'i2c' | 'spi' | 'uart';

export interface BusPin {
  /** Decoder role in the scope: sda/scl, sck/mosi/miso/cs, rx (= the line to decode). */
  role: 'sda' | 'scl' | 'sck' | 'mosi' | 'miso' | 'cs' | 'rx';
  pin: number;
  /** Label as the scope's pin picker shows it ("A4", "GP4", "GPIO21"). */
  label: string;
}

export interface BusSuggestion {
  protocol: BusProtocol;
  pins: BusPin[];
}

type Family = 'avr-uno' | 'avr-mega' | 'rp2040' | 'esp32';

function familyOf(boardKind: string): Family | null {
  switch (boardKind) {
    case 'arduino-uno':
    case 'arduino-nano':
      return 'avr-uno';
    case 'arduino-mega':
      return 'avr-mega';
    case 'raspberry-pi-pico':
    case 'pi-pico-w':
      return 'rp2040';
    case 'esp32':
    case 'esp32-devkit-c-v4':
    case 'esp32-cam':
    case 'wemos-lolin32-lite':
      return 'esp32';
    default:
      return null;
  }
}

/** Drop // and block comments so a commented-out `Wire.begin()` is not a hit. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function pinLabel(family: Family, pin: number): string {
  if (family === 'rp2040') return `GP${pin}`;
  if (family === 'esp32') return `GPIO${pin}`;
  if (family === 'avr-uno' && pin >= 14) return `A${pin - 14}`;
  if (family === 'avr-mega' && pin >= 54) return `A${pin - 54}`;
  return `D${pin}`;
}

function bp(family: Family, role: BusPin['role'], pin: number): BusPin {
  return { role, pin, label: pinLabel(family, pin) };
}

/** First numeric argument list of `name(a, b)`; null when absent or not literal. */
function numericArgs(src: string, call: RegExp): number[] | null {
  const m = src.match(call);
  if (!m) return null;
  const nums = m[1].split(',').map((s) => s.trim());
  if (nums.some((s) => !/^\d+$/.test(s))) return null;
  return nums.map(Number);
}

export function suggestBuses(source: string, boardKind: string): BusSuggestion[] {
  const family = familyOf(boardKind);
  if (!family) return [];
  const src = stripComments(source);
  const out: BusSuggestion[] = [];

  // ── I²C ───────────────────────────────────────────────────────────────────
  if (/\bWire\.begin\s*\(/.test(src)) {
    let sda: number | null = null;
    let scl: number | null = null;
    if (family === 'avr-uno') [sda, scl] = [18, 19]; // A4, A5
    else if (family === 'avr-mega') [sda, scl] = [20, 21];
    else if (family === 'rp2040') {
      sda = numericArgs(src, /\bWire\.setSDA\s*\(([^)]*)\)/)?.[0] ?? 4;
      scl = numericArgs(src, /\bWire\.setSCL\s*\(([^)]*)\)/)?.[0] ?? 5;
    } else {
      // ESP32: Wire.begin(sda, scl) names the pins; plain Wire.begin() uses 21/22.
      const given = numericArgs(src, /\bWire\.begin\s*\(([^)]*)\)/);
      if (given && given.length >= 2) [sda, scl] = given;
      else if (!/\bWire\.begin\s*\(\s*[^)\s]/.test(src)) [sda, scl] = [21, 22];
    }
    if (sda !== null && scl !== null) {
      out.push({ protocol: 'i2c', pins: [bp(family, 'sda', sda), bp(family, 'scl', scl)] });
    }
  }

  // ── SPI ───────────────────────────────────────────────────────────────────
  if (/\bSPI\.(begin|transfer|beginTransaction)\s*\(/.test(src)) {
    const map: Record<Family, [number, number, number, number]> = {
      // sck, mosi, miso, cs
      'avr-uno': [13, 11, 12, 10],
      'avr-mega': [52, 51, 50, 53],
      rp2040: [18, 19, 16, 17],
      esp32: [18, 23, 19, 5],
    };
    const [sck, mosi, miso, cs] = map[family];
    out.push({
      protocol: 'spi',
      pins: [bp(family, 'sck', sck), bp(family, 'mosi', mosi), bp(family, 'miso', miso), bp(family, 'cs', cs)],
    });
  }

  // ── UART ──────────────────────────────────────────────────────────────────
  // The scope decodes the board's TX line. On the Pico `Serial` is USB (no
  // pins), only `Serial1` is a real UART.
  if (family === 'rp2040') {
    if (/\bSerial1\.begin\s*\(/.test(src)) out.push({ protocol: 'uart', pins: [bp(family, 'rx', 0)] });
  } else if (/\bSerial\.begin\s*\(/.test(src)) {
    out.push({ protocol: 'uart', pins: [bp(family, 'rx', 1)] });
  }

  return out;
}

/** Human title for the one-click button: "I²C (SDA A4, SCL A5)". */
export function describeSuggestion(s: BusSuggestion): string {
  const name = s.protocol === 'i2c' ? 'I²C' : s.protocol === 'spi' ? 'SPI' : 'UART';
  const roleName: Record<BusPin['role'], string> = {
    sda: 'SDA', scl: 'SCL', sck: 'SCK', mosi: 'MOSI', miso: 'MISO', cs: 'CS', rx: 'TX',
  };
  // The optional SPI lines stay out of the label: they are extras, not the bus.
  const shown = s.pins.filter((p) => p.role !== 'miso' && p.role !== 'cs');
  return `${name} (${shown.map((p) => `${roleName[p.role]} ${p.label}`).join(', ')})`;
}
