// Reads the mirror's output: analyses/<id>/mesh.json (written by `noir mirror`). Analyses have no
// draft/pending lifecycle (they are public from creation), so unlike records.js there is no status
// check here — every folder with a mesh.json is published.
import fs from "node:fs";
import path from "node:path";

const root = process.env.ANALYSES_DIR || "analyses";

// The /analyses/ index lists cards in this editorial order, after the Supply-Chain Watch Lists card
// (hard-coded first in analyses-index.njk). Unlisted analyses sit between these and INDEX_LAST,
// newest first, so a new analysis never lands below the Schedule B dataset.
const INDEX_ORDER = ["conditional-approvals", "team-telecom-agreements", "cfius-presidential-orders", "covered-list"];
const INDEX_LAST = ["fcc-form-312-schedule-b"];

function excerpt(mesh) {
  if (mesh.excerpt) return mesh.excerpt;
  const first = (mesh.entries || [])[0];
  return first ? first.text.split("\n")[0] : "";
}

export default function () {
  if (!fs.existsSync(root)) return { all: [], pages: [], index: [] };
  const all = [];
  for (const id of fs.readdirSync(root).sort()) {
    const meshPath = path.join(root, id, "mesh.json");
    if (!fs.existsSync(meshPath)) continue;
    const mesh = JSON.parse(fs.readFileSync(meshPath, "utf8"));
    all.push({
      ...mesh,
      id,
      url: `/analyses/${id}/`,
      doc_date: mesh.last_changed || mesh.currency_date || "",
      excerpt: excerpt(mesh),
      search: [mesh.title, mesh.baseline_source, ...(mesh.entries || []).map((e) => e.label)]
        .filter(Boolean).join(" | ").toLowerCase().replace(/\s+/g, " "),
    });
  }
  all.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || b.id.localeCompare(a.id));
  // `pages` is what analysis.njk paginates: every non-ledger analysis. Ledger-kind meshes are
  // rendered by analysis-ledger.njk (from ledgers.js) instead, so they must not also feed the
  // generic template or the two would collide on the /analyses/<id>/ permalink.
  // Dataset-kind meshes (the Form 312 Schedule B page) render from datasets.js the same way.
  const pages = all.filter((a) => a.kind !== "ledger" && a.kind !== "dataset");
  const rank = (a) => {
    const i = INDEX_ORDER.indexOf(a.id);
    if (i >= 0) return i;
    const j = INDEX_LAST.indexOf(a.id);
    return j >= 0 ? INDEX_ORDER.length + 1 + j : INDEX_ORDER.length;
  };
  // Stable sort: unlisted analyses keep `all`'s newest-first order among themselves.
  const index = [...all].sort((a, b) => rank(a) - rank(b));
  return { all, pages, index };
}
