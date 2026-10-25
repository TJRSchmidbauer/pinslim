/**
 * Truth table + Boolean expression + timing diagram for the digital circuit on
 * the canvas (gates, slide switches, LEDs, flip-flops — no microcontroller).
 *
 * The maths lives in simulation/digital/truthTable.ts; this file only picks
 * the columns, renders, and offers "copy as text" for the Hefteintrag.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { useLogicTableStore } from '../../store/useLogicTableStore';
import {
  MAX_TABLE_INPUTS,
  analyzeCircuit,
  computeTruthTable,
  expressionsFor,
  simulateTimeline,
  tableToText,
  type AnalysisProblem,
  type Bit,
  type Timeline,
} from '../../simulation/digital/truthTable';
import type { DigitalWire } from '../../simulation/digital/digitalGateEngine';
import './LogicTablePanel.css';

type Tab = 'table' | 'timing';

const STEP_W = 28;
const LANE_H = 26;

export const LogicTablePanel: React.FC = () => {
  const { t } = useTranslation();
  const components = useSimulatorStore((s) => s.components);
  const wires = useSimulatorStore((s) => s.wires);
  const setOpen = useLogicTableStore((s) => s.setOpen);

  const [tab, setTab] = useState<Tab>('table');
  const [showInternals, setShowInternals] = useState(false);
  const [simplified, setSimplified] = useState(true);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [cycles, setCycles] = useState(8);
  const [copied, setCopied] = useState(false);

  const digitalWires = wires as unknown as DigitalWire[];
  const analysis = useMemo(() => analyzeCircuit(components, digitalWires), [components, digitalWires]);

  const inputs = analysis.inputs.filter((i) => !skipped.has(i.id));
  const outputs = [...analysis.outputs, ...(showInternals ? analysis.internals : [])];
  const tooMany = inputs.length > MAX_TABLE_INPUTS;

  const table = useMemo(
    () =>
      analysis.ok && !analysis.sequential && !tooMany && inputs.length > 0
        ? computeTruthTable(components, digitalWires, inputs, outputs)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis, components, digitalWires, skipped, showInternals],
  );

  const timeline: Timeline | null = useMemo(() => {
    if (!analysis.ok || tab !== 'timing') return null;
    if (analysis.sequential) {
      if (!analysis.clockId) return null;
      return simulateTimeline(components, digitalWires, analysis.inputs, outputs, {
        type: 'clock',
        clockId: analysis.clockId,
        cycles,
      });
    }
    if (tooMany || inputs.length === 0) return null;
    return simulateTimeline(components, digitalWires, inputs, outputs, { type: 'sweep' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, components, digitalWires, skipped, showInternals, cycles, tab]);

  // Row that matches the switches as they are set right now.
  const currentRow = useMemo(() => {
    if (!table) return -1;
    return inputs.reduce((acc, inp) => {
      const c = components.find((x) => x.id === inp.id);
      return (acc << 1) | (Number(c?.properties?.value) === 1 ? 1 : 0);
    }, 0);
  }, [table, inputs, components]);

  const problemText: Record<AnalysisProblem, string> = {
    empty: t(
      'logicTable.problem.empty',
      'Build a circuit from logic gates, slide switches and LEDs — its truth table appears here.',
    ),
    'not-digital': t(
      'logicTable.problem.notDigital',
      'The table works for pure logic circuits (gates, switches, LEDs, flip-flops) without a microcontroller or analog parts.',
    ),
    'no-switch': t('logicTable.problem.noSwitch', 'The circuit needs at least one slide switch as an input.'),
    'no-output': t('logicTable.problem.noOutput', 'The circuit needs at least one LED as an output.'),
  };

  const copy = async () => {
    if (!table) return;
    try {
      await navigator.clipboard.writeText(tableToText(table));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — nothing sensible to do */
    }
  };

  const toggleInput = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="lt-container">
      <div className="lt-header">
        <span className="lt-title">{t('logicTable.title', 'Truth table & timing diagram')}</span>
        <button
          className={`lt-tab${tab === 'table' ? ' lt-tab-active' : ''}`}
          onClick={() => setTab('table')}
        >
          {t('logicTable.tabTable', 'Truth table')}
        </button>
        <button
          className={`lt-tab${tab === 'timing' ? ' lt-tab-active' : ''}`}
          onClick={() => setTab('timing')}
        >
          {t('logicTable.tabTiming', 'Timing diagram')}
        </button>
        <span className="lt-spacer" />
        {tab === 'table' && table && (
          <button className="lt-btn" onClick={copy} title={t('logicTable.copyTitle', 'Copy as tab-separated text (pastes into Word or Excel)')}>
            {copied ? t('logicTable.copied', 'Copied ✓') : t('logicTable.copy', 'Copy table')}
          </button>
        )}
        <button
          className="lt-btn"
          onClick={() => setOpen(false)}
          aria-label={t('logicTable.close', 'Close')}
        >
          ×
        </button>
      </div>

      <div className="lt-body">
        {!analysis.ok && analysis.problem && (
          <div className="lt-hint">{problemText[analysis.problem]}</div>
        )}

        {analysis.ok && (
          <>
            <div className="lt-options">
              {analysis.inputs.length > 1 && !(analysis.sequential && tab === 'timing') && (
                <span>
                  {t('logicTable.inputs', 'Inputs:')}{' '}
                  {analysis.inputs.map((i) => (
                    <label key={i.id} title={i.id}>
                      <input
                        type="checkbox"
                        checked={!skipped.has(i.id)}
                        onChange={() => toggleInput(i.id)}
                      />
                      {i.label}
                    </label>
                  ))}
                </span>
              )}
              {analysis.internals.length > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={showInternals}
                    onChange={(e) => setShowInternals(e.target.checked)}
                  />
                  {t('logicTable.internals', 'Show gate outputs (intermediate results)')}
                </label>
              )}
              {tab === 'timing' && analysis.sequential && analysis.clockId && (
                <label>
                  {t('logicTable.cycles', 'Clock periods:')}{' '}
                  <select value={cycles} onChange={(e) => setCycles(Number(e.target.value))}>
                    {[4, 8, 16, 32].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {tab === 'table' && (
              <>
                {analysis.sequential && (
                  <div className="lt-hint">
                    {t(
                      'logicTable.sequential',
                      'This circuit contains flip-flops. It has a memory, so the output does not depend on the switches alone — a truth table is not defined. The timing diagram shows how it behaves over time.',
                    )}
                  </div>
                )}
                {!analysis.sequential && tooMany && (
                  <div className="lt-hint lt-error">
                    {t('logicTable.tooMany', 'Too many inputs for one table (maximum {{max}}). Untick some switches above; they keep their current position.', { max: MAX_TABLE_INPUTS })}
                  </div>
                )}
                {!analysis.sequential && !tooMany && inputs.length === 0 && (
                  <div className="lt-hint">{t('logicTable.pickInput', 'Tick at least one input above.')}</div>
                )}
                {table && (
                  <div className="lt-split">
                    <table className="lt-table">
                      <thead>
                        <tr>
                          {table.inputs.map((s) => (
                            <th key={`i${s.id}`}>{s.label}</th>
                          ))}
                          {table.outputs.map((s, k) => (
                            <th key={`o${s.id}`} className={k === 0 ? 'lt-sep' : undefined}>
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, r) => (
                          <tr key={r} className={r === currentRow ? 'lt-current' : undefined}>
                            {row.inputs.map((v, j) => (
                              <td key={j} className={v ? 'lt-one' : 'lt-zero'}>
                                {v}
                              </td>
                            ))}
                            {row.outputs.map((v, k) => (
                              <td key={k} className={`${v ? 'lt-one' : 'lt-zero'}${k === 0 ? ' lt-sep' : ''}`}>
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="lt-expr">
                      <div className="lt-expr-title">
                        {t('logicTable.expression', 'Boolean expression')}{' '}
                        <label>
                          <input
                            type="checkbox"
                            checked={simplified}
                            onChange={(e) => setSimplified(e.target.checked)}
                          />{' '}
                          {t('logicTable.simplified', 'simplified')}
                        </label>
                      </div>
                      {expressionsFor(table).map(({ label, expr }) => (
                        <div key={label} className="lt-expr-line">
                          {label} = {simplified ? expr.simplified : expr.dnf}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'timing' && (
              <>
                {analysis.sequential && !analysis.clockId && (
                  <div className="lt-hint">
                    {t(
                      'logicTable.noClock',
                      'No clock switch found: wire a slide switch to the CLK pin of a flip-flop to get a timing diagram.',
                    )}
                  </div>
                )}
                {!analysis.sequential && tooMany && (
                  <div className="lt-hint lt-error">
                    {t('logicTable.tooMany', 'Too many inputs for one table (maximum {{max}}). Untick some switches above; they keep their current position.', { max: MAX_TABLE_INPUTS })}
                  </div>
                )}
                {timeline && <TimingDiagram timeline={timeline} sweep={!analysis.sequential} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const levelPath = (values: Bit[]): string => {
  const y = (v: Bit) => (v ? 5 : LANE_H - 5);
  let d = `M0 ${y(values[0] ?? 0)}`;
  values.forEach((v, i) => {
    if (i > 0 && v !== values[i - 1]) d += ` V${y(v)}`;
    d += ` H${(i + 1) * STEP_W}`;
  });
  return d;
};

const TimingDiagram: React.FC<{ timeline: Timeline; sweep: boolean }> = ({ timeline, sweep }) => {
  const { t } = useTranslation();
  const width = timeline.steps * STEP_W;
  return (
    <div className="lt-timing">
      <div className="lt-lane-label">{sweep ? t('logicTable.step', 'Step') : t('logicTable.time', 'Time')}</div>
      <svg className="lt-lane-svg" width={width} height={16} aria-hidden>
        {Array.from({ length: timeline.steps }, (_, i) => (
          <text key={i} className="lt-step-label" x={i * STEP_W + STEP_W / 2} y={11}>
            {i}
          </text>
        ))}
      </svg>
      {timeline.lanes.map((lane) => (
        <LaneRow key={lane.label} lane={lane} steps={timeline.steps} width={width} />
      ))}
    </div>
  );
};

const LaneRow: React.FC<{ lane: Timeline['lanes'][number]; steps: number; width: number }> = ({
  lane,
  steps,
  width,
}) => (
  <>
    <div className="lt-lane-label">{lane.label}</div>
    <svg
      className={`lt-lane-svg lt-role-${lane.role}`}
      width={width}
      height={LANE_H}
      role="img"
      aria-label={`${lane.label}: ${lane.values.join(' ')}`}
    >
      {Array.from({ length: steps + 1 }, (_, i) => (
        <line key={i} className="lt-grid" x1={i * STEP_W} x2={i * STEP_W} y1={0} y2={LANE_H} />
      ))}
      <path className="lt-lane-line" d={levelPath(lane.values)} />
    </svg>
  </>
);
