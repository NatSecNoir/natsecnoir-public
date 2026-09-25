// Build check: the site builds with zero records and with the three fixture records, a record page
// links to its source and shows the summary, and a raw HTML tag in a summary renders as text.
// Analyses: the fixture mesh renders its own page, is badged in the feed, and its text is escaped.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
function build(recordsDir, analysesDir, ledgerDir, out) {
  fs.rmSync(out, { recursive: true, force: true });
  execFileSync("npx", ["eleventy", "--quiet"], { cwd: root, stdio: "inherit",
    env: { ...process.env, RECORDS_DIR: recordsDir, ANALYSES_DIR: analysesDir, LEDGER_DIR: ledgerDir, OUTPUT_DIR: out } });
}
const outEmpty = path.join(root, "tests/_out/empty");
const outFix = path.join(root, "tests/_out/fixtures");
const empty = path.join(root, "tests/_out/no-records");
const noAnalyses = path.join(root, "tests/_out/no-analyses");
const noLedger = path.join(root, "tests/_out/no-ledger");
fs.mkdirSync(empty, { recursive: true });

build(empty, noAnalyses, noLedger, outEmpty);
const home = fs.readFileSync(path.join(outEmpty, "index.html"), "utf8");
assert.match(home, /No records yet/);
assert.ok(fs.existsSync(path.join(outEmpty, "feed.xml")), "feed.xml with zero records");
assert.ok(fs.existsSync(path.join(outEmpty, "by/list/index.html")), "list hub with zero records");
// The ledger page builds even with no ledger published, showing the not-yet-published state.
const ledgerEmpty = fs.readFileSync(path.join(outEmpty, "analyses/supply-chain-watch-lists/index.html"), "utf8");
assert.match(ledgerEmpty, /has not been published yet/, "ledger page has an empty state");

build(path.join(root, "tests/fixtures/records"), path.join(root, "tests/fixtures/analyses"),
      path.join(root, "tests/fixtures/ledger"), outFix);
const page = fs.readFileSync(path.join(outFix, "records/2026-01-01-fixture-order-aaaaaa/index.html"), "utf8");
assert.match(page, /https:\/\/example\.org\/order\.pdf/, "links to the source URL");
assert.match(page, /barring untrusted labs/, "shows the summary");
assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "raw HTML in a summary is escaped");
assert.doesNotMatch(page, /<script>alert/, "raw HTML in a summary is not markup");
assert.match(page, /&lt;b&gt;bold&lt;\/b&gt; in the title/, "raw HTML in a title is escaped");
assert.ok(fs.existsSync(path.join(outFix, "records/2026-01-01-fixture-order-aaaaaa/source.pdf")), "stored copy is published");
assert.ok(!fs.existsSync(path.join(outFix, "records/2025-06-01-fixture-draft-cccccc")), "a non-approved folder is not rendered");
const feedIdx = fs.readFileSync(path.join(outFix, "index.html"), "utf8");
assert.ok(feedIdx.indexOf("fixture-order-aaaaaa") < feedIdx.indexOf("fixture-notice-bbbbbb"), "feed is newest first");
const feed = fs.readFileSync(path.join(outFix, "feed.xml"), "utf8");
assert.match(feed, /<item>/, "feed has items");
assert.ok(fs.existsSync(path.join(outFix, "by/list/covered-list/index.html")), "list index page");
assert.ok(fs.existsSync(path.join(outFix, "by/agency/fcc/index.html")), "agency index page");

const analysis = fs.readFileSync(path.join(outFix, "analyses/fixture-analysis/index.html"), "utf8");
assert.match(analysis, /Fixture Analysis/, "analysis page renders its title");
assert.match(analysis, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "raw HTML in entry text is escaped");
assert.match(analysis, /href="https:\/\/example\.org\/da-26-0\.pdf#page=3"/, "citation links to the page anchor");
assert.match(analysis, /A fixture footnote/, "footnotes render");
assert.ok(fs.existsSync(path.join(outFix, "analyses/fixture-analysis/mesh.json")), "mesh.json is published beside the page");
assert.match(feedIdx, /class="item[^"]*analysis"[\s\S]*?<span class="type">Analysis<\/span>[\s\S]*?href="\/analyses\/fixture-analysis\/"/, "analysis is badged in the feed");
assert.ok(feedIdx.indexOf("fixture-analysis") < feedIdx.indexOf("fixture-notice-bbbbbb"), "analysis interleaves by date");

