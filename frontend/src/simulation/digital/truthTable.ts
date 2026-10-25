/**
 * truthTable — truth table, minimised Boolean expression and timing diagram
 * for board-less digital circuits (logic gates, switches, LEDs, flip-flops).
 *
 * It drives the same headless network the live canvas uses
 * (`buildDigitalNetwork`), but on a throw-away copy: every sweep builds its own
 * network and the module-global bus registry is saved and restored around it,
 * so asking for a table never disturbs the circuit that is running on screen
 * (and never wipes its flip-flop state).
 *
 * Vocabulary the UI shows, in German school notation: ∧ (und), ∨ (oder),
 * ¬ (nicht).
 */
import { PinManager } from '../PinManager';
import { resetBusNets, restoreBusNets, snapshotBusNets } from '../customChips/busNets';
import {
  buildDigitalNetwork,
  isAllDigital,
  kindOf,
  type DigitalComponent,
  type DigitalNetwork,
  type DigitalWire,
} from './digitalGateEngine';

/** 2^10 = 1024 rows: the 4-bit adder (8 operand bits + carry) fits. */
export const MAX_TABLE_INPUTS = 10;

export type Bit = 0 | 1;

export interface PlacedComponent extends DigitalComponent {
  x?: number;
  y?: number;
}

/** One column of a table / one lane of a diagram. */
export interface LogicSignal {
  /** Component the signal belongs to. */
  id: string;
  /** Pin whose net level is read (`2` = switch wiper, `A` = LED anode, `Y`, `Q`). */
  pin: string;
  label: string;
  kind: 'switch' | 'led' | 'gate' | 'flipflop';
}

export type AnalysisProblem = 'empty' | 'not-digital' | 'no-switch' | 'no-output';

export interface CircuitAnalysis {
  ok: boolean;
  problem?: AnalysisProblem;
  /** Slide switches, left to right → A, B, C … (A is the most significant bit). */
  inputs: LogicSignal[];
  /** LEDs → Y (or Y1, Y2 …). */
  outputs: LogicSignal[];
  /** Gate and flip-flop outputs — optional intermediate columns. */
  internals: LogicSignal[];
  /** The circuit contains flip-flops: a truth table is not defined, only a timeline. */
  sequential: boolean;
  /** Switch that feeds a flip-flop clock, if one can be identified. */
  clockId: string | null;
}

const byPosition = (a: PlacedComponent, b: PlacedComponent) =>
  (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0);

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Run `fn` against a private bus registry and put the live one back after. */
function isolated<T>(fn: () => T): T {
  const saved = snapshotBusNets();
  try {
    resetBusNets();
    return fn();
  } finally {
    restoreBusNets(saved);
  }
}

function gateName(kind: string): string {
  const m = /^logic-gate-([a-z]+)/.exec(kind);
  return m ? m[1].toUpperCase() : kind.toUpperCase();
}

const FF_NAMES: Record<string, string> = {
  'flip-flop-d': 'D-FF',
  'flip-flop-t': 'T-FF',
  'flip-flop-jk': 'JK-FF',
};

/** Find the switches, LEDs and internal signals the user can tabulate. */
export function analyzeCircuit(
  components: PlacedComponent[],
  wires: DigitalWire[],
): CircuitAnalysis {
  const empty: CircuitAnalysis = {
    ok: false,
    inputs: [],
    outputs: [],
    internals: [],
    sequential: false,
    clockId: null,
  };
  if (components.length === 0) return { ...empty, problem: 'empty' };
  if (!isAllDigital(components)) return { ...empty, problem: 'not-digital' };

  const switches = components.filter((c) => kindOf(c) === 'slide-switch').sort(byPosition);
  const leds = components.filter((c) => kindOf(c) === 'led').sort(byPosition);
  const flipFlops = components.filter((c) => kindOf(c) in FF_NAMES).sort(byPosition);

  const inputs: LogicSignal[] = switches.map((c, i) => ({
    id: c.id,
    pin: '2',
    label: LETTERS[i] ?? `S${i + 1}`,
    kind: 'switch',
  }));
  const outputs: LogicSignal[] = leds.map((c, i) => ({
    id: c.id,
    pin: 'A',
    label: leds.length === 1 ? 'Y' : `Y${i + 1}`,
    kind: 'led',
  }));

  const counters = new Map<string, number>();
  const internals: LogicSignal[] = [];
  for (const c of components.filter((x) => kindOf(x).startsWith('logic-gate-')).sort(byPosition)) {
    const name = gateName(kindOf(c));
    const n = (counters.get(name) ?? 0) + 1;
    counters.set(name, n);
    internals.push({ id: c.id, pin: 'Y', label: `${name}${n}`, kind: 'gate' });
  }
  for (const c of flipFlops) {
    const name = FF_NAMES[kindOf(c)];
    const n = (counters.get(name) ?? 0) + 1;
    counters.set(name, n);
    internals.push({ id: c.id, pin: 'Q', label: `${name}${n}.Q`, kind: 'flipflop' });
  }

  let clockId: string | null = null;
  if (flipFlops.length > 0 && switches.length > 0) {
    clockId = isolated(() => {
      const net = buildDigitalNetwork(components, wires, new PinManager());
      if (!net.ok) return null;
      const clockNets = new Set(flipFlops.map((c) => net.netOf(c.id, 'CLK')));
      return switches.find((s) => clockNets.has(net.netOf(s.id, '2')))?.id ?? null;
    });
  }

  const base = { inputs, outputs, internals, sequential: flipFlops.length > 0, clockId };
  if (inputs.length === 0) return { ...empty, ...base, problem: 'no-switch' };
  if (outputs.length === 0 && internals.length === 0) return { ...empty, ...base, problem: 'no-output' };
  return { ok: true, ...base };
}

