// Shared status helper for the Conditional Approvals ledger (KTD5). A single home for the 90-day
// threshold and the active/expiring/expired rule so `ledgers.js` (build time) and, later, the
// browser status script derive the same verdict. The one constant lives here; the template writes
// it as `data-expiring-days` so the client never duplicates the number.

// A grant with more than this many days left is "active"; on or inside it, "expiring".
export const EXPIRING_DAYS = 90;

// When a Public Notice names no individual model, the overlay entry's `text` is this sentinel line
// (an empty `text` would be dropped by the private app's `add_proposals`); the build renders it as
// the R8 pending marker rather than as models.
export const NO_MODELS_SENTINEL = "(no models stated)";

const MS_PER_DAY = 86400000;

// UTC midnight day number for a Date, so status is computed at day granularity regardless of the
// build machine's local time.
function dayOf(d) {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_PER_DAY);
}

// The "DA nn-nnn" token a member Record's docket begins with, for display and search; "" when the
// docket carries none (that Record's row key falls back to its id — see ledger_profiles.py).
export function daOfDocket(docket) {
  const m = /DA\s+(\d+-\d+)/.exec(docket || "");
  return m ? `DA ${m[1]}` : "";
}

// active | expiring | expired for a termination date relative to `today` (a Date). No termination
// date means an open-ended grant, which is active. A grant terminating today is expiring, not
// expired. Exactly EXPIRING_DAYS out is expiring.
export function statusOf(terminationDate, today) {
  if (!terminationDate) return "active";
  const term = new Date(`${terminationDate}T00:00:00Z`);
  if (Number.isNaN(term.getTime())) return "active";
  const days = dayOf(term) - dayOf(today);
  if (days < 0) return "expired";
  return days <= EXPIRING_DAYS ? "expiring" : "active";
}
