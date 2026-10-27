/**
 * Serial plotter: draws the numbers a sketch prints as curves (see
 * simulation/serialPlot.ts for the accepted formats). Lives next to the text
 * view in the serial monitor.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVar } from '../../lib/theme';
import { useResolvedTheme } from '../../hooks/useTheme';
import {
  SerialPlot,
  niceTicks,
  plotExtent,
  plotToCsv,
  type PlotCurve,
} from '../../simulation/serialPlot';

/** Distinguishable on white and on dark panels alike. */
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

const WINDOWS = [100, 300, 1000, 0]; // samples; 0 = everything collected

const fmt = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(2);
};

interface Props {
  /** Everything the board has printed so far. */
  text: string;
  onClear: () => void;
}

export const SerialPlotter: React.FC<Props> = ({ text, onClear }) => {
  const { t } = useTranslation();
  const plotRef = useRef(new SerialPlot());
  const seen = useRef(0);
  const [version, setVersion] = useState(0);
  const [windowSamples, setWindowSamples] = useState(300);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const theme = useResolvedTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The curves are frozen while paused; new data keeps being collected.
  const frozen = useRef<PlotCurve[] | null>(null);

  // Feed only what is new. A shorter string means the monitor was cleared.
  useEffect(() => {
    if (text.length < seen.current) {
      plotRef.current.clear();
      seen.current = 0;
    }
    const fresh = text.slice(seen.current);
    seen.current = text.length;
    if (fresh && plotRef.current.feed(fresh)) setVersion((v) => v + 1);
  }, [text]);

  const live = useMemo(
    () => plotRef.current.curves.map((c) => ({ name: c.name, points: c.points.slice() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  if (!paused) frozen.current = null;
  else if (frozen.current === null) frozen.current = live;
  const curves = paused && frozen.current ? frozen.current : live;

  const extent = useMemo(() => plotExtent(curves, windowSamples, hidden), [curves, windowSamples, hidden]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const left = 46;
    const right = 10;
    const top = 8;
    const bottom = 18;
    const w = width - left - right;
    const h = height - top - bottom;
    ctx.font = '10px monospace';

    if (!extent) {
      ctx.fillStyle = cssVar('--wb-10');
      ctx.fillText(t('editor.serial.plot.empty', 'Waiting for numbers … print e.g. Serial.println(value);'), left + 6, top + 16);
      return;
    }
    const { x0, x1, yMin, yMax } = extent;
    const X = (x: number) => left + ((x - x0) / Math.max(1, x1 - x0)) * w;
    const Y = (y: number) => top + (1 - (y - yMin) / (yMax - yMin)) * h;

    // grid + y labels
    ctx.strokeStyle = cssVar('--wb-4');
    ctx.fillStyle = cssVar('--wb-10');
    ctx.lineWidth = 1;
    for (const tv of niceTicks(yMin, yMax, Math.max(2, Math.floor(h / 36)))) {
      const y = Math.round(Y(tv)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(fmt(tv), left - 5, y + 3);
    }
    // x labels
    ctx.textAlign = 'center';
    for (const tv of niceTicks(x0, x1, Math.max(2, Math.floor(w / 90)))) {
      ctx.fillText(String(Math.round(tv)), X(tv), top + h + 12);
    }
    ctx.strokeStyle = cssVar('--color-border-strong');
    ctx.strokeRect(left + 0.5, top + 0.5, w, h);

    // curves
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    curves.forEach((c, i) => {
      if (hidden.has(c.name)) return;
      ctx.strokeStyle = PALETTE[i % PALETTE.length];
      ctx.beginPath();
      let started = false;
      for (const p of c.points) {
        if (p.x < x0) continue;
        const px = X(p.x);
        const py = Y(p.y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    });
    ctx.restore();

    // crosshair
    if (hover !== null && hover >= x0 && hover <= x1) {
      const hx = Math.round(X(hover)) + 0.5;
      ctx.strokeStyle = cssVar('--wb-9');
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, top);
      ctx.lineTo(hx, top + h);
      ctx.stroke();
      ctx.setLineDash([]);
      curves.forEach((c, i) => {
        if (hidden.has(c.name)) return;
        const p = c.points.find((q) => q.x === hover);
        if (!p) return;
        ctx.fillStyle = PALETTE[i % PALETTE.length];
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, extent, hidden, hover, theme]);

  const onMove = (e: React.MouseEvent) => {
    if (!extent) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = 46;
    const w = rect.width - left - 10;
    const f = (e.clientX - rect.left - left) / w;
    if (f < 0 || f > 1) return setHover(null);
    setHover(Math.round(extent.x0 + f * Math.max(1, extent.x1 - extent.x0)));
  };

  const valueAt = (c: PlotCurve): number | undefined => {
    if (hover !== null) return c.points.find((p) => p.x === hover)?.y;
    return c.points[c.points.length - 1]?.y;
  };

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(plotToCsv(curves));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const clear = () => {
    plotRef.current.clear();
    setVersion((v) => v + 1);
    onClear();
  };

  const btn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--wb-8)',
    color: 'var(--wb-12)',
    padding: '2px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--wb-0)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '4px 10px', borderBottom: '1px solid var(--wb-6)', fontSize: 11 }}>
        {curves.length === 0 && (
          <span style={{ color: 'var(--wb-10)' }}>{t('editor.serial.plot.hint', 'Prints like "value", "a,b,c" or "name:value" are drawn.')}</span>
        )}
        {curves.map((c, i) => (
          <button
            key={c.name}
            onClick={() => toggle(c.name)}
            title={t('editor.serial.plot.toggleCurve', 'Show / hide this curve')}
            style={{ ...btn, opacity: hidden.has(c.name) ? 0.4 : 1, display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: 'inline-block' }} />
            {c.name}
            <b style={{ fontWeight: 600 }}>{valueAt(c) === undefined ? '–' : fmt(valueAt(c)!)}</b>
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <label style={{ color: 'var(--wb-10)' }}>
          {t('editor.serial.plot.window', 'Window:')}{' '}
          <select value={windowSamples} onChange={(e) => setWindowSamples(Number(e.target.value))} style={{ ...btn, padding: '1px 4px' }}>
            {WINDOWS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t('editor.serial.plot.all', 'all') : t('editor.serial.plot.samples', '{{n}} samples', { n })}
              </option>
            ))}
          </select>
        </label>
        <button style={btn} onClick={() => setPaused((p) => !p)}>
          {paused ? `▶ ${t('editor.serial.plot.resume', 'Resume')}` : `⏸ ${t('editor.serial.plot.pause', 'Pause')}`}
        </button>
        <button style={btn} onClick={copyCsv} disabled={curves.length === 0}>
          {copied ? t('editor.serial.plot.copied', 'Copied ✓') : t('editor.serial.plot.csv', 'Copy as CSV')}
        </button>
        <button style={btn} onClick={clear}>
          {t('editor.serial.clear')}
        </button>
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
