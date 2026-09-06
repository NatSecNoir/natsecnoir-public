// Reads the mirror's output: records/<id>/meta.json and summary.md. Only approved records are
// mirrored, but the status is checked again here so a stray folder cannot leak.
import fs from "node:fs";
import path from "node:path";
import listInfo from "./lists.js";

const root = process.env.RECORDS_DIR || "records";

function excerpt(summary) {
  const first = summary.split(/\n\s*\n/).find((p) => p.trim()) || "";
  return first.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function () {
  if (!fs.existsSync(root)) return { all: [], byList: [], byAgency: [], byType: [] };
  const all = [];
  for (const id of fs.readdirSync(root).sort()) {
    const dir = path.join(root, id);
    const metaPath = path.join(dir, "meta.json");
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.status !== "approved") continue;
    const summary = fs.existsSync(path.join(dir, "summary.md")) ? fs.readFileSync(path.join(dir, "summary.md"), "utf8") : "";
    const files = fs.readdirSync(dir);
    const copy = ["source.pdf", "source.html", "source.txt"].find((f) => files.includes(f));
    all.push({
      ...meta,
      id,
      summary,
      excerpt: excerpt(summary),
      url: `/records/${id}/`,
      copy: meta.source_copy_public && copy ? `/records/${id}/${copy}` : "",
      lists: (meta.lists || []).map((l) => ({ slug: l, label: (listInfo[l] || {}).label || l })),
      agencySlug: slug(meta.issuing_body || "unknown"),
      typeSlug: slug(meta.doc_type || "unknown"),
      search: [meta.title, meta.issuing_body, meta.doc_type, meta.docket, meta.doc_date,
        ...(meta.lists || []).map((l) => (listInfo[l] || {}).label || l), ...(meta.entities || []), excerpt(summary)]
        .filter(Boolean).join(" | ").toLowerCase().replace(/\s+/g, " "),
    });
  }
  all.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || b.id.localeCompare(a.id));

  const group = (keyOf) => {
    const m = new Map();
    for (const r of all) for (const k of keyOf(r)) {
      if (!m.has(k.slug)) m.set(k.slug, { slug: k.slug, label: k.label, gloss: k.gloss || "", records: [] });
      m.get(k.slug).records.push(r);
    }
    return [...m.values()].sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label));
  };
  return {
    all,
    byList: group((r) => r.lists.map((l) => ({ ...l, gloss: (listInfo[l.slug] || {}).gloss }))),
    byAgency: group((r) => [{ slug: r.agencySlug, label: r.issuing_body || "Unknown" }]),
    byType: group((r) => [{ slug: r.typeSlug, label: r.doc_type || "unknown" }]),
  };
}