// ---- ledger page (U6/U7) ----
const ledgerPath = path.join(outFix, "analyses/supply-chain-watch-lists/index.html");
const ledger = fs.readFileSync(ledgerPath, "utf8");
const led = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/ledger/ledger.json"), "utf8"));
// One <tr class="row"> per canonical entity in ledger.json.
const rowCount = (ledger.match(/<tr class="row/g) || []).length;
assert.equal(rowCount, led.entities.length, "one table row per canonical entity");
// Each list produces a provenance entry with its currency date and a .gov/.mil source link.
assert.match(ledger, /FCC Covered List/, "list label in the provenance strip");
assert.match(ledger, /as of 2026-06-01/, "list currency date is shown");
assert.match(ledger, /href="https:\/\/www\.fcc\.gov\/supplychain\/coveredlist"/, "a .gov source link");
assert.match(ledger, /href="https:\/\/media\.defense\.gov\/2026\/1260h-list\.pdf"/, "a .mil source link");
// Download-archive link points at a ledger/archive/*.html that exists in the output.
const dl = ledger.match(/href="(\/ledger\/archive\/[^"]+\.html)" download/);
assert.ok(dl, "a Download-archive link is rendered");
assert.equal(dl[1], "/ledger/archive/2026-09-12.html", "download link points at the newest archive");
assert.ok(fs.existsSync(path.join(outFix, dl[1].slice(1))), "the downloadable archive exists in the output");
// A whitespace-flattened copy for markers that wrap across template lines.
const flat = ledger.replace(/\s+/g, " ");
// subsidiaries_note renders the standing note.
assert.match(flat, /Includes named subsidiaries and affiliates: HiSilicon\./, "subsidiaries note renders");
// A no-results row exists (controls stay usable; JS toggles it).
assert.match(ledger, /class="noresults"[^>]*>\s*<td[^>]*>No entities match/, "no-results row is present");
// A list flagged-but-not-resnapshotted shows the awaiting-re-snapshot marker.
assert.match(flat, /newer notice detected on 2026-09-01 — awaiting re-snapshot/, "awaiting-re-snapshot marker");
// An entity dropped from all lists renders the formerly-listed marker with a last-archive link.
assert.match(flat, /formerly listed — <a href="\/ledger\/archive\/2026-06-01\.html">last archive<\/a>/, "formerly-listed marker with last-archive link");
// Every absolute source href in the ledger article is https on the .gov/.mil allowlist (the base
// layout's own links — newsletter, repo — are outside the article and not source links).
const article = ledger.slice(ledger.indexOf('<article class="ledger-page">'), ledger.indexOf("</article>"));
for (const m of article.matchAll(/<a href="(https?:\/\/[^"]+)"/g)) {
  const u = new URL(m[1]);
  assert.ok(u.protocol === "https:" && /(^|\.)(gov|mil)$/i.test(u.hostname), `source link is on the .gov/.mil allowlist: ${m[1]}`);
}
// The interaction script is wired up and shipped.
assert.match(ledger, /<script src="\/js\/ledger\.js" defer><\/script>/, "ledger.js is referenced");
assert.ok(fs.existsSync(path.join(outFix, "js/ledger.js")), "ledger.js is published");
// Graceful degradation: without JS every entity row is present (not hidden) and source links resolve.
assert.doesNotMatch(ledger, /<tr class="row[^"]*" hidden/, "rows are visible without JS");

// ---- chrome (editorial redesign, U2) ----
// Every page carries one nav.main listing The file, the lists.js keys in file order, Restricted entities.
const listKeys = Object.keys((await import("../src/_data/lists.js")).default);
const expectedNav = ["The file", ...listKeys.map((k) => `/by/list/${k}/`), "Restricted entities"];
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : d.name === "index.html" ? [path.join(dir, d.name)] : []); }
for (const f of walk(outFix)) {
  const html = fs.readFileSync(f, "utf8");
  const navs = html.match(/<nav class="main"[\s\S]*?<\/nav>/g) || [];
  assert.equal(navs.length, 1, `one primary nav on ${path.relative(outFix, f)}`);
  const links = [...navs[0].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m[2] === "The file" || m[2] === "Restricted entities" ? m[2] : m[1]);
  assert.deepEqual(links, expectedNav, `nav order on ${path.relative(outFix, f)}`);
}
assert.match(feedIdx, /last filed 2026-01-01/, "sub row shows the newest doc_date");
assert.doesNotMatch(home, /last filed/, "sub row omits the timestamp with zero records");

// ---- palette guard (editorial redesign, KTD10) ----
// Every colour literal in the stylesheet must be greyscale: hex with equal channels, rgb()/rgba()
// with equal r/g/b, or transparent. A jade, gold or any other accent slipping back in fails the build.
const css = fs.readFileSync(path.join(root, "src/css/site.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const offenders = [];
for (const m of css.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
  const h = m[1].toLowerCase();
  const rgb = h.length <= 4 ? [h[0], h[1], h[2]] : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  if (![3, 4, 6, 8].includes(h.length) || !(rgb[0] === rgb[1] && rgb[1] === rgb[2])) offenders.push(m[0]);
}
for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
  if (!(m[1] === m[2] && m[2] === m[3])) offenders.push(m[0]);
}
assert.deepEqual(offenders, [], "site.css uses only greyscale colour literals");
assert.doesNotMatch(css, /\.strip[^{]*\{[^}]*position:\s*sticky/, "the strip is not sticky");

console.log("site check: ok");
