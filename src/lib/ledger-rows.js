// Pure row-assembly for ledger-kind analyses, split out of src/_data/ledgers.js so it can be unit
// tested directly and so the data file exposes only its default export (Eleventy treats a global
// _data module's default as the data global; adding named exports there makes Eleventy load the
// module namespace instead of calling the default, so the assembled rows never reach the templates
// and pagination fails with "Could not find pagination data"). Two grains: `record` (one row per
// unfolded member Record, Team Telecom) and `row` (one row per approval, Conditional Approvals).
import { statusOf, daOfDocket, NO_MODELS_SENTINEL } from "./approvals-status.js";

// Terms/models live in the entry `text`, one bullet per line (KTD2). Empty lines are dropped.
function linesOf(entry) {
  return (entry && entry.text ? entry.text.split("\n") : []).map((t) => t.trim()).filter(Boolean);
}

// The stored copy is the only source link on the page: its R2 URL.
const pdfOf = (r) => (r && r.copy) || "";

// doc_type in the stored form the private app compares on: trimmed, lowercased, inner whitespace collapsed.
export const normalizeDocType = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Whether a Record carries every membership slug the mesh requires and, when the mesh sets
// `membership.doc_types` (the CFIUS orders ledger), one of those document types.
function memberTest(mesh) {
  const wants = (mesh.membership && mesh.membership.lists_all) || [];
  const types = mesh.membership && mesh.membership.doc_types ? mesh.membership.doc_types.map(normalizeDocType) : null;
  return (r) => wants.length > 0 && wants.every((slug) => (r.lists || []).some((l) => l.slug === slug))
    && (!types || types.includes(normalizeDocType(r.doc_type)));
}

// grain: "record" — one row per unfolded member, superseding/companion instruments folded beneath
// their parent row. The original ledger body, unchanged in behaviour.
export function recordGrainRows(mesh, records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const entries = new Map((mesh.entries || []).map((e) => [e.key, e]));
  const isMember = memberTest(mesh);
  const members = records.filter(isMember);
  const labelOf = (entry, r) => (entry && entry.label) || (r && r.title) || "";

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
    const terms = linesOf(entry);
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
  return rows;
}

// grain: "row" — one row per entry whose `record_id` is a current member (R3: an entry whose Record
// lost a tag or approval is dropped), plus one placeholder row per member with no entry (R1). Each
// row joins its Record for the PN date, DA, and links, which are never stored in the overlay so they
// cannot drift. Rows are generic; the template names the columns.
export function rowGrainRows(mesh, records, today) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const isMember = memberTest(mesh);
  const members = records.filter(isMember);
  const memberIds = new Set(members.map((r) => r.id));

  const rows = [];
  const covered = new Set(); // member ids already represented by an accepted row or an amendment
  for (const e of mesh.entries || []) {
    const rid = e.record_id;
    if (!rid || !memberIds.has(rid)) continue;
    const rec = byId.get(rid);
    const fields = e.fields || {};
    const lines = linesOf(e);
    const noModels = lines.length === 0 || (lines.length === 1 && lines[0] === NO_MODELS_SENTINEL);
    const models = noModels ? [] : lines;
    const termination_date = fields.termination_date || null;
    const status_at_build = statusOf(termination_date, today);
    const entity = e.label || (rec && rec.title) || "";
    const category = fields.category || "";
    const issuer = fields.issuer || "";
    const da = daOfDocket(rec && rec.docket);
    const amendments = (e.amendments || []).map((a) => {
      const ar = byId.get(a.record_id);
      covered.add(a.record_id); // an amending PN is folded here, not shown as a pending placeholder
      return {
        record_id: a.record_id, page: a.page || "", note: a.note || "",
        da: daOfDocket(ar && ar.docket), record_url: ar ? ar.url : "", pdf_url: pdfOf(ar),
      };
    });
    const search = [entity, ...models, category, issuer, da].filter(Boolean).join(" ")
      .toLowerCase().replace(/\s+/g, " ");
    covered.add(rid);
    rows.push({
      id: e.key, record_id: rid, doc_date: rec ? rec.doc_date : "", da,
      entity, category, issuer, models, termination_date, status_at_build,
      record_url: rec ? rec.url : "", pdf_url: pdfOf(rec), source_url: (rec && rec.source_url) || "", amendments,
      pending: { models: noModels, category: !category, issuer: !issuer, termination_date: false },
      search, lists: [category, status_at_build].filter(Boolean), placeholder: false,
    });
  }

  // Placeholders: members not yet represented by any accepted row or amendment.
  for (const r of members) {
    if (covered.has(r.id)) continue;
    const da = daOfDocket(r.docket);
    const entity = r.title || "";
    rows.push({
      id: r.id, record_id: r.id, doc_date: r.doc_date, da,
      entity, category: "", issuer: "", models: [], termination_date: null, status_at_build: "",
      record_url: r.url, pdf_url: pdfOf(r), source_url: r.source_url || "", amendments: [],
      pending: { models: true, category: true, issuer: true, termination_date: true },
      search: [entity, da].filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " "),
      lists: [], placeholder: true,
    });
  }
  rows.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || a.id.localeCompare(b.id));
  return rows;
}

