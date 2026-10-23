// The public API of the engine (ML-27/ML-28, S12; decision D20): re-exports only, no logic. processReport and scoring
// wait for the next plan. The surface that the identity-filter port (MOB-02) uses stays in shared.ts.
// Plain TypeScript, no logging, no React Native, fs or path import.

// Parsing
export { parseReport } from './parsing/parser';
export type { ParseContext, ParseOutput } from './parsing/parser';

// Review and typed range
export {
  applyTypedRange,
  needsReview,
  REVIEW_REASON_CODES,
  REVIEW_THRESHOLD,
  reviewReasons,
  splitForReview,
} from './parsing/review';

// Validation
export { validateA, validatePayload } from './contracts/validate';
export type { ValidationError, ValidationResult } from './contracts/validate';
