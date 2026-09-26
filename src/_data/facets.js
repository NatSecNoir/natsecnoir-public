import records from "./records.js";
export default function () {
  const d = records();
  return [
    { key: "list", title: "By list", groups: d.byList },
    { key: "agency", title: "By source", groups: d.byAgency },
  ];
}
