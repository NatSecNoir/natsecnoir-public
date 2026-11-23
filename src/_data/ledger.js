// Reads the mirror's output: ledger/ledger.json + ledger/archive/*.html (written by `noir ledger
// publish`). One deduped ledger of U.S. government restricted-entity lists — no draft/pending
// lifecycle, so like analyses.js there is no status check; the file is published as built.
// `newest_archive` is the newest snapshot's filename (the link label); `newest_archive_href` is its R2
// URL. Archives live on R2 only; the mirror writes `archive_urls` (filename -> URL) and `newest_archive_url`.
import fs from "node:fs";
import path from "node:path";

const root = process.env.LEDGER_DIR || "ledger";

// Dates sort lexically.
function newest(led) {
  const names = Object.keys(led.archive_urls || {}).sort();
  const name = names.length ? names[names.length - 1] : "";
  return { newest_archive: name, newest_archive_href: led.newest_archive_url || (name && led.archive_urls[name]) || "" };
}

export default function () {
  const index = path.join(root, "ledger.json");
  if (!fs.existsSync(index)) return { present: false, lists: [], entities: [], newest_archive: "", newest_archive_href: "", archive_urls: {} };
  const led = JSON.parse(fs.readFileSync(index, "utf8"));
  // Precompute each row's membership slugs as a space-joined string for the `data-lists` attribute
  // (Nunjucks has no Jinja-style `map(attribute=...)` filter, so the njk page can't derive it inline).
  // Surface the first membership's analyst "human-checked, correct-as-written" marker at the
  // entity level (Nunjucks has no selectattr) so the grid can show a ✓ badge; the per-membership
  // marker still renders in the detail expansion.
  const entities = (led.entities || []).map((e) => {
    const v = (e.memberships || []).find((m) => m.verified);
    return {
      ...e,
      // A removal-register row (private plan 2026-11-20-001) has no membership; its removals still
      // place it under its list's chip.
      list_slugs: [...(e.memberships || []).map((m) => m.list), ...(e.removals || []).map((r) => r.list)].join(" "),
      first_removal: (e.removals || [])[0] || null,
      verified: v ? v.verified : null,
    };
  });
  // The removal history of a pipeline-fed list (private plan 2026-11-22-001 U8): the events with
  // their quoted statements, the editor's public notes, and the saved PDFs. One list has one today;
  // the page takes the first. Its current members come from the same ledger rows.
  const histories = led.list_histories || {};
  const hslug = Object.keys(histories)[0] || "";
  const history = hslug ? {
    ...histories[hslug],
    slug: hslug,
    list: (led.lists || []).find((l) => l.slug === hslug) || null,
    current: entities
      .map((e) => ({ e, m: (e.memberships || []).find((m) => m.list === hslug) }))
      .filter((x) => x.m)
      .map(({ e, m }) => ({ name: e.canonical, aka: e.aka || [], parent: m.parent || "", cite: m.source_cite || m.cite || "",
                            source_url: m.source_url || "" })),
    removals: (histories[hslug].events || []).filter((x) => x.event === "removal").length,
  } : null;
  // The current list as printed: each company directly under the parent it is listed under
  // (matched by name or aka), parents alphabetical, children alphabetical, any depth. A parent that
  // is not itself on the list leaves its child at the top level, still showing "listed under".
  if (history) {
    // First-listed dates (published with the history): matched by exact spelling, else by a
    // loose form that ignores case and punctuation.
    const loose = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const firstBy = new Map();
    for (const c of history.listed || []) for (const n of c.names) {
      if (!firstBy.has(n)) firstBy.set(n, c.first_listed);
      if (!firstBy.has(loose(n))) firstBy.set(loose(n), c.first_listed);
    }
    const firstOf = (c) => {
      for (const n of [c.name, ...(c.aka || [])]) { const d = firstBy.get(n) || firstBy.get(loose(n)); if (d) return d; }
      return "";
    };
    history.current = history.current.map((c) => ({ ...c, first_listed: firstOf(c) }));
    history.events = (history.events || []).map((e) => ({ ...e, first_listed: e.first_listed || firstOf(e) }));
    const byName = new Map();
    for (const c of history.current) for (const n of [c.name, ...c.aka]) byName.set(n.toLowerCase(), c);
    const kids = new Map();
    const tops = [];
    for (const c of history.current) {
      const p = c.parent && byName.get(c.parent.toLowerCase());
      if (p && p !== c) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
      else tops.push(c);
    }
    const by = (a, b) => a.name.localeCompare(b.name);
    const rows = [];
    const walk = (c, depth, seen, anc) => {
      if (seen.has(c)) return;
      seen.add(c);
      const ch = (kids.get(c) || []).sort(by);
      rows.push({ ...c, depth, anc, children: ch.length, orphan: depth === 0 && !!c.parent });
      for (const k of ch) walk(k, depth + 1, seen, [...anc, c.name]);
    };
    const seen = new Set();
    for (const c of tops.sort(by)) walk(c, 0, seen, []);
    for (const c of history.current) if (!seen.has(c)) walk(c, 0, seen, []);  // a parent cycle, if ever
    history.current_tree = rows;
  }
  return {
    present: true,
    ...led,
    history,
    lists: led.lists || [],
    entities,
    archive_urls: led.archive_urls || {},
    ...newest(led),
  };
}