// Profile `presidential-order` (CFIUS orders ledger): one row per unfolded member order, an amending
// order folded beneath as a companion (as Team Telecom), plus the hand-set facts the editor sources —
// status, a deadline extension — and `related` records (litigation) linked from the detail row.
// Deadline: "N days (date)" when the order counts from its own date; a date the order itself states
// wins; an extension replaces the shown date and keeps the original term.
function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function orderDeadline(fields, signed, extension) {
  const days = Number.isInteger(fields.deadline_days) ? fields.deadline_days : null;
  const stated = fields.deadline_date || "";
  const computed = !stated && days !== null && fields.deadline_from === "order date" ? addDays(signed, days) : "";
  const date = stated || computed;
  const ext = extension && extension.date ? extension : null;
  return {
    days, date, stated: Boolean(stated),
    extended_to: ext ? ext.date : "", extension_source: ext ? ext.source || "" : "",
    basis: !date && days !== null && fields.deadline_from && fields.deadline_from !== "order date" ? "counted from a date other than the order" : "",
    has_days: days !== null, absent: days === null && !date,
  };
}

export function orderRows(mesh, records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const entries = new Map((mesh.entries || []).map((e) => [e.key, e]));
  const isMember = memberTest(mesh);
  const members = records.filter(isMember);

  const folded = new Set();
  for (const r of members) {
    const chain = (entries.get(r.id) || {}).chain || {};
    for (const id of [...(chain.supersedes || []), ...(chain.companion || [])]) folded.add(id);
  }

  const linkOf = (rel, id) => {
    const h = byId.get(id);
    if (!h) return null; // not a mirrored (approved) record: skipped, never a dead link
    return { rel, id, label: (entries.get(id) || {}).label || h.title, date: h.doc_date, docket: h.docket || "",
             record_url: h.url, pdf_url: pdfOf(h) };
  };

  const rows = members.filter((r) => !folded.has(r.id)).map((r) => {
    const entry = entries.get(r.id) || {};
    const fields = entry.fields || {};
    const chain = entry.chain || {};
    const terms = linesOf(entry);
    const history = [];
    for (const [rel, ids] of [["superseded", chain.supersedes || []], ["companion", chain.companion || []], ["related", entry.related || []]]) {
      for (const id of ids) { const h = linkOf(rel, id); if (h) history.push(h); }
    }
    history.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id));
    const folds = history.filter((h) => h.rel !== "related");
    const status = entry.status && entry.status.value ? entry.status : null;
    const deadline = orderDeadline(fields, r.doc_date, entry.deadline_extended_to);
    const acquirer = fields.acquirer || entry.label || r.title || "";
    const search = [acquirer, fields.acquirer_parent, fields.acquirer_country, fields.target, fields.sector,
      fields.action, fields.president, status && status.value, r.docket, r.title, ...(r.entities || [])]
      .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ");
    return {
      id: r.id, date: r.doc_date, doc_date: r.doc_date,
      president: fields.president || "", acquirer, acquirer_parent: fields.acquirer_parent || "",
      country: fields.acquirer_country || "", target: fields.target || "", sector: fields.sector || "",
      action: fields.action || "", deadline,
      status: status ? status.value : "", status_source: status ? status.source || "" : "",
      status_class: status ? `s-${status.value.replace(/\s+/g, "-")}` : "",
      docket: r.docket || "", terms, record_url: r.url, pdf_url: pdfOf(r),
      history, foldsummary: folds.map((h) => `${h.rel} · ${h.label}`).join("; "), foldcount: folds.length,
      pending: {
        president: !fields.president, acquirer: !fields.acquirer, country: !fields.acquirer_country,
        target: !fields.target, sector: !fields.sector, action: !fields.action,
        deadline: !Object.keys(fields).length, status: !status, terms: !terms.length,
      },
      search,
    };
  });
  rows.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || a.id.localeCompare(b.id));
  return rows;
}
