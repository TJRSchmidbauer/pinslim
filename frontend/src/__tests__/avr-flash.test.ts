/**
 * STK500v1 flashing against a simulated Optiboot bootloader.
 */
import { describe, it, expect } from 'vitest';
import {
  FlashError,
  flashStk500v1,
  parseHexForFlash,
  type SerialLink,
} from '../lib/avrFlash';

const hexLine = (addr: number, data: number[], type = 0): string => {
  const bytes = [data.length, (addr >> 8) & 0xff, addr & 0xff, type, ...data];
  const sum = bytes.reduce((a, b) => (a + b) & 0xff, 0);
  return ':' + [...bytes, (0x100 - sum) & 0xff].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
};
const makeHex = (image: number[]): string => {
  const lines: string[] = [];
  for (let i = 0; i < image.length; i += 16) lines.push(hexLine(i, image.slice(i, i + 16)));
  lines.push(':00000001FF');
  return lines.join('\n') + '\n';
};
const sample = (n: number) => Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0xff);

/** Minimal Optiboot: sync, signature, load address, program / read page. */
class FakeBootloader implements SerialLink {
  flash = new Uint8Array(32768).fill(0xff);
  signature = [0x1e, 0x95, 0x0f];
  ignoreSyncs: number;
  corruptWrites = false;
  resetPulses = 0;
  private rx: number[] = [];
  private tx: number[] = [];
  private addr = 0;
  commands: number[] = [];

  constructor(ignoreSyncs = 0) {
    this.ignoreSyncs = ignoreSyncs;
  }

  async setSignals(s: { dataTerminalReady?: boolean }) {
    if (s.dataTerminalReady === true) this.resetPulses++;
  }
  discardInput() {
    this.tx = [];
  }
  async write(data: Uint8Array) {
    this.rx.push(...data);
    this.process();
  }
  async read(n: number): Promise<Uint8Array> {
    if (this.tx.length < n) throw new FlashError('timeout', 'timeout');
    return Uint8Array.from(this.tx.splice(0, n));
  }

  private reply(...b: number[]) {
    this.tx.push(0x14, ...b, 0x10);
  }
  private process() {
    for (;;) {
      const [cmd] = this.rx;
      if (cmd === undefined) return;
      const need =
        cmd === 0x30 || cmd === 0x50 || cmd === 0x51 || cmd === 0x75 ? 2
        : cmd === 0x55 ? 4
        : cmd === 0x74 ? 5
        : cmd === 0x64 ? (this.rx.length >= 3 ? 5 + ((this.rx[1] << 8) | this.rx[2]) : Infinity)
        : 1;
      if (this.rx.length < need) return;
      const f = this.rx.splice(0, need);
      this.commands.push(cmd);
      switch (cmd) {
        case 0x30:
          if (this.ignoreSyncs > 0) this.ignoreSyncs--;
          else this.reply();
          break;
        case 0x75:
          this.reply(...this.signature);
          break;
        case 0x50:
        case 0x51:
          this.reply();
          break;
        case 0x55:
          this.addr = ((f[2] << 8) | f[1]) * 2;
          this.reply();
          break;
        case 0x64: {
          const len = (f[1] << 8) | f[2];
          const data = f.slice(4, 4 + len);
          if (this.corruptWrites) data[5] ^= 0x01;
          this.flash.set(data, this.addr);
          this.reply();
          break;
        }
        case 0x74: {
          const len = (f[1] << 8) | f[2];
          this.reply(...this.flash.subarray(this.addr, this.addr + len));
          break;
        }
        default:
          this.tx.push(0x15);
      }
    }
  }
}

const fast = { syncTimeoutMs: 1 };

