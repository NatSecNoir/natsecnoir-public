// Front-page feed: records and analyses interleaved by date, each tagged with `kind` so item.njk
// can render a distinct badge for analyses (R12).
import loadRecords from "./records.js";
import loadAnalyses from "./analyses.js";

export default function () {
  const records = loadRecords();
  const analyses = loadAnalyses();
  const items = [
    ...records.all.map((r) => ({ ...r, kind: "record" })),
    ...analyses.all.map((a) => ({ ...a, kind: "analysis" })),
  ];
  items.sort((a, b) => (b.doc_date || "").localeCompare(a.doc_date || "") || b.id.localeCompare(a.id));
  return { all: items };
}
