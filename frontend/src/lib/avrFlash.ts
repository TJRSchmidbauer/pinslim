/**
 * Flash an Arduino Uno / Nano over Web Serial with the STK500v1 protocol that
 * their Optiboot bootloader speaks — no helper program, straight from the
 * browser. The transport is abstracted (`SerialLink`) so the protocol runs
 * unchanged against a simulated bootloader in the tests.
 *
 * Not covered: the Arduino Mega 2560 (its bootloader speaks STK500v2) and
 * boards flashed through a programmer.
 */

export type FlashErrorCode =
  | 'no-sync'
  | 'timeout'
  | 'protocol'
  | 'verify'
  | 'too-big'
  | 'bad-hex'
  | 'closed';

export class FlashError extends Error {
  readonly code: FlashErrorCode;
  constructor(code: FlashErrorCode, message: string) {
    super(message);
    this.name = 'FlashError';
    this.code = code;
  }
}

/** What the flasher needs from a serial port. */
export interface SerialLink {
  write(data: Uint8Array): Promise<void>;
  /** Exactly `n` bytes, or a `timeout` FlashError after `timeoutMs`. */
  read(n: number, timeoutMs: number): Promise<Uint8Array>;
  /** Drop anything received so far (a failed sync leaves stale bytes). */
  discardInput(): void;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}

// ── Intel HEX ────────────────────────────────────────────────────────────

/**
 * Intel HEX → flash image, unprogrammed bytes 0xFF. Checksums are verified:
 * a hex file damaged in transit must not be written to a chip.
 */
export function parseHexForFlash(text: string): Uint8Array {
  const chunks: { addr: number; data: number[] }[] = [];
  let base = 0;
  let end = 0;
  let sawEof = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(':')) continue;
    const bytes: number[] = [];
    for (let i = 1; i + 1 < line.length; i += 2) bytes.push(parseInt(line.slice(i, i + 2), 16));
    if (bytes.some(Number.isNaN) || bytes.length < 5) throw new FlashError('bad-hex', 'Malformed HEX line');
    const sum = bytes.reduce((a, b) => (a + b) & 0xff, 0);
    if (sum !== 0) throw new FlashError('bad-hex', 'HEX checksum error');
    const [len, hi, lo, type] = bytes;
    const data = bytes.slice(4, 4 + len);
    if (type === 0x00) {
      const addr = base + ((hi << 8) | lo);
      chunks.push({ addr, data });
      end = Math.max(end, addr + len);
    } else if (type === 0x01) {
      sawEof = true;
      break;
    } else if (type === 0x02) {
      base = ((data[0] << 8) | data[1]) << 4;
    } else if (type === 0x04) {
      base = ((data[0] << 8) | data[1]) << 16;
    }
  }
  if (!sawEof || end === 0) throw new FlashError('bad-hex', 'HEX file is empty or incomplete');
  const image = new Uint8Array(end).fill(0xff);
  for (const c of chunks) image.set(c.data, c.addr);
  return image;
}

// ── STK500v1 ─────────────────────────────────────────────────────────────

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const CRC_EOP = 0x20;
const GET_SYNC = 0x30;
const ENTER_PROGMODE = 0x50;
const LEAVE_PROGMODE = 0x51;
const LOAD_ADDRESS = 0x55;
const PROG_PAGE = 0x64;
const READ_PAGE = 0x74;
const READ_SIGN = 0x75;

export const AVR_PAGE_BYTES = 128;
/** ATmega328P flash minus the 512-byte Optiboot section. */
export const UNO_MAX_BYTES = 32256;

const SIGNATURES: Record<string, string> = {
  '1e950f': 'ATmega328P',
  '1e9514': 'ATmega328',
  '1e9406': 'ATmega168',
  '1e9415': 'ATmega168PB',
};

