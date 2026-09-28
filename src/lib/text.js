// Text helpers shared by the data files (kept out of src/_data so Eleventy does not read them as data).

// A period after one of these never ends a sentence mid-text: dotted initials (D.C., U.S., U.S.C.),
// a lone initial, and the corporate/legal abbreviations the summaries use ("The D.C. Circuit",
// "Pacific Networks Corp. and ComNet", "commitments to the U.S. Department of Justice").
const ABBREV = /(?:^|[\s(“"])(?:(?:[A-Za-z]\.)+[A-Za-z]|[A-Z]|Inc|Co|Corp|Ltd|No|Nos|v|vs|Mr|Mrs|Ms|Dr|Jr|Sr|St|Fed|Cir|Stat|Dept|Gen|Sec|Art|Reg|Pub|al|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/;

// First sentence of a string (the lead standfirst and the ledger's one-line excerpt derive from it).
export function firstSentence(s) {
  s = String(s);
  for (const m of s.matchAll(/[.!?](?=\s|$)/g)) {
    const end = m.index + 1;
    const next = s.slice(end).trimStart();
    if (!next) break;
    if (/^[a-z]/.test(next)) continue;                       // "U.S. national security"
    if (m[0] === "." && ABBREV.test(s.slice(0, m.index))) continue;
    return s.slice(0, end).trim();
  }
  return s.trim();
}

// standfirst = first sentence of the excerpt; excerptRest = what follows it (empty when one sentence).
export function splitExcerpt(excerpt) {
  const standfirst = firstSentence(excerpt || "");
  const excerptRest = String(excerpt || "").slice(standfirst.length).trim();
  return { standfirst, excerptRest };
}