function readSignal(net: DigitalNetwork, s: LogicSignal): Bit {
  if (s.kind === 'led') return net.readLed(s.id);
  const n = net.netOf(s.id, s.pin);
  return n === undefined ? 0 : net.readNet(n);
}

export interface TruthTable {
  inputs: LogicSignal[];
  outputs: LogicSignal[];
  rows: { inputs: Bit[]; outputs: Bit[] }[];
}

/**
 * Sweep every switch combination (binary counting, first input = MSB) and read
 * the outputs. Returns null when the circuit cannot be evaluated or has too many
 * inputs.
 */
export function computeTruthTable(
  components: PlacedComponent[],
  wires: DigitalWire[],
  inputs: LogicSignal[],
  outputs: LogicSignal[],
): TruthTable | null {
  const n = inputs.length;
  if (n === 0 || n > MAX_TABLE_INPUTS) return null;
  return isolated(() => {
    const net = buildDigitalNetwork(components, wires, new PinManager());
    if (!net.ok) return null;
    const rows: TruthTable['rows'] = [];
    for (let i = 0; i < 1 << n; i++) {
      inputs.forEach((inp, j) => net.setSwitch(inp.id, ((i >> (n - 1 - j)) & 1) as Bit));
      rows.push({
        inputs: inputs.map((s) => readSignal(net, s)),
        outputs: outputs.map((s) => readSignal(net, s)),
      });
    }
    return { inputs, outputs, rows };
  });
}

// ── Boolean expressions ─────────────────────────────────────────────────────

interface Implicant {
  value: number;
  /** Bits set here are "don't care". */
  mask: number;
}

function ones(x: number): number {
  let c = 0;
  for (let v = x; v; v &= v - 1) c++;
  return c;
}

/** Quine–McCluskey prime implicants + essential-first greedy cover. */
function primeImplicants(minterms: number[]): Implicant[] {
  let current = new Map<string, Implicant>();
  for (const m of minterms) current.set(`${m}:0`, { value: m, mask: 0 });
  const primes: Implicant[] = [];
  while (current.size > 0) {
    const list = [...current.values()];
    const merged = new Set<string>();
    const next = new Map<string, Implicant>();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.mask !== b.mask) continue;
        const diff = a.value ^ b.value;
        if (ones(diff) !== 1) continue;
        const mask = a.mask | diff;
        const value = a.value & ~diff;
        next.set(`${value}:${mask}`, { value, mask });
        merged.add(`${a.value}:${a.mask}`);
        merged.add(`${b.value}:${b.mask}`);
      }
    }
    for (const imp of list) if (!merged.has(`${imp.value}:${imp.mask}`)) primes.push(imp);
    current = next;
  }
  return primes;
}

const covers = (imp: Implicant, minterm: number) => (minterm & ~imp.mask) === imp.value;

function chooseCover(minterms: number[], primes: Implicant[]): Implicant[] {
  const chosen: Implicant[] = [];
  const left = new Set(minterms);
  const take = (imp: Implicant) => {
    chosen.push(imp);
    for (const m of [...left]) if (covers(imp, m)) left.delete(m);
  };
  for (const m of minterms) {
    const cands = primes.filter((p) => covers(p, m));
    if (cands.length === 1 && !chosen.includes(cands[0])) take(cands[0]);
  }
  while (left.size > 0) {
    const m = left.values().next().value as number;
    const best = primes
      .filter((p) => covers(p, m))
      .sort((a, b) => [...left].filter((x) => covers(b, x)).length - [...left].filter((x) => covers(a, x)).length)[0];
    take(best);
  }
  return chosen;
}

