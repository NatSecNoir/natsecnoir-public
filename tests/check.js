// Build check: the site builds with zero records and with the three fixture records, a record page
// links to its source and shows the summary, and a raw HTML tag in a summary renders as text.
// Analyses: the fixture mesh renders its own page, is badged in the feed, and its text is escaped.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { rowGrainRows } from "../src/lib/ledger-rows.js";
import { firstSentence } from "../src/lib/text.js";
import { statusOf, daOfDocket, EXPIRING_DAYS, NO_MODELS_SENTINEL } from "../src/lib/approvals-status.js";

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
assert.equal(fs.readFileSync(path.join(outEmpty, "_redirects"), "utf8").trim(), "", "no redirects with zero records");
// A real 404 page: without 404.html, Cloudflare Pages serves the homepage (200) for every missing path.
assert.match(fs.readFileSync(path.join(outEmpty, "404.html"), "utf8"), /Not in the file/, "404 page builds with zero records");
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
// Stored copies live on R2 only: none is built into the site (also keeps every file under Pages' 25 MiB cap).
assert.ok(!fs.existsSync(path.join(outFix, "records/2026-01-01-fixture-order-aaaaaa/source.pdf")), "stored copy is not built into the site");
assert.ok(fs.existsSync(path.join(outFix, "records/2026-01-01-fixture-order-aaaaaa/meta.json")), "record meta.json is still published");
for (const dir of fs.readdirSync(path.join(outFix, "records"))) {
  for (const f of fs.readdirSync(path.join(outFix, "records", dir))) assert.ok(!f.startsWith("source."), `no source.* in the build: ${dir}/${f}`);
}
assert.ok(fs.existsSync(path.join(outFix, "ledger/ledger.json")), "ledger.json is published");
assert.ok(!fs.existsSync(path.join(outFix, "ledger/archive")), "ledger archives are not built into the site");
// Stored copies on R2: the record links its copy_url; a record without one falls back to the repo copy.
assert.match(page, /href="https:\/\/docs\.natsecnoir\.com\/records\/2026-01-01-fixture-order-aaaaaa\/source-0123abcd\.pdf">Stored copy</, "stored copy links its R2 URL");
assert.doesNotMatch(page, /href="\/records\/2026-01-01-fixture-order-aaaaaa\/source\.pdf"/, "no repo-copy link when R2 has it");
const noCopy = fs.readFileSync(path.join(outFix, "records/2025-11-15-fixture-notice-bbbbbb/index.html"), "utf8");
assert.doesNotMatch(noCopy, /Stored copy/, "a record without a public copy shows no stored-copy link");
// _redirects (Cloudflare Pages) sends old repo paths to R2: one rule per uploaded copy and per archive, nothing else.
const redirects = fs.readFileSync(path.join(outFix, "_redirects"), "utf8").trim().split("\n");
const copyRules = redirects.filter((l) => l.startsWith("/records/"));
assert.equal(copyRules.length, fs.readdirSync(path.join(root, "tests/fixtures/records")).filter((id) => {
  const m = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/records", id, "meta.json"), "utf8"));
  return m.status === "approved" && m.source_copy_public && m.copy_url;
}).length, "one redirect per uploaded copy");
assert.deepEqual(redirects.filter((l) => !l.startsWith("/records/")).concat(copyRules.filter((l) => l.includes("fixture-order-aaaaaa"))), [
  "/ledger/archive/2026-06-01.html https://docs.natsecnoir.com/ledger/archive/2026-06-01-aaaa0001.html 301",
  "/ledger/archive/2026-09-12.html https://docs.natsecnoir.com/ledger/archive/2026-09-12-bbbb0002.html 301",
  "/records/2026-01-01-fixture-order-aaaaaa/source.pdf https://docs.natsecnoir.com/records/2026-01-01-fixture-order-aaaaaa/source-0123abcd.pdf 301",
], "redirects map old copy and archive paths to R2");
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
assert.match(newco, /href="https:\/\/docs\.natsecnoir\.com\/records\/2020-01-01-fix-loa-newco-aaaa01\/source-aaaa0100\.pdf"/, "AE1 row links its stored PDF");
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
assert.match(gigDetail, /href="https:\/\/docs\.natsecnoir\.com\/records\/2017-10-20-fix-gigsky-2017-cccc03\/source-cccc0300\.pdf"/, "AE2 history links the 2017 PDF");
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
// on the same .gov/.mil allowlist the watch-lists page uses, or is a stored copy on our document host.
assert.doesNotMatch(tt, /<tr class="row[^"]*" hidden/, "ledger rows are visible without JS");
assert.match(tt, /<script src="\/js\/ledger\.js" defer><\/script>/, "the ledger reuses ledger.js");
const ttArticle = tt.slice(tt.indexOf('<article class="ledger-page">'), tt.indexOf("</article>"));
for (const m of ttArticle.matchAll(/<a href="(https?:\/\/[^"]+)"/g)) {
  const u = new URL(m[1]);
  const ownCopy = u.hostname === "docs.natsecnoir.com" && u.pathname.startsWith("/records/");
  assert.ok(u.protocol === "https:" && (ownCopy || /(^|\.)(gov|mil)$/i.test(u.hostname)), `ledger source link on the allowlist: ${m[1]}`);
}



