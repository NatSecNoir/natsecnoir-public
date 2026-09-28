// Assembles each ledger-kind analysis into a table of rows at build time (KTD3/KTD4). A ledger mesh
// carries `kind: "ledger"`, `membership.lists_all` (the slugs a Record must all have to be a
// member), and overlay `entries`. Two grains are supported: the default `grain: "record"` renders
// one row per unfolded member Record (Team Telecom agreements); `grain: "row"` renders one row per
// approval, plus a placeholder per un-extracted member, so one Public Notice grants many rows
// (Conditional Approvals). Membership is computed here against the mirrored Records, so a records
// mirror alone publishes a row (with pending markers) and the private app never renders the table.
// The row-assembly itself lives in ../lib/ledger-rows.js: this module has ONLY a default export,
// because Eleventy would otherwise load the module namespace and the rows would never reach the
// templates. The two grains are returned pre-split because Eleventy's YAML pagination.filter cannot
// express a grain test — the same reason analyses.js returns a pre-filtered `pages` array.
import loadRecords from "./records.js";
import loadAnalyses from "./analyses.js";
import { recordGrainRows, rowGrainRows } from "../lib/ledger-rows.js";
import { EXPIRING_DAYS } from "../lib/approvals-status.js";

export default function () {
  const analyses = loadAnalyses().all.filter((a) => a.kind === "ledger");
  if (!analyses.length) return { all: [], byId: {}, recordGrain: [], rowGrain: [] };

  const records = loadRecords().all;
  // Compute the build stamp once here, never at module import, so a long-lived process re-derives
  // view-time status against the actual build date (KTD5).
  const today = new Date();

  const all = [];
  const idIndex = {};
  const recordGrain = [];
  const rowGrain = [];
  for (const mesh of analyses) {
    const grain = mesh.grain || "record";
    // R14: the stamp is the last accepted change; fall back to currency_date only when a mesh has
    // never accepted anything, so a check run that accepts nothing does not move the stamp.
    const currency_date = mesh.last_changed || mesh.currency_date || "";
    let led;
    if (grain === "row") {
      const rows = rowGrainRows(mesh, records, today);
      led = { ...mesh, rows, count: rows.length, expiring_days: EXPIRING_DAYS, currency_date };
      rowGrain.push(led);
    } else {
      const rows = recordGrainRows(mesh, records);
      led = { ...mesh, rows, count: rows.length, currency_date };
      recordGrain.push(led);
    }
    all.push(led);
    idIndex[mesh.id] = led;
  }
  all.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || b.id.localeCompare(a.id));
  return { all, byId: idIndex, recordGrain, rowGrain };
}
