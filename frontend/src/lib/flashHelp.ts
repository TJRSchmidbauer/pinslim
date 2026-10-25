/**
 * Everything the Flash dialog knows about real hardware, as plain functions:
 * which chip a board kind should contain, whether the one that answered is
 * that chip, the "how do I get my board into flash mode" steps, and a
 * plain-language explanation for the errors esptool / the AVR bootloader
 * throw. Texts are (i18n key, English fallback) pairs; the dialog translates.
 */

export type FlashFamily =
  | 'esp32'
  | 'esp32s3'
  | 'esp32c3'
  | 'esp32c6'
  | 'esp32p4'
  | 'avr-uno'
  | 'avr-nano'
  | 'avr-mega';

export interface HelpText {
  key: string;
  fallback: string;
  params?: Record<string, string | number>;
}

/** The chip a board kind carries; null for boards that cannot be flashed here. */
export function flashFamilyOf(boardKind: string): FlashFamily | null {
  const k = boardKind.toLowerCase();
  if (k === 'arduino-uno') return 'avr-uno';
  if (k === 'arduino-nano') return 'avr-nano';
  if (k === 'arduino-mega') return 'avr-mega';
  if (k.includes('p4')) return k.includes('esp32') ? 'esp32p4' : null;
  if (k.includes('esp32') || k.includes('lolin32')) {
    if (k.includes('s3') || k === 'arduino-nano-esp32') return 'esp32s3';
    if (k.includes('c3')) return 'esp32c3';
    if (k.includes('c6')) return 'esp32c6';
    return 'esp32';
  }
  return null;
}

export const isEspFamily = (f: FlashFamily | null): boolean => !!f && f.startsWith('esp32');
export const isAvrFamily = (f: FlashFamily | null): boolean => !!f && f.startsWith('avr-');

const LABELS: Record<FlashFamily, string> = {
  esp32: 'ESP32',
  esp32s3: 'ESP32-S3',
  esp32c3: 'ESP32-C3',
  esp32c6: 'ESP32-C6',
  esp32p4: 'ESP32-P4',
  'avr-uno': 'Arduino Uno',
  'avr-nano': 'Arduino Nano',
  'avr-mega': 'Arduino Mega',
};
export const familyLabel = (f: FlashFamily): string => LABELS[f];

/** Family from the name esptool reports, e.g. "ESP32-S3 (QFN56) (revision v0.2)". */
export function familyFromChipName(chipName: string): FlashFamily | null {
  const n = chipName.toUpperCase();
  if (!n.startsWith('ESP32')) return null;
  if (n.startsWith('ESP32-S3')) return 'esp32s3';
  if (n.startsWith('ESP32-C3')) return 'esp32c3';
  if (n.startsWith('ESP32-C6')) return 'esp32c6';
  if (n.startsWith('ESP32-P4')) return 'esp32p4';
  // ESP32-S2, -C2, -H2, -C5 … are real chips we have no board for
  if (/^ESP32-[CHS]\d+/.test(n)) return null;
  return 'esp32'; // ESP32-D0WDQ6, ESP32-PICO-D4, ESP32 (revision …)
}

/**
 * A mismatch is only reported when both sides are known: writing an S3 image
 * to a classic ESP32 does not brick it, but the board silently never boots.
 */
export function chipMismatch(
  boardKind: string,
  detectedChipName: string,
): { expected: string; found: string } | null {
  const expected = flashFamilyOf(boardKind);
  if (!isEspFamily(expected)) return null;
  const found = familyFromChipName(detectedChipName);
  if (!found || found === expected) return null;
  return { expected: familyLabel(expected!), found: familyLabel(found) };
}

export function webSerialStatus(): 'ok' | 'insecure' | 'unsupported-browser' {
  if (typeof navigator !== 'undefined' && 'serial' in navigator) return 'ok';
  // Chrome and Edge hide navigator.serial on plain-http pages.
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
  return 'unsupported-browser';
}