// ---- Conditional Approvals row-grain ledger (U5) ----
// Data-layer coverage: rowGrainRows and the status helper are pure functions. The row-grain page
// template and its HTML render assertions (3 rendered rows, pending cells, exports) land with the
// template in U6; here we prove the assembled row data those assertions will build on.
const approvalsMesh = JSON.parse(fs.readFileSync(
  path.join(root, "tests/fixtures/analyses/fixture-approvals/mesh.json"), "utf8"));
// Two double-tagged member Records, shaped as records.js emits them (only the fields the assembler reads).
const mkRec = (id, doc_date, docket, title, lists) => ({
  id, doc_date, docket, title, url: `/records/${id}/`, copy: `https://docs.natsecnoir.com/records/${id}/source-${id.slice(-6)}00.pdf`,
  lists: lists.map((slug) => ({ slug })),
});
const PN1 = "2025-08-10-fix-approvals-pn1-aa0001";
const PN2 = "2025-09-15-fix-approvals-pn2-aa0002";
const approvalsRecords = [
  mkRec(PN1, "2025-08-10", "DA 26-000; ET Docket No. 21-232", "Fixture Conditional Approval Notice One",
        ["conditional-approval"]),
  mkRec(PN2, "2025-09-15", "DA 26-001; ET Docket No. 21-232", "Fixture Conditional Approval Notice Two",
        ["conditional-approval"]),
];
const asof = new Date("2026-09-27T00:00:00Z");
const dayOut = (n) => { const d = new Date(asof); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// statusOf: the single rule used at build and (in U6) in the browser (R6).
assert.equal(statusOf(null, asof), "active", "no termination date is active");
assert.equal(statusOf(dayOut(-1), asof), "expired", "yesterday is expired");
assert.equal(statusOf(dayOut(30), asof), "expiring", "30 days out is expiring");
assert.equal(statusOf(dayOut(120), asof), "active", "120 days out is active");
assert.equal(statusOf(dayOut(90), asof), "expiring", "exactly 90 days out is expiring");
assert.equal(EXPIRING_DAYS, 90, "the shared threshold is 90 days");
assert.equal(daOfDocket("DA 26-957; ET Docket 21-232"), "DA 26-957", "the DA token is read from the docket");
assert.equal(daOfDocket("ISP-PDR-20200101-00001"), "", "a docket with no DA token yields empty");
assert.equal(NO_MODELS_SENTINEL, "(no models stated)", "the shared no-models sentinel");

const approvalsRows = rowGrainRows(approvalsMesh, approvalsRecords, asof);
// Two accepted rows for PN1 plus one placeholder for PN2 (R1, R2).
assert.equal(approvalsRows.length, 3, "two accepted rows and one placeholder");
const byRowId = Object.fromEntries(approvalsRows.map((r) => [r.id, r]));
// R4: the synthetic row id is stable across builds.
assert.deepEqual(rowGrainRows(approvalsMesh, approvalsRecords, asof).map((r) => r.id),
  approvalsRows.map((r) => r.id), "row ids are stable across two builds");
const routers = byRowId["da-26-000-fixture-co-routers"];
assert.ok(routers, "the router grant keeps its synthetic row id (R4)");
assert.equal(routers.record_id, PN1, "the row back-points at its member Record");
assert.equal(routers.doc_date, "2025-08-10", "PN date is joined from the Record, never stored on the row");
assert.equal(routers.da, "DA 26-000", "DA token is joined from the docket");
assert.equal(routers.record_url, `/records/${PN1}/`, "row links its Record");
assert.equal(routers.pdf_url, `https://docs.natsecnoir.com/records/${PN1}/source-${PN1.slice(-6)}00.pdf`, "row links its stored PDF on R2");
assert.deepEqual(routers.models, ["Model X, Rev 2", "Series 9000"], "models come from the entry text");
assert.equal(routers.category, "routers");
assert.equal(routers.issuer, "DoW");
assert.equal(routers.status_at_build, "active", "a far-future termination is active at build");
assert.equal(routers.placeholder, false);
assert.deepEqual(routers.lists, ["routers", "active"], "chip tokens are category + build status");
assert.match(routers.search, /fixture co/, "search carries the entity");
assert.match(routers.search, /da 26-000/, "search carries the DA");
assert.equal(routers.pending.category, false, "an extracted category is not pending");
// The amendment folds onto the row and marks the amending Record covered (no placeholder for it).
assert.equal(routers.amendments.length, 1, "the amendment rides the row");
assert.equal(routers.amendments[0].record_id, "2026-03-10-fix-approvals-amend-aa0003", "amendment names its Record");
assert.equal(routers.amendments[0].page, 3, "amendment carries its page citation");

// R8: the no-models sentinel becomes an empty models list flagged pending, never literal text.
const uas = byRowId["da-26-000-widgetworks-uas"];
assert.deepEqual(uas.models, [], "the sentinel yields an empty models list");
assert.equal(uas.pending.models, true, "an empty models list is a pending marker");
assert.doesNotMatch(uas.search, /no models stated/, "the sentinel never leaks into search");
assert.equal(uas.status_at_build, "active", "a null termination is active");

// Placeholder row for the member PN with no entry (R1): every column pending, its Record linked.
const placeholder = approvalsRows.find((r) => r.placeholder);
assert.equal(placeholder.record_id, PN2, "the placeholder is the un-extracted member");
assert.equal(placeholder.record_url, `/records/${PN2}/`, "the placeholder links its Record");
for (const k of ["models", "category", "issuer", "termination_date"]) {
  assert.equal(placeholder.pending[k], true, `placeholder ${k} is pending`);
}

// R3: a member that loses the conditional-approval tag drops all of its rows.
const untagged = approvalsRecords.map((r) => r.id === PN1 ? { ...r, lists: [{ slug: "covered-list" }] } : r);
const afterDrop = rowGrainRows(approvalsMesh, untagged, asof);
assert.ok(!afterDrop.some((r) => r.record_id === PN1), "dropping the tag removes both of PN1's rows");
assert.equal(afterDrop.length, 1, "only PN2's placeholder remains");

// Rows are newest-first by PN date, then by id (the PN2 placeholder is newer than PN1's grants).
assert.equal(approvalsRows[0].id, PN2, "the newest PN (the placeholder) sorts first");

// ---- Conditional Approvals public page + exports (U6) ----
const appv = fs.readFileSync(path.join(outFix, "analyses/fixture-approvals/index.html"), "utf8");
// R11: the authority callout carries the fcc.gov link and the "derivative / FCC governs" wording.
assert.match(appv, /href="https:\/\/www\.fcc\.gov\/supplychain\/coveredlist"/, "authority callout links the fcc.gov Covered List");
assert.match(appv, /reviewed, reader-friendly derivative/, "authority callout carries the derivative wording");
assert.match(appv, /the FCC tab governs/, "authority callout states the FCC tab governs (R11)");
// The approvals fixture is rendered once (one article <h1>), not double-rendered by the record-grain template.
assert.equal((appv.match(/<h1>Conditional Approvals \(fixture\)<\/h1>/g) || []).length, 1, "the approvals fixture renders exactly one title h1");
// R6: an accepted row carries data-terminates equal to its fixture date and a build-time status cell.
const routersTr = appv.match(/<tr class="row"[^>]*data-terminates="2027-06-30"[\s\S]*?<\/tr>/);
assert.ok(routersTr, "the routers row carries data-terminates from the fixture");
const expectStatus = statusOf("2027-06-30", new Date());
assert.ok(routersTr[0].includes(`status ${expectStatus}`), `the routers status cell class matches the build-time rule (${expectStatus})`);
assert.ok(routersTr[0].includes('data-lists="routers active"'), "the accepted row seeds data-lists with category + build status");
// Grouped chips (R7): category chips carry data-group="category", status chips data-group="status".
assert.match(appv, /class="chip" data-group="category" data-list="routers"/, "a category chip carries data-group=category");
assert.match(appv, /class="chip" data-group="category" data-list="uas"/, "the uas category chip is derived from the rows");
assert.match(appv, /class="chip" data-group="status" data-list="expired"/, "a status chip carries data-group=status");
// The Team Telecom fixture ledger is unaffected — its (record-grain) page carries no grouped chips.
assert.ok(!tt.includes("data-group"), "the Team Telecom ledger page carries no grouped chips");
// R6/AE2/AE3: the status script loads before the chip/filter script so the first filter sees live status.
assert.ok(appv.indexOf('src="/js/approvals-status.js"') < appv.indexOf('src="/js/ledger.js"'),
  "approvals-status.js is loaded before ledger.js");
assert.ok(fs.existsSync(path.join(outFix, "js/approvals-status.js")), "approvals-status.js is published");
// R1: the placeholder row shows pending markers and no status badge other than "pending".
const placeholderTr = appv.match(/<tr class="row placeholder"[\s\S]*?<\/tr>/);
assert.ok(placeholderTr, "the un-extracted member renders as a placeholder row");
assert.match(placeholderTr[0], /class="status pending">pending extraction/, "the placeholder shows the pending-extraction marker");
assert.ok(!/status (active|expiring|expired)/.test(placeholderTr[0]), "the placeholder carries no active/expiring/expired badge");
// R12: both exports are linked from the page.
assert.match(appv, /href="\/analyses\/fixture-approvals\/fixture-approvals\.csv"/, "the page links the CSV export");
assert.match(appv, /href="\/analyses\/fixture-approvals\/fixture-approvals\.json"/, "the page links the JSON export");

// CSV export (R12): exact header, accepted rows only, models joined with "; ", comma cells quoted.
const csv = fs.readFileSync(path.join(outFix, "analyses/fixture-approvals/fixture-approvals.csv"), "utf8").trim();
const csvLines = csv.split("\n");
assert.equal(csvLines[0], "id,record_id,entity,category,issuer,models,pn_date,termination_date,status,da,record_url,pdf_url,source_url", "CSV header is the exact contract");
assert.equal(csvLines.length, 3, "CSV has the header plus 2 data lines (the placeholder is excluded)");
assert.ok(csv.includes('"Model X, Rev 2; Series 9000"'), "a multi-model cell is joined with '; ' and quoted for its comma");
assert.match(csv, /,https:\/\/www\.fcc\.gov\/fix-approvals-pn1\.pdf$/m, "source_url is the record's original fcc.gov URL");

// JSON export (R4/R12): top-level stamp + accepted rows only.
const jexp = JSON.parse(fs.readFileSync(path.join(outFix, "analyses/fixture-approvals/fixture-approvals.json"), "utf8"));
assert.equal(jexp.rows.length, 2, "JSON carries the 2 accepted rows");
assert.equal(jexp.pending_records, 1, "JSON reports 1 pending (placeholder) record");
assert.ok(jexp.built_at && jexp.expiring_days === EXPIRING_DAYS, "JSON top level has built_at and expiring_days");
for (const r of jexp.rows) assert.ok("id" in r && "status" in r && "termination_date" in r, "each JSON row has id, status, termination_date");


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
// Download-archive link points at the newest archive's R2 URL (the mirror's newest_archive_url).
const dl = ledger.match(/href="([^"]+)" download>Download archive \(([^)]+)\)/);
assert.ok(dl, "a Download-archive link is rendered");
assert.equal(dl[1], "https://docs.natsecnoir.com/ledger/archive/2026-09-12-bbbb0002.html", "download link points at the newest archive on R2");
assert.equal(dl[2], "2026-09-12.html", "download label names the newest snapshot");
// A whitespace-flattened copy for markers that wrap across template lines.
const flat = ledger.replace(/\s+/g, " ");
// subsidiaries_note renders the standing note.
assert.match(flat, /Includes named subsidiaries and affiliates: HiSilicon\./, "subsidiaries note renders");
// A no-results row exists (controls stay usable; JS toggles it).
assert.match(ledger, /class="noresults"[^>]*>\s*<td[^>]*>No entities match/, "no-results row is present");
// A list flagged-but-not-resnapshotted shows the awaiting-re-snapshot marker.
assert.match(flat, /newer notice detected on 2026-09-01 — awaiting re-snapshot/, "awaiting-re-snapshot marker");
// An entity dropped from all lists renders the formerly-listed marker with a last-archive link.
assert.match(flat, /formerly listed — <a href="https:\/\/docs\.natsecnoir\.com\/ledger\/archive\/2026-06-01-aaaa0001\.html">last archive<\/a>/, "formerly-listed marker with last-archive link on R2");
// Every absolute source href in the ledger article is https on the .gov/.mil allowlist (the base
// layout's own links — newsletter, repo — are outside the article and not source links).
const article = ledger.slice(ledger.indexOf('<article class="ledger-page">'), ledger.indexOf("</article>"));
for (const m of article.matchAll(/<a href="(https?:\/\/[^"]+)"/g)) {
  const u = new URL(m[1]);
  // Archive links go to NatSec Noir's own snapshots on its document host, not to a source.
  const ownArchive = u.hostname === "docs.natsecnoir.com" && u.pathname.startsWith("/ledger/archive/");
  assert.ok(u.protocol === "https:" && (ownArchive || /(^|\.)(gov|mil)$/i.test(u.hostname)), `source link is on the .gov/.mil allowlist: ${m[1]}`);
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
// Front-page rail: three curated Browse chips, By source, last filed.
const railChips = [...feedIdx.matchAll(/<a class="chip" href="\/by\/list\/([^/]+)\/">/g)].map((m) => m[1]);
assert.deepEqual(railChips, ["covered-list", "bad-labs", "litigation"], "rail Browse renders the three curated list chips in order");
assert.match(feedIdx, /<a class="more" href="\/by\/agency\/">By source/, "rail links to the source index");
assert.doesNotMatch(feedIdx, /From the record|Persons of interest/, "derived pull-quote and people sections are gone");
assert.match(fs.readFileSync(path.join(root, "src/css/site.css"), "utf8"), /\.ledger \.item\[hidden\]\s*\{[^}]*display:\s*none\s*!important/, "filtered rows stay hidden when the table stacks");