describe('parseHexForFlash', () => {
  it('fills gaps with 0xFF and keeps the data in place', () => {
    const hex = [hexLine(0, [1, 2, 3]), hexLine(0x10, [9]), ':00000001FF'].join('\n');
    const img = parseHexForFlash(hex);
    expect(img.length).toBe(0x11);
    expect([...img.slice(0, 4)]).toEqual([1, 2, 3, 0xff]);
    expect(img[0x10]).toBe(9);
  });
  it('rejects a corrupted checksum', () => {
    const bad = makeHex(sample(32)).replace(/..\n/, '00\n');
    expect(() => parseHexForFlash(bad)).toThrow(FlashError);
  });
  it('rejects a file without end-of-file record', () => {
    expect(() => parseHexForFlash(hexLine(0, [1, 2]))).toThrow(/empty or incomplete/);
  });
  it('handles Windows line endings', () => {
    const hex = makeHex([1, 2, 3, 4]).replace(/\n/g, '\r\n');
    expect([...parseHexForFlash(hex)]).toEqual([1, 2, 3, 4]);
  });
  it('applies an extended linear address record (type 04)', () => {
    const hex = [hexLine(0, [0, 1], 4), hexLine(0x10, [5, 6]), ':00000001FF'].join('\n');
    // upper address 0x0001 → data lands at 0x10010
    const img = parseHexForFlash(hex);
    expect(img.length).toBe(0x10012);
    expect(img[0x10010]).toBe(5);
  });
});

describe('flashStk500v1', () => {
  it('writes the program and verifies it', async () => {
    const boot = new FakeBootloader();
    const prog = sample(1000);
    const progress: number[] = [];
    const r = await flashStk500v1(boot, makeHex(prog), { ...fast, onProgress: (p) => progress.push(p) });
    expect(r.bytes).toBe(1000);
    expect(r.signature).toBe('1e950f');
    expect([...boot.flash.subarray(0, 1000)]).toEqual(prog);
    // the rest of the last page is erased flash
    expect(boot.flash[1000]).toBe(0xff);
    expect(progress[progress.length - 1]).toBe(100);
    expect([...progress]).toEqual([...progress].sort((a, b) => a - b)); // monotonic
    expect(boot.resetPulses).toBe(1);
  });

  it('keeps trying to sync until the bootloader listens', async () => {
    const boot = new FakeBootloader(5);
    await flashStk500v1(boot, makeHex(sample(200)), fast);
    expect([...boot.flash.subarray(0, 200)]).toEqual(sample(200));
  });

  it('reports no-sync when the bootloader never answers', async () => {
    const boot = new FakeBootloader(1000);
    await expect(flashStk500v1(boot, makeHex(sample(64)), { ...fast, syncAttempts: 4 })).rejects.toMatchObject({
      code: 'no-sync',
    });
    // nothing was written
    expect(boot.flash.every((b) => b === 0xff)).toBe(true);
  });

  it('detects a write that did not stick', async () => {
    const boot = new FakeBootloader();
    boot.corruptWrites = true;
    await expect(flashStk500v1(boot, makeHex(sample(300)), fast)).rejects.toMatchObject({ code: 'verify' });
  });

  it('refuses a program that does not fit', async () => {
    const boot = new FakeBootloader();
    await expect(flashStk500v1(boot, makeHex(sample(33000)), fast)).rejects.toMatchObject({ code: 'too-big' });
    expect(boot.commands).toEqual([]); // not even a reset or sync
  });

  it('can skip verification', async () => {
    const boot = new FakeBootloader();
    await flashStk500v1(boot, makeHex(sample(256)), { ...fast, verify: false });
    expect(boot.commands.includes(0x74)).toBe(false);
  });

  it('leaves programming mode at the end', async () => {
    const boot = new FakeBootloader();
    await flashStk500v1(boot, makeHex(sample(128)), fast);
    expect(boot.commands[boot.commands.length - 1]).toBe(0x51);
  });

  it('a page boundary program (exactly 128 bytes) writes one page', async () => {
    const boot = new FakeBootloader();
    await flashStk500v1(boot, makeHex(sample(128)), fast);
    expect(boot.commands.filter((c) => c === 0x64)).toHaveLength(1);
  });
});
