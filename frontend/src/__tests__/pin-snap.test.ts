import { describe, it, expect } from 'vitest';
import { pickNearestPin, PIN_SNAP_RADIUS_PX } from '../utils/pinSnap';

const box = (id: string, cx: number, cy: number, size = 28) => ({
  id,
  left: cx - size / 2,
  top: cy - size / 2,
  right: cx + size / 2,
  bottom: cy + size / 2,
});

describe('pickNearestPin (touch wiring snap)', () => {
  const pins = [box('a', 100, 100), box('b', 160, 100), box('c', 100, 160)];

  it('a touch inside a box picks that box', () => {
    expect(pickNearestPin(pins, 104, 96)?.id).toBe('a');
  });

  it('a touch beside a box still snaps to it', () => {
    // 14 px box half-width + 12 px = 26 from the centre: 12 px off the edge.
    expect(pickNearestPin(pins, 126, 100)?.id).toBe('a');
  });

  it('prefers the nearer of two boxes', () => {
    // between a (100) and b (160): 138 is 24 off a's edge... and 8 off b's.
    expect(pickNearestPin(pins, 138, 100)?.id).toBe('b');
  });

  it('inside beats nearby: a box under the finger wins over a closer centre', () => {
    const inside = box('inside', 100, 100, 28); // x 86..114
    const near = box('near', 118, 100, 4); // tiny box, centre closer to x=113
    expect(pickNearestPin([near, inside], 113, 100)?.id).toBe('inside');
  });

  it('nothing snaps beyond the radius', () => {
    const far = 100 + 14 + PIN_SNAP_RADIUS_PX + 1;
    expect(pickNearestPin([box('a', 100, 100)], far, 100)).toBeNull();
  });

  it('the radius edge itself still snaps', () => {
    const edge = 100 + 14 + PIN_SNAP_RADIUS_PX;
    expect(pickNearestPin([box('a', 100, 100)], edge, 100)?.id).toBe('a');
  });

  it('skips boxes that are not laid out (zero width)', () => {
    const hidden = { id: 'h', left: 100, top: 100, right: 100, bottom: 100 };
    expect(pickNearestPin([hidden], 100, 100)).toBeNull();
  });

  it('measures corner distance, not just per axis', () => {
    // 20 px off in x AND 20 px off in y from the corner: ~28 px > 24 radius.
    const a = box('a', 100, 100); // right 114, bottom 114
    expect(pickNearestPin([a], 134, 134)).toBeNull();
    expect(pickNearestPin([a], 128, 128)?.id).toBe('a'); // ~19.8 px
  });

  it('empty list gives null', () => {
    expect(pickNearestPin([], 0, 0)).toBeNull();
  });
});
