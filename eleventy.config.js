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

  // RSS: src/feed.njk renders records newest-first with the summary as the item body; the plugin supplies the filters.
  eleventyConfig.addPlugin(pluginRss);

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: process.env.OUTPUT_DIR || "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
