// Structured reading view (U11b): turns a record's public `document.json` (outline + blocks with
// per-block footnotes and part keys, written by the private mirror) into what document-view.njk renders.
//
// Footnote markers: the Document says which footnotes a paragraph cites (`markers`) but not where in the
// text each one sits; the PDF leaves the digit glued to the preceding word ("…FNPRM).1  In"). `placeMarkers`
// finds each marker in order: the number right after a non-space, non-digit character and before
// whitespace, punctuation, or the end. Measured on the 16 first published Documents it places about 90%;
// a marker it cannot place keeps its note under the paragraph, with the back-link going to the paragraph.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// [{n, index, length}] in text order, one per marker found; markers not found are omitted.
export function placeMarkers(text, markers) {
  const out = [];
  let pos = 0;
  for (const n of markers || []) {
    const re = new RegExp(`(?<=[^\\s\\d(§$])${Number(n)}(?=[\\s,;:.)\\]]|$)`, "g");
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) continue;
    out.push({ n: Number(n), index: m.index, length: m[0].length });
    pos = m.index + m[0].length;
  }
  return out;
}

// Footnote text arrives as "12 Text of the note"; the list numbers it already.
export const noteText = (n, text) => String(text || "").replace(new RegExp(`^\\s*${Number(n)}\\s+`), "");

export function documentView(doc) {
  if (!doc || !Array.isArray(doc.blocks)) return null;
  const parts = doc.parts || {};
  const levels = new Map((doc.outline || []).map((o) => [o.id, o.level || 1]));
  const fnIds = new Map();                        // note id per (block, n); suffixed if a number repeats
  const usedIds = new Set();
  const noteId = (bi, n) => {
    const key = `${bi}:${n}`;
    if (!fnIds.has(key)) {
      let id = `fn-${n}`, k = 2;
      while (usedIds.has(id)) id = `fn-${n}-${k++}`;
      usedIds.add(id); fnIds.set(key, id);
    }
    return fnIds.get(key);
  };
  const items = [], toc = [];
  let part = null, lastPage = 0;
  doc.blocks.forEach((b, bi) => {
    if (b.part !== part) {
      part = b.part;
      if (part && parts[part]) {
        items.push({ type: "part", id: `part-${part}`, label: parts[part] });
        toc.push({ id: `part-${part}`, label: parts[part], level: 0 });
      }
    }
    const page = b.page !== lastPage ? b.page : null;
    if (b.kind !== "heading" && page) lastPage = b.page;
    if (b.kind === "heading") {
      const level = levels.get(b.id) || 1;
      items.push({ type: "heading", id: b.id, text: b.text, level });
      if (level <= 2) toc.push({ id: b.id, label: b.text, level });
      return;
    }
    const text = String(b.text || "");
    const placed = placeMarkers(text, b.markers);
    const placedN = new Set(placed.map((p) => p.n));
    let html = "", pos = 0;
    for (const p of placed) {
      const id = noteId(bi, p.n);
      html += escapeHtml(text.slice(pos, p.index));
      html += `<sup class="fnref"><a id="ref-${id}" href="#${id}">${p.n}</a></sup>`;
      pos = p.index + p.length;
    }
    html += escapeHtml(text.slice(pos));
    const anchor = b.number != null ? `para-${b.number}` : b.id;
    const notes = (b.footnotes || []).map((f) => {
      const id = noteId(bi, f.n);
      return { id, n: f.n, text: noteText(f.n, f.text), back: placedN.has(f.n) ? `ref-${id}` : anchor };
    });
    items.push({ type: b.kind === "para" ? "para" : "block", id: anchor, number: b.number, page, html, notes });
  });
  const paras = items.filter((i) => i.type === "para").length;
  const notes = items.reduce((s, i) => s + (i.notes ? i.notes.length : 0), 0);
  return { items, toc, paras, notes };
}
