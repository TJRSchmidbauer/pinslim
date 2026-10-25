import { describe, it, expect } from 'vitest';
import {
  chipMismatch,
  explainFlashError,
  familyFromChipName,
  flashFamilyOf,
  flashSteps,
} from '../lib/flashHelp';

describe('flashFamilyOf', () => {
  it('maps every flashable board kind to its chip', () => {
    const cases: Record<string, string | null> = {
      esp32: 'esp32',
      'esp32-devkit-c-v4': 'esp32',
      'esp32-cam': 'esp32',
      'wemos-lolin32-lite': 'esp32',
      'esp32-s3': 'esp32s3',
      'xiao-esp32-s3': 'esp32s3',
      'arduino-nano-esp32': 'esp32s3', // the Nano ESP32 is an S3, not an AVR Nano
      'esp32-c3': 'esp32c3',
      'xiao-esp32-c3': 'esp32c3',
      'aitewinrobot-esp32c3-supermini': 'esp32c3',
      'esp32-c6': 'esp32c6',
      'xiao-esp32-c6': 'esp32c6',
      'esp32-p4': 'esp32p4',
      'arduino-uno': 'avr-uno',
      'arduino-nano': 'avr-nano',
      'arduino-mega': 'avr-mega',
      'raspberry-pi-pico': null,
      'stm32-bluepill': null,
    };
    for (const [kind, family] of Object.entries(cases)) expect(flashFamilyOf(kind), kind).toBe(family);
  });
});

describe('chip detection', () => {
  it('reads the family from esptool chip names', () => {
    expect(familyFromChipName('ESP32-D0WDQ6 (revision v1.0)')).toBe('esp32');
    expect(familyFromChipName('ESP32-PICO-D4 (revision v1.1)')).toBe('esp32');
    expect(familyFromChipName('ESP32-S3 (QFN56) (revision v0.2)')).toBe('esp32s3');
    expect(familyFromChipName('ESP32-C3 (QFN32) (revision v0.4)')).toBe('esp32c3');
    expect(familyFromChipName('ESP32-C6 (QFN40) (revision v0.1)')).toBe('esp32c6');
    expect(familyFromChipName('ESP32-P4 (revision v1.0)')).toBe('esp32p4');
    expect(familyFromChipName('ESP32-S2 (revision v0.0)')).toBeNull();
    expect(familyFromChipName('ATmega328P')).toBeNull();
  });
  it('flags a board that is not what the project is for', () => {
    expect(chipMismatch('esp32-s3', 'ESP32-D0WDQ6 (revision v1.0)')).toEqual({ expected: 'ESP32-S3', found: 'ESP32' });
    expect(chipMismatch('esp32', 'ESP32-C3 (QFN32)')).toEqual({ expected: 'ESP32', found: 'ESP32-C3' });
  });
  it('does not complain when it matches or when it cannot tell', () => {
    expect(chipMismatch('xiao-esp32-s3', 'ESP32-S3 (QFN56)')).toBeNull();
    expect(chipMismatch('esp32', 'ESP32-S2 (revision v0.0)')).toBeNull();
    expect(chipMismatch('arduino-uno', 'ESP32')).toBeNull();
  });
});

describe('explainFlashError', () => {
  const kind = (k: string, msg: string) => explainFlashError(msg, k)?.key;
  it('translates the typical esptool and Web Serial failures', () => {
    expect(kind('esp32', 'Failed to connect with the device')).toBe('editor.flash.help.errEspConnect');
    expect(kind('esp32', 'No serial data received.')).toBe('editor.flash.help.errEspConnect');
    expect(kind('esp32', "NotFoundError: No port selected by the user.")).toBe('editor.flash.help.errNoPort');
    expect(kind('esp32', "Failed to execute 'open' on 'SerialPort': Failed to open serial port.")).toBe('editor.flash.help.errBusy');
    expect(kind('esp32', 'NetworkError: The device has been lost.')).toBe('editor.flash.help.errLost');
    expect(kind('arduino-uno', 'The bootloader did not answer')).toBe('editor.flash.help.errNoSync');
    expect(kind('arduino-uno', 'Verification failed at 0x10')).toBe('editor.flash.help.errVerify');
  });
  it('passes the chips of a mismatch into the text', () => {
    const e = explainFlashError('Chip mismatch: board needs an ESP32-S3 — expects ESP32-S3, connected chip is ESP32', 'esp32-s3');
    expect(e?.params).toEqual({ expected: 'ESP32-S3', found: 'ESP32' });
  });
  it('returns null for something it does not recognise', () => {
    expect(explainFlashError('kaboom', 'esp32')).toBeNull();
  });
});

describe('flashSteps', () => {
  it('has boot-mode advice only for ESP chips, in the right flavour', () => {
    const keys = (k: string) => flashSteps(k).map((s) => s.key);
    expect(keys('esp32')).toContain('editor.flash.help.stepBootClassic');
    expect(keys('esp32-s3')).toContain('editor.flash.help.stepBootNative');
    expect(keys('arduino-uno')).not.toContain('editor.flash.help.stepBootClassic');
    expect(keys('arduino-uno')).toContain('editor.flash.help.stepAvrPins');
    expect(keys('arduino-nano')).toContain('editor.flash.help.stepNano');
  });
});