function term(imp: Implicant, names: string[]): string {
  const n = names.length;
  const lits: string[] = [];
  names.forEach((name, j) => {
    const bit = 1 << (n - 1 - j);
    if (imp.mask & bit) return;
    lits.push(imp.value & bit ? name : `¬${name}`);
  });
  return lits.join(' ∧ ');
}

function join(terms: string[]): string {
  if (terms.length === 1) return terms[0];
  return terms.map((t) => (t.includes('∧') ? `(${t})` : t)).join(' ∨ ');
}

export interface BooleanExpression {
  /** Every minterm, e.g. `(¬A ∧ B) ∨ (A ∧ ¬B)` (disjunktive Normalform). */
  dnf: string;
  /** Quine–McCluskey simplification of the same function. */
  simplified: string;
}

/** Expression for one output column. `minterms` index rows in table order. */
export function booleanExpression(minterms: number[], inputNames: string[]): BooleanExpression {
  const n = inputNames.length;
  if (minterms.length === 0) return { dnf: '0', simplified: '0' };
  if (minterms.length === 1 << n) return { dnf: '1', simplified: '1' };
  const full: Implicant[] = minterms.map((m) => ({ value: m, mask: 0 }));
  // Read left to right in variable order (A before B), shorter terms first.
  const firstVar = (imp: Implicant) => {
    for (let j = 0; j < n; j++) if (!(imp.mask & (1 << (n - 1 - j)))) return j;
    return n;
  };
  const cover = chooseCover(minterms, primeImplicants(minterms)).sort(
    (a, b) => firstVar(a) - firstVar(b) || ones(b.mask) - ones(a.mask) || a.value - b.value,
  );
  return {
    dnf: join(full.map((i) => term(i, inputNames))),
    simplified: join(cover.map((i) => term(i, inputNames))),
  };
}

/** Expressions for every output column of a table. */
export function expressionsFor(table: TruthTable): { label: string; expr: BooleanExpression }[] {
  const names = table.inputs.map((s) => s.label);
  return table.outputs.map((out, k) => ({
    label: out.label,
    expr: booleanExpression(
      table.rows.flatMap((r, i) => (r.outputs[k] === 1 ? [i] : [])),
      names,
    ),
  }));
}

/** Tab-separated text — pastes into Word / Excel / a Hefteintrag as a table. */
export function tableToText(table: TruthTable): string {
  const head = [...table.inputs, ...table.outputs].map((s) => s.label).join('\t');
  const rows = table.rows.map((r) => [...r.inputs, ...r.outputs].join('\t'));
  return [head, ...rows].join('\n');
}

// ── Timing diagram ─────────────────────────────────────────────────────────

export interface TimelineLane {
  label: string;
  role: 'clock' | 'input' | 'output';
  values: Bit[];
}

export interface Timeline {
  steps: number;
  lanes: TimelineLane[];
}

export type TimelineMode =
  | { type: 'sweep' }
  | { type: 'clock'; clockId: string; cycles: number };

/**
 * Sample a timeline. `sweep` counts through every switch combination (one step
 * each); `clock` holds the other switches and toggles `clockId` for `cycles`
 * periods (two steps each: low, then high — the flip-flops sample on the rise).
 */
export function simulateTimeline(
  components: PlacedComponent[],
  wires: DigitalWire[],
  inputs: LogicSignal[],
  outputs: LogicSignal[],
  mode: TimelineMode,
): Timeline | null {
  if (inputs.length > MAX_TABLE_INPUTS) return null;
  return isolated(() => {
    const net = buildDigitalNetwork(components, wires, new PinManager());
    if (!net.ok) return null;
    const lanes: TimelineLane[] = [
      ...inputs.map((s) => ({
        label: s.label,
        role: (mode.type === 'clock' && s.id === mode.clockId ? 'clock' : 'input') as TimelineLane['role'],
        values: [] as Bit[],
      })),
      ...outputs.map((s) => ({ label: s.label, role: 'output' as const, values: [] as Bit[] })),
    ];
    const sample = () => {
      [...inputs, ...outputs].forEach((s, i) => lanes[i].values.push(readSignal(net, s)));
    };

    let steps = 0;
    if (mode.type === 'sweep') {
      const n = inputs.length;
      for (let i = 0; i < 1 << n; i++) {
        inputs.forEach((inp, j) => net.setSwitch(inp.id, ((i >> (n - 1 - j)) & 1) as Bit));
        sample();
        steps++;
      }
    } else {
      for (let c = 0; c < mode.cycles; c++) {
        net.setSwitch(mode.clockId, 0);
        sample();
        net.setSwitch(mode.clockId, 1);
        sample();
        steps += 2;
      }
    }
    return { steps, lanes };
  });
}
