import { describe, it, expect } from 'vitest';
import { parseCompileErrors, explainCompileError, cleanCompilerPaths } from '../utils/compileErrorHelp';
import type { CompilationLog } from '../utils/compilationLogger';

const err = (message: string, targetId?: string): CompilationLog => ({
  timestamp: new Date(0),
  type: 'error',
  message,
  target: targetId ? { id: targetId, label: 'x', kind: 'board' } : undefined,
});

describe('compile error help', () => {
  it('reads file, line and column and drops the temp path', () => {
    const [e] = parseCompileErrors([
      err("/tmp/tmpzstxu74v/sketch/sketch.ino:18:2: error: expected declaration before '}' token"),
    ]);
    expect(e).toMatchObject({ file: 'sketch.ino', line: 18, col: 2 });
    expect(e.message).toBe("expected declaration before '}' token");
    expect(e.help).toEqual({ key: 'extraBrace' });
  });

  it('keeps log order: the first error is first', () => {
    const r = parseCompileErrors([
      err('/tmp/x/sketch/sketch.ino:3:1: error: foo'),
      err('/tmp/x/sketch/sketch.ino:9:1: error: bar'),
    ]);
    expect(r.map((e) => e.line)).toEqual([3, 9]);
  });

  it('ignores warnings, source echo lines and the circuit check', () => {
    const logs: CompilationLog[] = [
      { timestamp: new Date(0), type: 'warning', message: '/tmp/x/sketch/sketch.ino:1:1: warning: unused' },
      err('  void kaputt( { delay(10 }'),
      err('/tmp/x/sketch/sketch.ino:4:1: error: real'),
      err('/tmp/x/sketch/sketch.ino:5:1: error: LED burnt', 'circuit-check'),
    ];
    expect(parseCompileErrors(logs).map((e) => e.message)).toEqual(['real']);
  });

  it('explains the usual beginner errors', () => {
    expect(explainCompileError("expected ';' before 'delay'")).toEqual({ key: 'missingSemicolon' });
    expect(explainCompileError("expected ')' before '}' token")).toEqual({ key: 'missingParen' });
    expect(explainCompileError("expected '}' at end of input")).toEqual({ key: 'missingBraceEnd' });
    expect(explainCompileError("'ledPin' was not declared in this scope")).toEqual({ key: 'undeclared', params: { name: 'ledPin' } });
    expect(explainCompileError("'Servo' does not name a type")).toEqual({ key: 'noType', params: { name: 'Servo' } });
    expect(explainCompileError('Adafruit_GFX.h: No such file or directory')).toEqual({ key: 'noHeader', params: { name: 'Adafruit_GFX.h' } });
    expect(explainCompileError("stray '\\342' in program")).toEqual({ key: 'strayChar' });
    expect(explainCompileError("no matching function for call to 'Foo::bar(int)'")).toEqual({ key: 'noMatchingFunction', params: { name: 'Foo::bar(int)' } });
  });

  it('unknown messages get no explanation (the raw text is shown)', () => {
    expect(explainCompileError('something exotic happened')).toBeNull();
  });

  it('linker errors carry no file or line; a missing loop() is named', () => {
    const [e] = parseCompileErrors([err("/tmp/x/core.a(main.cpp.o): in function `main': undefined reference to `loop'")]);
    expect(e).toMatchObject({ file: null, line: 0 });
    expect(e.help).toEqual({ key: 'noSetupLoop' });
  });

  it('cleans compiler paths for display', () => {
    expect(cleanCompilerPaths('/tmp/tmpabc/sketch/sketch.ino:18:2: error: x')).toBe('sketch.ino:18:2: error: x');
    expect(cleanCompilerPaths('C:\\Users\\me\\sk\\sketch.ino:3:1: error: y')).toBe('sketch.ino:3:1: error: y');
    expect(cleanCompilerPaths('Sketch uses 3812 bytes')).toBe('Sketch uses 3812 bytes');
  });
});
