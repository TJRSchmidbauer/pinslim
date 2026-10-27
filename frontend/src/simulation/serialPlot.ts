/**
 * Serial plotter data: turns the text a sketch prints into curves.
 *
 * Understands what the Arduino IDE's plotter understands and a bit more:
 *
 *   512                        one value per line
 *   1.5,2,3   1.5 2 3   1.5;2  several values per line (comma, space, tab, ;)
 *   a:1,b:2   a=1 b=2          labelled values → named curves
 *   Temperatur: 23.5 C         "label:" followed by a number (unit is ignored)
 *
 * Lines without any number (log messages such as "LED AN") are skipped, so a
 * sketch can mix prints and data. The x axis is the line (sample) number.
 */

export interface ParsedValue {
  /** Curve name; null when the line did not label the value. */
  name: string | null;
  value: number;
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Values on one line, in order. Empty array for lines without numbers. */
export function parsePlotLine(raw: string): ParsedValue[] {
  // eslint-disable-next-line no-control-regex
  const line = raw.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ').trim();
  if (!line) return [];
  const tokens = line.split(/[,;\t ]+/).filter(Boolean);
  const out: ParsedValue[] = [];
  let pendingLabel: string | null = null;

  for (const tok of tokens) {
    // "name:value" or "name=value" in one token
    const joined = /^(.*?)[:=]([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.exec(tok);
    if (joined && joined[1] && !NUMBER.test(joined[1])) {
      out.push({ name: joined[1], value: Number(joined[2]) });
      pendingLabel = null;
      continue;
    }
    // "name:" / "name=" then the number in the next token
    const label = /^(.+?)[:=]$/.exec(tok);
    if (label && !NUMBER.test(label[1])) {
      pendingLabel = label[1];
      continue;
    }
    if (NUMBER.test(tok)) {
      out.push({ name: pendingLabel, value: Number(tok) });
      pendingLabel = null;
      continue;
    }
    // Any other word (a unit, a remark) ends a pending label without a value
    // being attached to it by mistake: "Temp: n/a 5" must not label the 5.
    pendingLabel = null;
  }
  return out;
}

export interface PlotPoint {
  /** Sample (line) number, counted from 0 since the plot was cleared. */
  x: number;
  y: number;
}

export interface PlotCurve {
  name: string;
  points: PlotPoint[];
}

/**
 * Incremental plot state. Feed it the text as it arrives (chunks may end in the
 * middle of a line); read `curves` to draw. Each curve keeps its newest
 * `maxPoints` samples.
 */
export class SerialPlot {
  private partial = '';
  private lineNo = 0;
  private readonly byName = new Map<string, PlotPoint[]>();
  readonly maxPoints: number;

  constructor(maxPoints = 5000) {
    this.maxPoints = maxPoints;
  }

  /** Number of data lines seen so far. */
  get samples(): number {
    return this.lineNo;
  }

  get curves(): PlotCurve[] {
    return [...this.byName.entries()].map(([name, points]) => ({ name, points }));
  }

  clear(): void {
    this.partial = '';
    this.lineNo = 0;
    this.byName.clear();
  }

  /** Returns true when at least one new data line was added. */
  feed(text: string): boolean {
    const chunk = this.partial + text;
    const lines = chunk.split(/\r?\n|\r/);
    this.partial = lines.pop() ?? '';
    let added = false;
    for (const line of lines) {
      const values = parsePlotLine(line);
      if (values.length === 0) continue;
      const x = this.lineNo++;
      let unlabelled = 0;
      for (const v of values) {
        const name = v.name ?? `Wert ${++unlabelled}`;
        let pts = this.byName.get(name);
        if (!pts) {
          pts = [];
          this.byName.set(name, pts);
        }
        pts.push({ x, y: v.value });
        if (pts.length > this.maxPoints) pts.shift();
      }
      added = true;
    }
    return added;
  }
}

/** Visible window and value range of the curves, for drawing. */
export function plotExtent(
  curves: PlotCurve[],
  windowSamples: number,
  hidden: ReadonlySet<string> = new Set(),
): { x0: number; x1: number; yMin: number; yMax: number } | null {
  let last = -1;
  for (const c of curves) if (c.points.length) last = Math.max(last, c.points[c.points.length - 1].x);
  if (last < 0) return null;
  const x1 = Math.max(last, 1);
  const x0 = windowSamples > 0 ? Math.max(0, x1 - windowSamples + 1) : 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const c of curves) {
    if (hidden.has(c.name)) continue;
    for (const p of c.points) {
      if (p.x < x0) continue;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  if (!Number.isFinite(yMin)) return { x0, x1, yMin: -1, yMax: 1 };
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = (yMax - yMin) * 0.06;
  return { x0, x1, yMin: yMin - pad, yMax: yMax + pad };
}

/** Round tick values for an axis: ~`count` ticks at 1/2/5 × 10ⁿ steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return ticks;
}

/** CSV (semicolon-free, comma separated) of all curves, one row per sample. */
export function plotToCsv(curves: PlotCurve[]): string {
  if (curves.length === 0) return '';
  const rows = new Map<number, Map<string, number>>();
  for (const c of curves) {
    for (const p of c.points) {
      let r = rows.get(p.x);
      if (!r) rows.set(p.x, (r = new Map()));
      r.set(c.name, p.y);
    }
  }
  const head = ['Messung', ...curves.map((c) => c.name)].join(',');
  const body = [...rows.keys()]
    .sort((a, b) => a - b)
    .map((x) => [x, ...curves.map((c) => rows.get(x)!.get(c.name) ?? '')].join(','));
  return [head, ...body].join('\n');
}
