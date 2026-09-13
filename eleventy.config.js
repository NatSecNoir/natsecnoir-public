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
  eleventyConfig.addFilter("head", (a, n) => (a || []).slice(0, n));
  // Ledger source links must be https on the authoritative .gov/.mil allowlist (mirrors
  // noir/ledger.py valid_source_url). Returns "" for anything off-allowlist so the page never
  // renders a non-government URL as a source href.
  eleventyConfig.addFilter("govsource", (url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && /(^|\.)(gov|mil)$/i.test(u.hostname) ? url : "";
    } catch { return ""; }
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
  // Each approved record's public files are published at /records/<id>/<name>, the same path as in
  // the repo (Eleventy's glob passthrough would flatten them). Non-approved folders are skipped.
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
      for (const name of ["meta.json", "summary.md", "source.pdf", "source.html", "source.txt"]) {
        if (name.startsWith("source.") && !meta.source_copy_public) continue;
        if (fs.existsSync(path.join(src, name))) fs.copyFileSync(path.join(src, name), path.join(dst, name));
      }
    }
  });
  eleventyConfig.addPassthroughCopy({ "records.json": "records.json" });
  // Analyses are always public: every analyses/<id>/mesh.json is served next to its page.
  const analyses = process.env.ANALYSES_DIR || "analyses";
  if (fs.existsSync(analyses)) eleventyConfig.addPassthroughCopy({ [analyses]: "analyses" });
  if (fs.existsSync("analyses.json")) eleventyConfig.addPassthroughCopy({ "analyses.json": "analyses.json" });
  // The built ledger + its self-contained archives are served at /ledger/ so the page's
  // Download-archive link resolves and each archive opens on its own (written by `noir ledger publish`).
  const ledger = process.env.LEDGER_DIR || "ledger";
  if (fs.existsSync(ledger)) eleventyConfig.addPassthroughCopy({ [ledger]: "ledger" });

  // RSS: src/feed.njk renders records newest-first with the summary as the item body; the plugin supplies the filters.
  eleventyConfig.addPlugin(pluginRss);

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: process.env.OUTPUT_DIR || "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
