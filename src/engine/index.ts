// The public API of the engine (ML-27/ML-28, S12; decision D20): re-exports only, no logic. Scoring is exported now
// (plan step 8, U2). processReport and the re-score function wait for ML-13 (Contract B before or after confirmation;
// visit_date). The identity-filter port (MOB-02) exports only sanitize, below.
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

// Scoring: which rows to pass (confirmed rows only, or all rows) is the open ML-13 decision.
export { buildContractB } from './scoring/extensions';
export type { ContractB, ContractBParameter, PanelScore, ParameterTrend, ResultRow } from './scoring/extensions';

// Identity filter (MOB-02)
export { sanitize } from './parsing/identityFilter';
export type { FilterResult as SanitizeResult } from './parsing/identityFilter';

// Validation
export { checkParity, validateA, validateB, validateC, validatePayload } from './contracts/validate';
export type { ValidationError, ValidationResult } from './contracts/validate';
