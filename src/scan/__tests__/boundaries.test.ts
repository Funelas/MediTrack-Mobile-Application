// The scan layer (MOB-03) must stay plain TypeScript: no React Native, Expo, fs or path import, no console call and no
// network call in any non-test source file under src/scan. The screen files that wire it in must not log or call out.
import * as fs from 'fs';
import * as path from 'path';

const SCAN_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SCAN_ROOT, '..', '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js']);
const WIRED_FILES = ['src/screens/InputMethodScreen.tsx', 'src/screens/EngineReviewScreen.tsx', 'src/utils/ocrUtils.ts'];

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function isForbiddenModule(specifier: string): boolean {
  const name = specifier.replace(/^node:/, '');
  return (
    name === 'react-native' ||
    name.startsWith('react-native/') ||
    name.startsWith('react-native-') ||
    name.startsWith('@react-native') ||
    name === 'expo' ||
    name.startsWith('expo-') ||
    name.startsWith('expo/') ||
    name === 'fs' ||
    name.startsWith('fs/') ||
    name === 'path' ||
    name.startsWith('path/')
  );
}

/** Console and network-call violations in one source text (comments are ignored). */
function findCallViolations(source: string, checkNetwork: boolean): string[] {
  const text = stripComments(source);
  const found: string[] = [];
  if (/\bconsole\s*\??\./.test(text)) {
    found.push('console call');
  }
  if (checkNetwork) {
    if (/\bfetch\s*\(/.test(text)) {
      found.push('fetch call');
    }
    if (/\bXMLHttpRequest\b/.test(text)) {
      found.push('XMLHttpRequest');
    }
    if (/\bWebSocket\b/.test(text)) {
      found.push('WebSocket');
    }
  }
  return found;
}

/** Rule violations found in one src/scan source text (comments are ignored). */
function findViolations(source: string): string[] {
  const text = stripComments(source);
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*['"`]([^'"`]+)['"`]/g, // import x from 'm', export { x } from 'm'
    /\bimport\s*['"`]([^'"`]+)['"`]/g, // import 'm'
    /\b(?:require|import)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, // require('m'), import('m')
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (isForbiddenModule(match[1])) {
        found.push('forbidden import: ' + match[1]);
      }
    }
  }
  return found.concat(findCallViolations(source, true));
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files.push(...collectSourceFiles(full));
      }
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

describe('boundary detector', () => {
  it.each([
    ["import x from 'react-native'", 'react-native'],
    ['import { View } from "react-native/Libraries/x"', 'react-native/Libraries/x'],
    ["import y from 'react-native-fs'", 'react-native-fs'],
    ["import z from '@react-native-async-storage/async-storage'", '@react-native-async-storage/async-storage'],
    ["import * as E from 'expo-file-system'", 'expo-file-system'],
    ["import e from 'expo'", 'expo'],
    ['const a = require("fs")', 'fs'],
    ["import * as p from 'path'", 'path'],
    ["const m = await import('node:path')", 'node:path'],
    ["import 'node:fs'", 'node:fs'],
    ["export { z } from 'fs/promises'", 'fs/promises'],
  ])('flags %s', (line, specifier) => {
    expect(findViolations(line)).toEqual(['forbidden import: ' + specifier]);
  });

  it('flags a console call', () => {
    expect(findViolations('console.log(1)')).toEqual(['console call']);
    expect(findViolations('  console.warn("x");')).toEqual(['console call']);
  });

  it('flags a network call', () => {
    expect(findViolations('await fetch(url)')).toEqual(['fetch call']);
    expect(findViolations('const r = new XMLHttpRequest();')).toEqual(['XMLHttpRequest']);
    expect(findViolations('const s = new WebSocket(u);')).toEqual(['WebSocket']);
  });

  it('checks the network patterns only when asked', () => {
    expect(findCallViolations('console.log(fetch(u))', false)).toEqual(['console call']);
    expect(findCallViolations('console.log(fetch(u))', true)).toEqual(['console call', 'fetch call']);
  });

  it('does not flag harmless lines', () => {
    expect(findViolations("import { a } from './local'")).toEqual([]);
    expect(findViolations("import { b } from '../engine'")).toEqual([]);
    expect(findViolations('const consoleTable = 1;')).toEqual([]);
    expect(findViolations('const prefetch = 1; prefetchAll();')).toEqual([]);
    expect(findViolations('const reactive = pathLength + fsize;')).toEqual([]);
    expect(findViolations("import x from 'rapidfuzz-like'")).toEqual([]);
  });

  it('ignores comments', () => {
    expect(findViolations("// import x from 'react-native'")).toEqual([]);
    expect(findViolations('/* console.log(1); fetch(u) */')).toEqual([]);
  });
});

describe('scan source boundaries', () => {
  it('has no forbidden import, console call or network call in any non-test file', () => {
    const files = collectSourceFiles(SCAN_ROOT);
    const failures = files
      .map((file) => [path.relative(SCAN_ROOT, file), findViolations(fs.readFileSync(file, 'utf8'))] as const)
      .filter(([, found]) => found.length > 0);
    expect(failures).toEqual([]);
  });
});

describe('wired file boundaries', () => {
  it.each(WIRED_FILES)('%s has no console call and no network call', (relative) => {
    const file = path.join(APP_ROOT, relative);
    if (!fs.existsSync(file)) {
      // EngineReviewScreen.tsx arrives with a later MOB-03 step; the other two files must always exist.
      expect(relative).toBe('src/screens/EngineReviewScreen.tsx');
      return;
    }
    expect(findCallViolations(fs.readFileSync(file, 'utf8'), true)).toEqual([]);
  });
});
