import { describe, it, expect } from 'vitest';
import { SerialPlot, niceTicks, parsePlotLine, plotExtent, plotToCsv } from '../simulation/serialPlot';

const v = (s: string) => parsePlotLine(s).map((x) => [x.name, x.value]);

describe('parsePlotLine', () => {
  it('one number', () => expect(v('512')).toEqual([[null, 512]]));
  it('negative, decimal and exponent', () => {
    expect(v('-12.5')).toEqual([[null, -12.5]]);
    expect(v('1e3')).toEqual([[null, 1000]]);
    expect(v('.5')).toEqual([[null, 0.5]]);
  });
  it('comma, space, tab and semicolon separated', () => {
    expect(v('1,2,3')).toEqual([[null, 1], [null, 2], [null, 3]]);
    expect(v('1 2\t3;4')).toEqual([[null, 1], [null, 2], [null, 3], [null, 4]]);
  });
  it('labelled values (a:1,b:2 and a=1 b=2)', () => {
    expect(v('temp:21.5,hum:40')).toEqual([['temp', 21.5], ['hum', 40]]);
    expect(v('x=1 y=2')).toEqual([['x', 1], ['y', 2]]);
  });
  it('"Label: value unit" in the style of Serial.print', () => {
    expect(v('Temperatur: 23.5 C')).toEqual([['Temperatur', 23.5]]);
    expect(v('Rohwert: 2048   Spannung: 1650 mV')).toEqual([['Rohwert', 2048], ['Spannung', 1650]]);
  });
  it('lines without numbers are skipped; a label without a value does not steal the next number', () => {
    expect(v('LED AN')).toEqual([]);
    expect(v('')).toEqual([]);
    expect(v('Temp: n/a 5')).toEqual([[null, 5]]);
  });
  it('strips ANSI colour codes and control characters', () => {
    expect(v('\x1b[0;32m42\x1b[0m')).toEqual([[null, 42]]);
  });
  it('a hex-looking or time-looking token is not a number', () => {
    expect(v('0x1F')).toEqual([]);
    expect(v('12:30')).toEqual([]); // a time of day is not a labelled value
  });
});

describe('SerialPlot', () => {
  it('collects curves across chunks that end mid-line', () => {
    const p = new SerialPlot();
    expect(p.feed('1,2\n3,')).toBe(true);
    expect(p.samples).toBe(1);
    p.feed('4\r\n5,6\n');
    expect(p.samples).toBe(3);
    const c = Object.fromEntries(p.curves.map((c) => [c.name, c.points.map((q) => q.y)]));
    expect(c).toEqual({ 'Wert 1': [1, 3, 5], 'Wert 2': [2, 4, 6] });
  });
  it('mixes log lines and data, and numbers samples by data line', () => {
    const p = new SerialPlot();
    p.feed('boot\nLED AN\n10\nLED AUS\n20\n');
    expect(p.curves[0].points).toEqual([{ x: 0, y: 10 }, { x: 1, y: 20 }]);
  });
  it('curves that appear later keep their own x positions', () => {
    const p = new SerialPlot();
    p.feed('a:1\na:2\na:3,b:9\n');
    const b = p.curves.find((c) => c.name === 'b')!;
    expect(b.points).toEqual([{ x: 2, y: 9 }]);
  });
  it('keeps only the newest maxPoints per curve', () => {
    const p = new SerialPlot(5);
    p.feed(Array.from({ length: 12 }, (_, i) => String(i)).join('\n') + '\n');
    expect(p.curves[0].points.map((q) => q.y)).toEqual([7, 8, 9, 10, 11]);
  });
  it('clear starts over', () => {
    const p = new SerialPlot();
    p.feed('1\n2\n');
    p.clear();
    expect(p.samples).toBe(0);
    expect(p.curves).toEqual([]);
  });
});

describe('plotExtent / niceTicks / csv', () => {
  it('window and padded value range', () => {
    const p = new SerialPlot();
    p.feed(Array.from({ length: 100 }, (_, i) => String(i)).join('\n') + '\n');
    const e = plotExtent(p.curves, 10)!;
    expect(e.x1).toBe(99);
    expect(e.x0).toBe(90);
    expect(e.yMin).toBeLessThan(90);
    expect(e.yMax).toBeGreaterThan(99);
  });
  it('a constant signal still gets a visible range', () => {
    const p = new SerialPlot();
    p.feed('5\n5\n5\n');
    const e = plotExtent(p.curves, 0)!;
    expect(e.yMax - e.yMin).toBeGreaterThan(0);
  });
  it('hidden curves do not stretch the axis', () => {
    const p = new SerialPlot();
    p.feed('a:1,b:1000\na:2,b:2000\n');
    const e = plotExtent(p.curves, 0, new Set(['b']))!;
    expect(e.yMax).toBeLessThan(10);
  });
  it('no data → null', () => expect(plotExtent([], 0)).toBeNull());
  it('round ticks', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
  it('csv has one row per sample', () => {
    const p = new SerialPlot();
    p.feed('a:1,b:2\na:3\n');
    expect(plotToCsv(p.curves)).toBe('Messung,a,b\n0,1,2\n1,3,');
  });
});
