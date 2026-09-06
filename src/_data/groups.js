import facets from "./facets.js";
export default function () {
  return facets().flatMap((f) => f.groups.map((g) => ({ ...g, key: f.key, facetTitle: f.title })));
}
