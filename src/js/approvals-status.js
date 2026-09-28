// Conditional Approvals view-time status. Runs BEFORE ledger.js (both deferred, document order
// decides) so the first chip filter already sees live status tokens. For every accepted row it
// recomputes the exemption status from data-terminates against today — or ?asof=YYYY-MM-DD when
// present — rewrites the status badge, and swaps the status token inside data-lists so the status
// chips filter live status rather than the build-time value. Placeholder rows have no status and
// are left untouched. No-JS degradation: the server already rendered the build-time badge.
(function () {
  "use strict";
  var table = document.getElementById("ledger");
  if (!table) return;
  var EXPIRING_DAYS = parseInt(table.getAttribute("data-expiring-days"), 10) || 90;
  var STATUSES = ["active", "expiring", "expired"];

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  var asof = param("asof");
  var valid = /^\d{4}-\d{2}-\d{2}$/.test(asof || "");
  var today = valid ? new Date(asof + "T00:00:00") : new Date();
  var asofEl = document.getElementById("asofdate");
  if (asofEl) asofEl.textContent = "as of " + today.toISOString().slice(0, 10);
  if (valid) { var b = document.getElementById("asofBanner"); if (b) b.classList.add("on"); }

  function statusOf(term) {
    if (!term) return "active";
    var t = new Date(term + "T00:00:00");
    if (isNaN(t.getTime())) return "active";
    var days = Math.floor((t - today) / 86400000);
    if (days < 0) return "expired";
    return days <= EXPIRING_DAYS ? "expiring" : "active";
  }
  function label(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr.row"));
  rows.forEach(function (tr) {
    if (tr.classList.contains("placeholder")) return;
    var st = statusOf(tr.getAttribute("data-terminates") || "");
    tr.setAttribute("data-status", st);
    var cell = tr.querySelector(".statuscell");
    if (cell) cell.innerHTML = '<span class="status ' + st + '">' + label(st) + "</span>";
    var lists = (tr.getAttribute("data-lists") || "").split(/\s+/)
      .filter(function (x) { return x && STATUSES.indexOf(x) < 0; });
    lists.push(st);
    tr.setAttribute("data-lists", lists.join(" "));
  });
})();
