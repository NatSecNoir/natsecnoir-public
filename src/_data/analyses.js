// Reads the mirror's output: analyses/<id>/mesh.json (written by `noir mirror`). Analyses have no
// draft/pending lifecycle (they are public from creation), so unlike records.js there is no status
// check here — every folder with a mesh.json is published.
import fs from "node:fs";
import path from "node:path";

const root = process.env.ANALYSES_DIR || "analyses";

function excerpt(mesh) {
  if (mesh.excerpt) return mesh.excerpt;
  const first = (mesh.entries || [])[0];
  return first ? first.text.split("\n")[0] : "";
}

export default function () {
  if (!fs.existsSync(root)) return { all: [] };
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
  return { all };
}
