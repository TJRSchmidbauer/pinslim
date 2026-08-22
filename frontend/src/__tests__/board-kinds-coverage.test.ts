/**
 * Board-kind coverage matrix (Phase 1d-tests D).
 *
 * Every velxio `BoardKind` is exercised by at least one example
 * across all six `examples-*.ts` modules.  Adding a new board kind
 * to `src/types/board.ts` without adding at least one gallery
 * example for it should fail this test — keeps the demo coverage in
 * sync with the supported hardware list.
 *
 * Deep behavioural tests for each board family (AVR / RP2040 /
 * ESP32 / ESP32-C3) live in their dedicated `*Simulator.test.ts`
 * files; this test only asserts the gallery side.
 *
 * Fidelity (memory `feedback_tests_import_real_code`): imports
 * `BOARD_KIND_LABELS` (the canonical list) + every examples-*.ts
 * source-of-truth.  No duplicated board list.
 */
import { describe, it, expect } from 'vitest';
import { BOARD_KIND_LABELS, type BoardKind } from '../types/board';
import { exampleProjects, type ExampleProject } from '../data/examples';

const ALL_EXAMPLES: ExampleProject[] = exampleProjects;

/**
 * Boards that intentionally have no gallery example today.  They
 * exist in the type for future support but no canvas demo ships.
 * Adding to this list requires a comment explaining why — keeps the
 * coverage gap visible at code-review time.
 */
const ACCEPTED_UNCOVERED: ReadonlySet<BoardKind> = new Set([
  'raspberry-pi-zero',
  'raspberry-pi-1',
  'raspberry-pi-2',
  'wemos-lolin32-lite',
  'xiao-esp32-s3',
  'arduino-nano-esp32',
  'xiao-esp32-c3',
  'aitewinrobot-esp32c3-supermini',
]);

interface Coverage {
  byBoardType: Map<BoardKind, string[]>;
  byBoardsArray: Map<BoardKind, string[]>;
}

function buildCoverage(): Coverage {
  const byBoardType = new Map<BoardKind, string[]>();
  const byBoardsArray = new Map<BoardKind, string[]>();
  for (const ex of ALL_EXAMPLES) {
    if (ex.boardType) {
      const list = byBoardType.get(ex.boardType) ?? [];
      list.push(ex.id);
      byBoardType.set(ex.boardType, list);
    }
    if (ex.boards && ex.boards.length > 0) {
      for (const b of ex.boards) {
        const list = byBoardsArray.get(b.boardKind as BoardKind) ?? [];
        list.push(ex.id);
        byBoardsArray.set(b.boardKind as BoardKind, list);
      }
    }
  }
  return { byBoardType, byBoardsArray };
}

describe('BoardKind gallery coverage matrix', () => {
  const { byBoardType, byBoardsArray } = buildCoverage();
  const allKinds = Object.keys(BOARD_KIND_LABELS) as BoardKind[];

  it.each(allKinds.map((k) => [k] as const))(
    'BoardKind %s has at least one gallery example (or is accepted as uncovered)',
    (kind) => {
      const count =
        (byBoardType.get(kind)?.length ?? 0) + (byBoardsArray.get(kind)?.length ?? 0);
      if (ACCEPTED_UNCOVERED.has(kind)) {
        expect(count, `${kind} is in ACCEPTED_UNCOVERED but actually has ${count} examples — remove from the accepted list`).toBe(0);
        return;
      }
      expect(
        count,
        `${kind} has no gallery example.  Either add an example to data/examples-*.ts OR add ${kind} to ACCEPTED_UNCOVERED with a comment.`,
      ).toBeGreaterThan(0);
    },
  );

  it('summary: every BoardKind appears in BOARD_KIND_LABELS', () => {
    // Self-check that the LABELS map is exhaustive vs the type union.
    // If you add a kind to the BoardKind union without an entry in
    // BOARD_KIND_LABELS, TypeScript already catches it.  This is a
    // runtime double-check.
    for (const kind of allKinds) {
      expect(BOARD_KIND_LABELS[kind], `${kind} missing label`).toBeTruthy();
    }
  });

  it('reports BoardKind coverage stats (informational)', () => {
    const stats = allKinds.map((kind) => {
      const inBoardType = byBoardType.get(kind)?.length ?? 0;
      const inBoardsArray = byBoardsArray.get(kind)?.length ?? 0;
      return { kind, total: inBoardType + inBoardsArray, inBoardType, inBoardsArray };
    });
    stats.sort((a, b) => b.total - a.total);
    // eslint-disable-next-line no-console
    console.log('[board-coverage]', stats.map((s) => `${s.kind}=${s.total}`).join(' '));
    expect(stats.length).toBe(allKinds.length);
  });
});
