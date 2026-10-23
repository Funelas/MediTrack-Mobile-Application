// The shared surface of the engine for the identity-filter port (MOB-02), ML-27/ML-28 step S9: re-exports only, no logic.
// Plain TypeScript, no logging, no React Native, fs or path import.

// Layout
export { buildCells, deskew, elementsFromPage, groupRows, pageRows } from './parsing/layout';
export type { Cell, Element, Row } from './parsing/layout';

// Cells
export { classifyCell } from './parsing/extract';
export type { Typed } from './parsing/extract';

// Names
export { resolve } from './parsing/dictionary';
export type { Match } from './parsing/dictionary';

// Classification
export { classify, detectSection, isHeaderRow, isResultRow, reportTypeOf } from './parsing/classify';

// Identity labels
export { findIdentityLabels, IDENTITY_RE, labelRegex, SIGNATURE_RE } from './parsing/identityLabels';

// Helpers
export { pyRound } from './py/round';
export { stableSort } from './py/sort';
export { pySlice, pySplit, pyStrip } from './py/text';

// Validation
export { validatePayload } from './contracts/validate';
