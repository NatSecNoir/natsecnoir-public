// NatSec Noir public site. Reads records/<id>/{meta.json,summary.md} (written by `noir mirror`) and
// renders a feed, per-record pages, index pages by list/agency/type, and an RSS feed.
// Summaries render with raw HTML disabled (KTD13): a summary can quote source text verbatim.
import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import pluginRss from "@11ty/eleventy-plugin-rss";

export default function (eleventyConfig) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addFilter("markdown", (s) => md.render(s || ""));
  // Conditional Approvals device categories: display labels (data keys stay as-is, e.g. "uas").
  const CATEGORY_LABELS = { uas: "Drones" };
  eleventyConfig.addFilter("categoryLabel", (c) => {
    const k = String(c || "");
    return CATEGORY_LABELS[k.toLowerCase()] || (k.charAt(0).toUpperCase() + k.slice(1));
  });
  eleventyConfig.addFilter("head", (a, n) => (a || []).slice(0, n));
  // CSV row: quote a cell only when it holds a comma, quote, or newline (RFC 4180), doubling any
  // embedded quote. Used by src/analysis-approvals.csv.njk for the machine-readable export.
  eleventyConfig.addFilter("csv", (cells) =>
    (cells || []).map((c) => {
      const s = c == null ? "" : String(c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(","));
  // Pretty JSON for the export template (Nunjucks `dump` gives compact, unindented output).
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v, null, 2));
  // Ledger source links must be https on the authoritative .gov/.mil allowlist (mirrors
  // noir/ledger.py valid_source_url). Returns "" for anything off-allowlist so the page never
  // renders a non-government URL as a source href.
  eleventyConfig.addFilter("govsource", (url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && /(^|\.)(gov|mil)$/i.test(u.hostname) ? url : "";
    } catch { return ""; }
  });
  // The Federal Register's plain-text edition writes quotation marks as `` and ''; its HTML edition
  // prints them as curly quotes. Shown the HTML way; the saved quote is unchanged.
  eleventyConfig.addFilter("frquotes", (s) => String(s || "").replace(/``/g, "\u201c").replace(/''/g, "\u201d"));
  // § 1260H history page: the one quote that best states why a company left the list, shortened
  // for a table cell. A company's own note beats a heading over a group, and a stated ground beats
  // the notice's operative text. Long quotes are cut to a verbatim excerpt with ellipses; the full
  // text is one click away in the linked document. Returns null when there is nothing to quote.
  eleventyConfig.addFilter("briefreason", (e) => {
    const st = (e && e.statements) || [];
    const rank = (x) => (x.role === "reason" ? 0 : 2) + (x.scope === "entity note" ? 0 : 1);
    const best = [...st].sort((a, b) => rank(a) - rank(b))[0];
    if (!best) return null;
    let q = String(best.quote || "").replace(/``/g, "\u201c").replace(/''/g, "\u201d").replace(/\s+/g, " ").trim();
    const max = 110;
    if (q.length > max) {
      const m = /\b((?:Because|in compliance with) .*?)(?:,? as Mandated\b|, which\b|$)/i.exec(q);
      if (m && m[1].length <= 150) q = (m.index ? "\u2026 " : "") + m[1] + (m.index + m[1].length < q.length ? " \u2026" : "");
      else q = q.slice(0, q.lastIndexOf(" ", max)).replace(/[,;:]$/, "") + " \u2026";
    }
    return { quote: q, role: best.role, scope: best.scope, over: best.over || 1 };
  });
  // An archived copy is allowed only as a Wayback capture of a .gov/.mil URL (private plan
  // 2026-11-22-001 KD3: official link first, archived copy second). Anything else renders no link.
  eleventyConfig.addFilter("archivesource", (url) => {
    const m = /^https:\/\/web\.archive\.org\/web\/\d{14}\/(https:\/\/[^/#?]+)/.exec(String(url || ""));
    if (!m) return "";
    try { return /(^|\.)(gov|mil)$/i.test(new URL(m[1]).hostname) ? url : ""; } catch { return ""; }
  });
  // A "cite" field can carry one or more Federal Register citations ("62 FR 35334; 84 FR 40241, …")
  // mixed with dates and parentheticals. Linkify each "<vol> FR <page>" token to the Federal Register
  // citation redirect (www.federalregister.gov — authoritative .gov), leaving everything else as plain
  // text. The input is HTML-escaped first; an FR token has no HTML-special characters, so it survives
  // intact. A trailing "FR" with no page (e.g. "88 FR") simply does not match and stays plain text.
  eleventyConfig.addFilter("frcite", (s) => {
    const esc = String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/\b(\d{1,3})\s+FR\s+(\d+)\b/g, (m, vol, page) =>
      `<a href="https://www.federalregister.gov/citation/${vol}-FR-${page}" target="_blank" rel="noopener noreferrer">${m}</a>`);
  });

  const records = process.env.RECORDS_DIR || "records";
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/js": "js", "src/img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  // Each approved record's public files are published at /records/<id>/<name>, the same path as in
  // the repo (Eleventy's glob passthrough would flatten them). Non-approved folders are skipped.
  // Stored copies are not among them: they live on R2 (meta.copy_url), and old /records/<id>/source.*
  // paths 301 there via _redirects. Keeping them out also keeps every file under Pages' 25 MiB cap.
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    if (!fs.existsSync(records)) return;
    for (const id of fs.readdirSync(records)) {
      const src = path.join(records, id);
      const metaPath = path.join(src, "meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta.status !== "approved") continue;
      const dst = path.join(dir.output, "records", id);
      fs.mkdirSync(dst, { recursive: true });
      for (const name of ["meta.json", "summary.md"]) {
        if (fs.existsSync(path.join(src, name))) fs.copyFileSync(path.join(src, name), path.join(dst, name));
      }
    }
  });
  eleventyConfig.addPassthroughCopy({ "records.json": "records.json" });
  // Analyses are always public: every analyses/<id>/mesh.json is served next to its page.
  const analyses = process.env.ANALYSES_DIR || "analyses";
  if (fs.existsSync(analyses)) eleventyConfig.addPassthroughCopy({ [analyses]: "analyses" });
  if (fs.existsSync("analyses.json")) eleventyConfig.addPassthroughCopy({ "analyses.json": "analyses.json" });
  // The built ledger is served at /ledger/ledger.json (written by `noir ledger publish`). Its archives
  // live on R2 (ledger.archive_urls); old /ledger/archive/ paths 301 there via _redirects.
  const ledger = process.env.LEDGER_DIR || "ledger";
  if (fs.existsSync(path.join(ledger, "ledger.json")))
    eleventyConfig.addPassthroughCopy({ [path.join(ledger, "ledger.json")]: "ledger/ledger.json" });

  // RSS: src/feed.njk renders records newest-first with the summary as the item body; the plugin supplies the filters.
  eleventyConfig.addPlugin(pluginRss);

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: process.env.OUTPUT_DIR || "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
