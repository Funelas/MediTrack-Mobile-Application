// The identity-filter seam (MOB-03; the filter itself is MOB-02). Pure TypeScript. The types follow the filter spec in
// docs/identity_filter/README.md. IDENTITY_FILTER stays null until MOB-02 lands; that one line is what MOB-02 changes,
// and while it is null the scan button keeps the old parseOCRText path (decision U1) and the engine screen is not reached.
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

export const IDENTITY_FILTER: IdentityFilter | null = null;
