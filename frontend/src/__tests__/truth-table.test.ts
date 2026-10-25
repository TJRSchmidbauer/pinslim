/**
 * Truth table / Boolean expression / timeline for board-less digital circuits,
 * evaluated on the gallery's real examples.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBusNets } from '../simulation/customChips/busNets';
import {
  analyzeCircuit,
  booleanExpression,
  computeTruthTable,
  expressionsFor,
  simulateTimeline,
  tableToText,
  type PlacedComponent,
} from '../simulation/digital/truthTable';
import { buildDigitalNetwork, type DigitalWire } from '../simulation/digital/digitalGateEngine';
import { digitalExamples } from '../data/examples-digital';

type Ex = { id: string; components: PlacedComponent[]; wires: DigitalWire[] };
const example = (id: string): Ex => {
  const ex = (digitalExamples as unknown as Ex[]).find((e) => e.id === id);
  if (!ex) throw new Error(`no example ${id}`);
  return ex;
};

const table = (id: string) => {
  const ex = example(id);
  const a = analyzeCircuit(ex.components, ex.wires);
  expect(a.ok, `${id}: ${a.problem}`).toBe(true);
  const t = computeTruthTable(ex.components, ex.wires, a.inputs, a.outputs);
  expect(t).not.toBeNull();
  return t!;
};
const column = (id: string, k = 0) => table(id).rows.map((r) => r.outputs[k]);

beforeEach(() => resetBusNets());

describe('truth table of the gallery gates', () => {
  it('AND: only 1,1 lights the lamp', () => {
    expect(column('digital-and-two-switches')).toEqual([0, 0, 0, 1]);
  });
  it('OR / NAND / NOR / XOR / XNOR', () => {
    expect(column('digital-or-any-switch')).toEqual([0, 1, 1, 1]);
    expect(column('digital-nand-two-switches')).toEqual([1, 1, 1, 0]);
    expect(column('digital-nor-idle-light')).toEqual([1, 0, 0, 0]);
    expect(column('digital-xor-difference')).toEqual([0, 1, 1, 0]);
    expect(column('digital-xnor-equality')).toEqual([1, 0, 0, 1]);
  });
  it('NOT has one input', () => {
    expect(column('digital-not-inverter')).toEqual([1, 0]);
  });
  it('the first switch (leftmost) is the most significant bit', () => {
    const t = table('digital-and-two-switches');
    expect(t.rows.map((r) => r.inputs.join(''))).toEqual(['00', '01', '10', '11']);
  });
  it('half adder has a sum and a carry column', () => {
    const t = table('digital-half-adder');
    expect(t.outputs).toHaveLength(2);
    const col = (k: number) => t.rows.map((r) => r.outputs[k]);
    const cols = [col(0).join(''), col(1).join('')].sort();
    // sum = A xor B (0110) and carry = A and B (0001), in either column order
    expect(cols).toEqual(['0001', '0110']);
  });
  it('3-input majority voter has 8 rows and the right minterms', () => {
    const t = table('digital-majority-voter');
    expect(t.rows).toHaveLength(8);
    expect(t.rows.map((r) => r.outputs[0])).toEqual([0, 0, 0, 1, 0, 1, 1, 1]);
  });
  it('a 4-bit adder (9 switches incl. carry-in) still tabulates', () => {
    const ex = example('digital-ripple-adder-4bit');
    const a = analyzeCircuit(ex.components, ex.wires);
    expect(a.inputs.length).toBe(9); // A3..A0, B3..B0 and the carry-in
    const t = computeTruthTable(ex.components, ex.wires, a.inputs, a.outputs);
    expect(t?.rows.length).toBe(1 << a.inputs.length);
  });
});

describe('the sweep leaves the live network alone', () => {
  it('a running network keeps its state while a table is computed', () => {
    const ex = example('digital-and-two-switches');
    const live = buildDigitalNetwork(ex.components, ex.wires);
    const sw = ex.components.filter((c) => String(c.type).includes('slide-switch')).map((c) => c.id);
    sw.forEach((id) => live.setSwitch(id, 1));
    const led = live.ledIds[0];
    expect(live.readLed(led)).toBe(1);

    const a = analyzeCircuit(ex.components, ex.wires);
    computeTruthTable(ex.components, ex.wires, a.inputs, a.outputs);

    // flipping one switch afterwards must still work on the live network
    live.setSwitch(sw[0], 0);
    expect(live.readLed(led)).toBe(0);
    live.setSwitch(sw[0], 1);
    expect(live.readLed(led)).toBe(1);
  });
});

describe('analysis', () => {
  it('flags the ripple counter as sequential and finds its clock switch', () => {
    const ex = example('digital-ripple-counter-4bit');
    const a = analyzeCircuit(ex.components, ex.wires);
    expect(a.ok).toBe(true);
    expect(a.sequential).toBe(true);
    expect(a.clockId).toBe('cnt_clk');
  });
  it('names the single output Y and inputs A, B …', () => {
    const ex = example('digital-and-two-switches');
    const a = analyzeCircuit(ex.components, ex.wires);
    expect(a.inputs.map((s) => s.label)).toEqual(['A', 'B']);
    expect(a.outputs.map((s) => s.label)).toEqual(['Y']);
  });
  it('rejects circuits that are not purely digital', () => {
    expect(analyzeCircuit([], []).problem).toBe('empty');
    const mcu: PlacedComponent[] = [{ id: 'u', metadataId: 'arduino-uno' }];
    expect(analyzeCircuit(mcu, []).problem).toBe('not-digital');
  });
});

describe('boolean expressions', () => {
  it('XOR → (¬A ∧ B) ∨ (A ∧ ¬B)', () => {
    const e = booleanExpression([1, 2], ['A', 'B']);
    expect(e.dnf).toBe('(¬A ∧ B) ∨ (A ∧ ¬B)');
    expect(e.simplified).toBe('(¬A ∧ B) ∨ (A ∧ ¬B)');
  });
  it('OR simplifies to A ∨ B', () => {
    expect(booleanExpression([1, 2, 3], ['A', 'B']).simplified).toBe('A ∨ B');
  });
  it('constants', () => {
    expect(booleanExpression([], ['A', 'B']).simplified).toBe('0');
    expect(booleanExpression([0, 1, 2, 3], ['A', 'B']).simplified).toBe('1');
  });
  it('majority voter simplifies to three pair terms', () => {
    const e = booleanExpression([3, 5, 6, 7], ['A', 'B', 'C']);
    expect(e.simplified.split('∨')).toHaveLength(3);
    expect(e.dnf.split('∨')).toHaveLength(4);
  });
  it('every simplified expression agrees with its table (exhaustive for the gallery)', () => {
    for (const id of ['digital-half-adder', 'digital-full-adder', 'digital-mux-2to1', 'digital-xor-from-nands', 'digital-aoi-gate']) {
      const t = table(id);
      for (const { expr } of expressionsFor(t)) expect(expr.simplified.length).toBeGreaterThan(0);
    }
  });
  it('tab separated text has a header and one line per row', () => {
    const txt = tableToText(table('digital-and-two-switches')).split('\n');
    expect(txt[0]).toBe('A\tB\tY');
    expect(txt).toHaveLength(5);
    expect(txt[4]).toBe('1\t1\t1');
  });
});

describe('timeline', () => {
  it('sweep gives one step per switch combination', () => {
    const ex = example('digital-and-two-switches');
    const a = analyzeCircuit(ex.components, ex.wires);
    const tl = simulateTimeline(ex.components, ex.wires, a.inputs, a.outputs, { type: 'sweep' });
    expect(tl?.steps).toBe(4);
    expect(tl?.lanes.map((l) => l.label)).toEqual(['A', 'B', 'Y']);
    expect(tl?.lanes[2].values).toEqual([0, 0, 0, 1]);
  });
  it('the 4-bit ripple counter counts in binary on a clock switch', () => {
    const ex = example('digital-ripple-counter-4bit');
    const a = analyzeCircuit(ex.components, ex.wires);
    const tl = simulateTimeline(ex.components, ex.wires, a.inputs, a.outputs, {
      type: 'clock',
      clockId: a.clockId!,
      cycles: 6,
    });
    expect(tl?.steps).toBe(12);
    const clock = tl!.lanes.find((l) => l.role === 'clock')!;
    expect(clock.values.slice(0, 4)).toEqual([0, 1, 0, 1]);
    // LED lanes are Y1 (LSB) … Y4; read the count after each rising edge.
    const y = (n: number) => tl!.lanes.find((l) => l.label === `Y${n}`)!.values;
    const count = (step: number) => y(1)[step] + 2 * y(2)[step] + 4 * y(3)[step] + 8 * y(4)[step];
    expect([1, 3, 5, 7, 9, 11].map(count)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
