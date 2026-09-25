// Text helpers shared by the data files (kept out of src/_data so Eleventy does not read them as data).

// First sentence of a string (the lead standfirst and the ledger's one-line excerpt derive from it).
export function firstSentence(s) {
  const m = String(s).match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : String(s)).trim();
}

// standfirst = first sentence of the excerpt; excerptRest = what follows it (empty when one sentence).
export function splitExcerpt(excerpt) {
  const standfirst = firstSentence(excerpt || "");
  const excerptRest = String(excerpt || "").slice(standfirst.length).trim();
  return { standfirst, excerptRest };
}
