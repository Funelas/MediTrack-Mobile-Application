// The on-device engine must stay plain TypeScript (ML-28): no React, React Native, Expo, fs or path import, and no
// console call, in any non-test source file under src/engine.
import * as fs from 'fs';
import * as path from 'path';

const ENGINE_ROOT = path.resolve(__dirname, '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js']);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function isForbiddenModule(specifier: string): boolean {
  const name = specifier.replace(/^node:/, '');
  return (
    name === 'react' ||
    name.startsWith('react/') ||
    name.startsWith('react-native') ||
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

/** Rule violations found in one source text (comments are ignored). */
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
  if (/\bconsole\s*\??\./.test(text)) {
    found.push('console call');
  }
  return found;
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
    ["import y from '@react-native-async-storage/async-storage'", '@react-native-async-storage/async-storage'],
    ["import React from 'react'", 'react'],
    ["import * as E from 'expo-file-system'", 'expo-file-system'],
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

  it('does not flag harmless lines', () => {
    expect(findViolations("import { a } from './local'")).toEqual([]);
    expect(findViolations("import data from './engine_constants.json'")).toEqual([]);
    expect(findViolations('const consoleTable = 1;')).toEqual([]);
    expect(findViolations('const reactive = pathLength + fsize;')).toEqual([]);
    expect(findViolations("import x from 'rapidfuzz-like'")).toEqual([]);
  });

  it('ignores comments', () => {
    expect(findViolations("// import x from 'react-native'")).toEqual([]);
    expect(findViolations('/* console.log(1) */')).toEqual([]);
  });
});

describe('engine source boundaries', () => {
  const files = collectSourceFiles(ENGINE_ROOT);

  it('scans at least the data loader', () => {
    expect(files.map((f) => path.relative(ENGINE_ROOT, f).split(path.sep).join('/'))).toContain('data/index.ts');
  });

  it.each(files.map((f) => [path.relative(ENGINE_ROOT, f).split(path.sep).join('/'), f]))(
    '%s has no forbidden import and no console call',
    (_name, file) => {
      expect(findViolations(fs.readFileSync(file, 'utf8'))).toEqual([]);
    },
  );
});
