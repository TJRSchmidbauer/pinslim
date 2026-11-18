import { describe, it, expect } from 'vitest';
import { suggestBuses, describeSuggestion } from '../simulation/busSuggest';

const i2c = (src: string, kind: string) => suggestBuses(src, kind).find((s) => s.protocol === 'i2c');

describe('bus suggestions from the sketch', () => {
  it('Uno: Wire.begin() means SDA A4, SCL A5', () => {
    const s = i2c('#include <Wire.h>\nvoid setup(){ Wire.begin(); }', 'arduino-uno')!;
    expect(s.pins.map((p) => [p.role, p.pin, p.label])).toEqual([
      ['sda', 18, 'A4'],
      ['scl', 19, 'A5'],
    ]);
    expect(describeSuggestion(s)).toBe('I²C (SDA A4, SCL A5)');
  });

  it('Mega uses D20/D21', () => {
    const s = i2c('Wire.begin();', 'arduino-mega')!;
    expect(s.pins.map((p) => p.label)).toEqual(['D20', 'D21']);
  });

  it('Pico: defaults GP4/GP5, setSDA/setSCL override', () => {
    expect(i2c('Wire.begin();', 'raspberry-pi-pico')!.pins.map((p) => p.label)).toEqual(['GP4', 'GP5']);
    const s = i2c('Wire.setSDA(8); Wire.setSCL(9); Wire.begin();', 'raspberry-pi-pico')!;
    expect(s.pins.map((p) => p.label)).toEqual(['GP8', 'GP9']);
  });

  it('ESP32: Wire.begin(sda, scl) names the pins, plain begin uses 21/22', () => {
    expect(i2c('Wire.begin(17, 16);', 'esp32')!.pins.map((p) => p.pin)).toEqual([17, 16]);
    expect(i2c('Wire.begin();', 'esp32')!.pins.map((p) => p.pin)).toEqual([21, 22]);
  });

  it('ESP32: a non-literal argument is not guessed', () => {
    expect(i2c('Wire.begin(SDA_PIN, SCL_PIN);', 'esp32')).toBeUndefined();
  });

  it('ignores commented-out code', () => {
    expect(suggestBuses('// Wire.begin();\n/* SPI.begin(); Serial.begin(9600); */', 'arduino-uno')).toEqual([]);
  });

  it('SPI on Uno: SCK 13, MOSI 11, MISO 12, CS 10; label leaves the optional lines out', () => {
    const s = suggestBuses('SPI.begin();', 'arduino-uno').find((x) => x.protocol === 'spi')!;
    expect(s.pins.map((p) => [p.role, p.pin])).toEqual([
      ['sck', 13],
      ['mosi', 11],
      ['miso', 12],
      ['cs', 10],
    ]);
    expect(describeSuggestion(s)).toBe('SPI (SCK D13, MOSI D11)');
  });

  it('UART: Uno decodes TX on D1; on the Pico only Serial1 has pins', () => {
    expect(suggestBuses('Serial.begin(9600);', 'arduino-uno')[0].pins[0]).toMatchObject({ role: 'rx', pin: 1, label: 'D1' });
    expect(suggestBuses('Serial.begin(115200);', 'raspberry-pi-pico')).toEqual([]);
    expect(suggestBuses('Serial1.begin(115200);', 'raspberry-pi-pico')[0].pins[0].label).toBe('GP0');
  });

  it('boards without a known default give no suggestion', () => {
    expect(suggestBuses('Wire.begin();', 'attiny85')).toEqual([]);
    expect(suggestBuses('Wire.begin();', 'esp32-c6')).toEqual([]);
  });

  it('a sketch with Wire and Serial yields both, I²C first', () => {
    const r = suggestBuses('Serial.begin(115200); Wire.begin();', 'arduino-uno');
    expect(r.map((x) => x.protocol)).toEqual(['i2c', 'uart']);
  });
});
