// Federal Register panel for an FCC national-security order (records tagged `fcc-natsec-order`).
// Mirrors the private app's reading of meta.federal_register (noir/fedreg.py): dates and links only.
//
//   { state: "hidden" | "not_expected" | "pending" | "docs", checked, finals: [...], proposals: [...] }
//
// A proposal is `open` while its latest comment or reply deadline is on or after `today`; a closed
// one keeps its line (and its FR link) but says so. The client script flips open → closed when a
// build is older than the deadline.

export const FCC_TAG = "fcc-natsec-order";

function isoDay(s) { return (s || "").slice(0, 10); }

export function frPanel(meta, today) {
  const lists = meta.lists || [];
  if (!lists.includes(FCC_TAG)) return { state: "hidden" };
  if (meta.fr_status === "not_expected") return { state: "not_expected" };
  const fr = meta.federal_register || {};
  const docs = (fr.documents || []).filter((d) => d && d.url);
  if (!docs.length) return { state: "pending" };
  const byDate = (a, b) => (a.published || "").localeCompare(b.published || "") || (a.number || "").localeCompare(b.number || "");
  const finals = docs.filter((d) => d.type !== "Proposed Rule").sort(byDate).map((d) => ({
    url: d.url, citation: d.citation || "", published: isoDay(d.published),
    effective_on: isoDay(d.effective_on), effective_partial: !!d.effective_partial,
    label: d.action || d.type || "Final rule",
  }));
  const proposals = docs.filter((d) => d.type === "Proposed Rule").sort(byDate).map((d) => {
    const comments = isoDay(d.comments_due), replies = isoDay(d.replies_due);
    const until = [comments, replies].filter(Boolean).sort().pop() || "";
    return { url: d.url, citation: d.citation || "", published: isoDay(d.published),
             comments_due: comments, replies_due: replies, until, open: !!until && until >= today };
  });
  return { state: "docs", checked: isoDay(fr.updated_at), finals, proposals };
}

// The most recent erratum (by `issued`), or null.
export function latestErratum(meta) {
  const list = (meta.errata || []).filter((e) => e && e.url);
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (b.issued || "").localeCompare(a.issued || ""));
  return { ...sorted[0], issued: sorted[0].issued || "", earlier: sorted.slice(1) };
}
