// Hermes (React Native 0.74) rejects the Unicode property classes (backslash-p-brace, backslash-P-brace) in a regex.
// Node accepts them, so the engine tests cannot see the failure. Two guards:
//  (a) a source scan for the escape in every non-test file under src;
//  (b) a recorder that notes the [source, flags] of every RegExp constructed while the engine modules load, writes
//      them as regex literals to a temporary .js file and compiles that file with the hermesc binary of
//      react-native. Limit: a regex built only at call time is not recorded, and regex literals are covered by the
//      release-bundle hermesc check, not by this test.
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PY_WORD_CHARS } from '../py/text';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js']);
const PROPERTY_CLASS = /\\{1,2}[pP]\{/;
const MODULES_TO_LOAD = ['engine/index.ts', 'engine/shared.ts', 'engine/parsing/identityFilter.ts', 'scan/identityFilter.ts'];

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Line numbers (1-based) of the comment-stripped text that hold a Unicode property-class escape. */
function findPropertyClassLines(source: string): number[] {
  const lines = stripComments(source).split('\n');
  const found: number[] = [];
  lines.forEach((line, index) => {
    if (PROPERTY_CLASS.test(line)) {
      found.push(index + 1);
    }
  });
  return found;
}

function isTestFile(name: string): boolean {
  return /\.test\.[^.]+$/.test(name);
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        files.push(...collectSourceFiles(full));
      }
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !isTestFile(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('property-class detector', () => {
  it('flags the escape in a string, a pattern and a regex literal', () => {
    expect(findPropertyClassLines("'[\\p{L}]'")).toEqual([1]);
    expect(findPropertyClassLines("'[\\\\p{L}]'")).toEqual([1]);
    expect(findPropertyClassLines('/\\p{L}/u')).toEqual([1]);
    expect(findPropertyClassLines("new RegExp('\\\\P{N}', 'u')")).toEqual([1]);
  });

  it('does not flag other text', () => {
    expect(findPropertyClassLines('checkup{')).toEqual([]);
    expect(findPropertyClassLines("'\\\\u{30}'")).toEqual([]);
    expect(findPropertyClassLines('/\\u{30}/u')).toEqual([]);
  });

  it('ignores comments', () => {
    expect(findPropertyClassLines('// uses \\p{L} here')).toEqual([]);
    expect(findPropertyClassLines('/* \\p{L} */')).toEqual([]);
    expect(findPropertyClassLines('const a = 1;\n// \\p{L}\nconst b = 2;')).toEqual([]);
  });

  it('reports the line number', () => {
    expect(findPropertyClassLines('const a = 1;\nconst b = /\\p{L}/u;')).toEqual([2]);
  });
});

describe('source scan', () => {
  it('finds no Unicode property class in a non-test file under src', () => {
    const files = collectSourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(30);
    const offences: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
      for (const line of findPropertyClassLines(fs.readFileSync(file, 'utf8'))) {
        offences.push(rel + ':' + line);
      }
    }
    expect(offences).toEqual([]);
  });
});

type Recorded = [string, string];

function frameFile(frame: string): string | null {
  const trimmed = frame.trim();
  const match = /\((.+):\d+:\d+\)$/.exec(trimmed) ?? /^at (.+):\d+:\d+$/.exec(trimmed);
  return match ? path.normalize(match[1]) : null;
}

function isUnderSrc(file: string): boolean {
  const rel = path.relative(SRC_ROOT, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Load the engine modules with a recording RegExp; restores the global RegExp in a finally. */
function recordRegexConstructions(): Recorded[] {
  const recorded: Recorded[] = [];
  const NativeRegExp = globalThis.RegExp;
  const thisFile = path.normalize(__filename);

  class RecordingRegExp extends NativeRegExp {
    constructor(pattern: string | RegExp, flags?: string) {
      super(pattern as string, flags);
      const frames = (new Error().stack ?? '').split('\n').slice(1);
      for (const frame of frames) {
        const file = frameFile(frame);
        if (file === null || file === thisFile) {
          continue;
        }
        if (isUnderSrc(file)) {
          recorded.push([this.source, this.flags]);
        }
        break;
      }
    }
  }

  globalThis.RegExp = RecordingRegExp as unknown as RegExpConstructor;
  try {
    jest.isolateModules(() => {
      for (const module of MODULES_TO_LOAD) {
        const full = path.join(SRC_ROOT, module);
        if (fs.existsSync(full)) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(full);
        } else {
          process.stderr.write('hermes_regex: module not found, skipped: ' + module + '\n');
        }
      }
    });
  } finally {
    globalThis.RegExp = NativeRegExp;
  }
  return recorded;
}

/** One line `/<source>/<flags>;` with every unescaped slash escaped and no raw line break. */
function toLiteral([source, flags]: Recorded): string {
  let body = '';
  let escaped = false;
  for (const ch of source) {
    if (escaped) {
      body += ch === '\n' ? 'n' : ch === '\r' ? 'r' : ch;
      escaped = false;
    } else if (ch === '\\') {
      body += ch;
      escaped = true;
    } else if (ch === '/') {
      body += '\\/';
    } else if (ch === '\n') {
      body += '\\n';
    } else if (ch === '\r') {
      body += '\\r';
    } else if (ch === '\u2028') {
      body += '\\u2028';
    } else if (ch === '\u2029') {
      body += '\\u2029';
    } else {
      body += ch;
    }
  }
  return '/' + body + '/' + flags + ';';
}

function hermescPath(): string | null {
  const dirs: Record<string, string[]> = {
    win32: ['win64-bin', 'hermesc.exe'],
    linux: ['linux64-bin', 'hermesc'],
    darwin: ['osx-bin', 'hermesc'],
  };
  const parts = dirs[process.platform];
  if (!parts) {
    return null;
  }
  const rnRoot = path.dirname(require.resolve('react-native/package.json'));
  const binary = path.join(rnRoot, 'sdks', 'hermesc', ...parts);
  return fs.existsSync(binary) ? binary : null;
}

describe('regex constructions under Hermes', () => {
  let recorded: Recorded[] = [];
  beforeAll(() => {
    recorded = recordRegexConstructions();
  });

  it('records the RegExp constructions of the engine modules (at least 30)', () => {
    expect(recorded.length).toBeGreaterThanOrEqual(30);
  });

  it('records the digit-class escape used by PY_DIGIT_CLASS (sanity marker)', () => {
    expect(recorded.some(([source]) => source.includes('\\u{30}'))).toBe(true);
  });

  it('records a regex that holds the word-class body PY_WORD_CHARS', () => {
    expect(recorded.some(([source]) => source.includes(PY_WORD_CHARS))).toBe(true);
  });

  const binary = hermescPath();
  const compileIt = binary ? it : it.skip;
  if (!binary) {
    process.stderr.write('hermes_regex: SKIPPED (not a pass), no hermesc binary for ' + process.platform + '\n');
  }

  compileIt('hermesc compiles every recorded regex', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes_regex-'));
    try {
      const jsFile = path.join(dir, 'regexes.js');
      const hbcFile = path.join(dir, 'regexes.hbc');
      fs.writeFileSync(jsFile, recorded.map(toLiteral).join('\n') + '\n', 'utf8');
      const result = spawnSync(binary as string, ['-emit-binary', '-out', hbcFile, jsFile], { encoding: 'utf8' });
      if (result.error || result.status !== 0) {
        const lines = ((result.stdout ?? '') + '\n' + (result.stderr ?? ''))
          .split('\n')
          .filter((line) => /\b(error|warning):/.test(line.slice(0, 400)))
          .map((line) => line.replace(/^.*regexes\.js:/, 'regexes.js:').slice(0, 120))
          .slice(0, 20);
        throw new Error(
          'hermesc exit status ' + String(result.status) + (result.error ? ' (' + result.error.message + ')' : '') +
            '\n' + lines.join('\n'),
        );
      }
      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