/** The "get your board ready" checklist for a board kind. */
export function flashSteps(boardKind: string): HelpText[] {
  const family = flashFamilyOf(boardKind);
  const steps: HelpText[] = [
    {
      key: 'editor.flash.help.stepCable',
      fallback: 'Connect the board with a USB cable that carries data (charge-only cables do not work).',
    },
    {
      key: 'editor.flash.help.stepClose',
      fallback: 'Close every program that uses the port: Arduino IDE, serial monitors, other browser tabs.',
    },
  ];
  if (isAvrFamily(family)) {
    steps.push({
      key: 'editor.flash.help.stepAvrPins',
      fallback: 'Unplug anything connected to pins 0 and 1 (RX/TX) — they are used while uploading.',
    });
    if (family === 'avr-nano') {
      steps.push({
        key: 'editor.flash.help.stepNano',
        fallback: 'Old Nano clones use a slower bootloader: Pinslim tries both speeds automatically.',
      });
    }
  }
  steps.push({
    key: 'editor.flash.help.stepPick',
    fallback: 'Click the flash button and choose the board in the browser window (often "USB-SERIAL CH340", "CP210x" or "USB JTAG/serial").',
  });
  if (isEspFamily(family)) {
    steps.push({
      key: family === 'esp32' ? 'editor.flash.help.stepBootClassic' : 'editor.flash.help.stepBootNative',
      fallback:
        family === 'esp32'
          ? 'If it hangs at "Connecting…", hold the BOOT button on the board until the upload starts.'
          : 'If the board is not found: hold BOOT, tap RESET (EN), then release BOOT. The board reappears as a new port — choose that one.',
    });
  }
  return steps;
}

/** A plain-language reading of an error from esptool-js, the AVR flasher or Web Serial. */
export function explainFlashError(message: string, boardKind: string): HelpText | null {
  const m = message.toLowerCase();
  const family = flashFamilyOf(boardKind);

  if (m.includes('chip mismatch') || m.includes('wrong board')) {
    const detail = /expects ([^,]+), connected chip is (.+)$/i.exec(message);
    return {
      key: 'editor.flash.help.errMismatch',
      fallback: 'The connected chip is not the one this board kind needs ({{expected}} expected, {{found}} found). Pick the matching board in Pinslim or connect the right board.',
      params: { expected: detail?.[1] ?? '?', found: detail?.[2] ?? '?' },
    };
  }
  if (m.includes('no port selected') || m.includes('notfounderror')) {
    return {
      key: 'editor.flash.help.errNoPort',
      fallback: 'No port was chosen. Click the flash button again and select your board in the browser window.',
    };
  }
  if (m.includes('user gesture') || m.includes('securityerror')) {
    return {
      key: 'editor.flash.help.errGesture',
      fallback: 'The browser only opens the port picker right after a click. Click the flash button again.',
    };
  }
  if (m.includes('already open') || m.includes('failed to open serial port') || m.includes('invalidstateerror')) {
    return {
      key: 'editor.flash.help.errBusy',
      fallback: 'The port is busy. Close the Arduino IDE, serial monitors and other browser tabs that use the board, then try again.',
    };
  }
  if (m.includes('device has been lost') || m.includes('networkerror') || m.includes('port was closed')) {
    return {
      key: 'editor.flash.help.errLost',
      fallback: 'The USB connection was lost. Check the cable, plug the board in again and retry.',
    };
  }
  if (m.includes('no-sync') || m.includes('did not answer') || m.includes('not in sync')) {
    return {
      key: 'editor.flash.help.errNoSync',
      fallback: isAvrFamily(family)
        ? 'The bootloader did not answer. Check that the right board is selected and nothing is connected to pins 0/1, then try again (a Nano may need a second try).'
        : 'The board did not answer.',
    };
  }
  if (m.includes('verification failed')) {
    return {
      key: 'editor.flash.help.errVerify',
      fallback: 'What was written does not match the program. Try again with a different USB cable or port; do not unplug during the upload.',
    };
  }
  if (m.includes('room for') || m.includes('too-big')) {
    return {
      key: 'editor.flash.help.errTooBig',
      fallback: 'The program is too large for this board. Remove code, large strings or libraries.',
    };
  }
  if (
    m.includes('failed to connect') ||
    m.includes('no serial data received') ||
    m.includes('invalid head of packet') ||
    m.includes('timed out waiting for packet') ||
    m.includes('timeout')
  ) {
    return {
      key: isEspFamily(family) ? 'editor.flash.help.errEspConnect' : 'editor.flash.help.errNoSync',
      fallback: isEspFamily(family)
        ? 'The chip is not in flash mode. Hold the BOOT button while the upload starts (S3/C3/C6/P4: hold BOOT, tap RESET, release BOOT), and use a data cable.'
        : 'The board did not answer.',
    };
  }
  return null;
}
