/**
 * pushSamples — a whole burst of edges in ONE store update, with exactly the
 * semantics of pushing them one by one (trigger, single-shot, ring buffer).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAX_SAMPLES, useOscilloscopeStore } from '../store/useOscilloscopeStore';
import { deliverEdges, type PinTimeCallback } from '../simulation/busWaveform';

const initialState = useOscilloscopeStore.getState();

function reset(mode: 'auto' | 'normal' | 'single' = 'auto') {
  useOscilloscopeStore.setState({
    ...initialState,
    channels: [],
    samples: {},
    triggerMode: mode,
    triggerChannelId: null,
    triggerEdge: 'rising',
    triggeredAtMs: null,
    triggerStatus: mode === 'auto' ? 'idle' : 'armed',
    running: true,
  });
  const st = useOscilloscopeStore.getState();
  st.addChannel('b', 1, 'D1');
  st.addChannel('b', 2, 'D2');
  return useOscilloscopeStore.getState().channels.map((c) => c.id);
}

const edges = (ch: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ channelId: ch, timeMs: i * 0.01, state: i % 2 === 1 }));

beforeEach(() => reset());

describe('pushSamples', () => {
  it('stores the same samples as repeated pushSample', () => {
    const [a, b] = reset();
    const batch = [...edges(a, 20), ...edges(b, 7)];
    useOscilloscopeStore.getState().pushSamples(batch);
    const viaBatch = useOscilloscopeStore.getState().samples;

    reset();
    for (const e of batch) useOscilloscopeStore.getState().pushSample(e.channelId, e.timeMs, e.state);
    const viaSingle = useOscilloscopeStore.getState().samples;
    expect(Object.values(viaBatch)).toEqual(Object.values(viaSingle));
  });

  it('is one store update for the whole burst', () => {
    const [a] = reset();
    const listener = vi.fn();
    const unsub = useOscilloscopeStore.subscribe(listener);
    useOscilloscopeStore.getState().pushSamples(edges(a, 500));
    unsub();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps only the newest MAX_SAMPLES (ring buffer)', () => {
    const [a] = reset();
    useOscilloscopeStore.getState().pushSamples(edges(a, MAX_SAMPLES + 50));
    const buf = useOscilloscopeStore.getState().samples[a];
    expect(buf).toHaveLength(MAX_SAMPLES);
    expect(buf[buf.length - 1].timeMs).toBeCloseTo((MAX_SAMPLES + 49) * 0.01);
  });

  it('ignores samples for unknown channels and does nothing when paused', () => {
    const [a] = reset();
    useOscilloscopeStore.getState().pushSamples([{ channelId: 'nope', timeMs: 1, state: true }]);
    expect(useOscilloscopeStore.getState().samples[a]).toHaveLength(0);
    useOscilloscopeStore.setState({ running: false });
    useOscilloscopeStore.getState().pushSamples(edges(a, 4));
    expect(useOscilloscopeStore.getState().samples[a]).toHaveLength(0);
  });

  it('single-shot trigger freezes the scope inside a burst, like one-by-one pushes', () => {
    const [a] = reset('single');
    // rising edge at index 2 (false, false→true is the 2nd sample: state i%2===1)
    useOscilloscopeStore.getState().pushSamples(edges(a, 10));
    const st = useOscilloscopeStore.getState();
    expect(st.triggerStatus).toBe('captured');
    expect(st.running).toBe(false);
    const frozen = st.samples[a].length;

    reset('single');
    for (const e of edges(a, 10)) useOscilloscopeStore.getState().pushSample(e.channelId, e.timeMs, e.state);
    expect(useOscilloscopeStore.getState().samples[a].length).toBe(frozen);
  });
});

describe('deliverEdges', () => {
  const list = [
    { pin: 1, state: true, timeMs: 1 },
    { pin: 2, state: false, timeMs: 2 },
  ];
  it('uses batch() when the callback has one', () => {
    const single = vi.fn();
    const batch = vi.fn();
    const cb: PinTimeCallback = (p, s, t) => single(p, s, t);
    cb.batch = batch;
    deliverEdges(cb, list);
    expect(batch).toHaveBeenCalledWith(list);
    expect(single).not.toHaveBeenCalled();
  });
  it('falls back to one call per edge', () => {
    const single = vi.fn();
    deliverEdges((p, s, t) => single(p, s, t), list);
    expect(single).toHaveBeenCalledTimes(2);
    expect(single).toHaveBeenCalledWith(2, false, 2);
  });
  it('is a no-op without a callback or edges', () => {
    expect(() => deliverEdges(null, list)).not.toThrow();
    const single = vi.fn();
    deliverEdges((p, s, t) => single(p, s, t), []);
    expect(single).not.toHaveBeenCalled();
  });
});
