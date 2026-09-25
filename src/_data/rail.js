// Front-page rail: derived content for the home page's side rail. No new authoring pipeline —
// everything here is computed from the already-loaded records/facets machinery.
//
//   rail.tags  = [{ label, count, url }]   top ~6 tags by record count (same numbers the
//                                          "By tags" pages show — sourced from facets key "list");
//                                          url points at the tag's own "By tags" page (/by/list/<slug>/)
//   rail.quote = { present: true, text, docket, source }   pull-quote from the newest record
//              | { present: false }                        explicit absent state (no usable quote)
//   rail.people = [{ label, count, url }]  top ~6 named entities by record count; url prefills the
//                                          front-page keyword filter (/?q=<entity>)
import facets from "./facets.js";
import loadRecords from "./records.js";
import { firstSentence } from "../lib/text.js";

const TAG_LIMIT = 6;
const PEOPLE_LIMIT = 6;

export default function () {
  // Tags: reuse the exact facet the by-tag pages render ("By tags" == facet key "list").
  // Its groups are already sorted by record count desc; count == group.records.length.
  const listFacet = facets().find((f) => f.key === "list");
  const tags = (listFacet ? listFacet.groups : [])
    .slice(0, TAG_LIMIT)
    .map((g) => ({ label: g.label, count: g.records.length, url: `/by/list/${g.slug}/` }));

  // From the record: newest record (records().all is sorted newest-first, same as the feed).
  const records = loadRecords().all;
  const newest = records[0];
  let quote = { present: false };
  if (newest) {
    // Designated field: the record's `excerpt` (first paragraph of its summary, computed in
    // records.js). Fall back to the first sentence of the raw summary if no excerpt exists.
    // If neither yields text, stay absent so the template can omit the section cleanly.
    const text = (newest.excerpt || "").trim() || firstSentence(newest.summary || "").trim();
    if (text) {
      quote = {
        present: true,
        text,
        docket: newest.docket || "",
        source: newest.issuing_body || newest.doc_type || "",
      };
    }
  }

  // Persons of interest: entity counts across all records, ties broken alphabetically.
  const counts = new Map();
  for (const r of records) for (const e of r.entities || []) counts.set(e, (counts.get(e) || 0) + 1);
  const people = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PEOPLE_LIMIT)
    .map(([label, count]) => ({ label, count, url: `/?q=${encodeURIComponent(label)}` }));

  return { tags, quote, people };
}
