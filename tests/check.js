// Build check: the site builds with zero records and with the three fixture records, a record page
// links to its source and shows the summary, and a raw HTML tag in a summary renders as text.
// Analyses: the fixture mesh renders its own page, is badged in the feed, and its text is escaped.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
function build(recordsDir, analysesDir, out) {
  fs.rmSync(out, { recursive: true, force: true });
  execFileSync("npx", ["eleventy", "--quiet"], { cwd: root, stdio: "inherit",
    env: { ...process.env, RECORDS_DIR: recordsDir, ANALYSES_DIR: analysesDir, OUTPUT_DIR: out } });
}
const outEmpty = path.join(root, "tests/_out/empty");
const outFix = path.join(root, "tests/_out/fixtures");
const empty = path.join(root, "tests/_out/no-records");
const noAnalyses = path.join(root, "tests/_out/no-analyses");
fs.mkdirSync(empty, { recursive: true });

build(empty, noAnalyses, outEmpty);
const home = fs.readFileSync(path.join(outEmpty, "index.html"), "utf8");
assert.match(home, /No records yet/);
assert.ok(fs.existsSync(path.join(outEmpty, "feed.xml")), "feed.xml with zero records");
assert.ok(fs.existsSync(path.join(outEmpty, "by/list/index.html")), "list hub with zero records");

build(path.join(root, "tests/fixtures/records"), path.join(root, "tests/fixtures/analyses"), outFix);
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
assert.ok(fs.existsSync(path.join(outFix, "by/type/order/index.html")), "type index page");

const analysis = fs.readFileSync(path.join(outFix, "analyses/fixture-analysis/index.html"), "utf8");
assert.match(analysis, /Fixture Analysis/, "analysis page renders its title");
assert.match(analysis, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "raw HTML in entry text is escaped");
assert.match(analysis, /href="https:\/\/example\.org\/da-26-0\.pdf#page=3"/, "citation links to the page anchor");
assert.match(analysis, /A fixture footnote/, "footnotes render");
assert.ok(fs.existsSync(path.join(outFix, "analyses/fixture-analysis/mesh.json")), "mesh.json is published beside the page");
assert.match(feedIdx, /class="tag analysis">Analysis<\/span> <a href="\/analyses\/fixture-analysis\/"/, "analysis is badged in the feed");
assert.ok(feedIdx.indexOf("fixture-analysis") < feedIdx.indexOf("fixture-notice-bbbbbb"), "analysis interleaves by date");
console.log("site check: ok");
