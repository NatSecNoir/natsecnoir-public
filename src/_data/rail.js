// Front-page rail: derived content for the home page's side rail. No new authoring pipeline —
// everything here is computed from the already-loaded records/facets machinery.
//
//   rail.tags  = [{ label, count }]        top ~6 tags by record count (same numbers the
//                                          "By tags" pages show — sourced from facets key "list")
//   rail.quote = { present: true, text, docket, source }   pull-quote from the newest record
//              | { present: false }                        explicit absent state (no usable quote)
import facets from "./facets.js";
import loadRecords from "./records.js";

const TAG_LIMIT = 6;

function firstSentence(s) {
  const m = String(s).match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : String(s)).trim();
}

export default function () {
  // Tags: reuse the exact facet the by-tag pages render ("By tags" == facet key "list").
  // Its groups are already sorted by record count desc; count == group.records.length.
  const listFacet = facets().find((f) => f.key === "list");
  const tags = (listFacet ? listFacet.groups : [])
    .slice(0, TAG_LIMIT)
    .map((g) => ({ label: g.label, count: g.records.length }));

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

  return { tags, quote };
}
