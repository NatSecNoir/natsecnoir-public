// Ledger table interactions: keyword filter, list-chip filter (OR within lists, AND with keyword),
// column sort, resizable columns (persisted per-browser), and per-row expand. All client-side and
// no-JS-degradation-safe — rows and source links are visible without this script (the U4 offline
// archive inlines this same source).
(function () {
  "use strict";
  var table = document.getElementById("ledger");
  if (!table) return;
  var tbody = table.querySelector("tbody");
  var q = document.getElementById("q");
  var count = document.getElementById("count");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var noun = table.getAttribute("data-noun") || "entities";
  var noresults = tbody.querySelector(".noresults");

  function rowPairs() {
    var out = [], rows = tbody.querySelectorAll("tr.row");
    for (var i = 0; i < rows.length; i++) {
      out.push({ main: rows[i], detail: rows[i].nextElementSibling });
    }
    return out;
  }
  var pairs = rowPairs();

  function activeByGroup() {
    var g = {};
    chips.forEach(function (c) {
      if (c.getAttribute("aria-pressed") !== "true") return;
      var grp = c.getAttribute("data-group") || "";
      (g[grp] = g[grp] || []).push(c.getAttribute("data-list"));
    });
    return g;
  }
  // Optional frequency box (Schedule B page): lower/upper bounds in the chosen unit, matched against
  // each row's data-ranges by range-filter.js. Absent on every other ledger page.
  var flo = document.getElementById("flo"), fhi = document.getElementById("fhi"), funit = document.getElementById("funit");
  function freqBounds() {
    if (!flo || !fhi || !window.nsnRange) return null;
    var k = funit && funit.value === "ghz" ? 1000 : 1;
    var lo = parseFloat(flo.value), hi = parseFloat(fhi.value);
    if (isNaN(lo) && isNaN(hi)) return null;
    return [lo * k, hi * k];
  }
  function apply() {
    var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    var groups = activeByGroup();
    var fb = freqBounds();
    var shown = 0;
    pairs.forEach(function (p) {
      var hay = p.main.getAttribute("data-search") || "";
      var rowLists = (p.main.getAttribute("data-lists") || "").split(/\s+/);
      var textOk = words.every(function (w) { return hay.indexOf(w) >= 0; });
      var listOk = Object.keys(groups).every(function (grp) {
        return groups[grp].some(function (s) { return rowLists.indexOf(s) >= 0; });
      });
      var freqOk = !fb || window.nsnRange.match(window.nsnRange.parse(p.main.getAttribute("data-ranges")), fb[0], fb[1]);
      var show = textOk && listOk && freqOk;
      p.main.hidden = !show;
      if (p.detail && !show) { p.detail.hidden = true; }
      if (show) shown++;
    });
    if (noresults) noresults.hidden = shown !== 0;
    if (count) count.textContent = shown + " of " + pairs.length + " " + noun;
  }

  if (q) {
    q.addEventListener("input", apply);
  }
  [flo, fhi, funit].forEach(function (el) {
    if (el) { el.addEventListener("input", apply); el.addEventListener("change", apply); }
  });
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true");
      apply();
    });
  });

  tbody.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".expand");
    if (!btn) return;
    var main = btn.closest("tr");
    var detail = main.nextElementSibling;
    if (!detail) return;
    var open = detail.hidden;
    detail.hidden = !open;
    // A detail row with data-src (Schedule B) holds only a link until first opened; its body is the
    // .sb-detail block of the site's own page, fetched once. On failure the link stays usable.
    var src = detail.getAttribute("data-src");
    if (open && src && !detail.getAttribute("data-loaded") && window.fetch && window.DOMParser) {
      detail.setAttribute("data-loaded", "loading");
      fetch(src).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); }).then(function (html) {
        var body = new DOMParser().parseFromString(html, "text/html").querySelector(".sb-detail");
        if (!body) throw new Error("no detail");
        var cell = detail.cells[0];
        var link = cell.querySelector("a");
        cell.textContent = "";
        cell.appendChild(document.importNode(body, true));
        if (link) { var p = document.createElement("p"); p.className = "sb-permalink"; link.textContent = "Site page"; p.appendChild(link); cell.appendChild(p); }
        detail.setAttribute("data-loaded", "yes");
      }).catch(function () { detail.removeAttribute("data-loaded"); });
    }
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.textContent = open ? "\u2212" : "+"; // minus sign when expanded
    btn.setAttribute("aria-label", open ? "Hide details" : "Show details");
  });

  // Header-row cells only: a detail row may hold its own nested table (the Schedule B band tables).
  var headers = Array.prototype.slice.call(table.tHead.rows[0].cells);
  function cellValue(pair, idx, key) {
    // A cell may carry a numeric sort key (Schedule B coordinates, frequencies, EIRP); blanks sort last.
    var cell = pair.main.cells[idx];
    if (cell && cell.hasAttribute("data-num")) {
      var n = parseFloat(cell.getAttribute("data-num"));
      return isNaN(n) ? Infinity : n;
    }
    if (key === "status") return pair.main.getAttribute("data-status") || "zzz";
    if (key === "added") {
      var t = pair.main.cells[idx].textContent.trim();
      return t || "0000-00-00";
    }
    return pair.main.cells[idx].textContent.trim().toLowerCase();
  }
  headers.forEach(function (th, idx) {
    th.setAttribute("tabindex", "0");
    th.setAttribute("role", "button");
    var key = th.getAttribute("data-key");
    function sort() {
      var dir = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      headers.forEach(function (h) { h.removeAttribute("aria-sort"); });
      th.setAttribute("aria-sort", dir);
      var sign = dir === "ascending" ? 1 : -1;
      var sorted = pairs.slice().sort(function (a, b) {
        var av = cellValue(a, idx, key), bv = cellValue(b, idx, key);
        return av < bv ? -sign : av > bv ? sign : 0;
      });
      sorted.forEach(function (p) {
        tbody.appendChild(p.main);
        if (p.detail) tbody.appendChild(p.detail);
      });
      if (noresults) tbody.appendChild(noresults);
    }
    th.addEventListener("click", sort);
    th.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); sort(); }
    });
  });

  // Column resizing: drag a header's right edge. On first drag we freeze every
  // column to its current pixel width, then adjust only the dragged one — so a
  // column grows (and the panel scrolls) rather than squeezing its neighbours,
  // the way a spreadsheet behaves. Widths persist per-browser.
  (function () {
    var colgroup = table.querySelector("colgroup");
    if (!colgroup || !window.localStorage) return;
    var cols = Array.prototype.slice.call(colgroup.children);
    var ths = Array.prototype.slice.call(table.tHead.rows[0].cells);
    if (cols.length !== ths.length) return;
    var STORE = "nsn-ledger-colw";
    function saved() { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { return null; } }
    function store() {
      try { localStorage.setItem(STORE, JSON.stringify(cols.map(function (c) { return parseFloat(c.style.width) || 0; }))); } catch (e) {}
    }
    var last = cols.length - 1;
    var init = saved();
    if (init && init.length === cols.length) {
      // Restore every column but the last as a fixed width; the last stays
      // auto so it absorbs any slack and the table always fills 100%.
      cols.forEach(function (c, i) { if (i < last && init[i] > 0) c.style.width = init[i] + "px"; });
    }
    function freeze() {
      // Pin every column except the last to its current pixel width. Leaving
      // the last auto lets it soak up freed space when a column shrinks, so
      // the table never ends up narrower than the page — and overflows into
      // the scroll wrapper when a column grows past the available width.
      ths.forEach(function (th, i) { if (i < last) cols[i].style.width = th.getBoundingClientRect().width + "px"; });
      cols[last].style.width = "";
    }
    ths.forEach(function (th, i) {
      var grip = document.createElement("span");
      grip.className = "col-grip";
      grip.setAttribute("aria-hidden", "true");
      th.appendChild(grip);
      grip.addEventListener("click", function (ev) { ev.stopPropagation(); });
      grip.addEventListener("pointerdown", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var startX = ev.clientX, startW = ths[i].getBoundingClientRect().width;
        freeze();
        grip.classList.add("active");
        document.body.classList.add("col-resizing");
        try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
        function move(mv) { cols[i].style.width = Math.max(44, startW + (mv.clientX - startX)) + "px"; }
        function up() {
          grip.classList.remove("active");
          document.body.classList.remove("col-resizing");
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
          store();
        }
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      });
    });
  })();

  apply();
})();
