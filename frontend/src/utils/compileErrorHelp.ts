/**
 * Compiler errors for people who have never read one.
 *
 * gcc says `/tmp/tmpzstxu74v/sketch/sketch.ino:18:2: error: expected
 * declaration before '}' token`. A student needs: which file, which line, and
 * what that usually means. This module turns the raw log into that, and does
 * nothing else (pure, tested). The console renders the first error as a card;
 * the raw lines stay one click away.
 */

import type { CompilationLog } from './compilationLogger';
import { CIRCUIT_CHECK_TARGET_ID } from './compilationLogger';

export interface ParsedCompileError {
  /** Base name of the source file ("sketch.ino"), null for linker errors. */
  file: string | null;
  /** 1-based line, 0 when the compiler gave none. */
  line: number;
  col: number;
  /** The compiler's own words, without the "error:" prefix. */
  message: string;
  /** i18n key suffix under editor.console.help.* and its parameters, or null. */
  help: { key: string; params?: Record<string, string> } | null;
}

/** `dir/file.ino:LINE[:COL]: [fatal ]error: MESSAGE` */
const ERROR_LINE =
  /^(?:.*[\\/])?([^\\/:\s]+\.(?:ino|cpp|c|h|hpp|cc|py)):(\d+)(?::(\d+))?:\s*(?:fatal error|error):\s*(.+)$/;
/** Linker / driver errors have no file and line. */
const LINKER_LINE = /^(?:.*:\s)?(undefined reference to .+)$/;

/** Plain-language cause for the most common beginner errors. */
export function explainCompileError(message: string): ParsedCompileError['help'] {
  let m: RegExpMatchArray | null;
  if (/expected '[;,]' (?:or '[;,]' )?before|expected ';' at end of/.test(message)) return { key: 'missingSemicolon' };
  if (/expected '\)' (?:before|at end)/.test(message)) return { key: 'missingParen' };
  if (/expected '\}' at end of input/.test(message)) return { key: 'missingBraceEnd' };
  if (/expected (?:declaration|unqualified-id) before '\}' token/.test(message)) return { key: 'extraBrace' };
  if ((m = message.match(/'([^']+)' was not declared in this scope/))) return { key: 'undeclared', params: { name: m[1] } };
  if ((m = message.match(/'([^']+)' does not name a type/))) return { key: 'noType', params: { name: m[1] } };
  if ((m = message.match(/([\w./+-]+\.h(?:pp)?): No such file or directory/))) return { key: 'noHeader', params: { name: m[1] } };
  if (/stray '.+' in program/.test(message)) return { key: 'strayChar' };
  if (/expected primary-expression before/.test(message)) return { key: 'primaryExpr' };
  if ((m = message.match(/no matching function for call to '([^']+)'/))) return { key: 'noMatchingFunction', params: { name: m[1] } };
  if (/redefinition of|previous definition of/.test(message)) return { key: 'redefinition' };
  if (/undefined reference to `?(?:setup|loop)\b/.test(message)) return { key: 'noSetupLoop' };
  if ((m = message.match(/undefined reference to `?([^'`(]+)/))) return { key: 'undefinedRef', params: { name: m[1].trim() } };
  return null;
}

/** All compiler errors in log order (the first one is the one to fix first). */
export function parseCompileErrors(logs: CompilationLog[]): ParsedCompileError[] {
  const out: ParsedCompileError[] = [];
  for (const log of logs) {
    if (log.type !== 'error' || log.target?.id === CIRCUIT_CHECK_TARGET_ID) continue;
    const line = log.message.trim();
    const m = line.match(ERROR_LINE);
    if (m) {
      out.push({
        file: m[1],
        line: Number(m[2]),
        col: m[3] ? Number(m[3]) : 1,
        message: m[4],
        help: explainCompileError(m[4]),
      });
      continue;
    }
    const l = line.match(LINKER_LINE);
    if (l) out.push({ file: null, line: 0, col: 0, message: l[1], help: explainCompileError(l[1]) });
  }
  return out;
}

/** Show `sketch.ino:18:2:` instead of `/tmp/tmpzstxu74v/sketch/sketch.ino:18:2:`. */
export function cleanCompilerPaths(message: string): string {
  return message.replace(/(?:[A-Za-z]:)?[\\/][^\s:]*[\\/]([^\\/\s:]+\.(?:ino|cpp|c|h|hpp|cc|py))/g, '$1');
}
