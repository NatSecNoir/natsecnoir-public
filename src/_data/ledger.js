// Reads the mirror's output: ledger/ledger.json + ledger/archive/*.html (written by `noir ledger
// publish`). One deduped ledger of U.S. government restricted-entity lists — no draft/pending
// lifecycle, so like analyses.js there is no status check; the file is published as built.
// `newest_archive` is the filename the page's Download-archive link points at.
import fs from "node:fs";
import path from "node:path";

const root = process.env.LEDGER_DIR || "ledger";

export default function () {
  const index = path.join(root, "ledger.json");
  if (!fs.existsSync(index)) return { present: false, lists: [], entities: [], newest_archive: "" };
  const led = JSON.parse(fs.readFileSync(index, "utf8"));
  const archiveDir = path.join(root, "archive");
  const archives = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).filter((n) => n.endsWith(".html")).sort()
    : [];
  // Precompute each row's membership slugs as a space-joined string for the `data-lists` attribute
  // (Nunjucks has no Jinja-style `map(attribute=...)` filter, so the njk page can't derive it inline).
  // Surface the first membership's analyst "human-checked, correct-as-written" marker at the
  // entity level (Nunjucks has no selectattr) so the grid can show a ✓ badge; the per-membership
  // marker still renders in the detail expansion.
  const entities = (led.entities || []).map((e) => {
    const v = (e.memberships || []).find((m) => m.verified);
    return {
      ...e,
      list_slugs: (e.memberships || []).map((m) => m.list).join(" "),
      verified: v ? v.verified : null,
    };
  });
  return {
    present: true,
    ...led,
    lists: led.lists || [],
    entities,
    // Newest snapshot (dates sort lexically), served at /ledger/archive/<name> by the passthrough.
    newest_archive: archives.length ? archives[archives.length - 1] : "",
  };
}
