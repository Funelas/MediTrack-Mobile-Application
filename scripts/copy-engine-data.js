'use strict';

/*
 * Copies the data files the on-device engine reads into mobile/src/engine/data/ (ML-27/ML-28, plan section 6.5).
 * The copies are the source text with line endings normalized to LF, written as UTF-8 without a byte-order mark.
 *
 *   node scripts/copy-engine-data.js                 copy the four files
 *   node scripts/copy-engine-data.js --check         exit 1 and list the stale copies, else print "up to date"
 *   node scripts/copy-engine-data.js --dest <dir>    use <dir> instead of src/engine/data (works with --check)
 *
 * --check parses source and copy and compares them deeply (decision D14: line endings never count). It never
 * prints file contents.
 */

const fs = require('fs');
const path = require('path');

// [path below the repository root, file name in the destination folder]
const FILES = [
  ['docs/schemas/canonical_dictionary.json', 'canonical_dictionary.json'],
  ['docs/schemas/unit_conversions.json', 'unit_conversions.json'],
  ['docs/identity_filter/identity_filter_config.json', 'identity_filter_config.json'],
  ['docs/engine_vectors/engine_constants.json', 'engine_constants.json'],
];

const DEFAULT_SOURCE_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_DEST = path.join(__dirname, '..', 'src', 'engine', 'data');

function normalizeText(raw) {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function readText(file) {
  return normalizeText(fs.readFileSync(file, 'utf8'));
}

function deepEqual(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Names of the copies in destDir that are missing, unreadable as JSON, or different from their source. */
function findStale(sourceRoot, destDir) {
  const stale = [];
  for (const [relative, name] of FILES) {
    const source = path.join(sourceRoot, relative);
    if (!fs.existsSync(source)) {
      throw new Error('source file missing: ' + relative);
    }
    const copy = path.join(destDir, name);
    if (!fs.existsSync(copy)) {
      stale.push(name);
      continue;
    }
    const expected = JSON.parse(readText(source));
    let actual;
    try {
      actual = JSON.parse(readText(copy));
    } catch (error) {
      stale.push(name);
      continue;
    }
    if (!deepEqual(expected, actual)) {
      stale.push(name);
    }
  }
  return stale;
}

/** Writes the four copies into destDir (created if needed) and returns their names. */
function copyFiles(sourceRoot, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const names = [];
  for (const [relative, name] of FILES) {
    const source = path.join(sourceRoot, relative);
    if (!fs.existsSync(source)) {
      throw new Error('source file missing: ' + relative);
    }
    JSON.parse(readText(source)); // refuse to copy a file that is not valid JSON
    fs.writeFileSync(path.join(destDir, name), readText(source), { encoding: 'utf8' });
    names.push(name);
  }
  return names;
}

function main(argv) {
  let check = false;
  let dest = DEFAULT_DEST;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') {
      check = true;
    } else if (argv[i] === '--dest' && i + 1 < argv.length) {
      i += 1;
      dest = path.resolve(argv[i]);
    } else {
      process.stderr.write('usage: node scripts/copy-engine-data.js [--check] [--dest <dir>]\n');
      return 2;
    }
  }
  try {
    if (check) {
      const stale = findStale(DEFAULT_SOURCE_ROOT, dest);
      if (stale.length > 0) {
        process.stdout.write('stale: ' + stale.join(', ') + '\n');
        process.stdout.write('run: npm run engine:data\n');
        return 1;
      }
      process.stdout.write('up to date\n');
      return 0;
    }
    const names = copyFiles(DEFAULT_SOURCE_ROOT, dest);
    process.stdout.write('copied ' + names.length + ' files\n');
    return 0;
  } catch (error) {
    // A JSON parse error message can quote file text, so only the missing-file message is shown.
    const known = error.message.startsWith('source file missing');
    process.stderr.write('error: ' + (known ? error.message : 'a source file could not be read or parsed') + '\n');
    return 2;
  }
}

module.exports = { FILES, findStale, copyFiles, normalizeText };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
