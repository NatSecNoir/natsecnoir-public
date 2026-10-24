// Dataset-kind analyses (`kind: "dataset"`): meshes that carry their own prebuilt `rows` instead of
// overlay entries joined to Records. Today the only one is the FCC Form 312 Schedule B page
// (`profile: "schedule-b"`), split out as `schedb` for its template. Default export only — Eleventy
// would otherwise load the module namespace (docs/solutions eleventy-data-module-named-exports-break-global).
import loadAnalyses from "./analyses.js";
import { displayRow, chipGroups, exportLines, EXPORT_COLUMNS } from "../lib/schedb-rows.js";

export default function () {
  const sets = loadAnalyses().all.filter((a) => a.kind === "dataset");
  const schedb = [];
  // One entry per site for analysis-schedb-site.njk (each site's own page, which also serves the table's
  // expand-on-demand detail so the table page stays light).
  const schedbSites = [];
  const built_at = new Date().toISOString();
  for (const mesh of sets) {
    if (mesh.profile !== "schedule-b") continue;
    const bands = mesh.bands || [];
    const rows = (mesh.rows || []).map((r) => displayRow(r, bands));
    const stats = mesh.stats || {};
    for (const row of rows) {
      schedbSites.push({ id: mesh.id, url: mesh.url, title: mesh.title, authority_note: mesh.authority_note || "",
                         currency_date: mesh.currency_date || "", row });
    }
    schedb.push({
      ...mesh, rows, count: rows.length, bands, stats, built_at,
      currency_date: mesh.currency_date || "",
      chips: chipGroups(rows, bands),
      export_columns: EXPORT_COLUMNS,
      export_lines: exportLines(mesh.rows || []),
      export_json: { built_at, currency_date: mesh.currency_date || "", bands, stats,
                     authority_note: mesh.authority_note || "", rows: mesh.rows || [] },
    });
  }
  return { schedb, schedbSites };
}