// ---- chrome (visual redesign v2, U3) ----
// Every page carries exactly one nav.main with four tabs and one theme toggle; no secondary sub-row.
const expectedNav = ["/", "/analyses/", "/by/list/covered-list/", "/by/list/bad-labs/"];
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : d.name === "index.html" ? [path.join(dir, d.name)] : []); }
for (const f of walk(outFix)) {
  const html = fs.readFileSync(f, "utf8");
  const navs = html.match(/<nav class="main"[\s\S]*?<\/nav>/g) || [];
  assert.equal(navs.length, 1, `one primary nav on ${path.relative(outFix, f)}`);
  const links = [...navs[0].matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  assert.deepEqual(links, expectedNav, `nav order on ${path.relative(outFix, f)}`);
  assert.equal((html.match(/id="theme"/g) || []).length, 1, `exactly one theme toggle on ${path.relative(outFix, f)}`);
  // Every page ships the deferred theme script and the pre-paint anti-flash inline script, and the
  // anti-flash script runs before the stylesheet link so the stored theme applies before first paint.
  assert.match(html, /<script src="\/js\/theme\.js" defer><\/script>/, `theme.js on ${path.relative(outFix, f)}`);
  assert.match(html, /localStorage\.getItem\('theme'\)/, `anti-flash script on ${path.relative(outFix, f)}`);
  assert.ok(html.indexOf("localStorage.getItem('theme')") < html.indexOf('/css/site.css'), `anti-flash precedes the stylesheet on ${path.relative(outFix, f)}`);
  assert.doesNotMatch(html, /<div class="sub"/, `no secondary nav sub-row on ${path.relative(outFix, f)}`);
}
assert.ok(fs.existsSync(path.join(outFix, "js/theme.js")), "theme.js is published");
assert.match(feedIdx, /last filed 2026-01-01/, "rail shows the newest doc_date");
assert.doesNotMatch(home, /last filed/, "rail omits the last-filed line with zero records");

// ---- masthead spire band (2026-09-26) ----
// Every page opens with one black masthead band carrying the spire svg and the folded
// Newsletter/RSS/About links; the separate strip is gone, the favicon is linked, and the fonts
// request loads Marcellus SC, not Poiret One / Jost / EB Garamond (visual-redesign-v2 U2).
for (const [label, html] of [["front", feedIdx], ["record", page], ["empty front", home]]) {
  const masts = html.match(/<header class="mast">[\s\S]*?<\/header>/g) || [];
  assert.equal(masts.length, 1, `one masthead band on the ${label} page`);
  assert.match(masts[0], /<svg class="spire"/, `${label} masthead carries the inline spire`);
  assert.match(masts[0], />Newsletter</, `${label} masthead keeps the Newsletter link`);
  assert.match(masts[0], />RSS</, `${label} masthead keeps the RSS link`);
  assert.match(masts[0], />About</, `${label} masthead keeps the About link`);
  assert.doesNotMatch(html, /class="strip"/, `${label} page shows no separate strip`);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, `${label} head links the favicon`);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Marcellus\+SC/, `${label} loads Marcellus SC`);
  assert.doesNotMatch(html, /family=Poiret\+One/, `${label} no longer loads Poiret One`);
  assert.doesNotMatch(html, /family=Jost/, `${label} no longer loads Jost`);
  assert.doesNotMatch(html, /family=EB\+Garamond/, `${label} no longer loads EB Garamond`);
  assert.match(masts[0], /Tech and geopolitics out of the shadows/, `${label} masthead carries the v2 tagline`);
  assert.doesNotMatch(html, /bureaucratic shadows/, `${label} drops the old bureaucratic-shadows motto`);
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
// The v2 palette (KTD6): the intentional navy/ground/ink tokens are whitelisted; every other colour
// literal must still be greyscale (equal-channel hex, equal-channel rgb()/rgba(), or transparent).
const allowed = new Set(["ffffff","f7f7f7","0c0f14","5b6270","8e96a3","e2e2e2","24406b","090b0f","f1f4f7","0d1015","13161c","e8ecf1","9aa3b0","68717f","6f9bd8","04060a",
  // U6 exemption-status badges — the deliberate semantic-colour exception (light + dark ok/warn/bad).
  "1b7a47","8a5a00","a23a32","5bc49a","e0b04a","ec7a6e"]);
