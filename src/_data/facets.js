import records from "./records.js";
export default function () {
  const d = records();
  return [
    { key: "list", title: "By tags", groups: d.byList },
    { key: "agency", title: "By agency", groups: d.byAgency },
  ];
}
