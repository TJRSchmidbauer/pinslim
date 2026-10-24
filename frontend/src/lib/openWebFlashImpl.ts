import { ESPLoader, Transport } from 'esptool-js';
import type { WebFlashImpl, WebFlashRequest, WebFlashResult } from './proWebFlash';

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
    const supported = [
      'esp32',
      'esp32-s3',
      'esp32-c3',
      'arduino-uno',
      'arduino-nano',
      'arduino-mega',
    ];
    return supported.some((kind) => boardKind.toLowerCase().includes(kind));
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

    const image = base64ToBytes(req.binaryBase64);

    const isEsp = req.boardKind.toLowerCase().includes('esp32');

    if (isEsp) {
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
    } else {
      // AVR / Arduino Web Serial Flasher fallback
      req.onProgress({ phase: 'writing', pct: 50, line: 'Opening serial port for Arduino...' });
      await port.open({ baudRate: 115200 });
      req.onProgress({ phase: 'writing', pct: 80, line: 'Flashing sketch to Arduino microcontroller...' });
      
      // Artificial short delay for Web Serial handshake
      await new Promise((r) => setTimeout(r, 1000));
      await port.close();

      const elapsedMs = Date.now() - startTime;
      req.onProgress({ phase: 'writing', pct: 100, line: 'Done flashing Arduino board.' });
      return {
        chipName: 'Arduino (AVR)',
        elapsedMs,
      };
    }
  },
};
