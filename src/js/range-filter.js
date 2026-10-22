// Frequency-range matching for the Schedule B page's "Filed frequency" box (analysis-schedb.njk).
// A row carries `data-ranges="lo:hi lo:hi"` in MHz: every range its latest filing lists, in band or
// not. ledger.js calls `match` from apply(); tests/check.js loads this file in a VM to test it.
(function (root) {
  "use strict";
  function parse(attr) {
    return (attr || "").split(/\s+/).filter(Boolean).map(function (pair) {
      var p = pair.split(":");
      return [parseFloat(p[0]), parseFloat(p[1])];
    }).filter(function (r) { return !isNaN(r[0]) && !isNaN(r[1]); });
  }
  // True when any range overlaps [lo, hi] MHz. A blank bound is open; reversed bounds are swapped;
  // a single frequency (lo == hi) matches a range that contains it.
  function match(ranges, lo, hi) {
    var hasLo = typeof lo === "number" && !isNaN(lo);
    var hasHi = typeof hi === "number" && !isNaN(hi);
    if (!hasLo && !hasHi) return true;
    var a = hasLo ? lo : -Infinity, b = hasHi ? hi : Infinity;
    if (a > b) { var t = a; a = b; b = t; }
    return ranges.some(function (r) { return r[0] <= b && r[1] >= a; });
  }
  root.nsnRange = { parse: parse, match: match };
})(typeof window !== "undefined" ? window : globalThis);
