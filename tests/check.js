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

// ---- Team Telecom agreements ledger (U5) ----
const tt = fs.readFileSync(path.join(outFix, "analyses/fixture-ledger/index.html"), "utf8");
const ttFlat = tt.replace(/\s+/g, " ");
// Each main row is bounded by its own </tr>; a lazy match stops before the following detail row.
const ttMainRows = tt.match(/<tr class="row"[\s\S]*?<\/tr>/g) || [];
// Slice one row's <tr class="row"> (main) by the record id in its Links cell.
function ttRow(id) {
  const at = tt.indexOf(`/records/${id}/`);
  assert.ok(at > 0, `row for ${id} is present`);
  const start = tt.lastIndexOf('<tr class="row"', at);
  return tt.slice(start, tt.indexOf("</tr>", at) + 5);
}
// The detail row immediately follows its main row.
function ttDetail(id) {
  const rowEnd = tt.indexOf("</tr>", tt.indexOf(`/records/${id}/`)) + 5;
  const ds = tt.indexOf('<tr class="detail"', rowEnd);
  return tt.slice(ds, tt.indexOf("</tr>", tt.indexOf("</td>", ds)) + 5);
}
// One <tr class="row"> per unfolded member: five rows (lumos, partial, gigsky-2022, ziply, newco).
assert.equal((tt.match(/<tr class="row/g) || []).length, 5, "one ledger row per unfolded member");

// AE1: a member with no overlay entry renders with its date, title, docket, record + PDF links, and
// a pending marker in each of the four analyst columns.
const newco = ttRow("2020-01-01-fix-loa-newco-aaaa01");
assert.match(newco, /2020-01-01/, "AE1 row shows the doc date");
assert.match(newco, /NewCo Letter of Agreement/, "AE1 row shows the record title as company");
assert.match(newco, /ISP-PDR-20200101-00001/, "AE1 row shows the docket");
assert.match(newco, /href="\/records\/2020-01-01-fix-loa-newco-aaaa01\/">record<\/a>/, "AE1 row links its record");
assert.match(newco, /href="\/records\/2020-01-01-fix-loa-newco-aaaa01\/source\.pdf"/, "AE1 row links its stored PDF");
assert.equal((newco.match(/class="pending"/g) || []).length, 4, "AE1 row shows four pending markers");

// AE2: Gigsky is one parent row dated by the 2022 instrument, with a fold note and a history row for
// the 2017 instrument that links to its own record and PDF.
const gig = ttRow("2022-05-05-fix-gigsky-2022-bbbb02");
assert.match(gig, /2022-05-05/, "AE2 Gigsky row is dated by the newer instrument");
assert.match(gig.replace(/\s+/g, " "), /\+ 1 folded: superseded · GigSky \(2017 LOA\)/, "AE2 fold note names the superseded instrument");
assert.ok(tt.indexOf("2017-10-20-fix-gigsky-2017-cccc03") < 0 ? false : true);
const gigDetail = ttDetail("2022-05-05-fix-gigsky-2022-bbbb02").replace(/\s+/g, " ");
assert.match(gigDetail, /Instrument history/, "AE2 detail row has an instrument-history block");
assert.match(gigDetail, /superseded<\/span>GigSky \(2017 LOA\)/, "AE2 history tags the 2017 instrument superseded");
assert.match(gigDetail, /href="\/records\/2017-10-20-fix-gigsky-2017-cccc03\/">record<\/a>/, "AE2 history links the 2017 record");
assert.match(gigDetail, /href="\/records\/2017-10-20-fix-gigsky-2017-cccc03\/source\.pdf"/, "AE2 history links the 2017 PDF");
// The folded 2017 instrument has no row of its own.
assert.ok(!ttMainRows.some((r) => r.includes("/records/2017-10-20-fix-gigsky-2017-cccc03/")), "the superseded 2017 instrument is not a standalone row");

// AE3: an overlay entry with fields and three terms lines renders its fields in the columns and
// three bullets in the detail; the currency stamp is the mesh last_changed, not the run date.
const lumos = ttRow("2024-06-01-fix-lumos-dddd04");
assert.match(lumos, /transfer of control/, "AE3 transaction type in its column");
assert.match(lumos, /DOJ · DHS · DoD/, "AE3 agencies joined in their column");
assert.match(lumos, /United States/, "AE3 country in its column");
assert.match(lumos, /3 bullets/, "AE3 terms cell shows the bullet count");
assert.doesNotMatch(lumos, /class="pending"/, "AE3 fully-extracted row shows no pending marker");
const lumosDetail = ttDetail("2024-06-01-fix-lumos-dddd04");
assert.equal((lumosDetail.match(/<li>/g) || []).length, 3, "AE3 detail row renders three term bullets");
assert.match(tt, /last accepted change 2026-02-15/, "R14 currency stamp is the mesh last_changed");
assert.doesNotMatch(tt, /last accepted change 2026-09-01/, "R14 stamp is not the mesh currency_date");

// R7 partial: an accepted field renders in its column while each absent field is an independent
// pending marker.
const partial = ttRow("2023-01-01-fix-partial-gggg07");
assert.match(partial, /cable landing/, "R7 accepted transaction type renders");
assert.equal((partial.match(/class="pending"/g) || []).length, 3, "R7 leaves agencies, country and terms pending");

// AE4: a record with only team-telecom does not appear, even though an overlay entry names its id.
assert.doesNotMatch(tt, /fix-teamonly-hhhh08/, "AE4 a non-member is absent even with an overlay entry");
assert.doesNotMatch(tt, /Should Not Render/, "AE4 the non-member's overlay label never renders");

// Companion: the Ziply row is dated by its own instrument with a companion history row for BCE.
const ziply = ttRow("2021-03-03-fix-ziply-eeee05");
assert.match(ziply, /2021-03-03/, "companion parent dated by its own instrument");
assert.match(ziply.replace(/\s+/g, " "), /\+ 1 folded: companion · BCE Holding Corporation/, "companion fold note");
const ziplyDetail = ttDetail("2021-03-03-fix-ziply-eeee05").replace(/\s+/g, " ");
assert.match(ziplyDetail, /companion<\/span>BCE Holding Corporation/, "companion history tags BCE companion");
assert.match(ziplyDetail, /href="\/records\/2019-11-21-fix-bce-ffff06\/">record<\/a>/, "companion history links the BCE record");

// Sort: rows are doc_date descending (lumos 2024 first, newco 2020 last).
assert.ok(tt.indexOf("2024-06-01-fix-lumos-dddd04") < tt.indexOf("2022-05-05-fix-gigsky-2022-bbbb02"), "rows are newest first");
assert.ok(tt.indexOf("2022-05-05-fix-gigsky-2022-bbbb02") < tt.indexOf("2020-01-01-fix-loa-newco-aaaa01"), "oldest unfolded row is last");

// Chain integrity: no member id appears in more than one row's chain and no row is dropped.
const foldedIds = ["2017-10-20-fix-gigsky-2017-cccc03", "2019-11-21-fix-bce-ffff06"];
for (const id of foldedIds) assert.ok(!ttMainRows.some((r) => r.includes(`/records/${id}/`)), `folded ${id} is not a top-level row`);

// Index: the ledger card shows its row count (5), not its overlay entry count (7).
const idx = fs.readFileSync(path.join(outFix, "analyses/index.html"), "utf8");
const card = idx.match(/href="\/analyses\/fixture-ledger\/"[\s\S]*?<\/a>/);
assert.ok(card, "the ledger has a card on the analyses index");
assert.match(card[0], /<span class="gn">5<\/span>/, "index card shows the row count, not the 7 overlay entries");

// Backlink (R16): a member record links to the ledger; a non-member record does not.
const newcoPage = fs.readFileSync(path.join(outFix, "records/2020-01-01-fix-loa-newco-aaaa01/index.html"), "utf8");
assert.match(newcoPage, /href="\/analyses\/fixture-ledger\/">Tracked in Team Telecom Agreements/, "a member record backlinks the ledger");
assert.doesNotMatch(page, /\/analyses\/fixture-ledger\//, "a non-member record does not backlink the ledger");

// Feed opt-out (AE5): the ledger is absent from the front-page feed and from RSS.
assert.doesNotMatch(feedIdx, /\/analyses\/fixture-ledger\//, "the ledger is not on the front-page feed");
assert.doesNotMatch(feed, /fixture-ledger/, "the ledger is not in the RSS feed");

// Degradation + safety: every row is present without JS, and every absolute href in the article is
// on the same .gov/.mil allowlist the watch-lists page uses (there should be none — links are relative).
assert.doesNotMatch(tt, /<tr class="row[^"]*" hidden/, "ledger rows are visible without JS");
assert.match(tt, /<script src="\/js\/ledger\.js" defer><\/script>/, "the ledger reuses ledger.js");
const ttArticle = tt.slice(tt.indexOf('<article class="ledger-page">'), tt.indexOf("</article>"));
for (const m of ttArticle.matchAll(/<a href="(https?:\/\/[^"]+)"/g)) {
  const u = new URL(m[1]);
  assert.ok(u.protocol === "https:" && /(^|\.)(gov|mil)$/i.test(u.hostname), `ledger source link on the allowlist: ${m[1]}`);
}


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

// ---- record and analysis pages (editorial redesign, U4) ----
assert.match(page, /<pre class="cite">NatSec Noir, "Fixture Order with &lt;b&gt;bold&lt;\/b&gt; in the title", 2026-01-01, https:\/\/natsecnoir\.com\/records\/2026-01-01-fixture-order-aaaaaa\/<\/pre>/, "citation block carries site, title, doc_date and canonical URL");
assert.match(page, /<dt>Persons of interest<\/dt>\s*<dd>[\s\S]*?Federal Communications Commission/, "persons of interest row lists the fixture entity");
const notice = fs.readFileSync(path.join(outFix, "records/2025-11-15-fixture-notice-bbbbbb/index.html"), "utf8");
assert.doesNotMatch(notice, /<dt>Persons of interest<\/dt>/, "persons row is omitted when a record names nobody");
assert.match(page, /<dt>Document date<\/dt>\s*<dd[^>]*>2026-01-01<\/dd>[\s\S]*?<dt>Entered<\/dt>\s*<dd[^>]*>2026-01-02<\/dd>/, "metadata shows document date and entered date");
const related = page.match(/<section class="related">[\s\S]*?<\/section>/);
assert.ok(related, "related records section renders when a record shares a list");
assert.match(related[0], /fixture-notice-bbbbbb/, "related list names the record sharing covered-list");
assert.doesNotMatch(related[0], /fixture-order-aaaaaa/, "related list never names the record itself");
assert.match(page, /<script src="\/js\/cite\.js" defer><\/script>/, "cite.js is referenced");
assert.ok(fs.existsSync(path.join(outFix, "js/cite.js")), "cite.js is published");

// ---- front page (editorial redesign, U3) ----
// Lead article, then the remaining feed as a real table; the lead is not repeated as a row.
assert.match(feedIdx, /<article class="item lead[^"]*analysis"[\s\S]*?<span class="type">Analysis<\/span>[\s\S]*?1 entries/, "lead meta line shows the analysis entry count");
const ledgerTable = feedIdx.match(/<table class="ledger">[\s\S]*?<\/table>/);
assert.ok(ledgerTable, "front page renders a ledger table");
assert.doesNotMatch(ledgerTable[0], /fixture-analysis/, "the lead is not repeated as a table row");
assert.match(ledgerTable[0], /<tr class="item"[^>]*data-date="2026-01-01"[^>]*data-search="[^"]*"[\s\S]*?<td class="ref[^"]*">FCC 26-1<\/td>/, "a record row carries data attributes and its docket in the Reference cell");
assert.ok(ledgerTable[0].indexOf("fixture-order-aaaaaa") < ledgerTable[0].indexOf("fixture-notice-bbbbbb"), "rows are newest first");
assert.match(feedIdx, /From the record/, "rail pull-quote renders with fixtures");
assert.match(feedIdx, /Persons of interest[\s\S]*?href="\/\?q=Federal%20Communications%20Commission"/, "rail people link prefills the filter");
assert.doesNotMatch(home, /From the record|Persons of interest/, "rail derived sections are omitted with zero records");
assert.match(fs.readFileSync(path.join(root, "src/css/site.css"), "utf8"), /\.ledger \.item\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, "filtered rows stay hidden when the table stacks");

// ---- chrome (editorial redesign, U2) ----
// Every page carries one nav.main: The file, Analyses, the lists.js keys in file order, Restricted entities.
const listKeys = Object.keys((await import("../src/_data/lists.js")).default);
const expectedNav = ["The file", "/analyses/", ...listKeys.map((k) => `/by/list/${k}/`), "Restricted entities"];
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

// ---- masthead spire band (2026-09-26) ----
// Every page opens with one black masthead band carrying the spire svg and the folded
// Newsletter/RSS/About links; the separate strip is gone, the favicon is linked, and the fonts
// request loads Poiret One, not Jost (AE1, AE3, AE4).
for (const [label, html] of [["front", feedIdx], ["record", page], ["empty front", home]]) {
  const masts = html.match(/<header class="mast">[\s\S]*?<\/header>/g) || [];
  assert.equal(masts.length, 1, `one masthead band on the ${label} page`);
  assert.match(masts[0], /<svg class="spire"/, `${label} masthead carries the inline spire`);
  assert.match(masts[0], />Newsletter</, `${label} masthead keeps the Newsletter link`);
  assert.match(masts[0], />RSS</, `${label} masthead keeps the RSS link`);
  assert.match(masts[0], />About</, `${label} masthead keeps the About link`);
  assert.doesNotMatch(html, /class="strip"/, `${label} page shows no separate strip`);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, `${label} head links the favicon`);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Poiret\+One/, `${label} loads Poiret One`);
  assert.doesNotMatch(html, /family=Jost/, `${label} no longer loads Jost`);
}
// The favicon passes through into every build output; its source shapes match the inline mark.
// (CI runs this test before `npm run build`, so assert the check's own out-dirs, never _site/.)
assert.ok(fs.existsSync(path.join(outFix, "favicon.svg")), "favicon.svg is published in the build");
assert.ok(fs.existsSync(path.join(outEmpty, "favicon.svg")), "favicon.svg is published with zero records");
const favicon = fs.readFileSync(path.join(root, "src/favicon.svg"), "utf8");
assert.match(favicon, /<polygon points="47,22 50,4 53,22"\s*\/>/, "favicon spire tip matches the inline mark");
assert.match(favicon, /<rect x="16" y="92" width="68" height="3"\s*\/>/, "favicon spire base matches the inline mark");

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

// ---- interior retone (editorial redesign, U5): no retired v14 token names, no compat aliases, no images ----
const retired = css.match(/var\(--(accent|ink-2|ink-3|rule|rule2|rule-bright|rule-glow|accent-glow|band|card|card-sheen|brand-ink|glow1|glow2|neon|neon-wash|mint|rose|display|body|brand|mast|gold|jade|jade-deep|jade-hi|hair|hair2|hair3|panel|bg|dim|vermilion)\b/g) || [];
assert.deepEqual([...new Set(retired)], [], "site.css references no retired v14 token or compat alias");
assert.doesNotMatch(css, /\.jpe?g/i, "site.css references no photograph");
for (const img of ["blinds-plate.jpg", "letter-lamp.jpg", "banner-left.jpg", "banner-right.jpg"]) assert.ok(!fs.existsSync(path.join(root, "src/img", img)), `${img} is deleted`);

console.log("site check: ok");
