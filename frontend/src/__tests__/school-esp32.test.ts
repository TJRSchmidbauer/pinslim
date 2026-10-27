import { describe, it, expect } from 'vitest';
import { schoolExamples } from '../data/examples';
import { ESP_VARIANTS, SCHOOL_ESP_BOARD } from '../data/examples-school-esp';

// Pads of the ESP32 DevKit V1 element (Esp32Element.ts PINS_ESP32).
const DEVKIT_PADS = new Set([
  'EN', 'VN', 'VP', '34', '35', '32', '33', '25', '26', '27', '14', '12', '13', 'GND',
  'VIN', '3V3', 'GND2', '15', '2', '4', 'RX2', '16', 'TX2', '17', '5', '18', '19', '21',
  'RX0', 'TX0', '22', '23',
]);

describe('school examples on ESP32', () => {
  const converted = schoolExamples.filter((e) => ESP_VARIANTS[e.id]);

  it('converts every microcontroller entry', () => {
    expect(converted.length).toBe(Object.keys(ESP_VARIANTS).length);
  });

  it.each(converted.map((e) => [e.id, e] as const))('%s runs on the ESP32 board', (_id, e) => {
    expect(e.boards?.map((b) => b.boardKind)).toEqual([SCHOOL_ESP_BOARD]);
    expect(e.boards?.[0].code).toMatch(/void setup/);
    expect(e.boards?.[0].code).not.toMatch(/\bA[0-5]\b|analogRead\(A|1023|[^0-9]5\.0[^0-9]|Serial\.begin\(9600\)/);
    const ids = new Set([SCHOOL_ESP_BOARD, ...e.components.map((c) => c.id)]);
    expect(e.components.some((c) => c.type === 'wokwi-arduino-uno')).toBe(false);
    for (const w of e.wires) {
      for (const end of [w.start, w.end]) {
        expect(ids.has(end.componentId)).toBe(true);
        if (end.componentId === SCHOOL_ESP_BOARD) expect(DEVKIT_PADS.has(end.pinName)).toBe(true);
      }
    }
  });
});