// The status badges also carry tinted backgrounds; these exact rgb triples are the only
// non-greyscale rgba() allowed (used only for --ok-bg/--warn-bg/--bad-bg).
const allowedRgb = new Set(["27,122,71","138,90,0","162,58,50","91,196,154","224,176,74","236,122,110"]);
const offenders = [];
for (const m of css.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
  const h = m[1].toLowerCase();
  if (allowed.has(h)) continue;
  const rgb = h.length <= 4 ? [h[0], h[1], h[2]] : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  if (![3, 4, 6, 8].includes(h.length) || !(rgb[0] === rgb[1] && rgb[1] === rgb[2])) offenders.push(m[0]);
}
for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
  if (allowedRgb.has(`${m[1]},${m[2]},${m[3]}`)) continue;
  if (!(m[1] === m[2] && m[2] === m[3])) offenders.push(m[0]);
}
assert.deepEqual(offenders, [], "site.css uses only greyscale colour literals");
assert.doesNotMatch(css, /\.strip[^{]*\{[^}]*position:\s*sticky/, "the strip is not sticky");

// ---- litigation full text: text.json gets its own page, linked from the record rail ----
const withText = fs.readFileSync(path.join(outFix, "records/2025-11-15-fixture-notice-bbbbbb/index.html"), "utf8");
assert.match(withText, /href="\/records\/2025-11-15-fixture-notice-bbbbbb\/text\/">Read the full text · 2 pp\./, "record rail links its full text");
const textPage = fs.readFileSync(path.join(outFix, "records/2025-11-15-fixture-notice-bbbbbb/text/index.html"), "utf8");
assert.match(textPage, /id="p2"/, "text page anchors each source page");
assert.match(textPage, /with 1 page corrected by hand/, "text page discloses hand corrections");
assert.match(textPage, /&lt;script&gt;alert\(2\)/, "text page escapes the transcription");
assert.doesNotMatch(page, /Read the full text/, "records without text.json get no full-text link");
assert.ok(!fs.existsSync(path.join(outFix, "records/2026-01-01-fixture-order-aaaaaa/text/index.html")), "no text page without text.json");

// ---- oral arguments: recording linked out, transcript published with an unofficial notice ----
const argPage = fs.readFileSync(path.join(outFix, "records/2024-02-01-fixture-argument-eeeeee/index.html"), "utf8");
const unofficial = /Unofficial transcript prepared by NatSec Noir from the court(?:'|&#39;)s public recording\. The recording is authoritative\./;
assert.match(argPage, /href="https:\/\/media\.cadc\.uscourts\.gov\/recordings\/docs\/2024\/02\/23-1001\.mp3">Listen to the argument · media\.cadc\.uscourts\.gov ↗/, "argument links the court recording with its host");
assert.match(argPage, /href="\/records\/2024-02-01-fixture-argument-eeeeee\/text\/">Read the transcript · 2 pp\./, "argument links its transcript text");
assert.match(argPage, /href="https:\/\/docs\.natsecnoir\.com\/records\/2024-02-01-fixture-argument-eeeeee\/source-0e0e0e0e\.pdf">Transcript \(PDF\)</, "argument links its transcript PDF");
assert.match(argPage, unofficial, "argument page carries the unofficial-transcript notice");
assert.doesNotMatch(argPage, /Open the source|Stored copy|Read the full text/, "argument page uses argument labels only");
assert.match(argPage, /<span class="k cat">oral argument/, "argument type shows as oral argument");
const argText = fs.readFileSync(path.join(outFix, "records/2024-02-01-fixture-argument-eeeeee/text/index.html"), "utf8");
assert.match(argText, /<strong class="speaker">JUDGE PILLARD<\/strong>: Counsel/, "transcript renders the speaker in bold");
assert.match(argText, /<p class="turn">UNITED STATES COURT OF APPEALS<\/p>/, "a caption paragraph renders with no speaker element");
assert.match(argText, unofficial, "transcript page carries the unofficial-transcript notice");
assert.doesNotMatch(argText, /cite the source document/, "transcript page drops the source-citation note");
assert.match(argText, /&lt;script&gt;alert\(3\)/, "transcript text is escaped");
for (const [own, other] of [["2024-02-01-fixture-argument-eeeeee", "2024-03-01-fixture-opinion-dddddd"],
                            ["2024-03-01-fixture-opinion-dddddd", "2024-02-01-fixture-argument-eeeeee"]]) {
  const rail = fs.readFileSync(path.join(outFix, `records/${own}/index.html`), "utf8").match(/<section class="related">[\s\S]*?<\/section>/);
  assert.ok(rail && rail[0].indexOf(other) !== -1, `${own} relates to ${other}`);
  assert.ok(rail[0].indexOf(`href="/records/${other}/"`) === rail[0].indexOf('href="/records/'), `${other} is first in ${own}'s rail (shared docket)`);
}
const opinionPage = fs.readFileSync(path.join(outFix, "records/2024-03-01-fixture-opinion-dddddd/index.html"), "utf8");
assert.match(opinionPage, /Open the source/, "a non-argument record keeps its source labels");
assert.doesNotMatch(opinionPage, unofficial, "a non-argument record has no unofficial notice");

// ---- interior retone (editorial redesign, U5): no retired v14 token names, no compat aliases, no images ----
const retired = css.match(/var\(--(accent|ink-2|ink-3|rule|rule2|rule-bright|rule-glow|accent-glow|band|card|card-sheen|brand-ink|glow1|glow2|neon|neon-wash|mint|rose|display|body|brand|mast|gold|jade|jade-deep|jade-hi|hair|hair2|hair3|panel|bg|dim|vermilion)\b/g) || [];
assert.deepEqual([...new Set(retired)], [], "site.css references no retired v14 token or compat alias");
assert.doesNotMatch(css, /\.jpe?g/i, "site.css references no photograph");
for (const img of ["blinds-plate.jpg", "letter-lamp.jpg", "banner-left.jpg", "banner-right.jpg"]) assert.ok(!fs.existsSync(path.join(root, "src/img", img)), `${img} is deleted`);

// ---- standfirst: an abbreviation's period does not end the first sentence ----
assert.equal(firstSentence("The D.C. Circuit upheld the order. It also held more."), "The D.C. Circuit upheld the order.");
assert.equal(firstSentence("Pacific Networks Corp. and ComNet lost. Next."), "Pacific Networks Corp. and ComNet lost.");
assert.equal(firstSentence("Commitments to the U.S. Department of Justice. Next."), "Commitments to the U.S. Department of Justice.");
assert.equal(firstSentence("Risks to U.S. national security. Next."), "Risks to U.S. national security.");
assert.equal(firstSentence("The FCC acted. Then it stopped."), "The FCC acted.");
assert.equal(firstSentence("Is it final? Yes."), "Is it final?");
assert.equal(firstSentence("No period here"), "No period here");

console.log("site check: ok");
