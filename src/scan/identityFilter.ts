// The identity-filter seam (MOB-03; the filter itself is MOB-02). Pure TypeScript. The types follow the filter spec in
// docs/identity_filter/README.md. MOB-02 filled the seam in step 15 of the takeover plan: IDENTITY_FILTER is the engine's
// sanitize with its default drug-test hold (one argument, so the hold stays on). This change is committed only after the
// device check; while the seam was null the scan button kept the old parseOCRText path (decision U1).
import { sanitize } from '../engine';
import { RawPage } from './mlkitPages';

export type FilterReason = 'no_table_region' | 'no_results' | 'drug_test_held';

export interface FilterResult {
  payload: object | null;
  reason: FilterReason | null;
  doc_types: string[];
  visit_date: string | null;
  dropped_rows: number;
}

export type IdentityFilter = (pages: RawPage[]) => FilterResult;

export const IDENTITY_FILTER: IdentityFilter | null = (pages) => sanitize(pages);
