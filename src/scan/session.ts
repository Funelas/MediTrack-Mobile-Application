// The scan session slot (MOB-03, decision D14). One in-memory slot holds the sanitized payload, the Contract A record and
// the date candidate the filter found (optional) while the scan screens are open. Nothing goes in navigation params or in a log. The screens clear it on save, on
// discard and on unmount. Pure TypeScript.
import { ParseOutput } from '../engine';

export interface ScanSession {
  payload: object;
  record: ParseOutput['record'] | null;
  /** The date the identity filter found on the report: a candidate only; the screen prefills it and the user confirms it. */
  dateCandidate?: string | null;
}

let slot: ScanSession | null = null;

export function setSession(session: ScanSession): void {
  slot = session;
}

export function getSession(): ScanSession | null {
  return slot;
}

export function clearSession(): void {
  slot = null;
}