export interface Stk500Options {
  /** Bytes per flash page (128 on the ATmega328P / 168). */
  pageBytes?: number;
  /** Largest image the bootloader leaves room for. */
  maxBytes?: number;
  verify?: boolean;
  /** Pulse DTR/RTS first so the board restarts into its bootloader. */
  resetPulse?: boolean;
  syncAttempts?: number;
  syncTimeoutMs?: number;
  onProgress?: (pct: number, line?: string) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function command(link: SerialLink, frame: number[], extra = 0, timeoutMs = 1000): Promise<Uint8Array> {
  await link.write(Uint8Array.from(frame));
  const reply = await link.read(2 + extra, timeoutMs);
  if (reply[0] !== STK_INSYNC || reply[reply.length - 1] !== STK_OK) {
    throw new FlashError('protocol', `Unexpected bootloader reply ${[...reply].map((b) => b.toString(16)).join(' ')}`);
  }
  return reply.slice(1, reply.length - 1);
}

export async function resetIntoBootloader(link: SerialLink): Promise<void> {
  await link.setSignals({ dataTerminalReady: false, requestToSend: false });
  await sleep(250);
  await link.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
}

/**
 * Write `hex` (Intel HEX text) to the board. Resolves with the number of
 * bytes written; rejects with a {@link FlashError}.
 */
export async function flashStk500v1(
  link: SerialLink,
  hex: string,
  opts: Stk500Options = {},
): Promise<{ bytes: number; signature: string }> {
  const {
    pageBytes = AVR_PAGE_BYTES,
    maxBytes = UNO_MAX_BYTES,
    verify = true,
    resetPulse = true,
    syncAttempts = 12,
    syncTimeoutMs = 120,
    onProgress = () => {},
  } = opts;

  const image = parseHexForFlash(hex);
  if (image.length > maxBytes) {
    throw new FlashError('too-big', `Program is ${image.length} bytes, the board has room for ${maxBytes}`);
  }
  const padded = new Uint8Array(Math.ceil(image.length / pageBytes) * pageBytes).fill(0xff);
  padded.set(image);

  onProgress(2, 'Restarting the board into its bootloader...');
  if (resetPulse) await resetIntoBootloader(link);

  // Sync: the bootloader only listens for a short window after reset.
  let synced = false;
  for (let i = 0; i < syncAttempts && !synced; i++) {
    link.discardInput();
    try {
      await link.write(Uint8Array.from([GET_SYNC, CRC_EOP]));
      const r = await link.read(2, syncTimeoutMs);
      synced = r[0] === STK_INSYNC && r[1] === STK_OK;
    } catch (e) {
      if (!(e instanceof FlashError) || e.code !== 'timeout') throw e;
    }
  }
  if (!synced) throw new FlashError('no-sync', 'The bootloader did not answer');
  onProgress(8, 'Bootloader found.');

  // Signature check: catches "wrong board selected" before anything is written.
  const sig = [...(await command(link, [READ_SIGN, CRC_EOP], 3))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  onProgress(10, `Chip signature ${sig.toUpperCase()}${SIGNATURES[sig] ? ` (${SIGNATURES[sig]})` : ''}`);

  await command(link, [ENTER_PROGMODE, CRC_EOP]);

  const pages = padded.length / pageBytes;
  for (let p = 0; p < pages; p++) {
    const addrWords = (p * pageBytes) >> 1;
    await command(link, [LOAD_ADDRESS, addrWords & 0xff, (addrWords >> 8) & 0xff, CRC_EOP]);
    const page = padded.subarray(p * pageBytes, (p + 1) * pageBytes);
    await command(link, [PROG_PAGE, (pageBytes >> 8) & 0xff, pageBytes & 0xff, 0x46, ...page, CRC_EOP], 0, 2000);
    onProgress(10 + Math.round(((p + 1) / pages) * (verify ? 45 : 85)));
  }

  if (verify) {
    onProgress(55, 'Verifying...');
    for (let p = 0; p < pages; p++) {
      const addrWords = (p * pageBytes) >> 1;
      await command(link, [LOAD_ADDRESS, addrWords & 0xff, (addrWords >> 8) & 0xff, CRC_EOP]);
      const back = await command(
        link,
        [READ_PAGE, (pageBytes >> 8) & 0xff, pageBytes & 0xff, 0x46, CRC_EOP],
        pageBytes,
        2000,
      );
      const want = padded.subarray(p * pageBytes, (p + 1) * pageBytes);
      for (let i = 0; i < pageBytes; i++) {
        if (back[i] !== want[i]) {
          throw new FlashError(
            'verify',
            `Verification failed at 0x${(p * pageBytes + i).toString(16)}: wrote ${want[i]}, read ${back[i]}`,
          );
        }
      }
      onProgress(55 + Math.round(((p + 1) / pages) * 40));
    }
  }

  await command(link, [LEAVE_PROGMODE, CRC_EOP]);
  onProgress(100, `Wrote ${image.length} bytes.`);
  return { bytes: image.length, signature: sig };
}

// ── Web Serial transport ─────────────────────────────────────────────────

export class WebSerialLink implements SerialLink {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buf: number[] = [];
  private pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  private port: SerialPort;

  private constructor(port: SerialPort) {
    this.port = port;
    this.reader = port.readable!.getReader();
    this.writer = port.writable!.getWriter();
  }

  static async open(port: SerialPort, baudRate: number): Promise<WebSerialLink> {
    await port.open({ baudRate });
    return new WebSerialLink(port);
  }

  async write(data: Uint8Array): Promise<void> {
    await this.writer.write(data);
  }

  async read(n: number, timeoutMs: number): Promise<Uint8Array> {
    const deadline = Date.now() + timeoutMs;
    while (this.buf.length < n) {
      const left = deadline - Date.now();
      if (left <= 0) throw new FlashError('timeout', 'Timed out waiting for the board');
      // A read that outlives its timeout is kept and reused by the next call.
      this.pending ??= this.reader.read();
      const r = await Promise.race([this.pending, sleep(left).then(() => null)]);
      if (r === null) throw new FlashError('timeout', 'Timed out waiting for the board');
      this.pending = null;
      if (r.done) throw new FlashError('closed', 'The serial port was closed');
      this.buf.push(...r.value);
    }
    return Uint8Array.from(this.buf.splice(0, n));
  }

  discardInput(): void {
    this.buf = [];
  }

  async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> {
    await this.port.setSignals(signals);
  }

  async close(): Promise<void> {
    try {
      await this.reader.cancel();
    } catch {
      /* already closed */
    }
    this.reader.releaseLock();
    try {
      await this.writer.close();
    } catch {
      /* already closed */
    }
    await this.port.close();
  }
}
