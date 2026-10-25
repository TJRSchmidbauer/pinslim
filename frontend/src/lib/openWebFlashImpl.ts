import { ESPLoader, Transport } from 'esptool-js';
import type { WebFlashImpl, WebFlashRequest, WebFlashResult } from './proWebFlash';
import { FlashError, WebSerialLink, flashStk500v1 } from './avrFlash';
import { chipMismatch, flashFamilyOf, isAvrFamily, isEspFamily } from './flashHelp';

let pregrantedPort: SerialPort | null = null;

// esptool-js 0.6 takes the image as bytes; handing it a binary string
// (the pre-0.5 API) made writeFlash fail.
function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const openWebFlashImpl: WebFlashImpl = {
  available(boardKind: string): boolean {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      return false;
    }
    const family = flashFamilyOf(boardKind);
    // The Mega's bootloader speaks STK500v2, which is not implemented.
    return family !== null && family !== 'avr-mega';
  },

  async preparePort(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }
    pregrantedPort = await navigator.serial.requestPort();
  },

  async flash(req: WebFlashRequest): Promise<WebFlashResult> {
    const startTime = Date.now();
    req.onProgress({ phase: 'connecting', pct: 0, line: 'Connecting to device via Web Serial...' });

    let port = pregrantedPort;
    pregrantedPort = null;

    if (!port) {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not available.');
      }
      port = await navigator.serial.requestPort();
    }

    const family = flashFamilyOf(req.boardKind);

    if (isEspFamily(family)) {
      const image = base64ToBytes(req.binaryBase64);
      req.onProgress({ phase: 'connecting', pct: 10, line: 'Opening serial transport at 115200 baud...' });
      const transport = new Transport(port);
      
      const terminal = {
        clean() {},
        writeLine(data: string) {
          req.onProgress({ phase: 'writing', pct: 50, line: data });
        },
        write(data: string) {
          req.onProgress({ phase: 'writing', pct: 50, line: data });
        },
      };

      const esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal,
      });

      try {
        req.onProgress({ phase: 'connecting', pct: 20, line: 'Connecting to ESP bootloader...' });
        const chipName = await esploader.main();
        req.onProgress({ phase: 'erasing', pct: 30, line: `Detected chip: ${chipName}` });

        // Refuse before writing: an image for another chip flashes fine and
        // then never boots, which looks like a broken board.
        const wrong = chipMismatch(req.boardKind, chipName);
        if (wrong) {
          throw new Error(
            `Chip mismatch: this project is for a ${wrong.expected} board — expects ${wrong.expected}, connected chip is ${wrong.found}`,
          );
        }

        req.onProgress({ phase: 'writing', pct: 40, line: 'Writing binary image to flash...' });
        
        await esploader.writeFlash({
          // The backend returns a MERGED image (bootloader, partition table
          // and app at their real offsets, starting at 0x0) — writing it at
          // the app offset 0x10000 shifted everything and the chip never
          // booted.
          fileArray: [{ data: image, address: 0x0 }],
          flashMode: 'keep',
          flashFreq: 'keep',
          flashSize: 'keep',
          eraseAll: false,
          compress: true,
          reportProgress: (_fileIndex: number, written: number, total: number) => {
            const pct = Math.round(40 + (written / total) * 55);
            req.onProgress({ phase: 'writing', pct, line: `Writing: ${Math.round((written / total) * 100)}%` });
          },
        });

        req.onProgress({ phase: 'resetting', pct: 98, line: 'Hard resetting ESP chip...' });
        await esploader.after();

        const elapsedMs = Date.now() - startTime;
        req.onProgress({ phase: 'writing', pct: 100, line: 'Flashing completed successfully!' });
        return {
          chipName: chipName || 'ESP32',
          elapsedMs,
        };
      } finally {
        await transport.disconnect();
      }
    } else if (isAvrFamily(family)) {
      // Uno / Nano: STK500v1 to the Optiboot bootloader. The compiled program
      // of an AVR board is Intel HEX text (not base64) and arrives in the same
      // field. Old Nano clones use a slower bootloader, so try both speeds.
      const hex = req.binaryBase64;
      const bauds = family === 'avr-uno' ? [115200] : [115200, 57600];
      let lastError: unknown = null;
      for (const baud of bauds) {
        if (req.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        req.onProgress({ phase: 'connecting', pct: 5, line: `Opening serial port at ${baud} baud...` });
        const link = await WebSerialLink.open(port, baud);
        try {
          const result = await flashStk500v1(link, hex, {
            onProgress: (pct, line) =>
              req.onProgress({ phase: pct < 10 ? 'connecting' : 'writing', pct, line }),
          });
          return {
            chipName: `${family === 'avr-uno' ? 'Arduino Uno' : 'Arduino Nano'} (signature ${result.signature.toUpperCase()})`,
            elapsedMs: Date.now() - startTime,
          };
        } catch (err) {
          lastError = err;
          // Wrong speed → try the next one; anything else is final.
          if (!(err instanceof FlashError) || err.code !== 'no-sync') throw err;
          req.onProgress({ phase: 'connecting', pct: 5, line: `No answer at ${baud} baud.` });
        } finally {
          await link.close();
        }
      }
      throw lastError ?? new FlashError('no-sync', 'The bootloader did not answer');
    } else {
      throw new Error(`Flashing ${req.boardKind} over Web Serial is not supported`);
    }
  },
};
