// Assembles each ledger-kind analysis into a table of rows at build time (KTD3). A ledger mesh
// carries `kind: "ledger"`, `membership.lists_all` (the slugs a Record must all have to be a
// member), and overlay `entries` keyed by Record id. Membership is computed here against the
// mirrored Records, so a records mirror alone publishes a row (with pending markers) and the
// private app never renders the table. Chain links fold superseding/companion instruments beneath
// their parent row; the fold guard lives in the private app's set_overlay, so a mesh that reaches
// the build is already free of cross-linked or cyclic chains.
import loadRecords from "./records.js";
import loadAnalyses from "./analyses.js";

// Terms live in the entry `text`, one bullet per line (KTD2). Empty lines are dropped.
function termsOf(entry) {
  return (entry && entry.text ? entry.text.split("\n") : []).map((t) => t.trim()).filter(Boolean);
}

export default function () {
  const analyses = loadAnalyses().all.filter((a) => a.kind === "ledger");
  if (!analyses.length) return { all: [], byId: {} };

  const records = loadRecords().all;
  const byId = new Map(records.map((r) => [r.id, r]));
  // The stored copy is the only source link on the page: it is a relative /records/<id>/... path,
  // so every href in the article stays on-site (the external source lives on the record page).
  const pdfOf = (r) => (r && r.copy) || "";
  const labelOf = (entry, r) => (entry && entry.label) || (r && r.title) || "";

  const all = [];
  const idIndex = {};
  for (const mesh of analyses) {
    const wants = (mesh.membership && mesh.membership.lists_all) || [];
    const entries = new Map((mesh.entries || []).map((e) => [e.key, e]));
    const isMember = (r) => wants.length > 0 && wants.every((slug) => (r.lists || []).some((l) => l.slug === slug));
    const members = records.filter(isMember);

    // Ids folded beneath a parent: named in some member's chain.supersedes or .companion.
    const folded = new Set();
    for (const r of members) {
      const chain = (entries.get(r.id) || {}).chain || {};
      for (const id of [...(chain.supersedes || []), ...(chain.companion || [])]) folded.add(id);
    }

    const rows = members.filter((r) => !folded.has(r.id)).map((r) => {
      const entry = entries.get(r.id);
      const fields = (entry && entry.fields) || {};
      const chain = (entry && entry.chain) || {};
      const terms = termsOf(entry);
      const agencies = fields.agencies || [];
      const company = labelOf(entry, r);

      // History: each folded id this row names, tagged by which list named it, in date order.
      const history = [];
      for (const [rel, ids] of [["superseded", chain.supersedes || []], ["companion", chain.companion || []]]) {
        for (const id of ids) {
          const h = byId.get(id);
          if (!h) continue; // a named id that is not a mirrored member is silently skipped
          history.push({
            rel, id,
            label: (entries.get(id) || {}).label || h.title,
            date: h.doc_date, docket: h.docket || "",
            record_url: h.url, pdf_url: pdfOf(h),
          });
        }
      }
      history.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id));

      const search = [company, r.title, fields.transaction_type, agencies.join(" "), fields.country,
        r.docket, ...(r.entities || [])].filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ");

      return {
        id: r.id, date: r.doc_date, doc_date: r.doc_date, company,
        transaction_type: fields.transaction_type || "", agencies, country: fields.country || "",
        docket: r.docket || "", terms,
        record_url: r.url, pdf_url: pdfOf(r),
        history,
        foldsummary: history.map((h) => `${h.rel} · ${h.label}`).join("; "),
        pending: {
          type: !fields.transaction_type, agencies: !agencies.length,
          country: !fields.country, terms: !terms.length,
        },
        search,
      };
    });
    rows.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || a.id.localeCompare(b.id));

    const led = {
      ...mesh,
      rows, count: rows.length,
      // R14: the stamp is the last accepted change; fall back to currency_date only when a mesh has
      // never accepted anything, so a check run that accepts nothing does not move the stamp.
      currency_date: mesh.last_changed || mesh.currency_date || "",
    };
    all.push(led);
    idIndex[mesh.id] = led;
  }
  all.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || b.id.localeCompare(a.id));
  return { all, byId: idIndex };
}
