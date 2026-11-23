// § 1260H page tables: a filter box per table, click-to-sort headers, and drag-to-resize columns.
// Rows stay readable without this script. The current list is grouped under parents as printed;
// sorting by any column shows a flat list (each company then names its parent), and a third click
// on the same header returns to the printed grouping. Filtering the grouped list keeps the parents
// of every match on screen so each company is still seen under its group.
(function () {
  "use strict";
  var tables = document.querySelectorAll("table.ltable[id]");
  Array.prototype.forEach.call(tables, function (table) {
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    var printed = rows.slice();
    var grouped = table.classList.contains("current");
    var noun = table.getAttribute("data-noun") || "rows";
    var q = document.querySelector('.tq[data-for="' + table.id + '"]');
    var count = document.querySelector('.count[data-for="' + table.id + '"]');
    var none = document.createElement("tr");
    none.className = "noresults";
    none.hidden = true;
    none.innerHTML = '<td colspan="' + table.tHead.rows[0].cells.length + '">No matches.</td>';
    tbody.appendChild(none);
    var sorted = false;
    rows.forEach(function (r) {
      if (!r.hasAttribute("data-search")) r.setAttribute("data-search", r.textContent.replace(/\s+/g, " ").toLowerCase());
    });

    function apply() {
      var words = q ? q.value.toLowerCase().split(/\s+/).filter(Boolean) : [];
      var keep = {};
      var shown = 0;
      rows.forEach(function (r) {
        var hay = r.getAttribute("data-search");
        var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
        r.hidden = !ok;
        if (ok) {
          shown++;
          if (grouped && !sorted) (r.getAttribute("data-anc") || "").split(/\s+/).forEach(function (a) { if (a) keep[a] = 1; });
        }
      });
      // a match's parents stay visible (muted) so the grouping still reads
      rows.forEach(function (r) {
        var ctx = r.hidden && keep[r.id];
        if (ctx) r.hidden = false;
        r.classList.toggle("ctx", !!ctx);
      });
      none.hidden = shown !== 0;
      if (count) count.textContent = shown + " of " + rows.length + " " + noun;
    }
    if (q) q.addEventListener("input", apply);

    var headers = Array.prototype.slice.call(table.tHead.rows[0].cells);
    function value(r, idx, key) {
      if (key === "date") return r.getAttribute("data-date") || "";
      if (key === "listed") return r.getAttribute("data-listed") || "9999";
      if (key === "name") { var n = r.querySelector(".nm"); return (n ? n.textContent : r.cells[idx].textContent).trim().toLowerCase(); }
      return r.cells[idx].textContent.replace(/\s+/g, " ").trim().toLowerCase();
    }
    headers.forEach(function (th, idx) {
      var key = th.getAttribute("data-key");
      if (!key) return;
      th.setAttribute("tabindex", "0");
      th.setAttribute("role", "button");
      function sort() {
        var cur = th.getAttribute("aria-sort");
        // grouped list: ascending → descending → back to the printed grouping
        var dir = cur === "ascending" ? "descending" : (cur === "descending" && grouped ? "" : "ascending");
        headers.forEach(function (h) { h.removeAttribute("aria-sort"); });
        var order;
        if (!dir) {
          order = printed;
          sorted = false;
        } else {
          th.setAttribute("aria-sort", dir);
          var sign = dir === "ascending" ? 1 : -1;
          order = rows.slice().sort(function (a, b) {
            var av = value(a, idx, key), bv = value(b, idx, key);
            return av < bv ? -sign : av > bv ? sign : 0;
          });
          sorted = true;
        }
        table.classList.toggle("flat", grouped && sorted);
        order.forEach(function (r) { tbody.appendChild(r); });
        tbody.appendChild(none);
        apply();
      }
      th.addEventListener("click", sort);
      th.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); sort(); }
      });
    });

    // Drag a header's right edge to resize its column (same behaviour as the watch-lists table).
    var colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children.length === headers.length) {
      var cols = Array.prototype.slice.call(colgroup.children);
      var last = cols.length - 1;
      var STORE = "nsn-" + table.id + "-colw";
      try {
        var init = JSON.parse(localStorage.getItem(STORE) || "null");
        if (init && init.length === cols.length) cols.forEach(function (c, i) { if (i < last && init[i] > 0) c.style.width = init[i] + "px"; });
      } catch (e) {}
      headers.forEach(function (th, i) {
        var grip = document.createElement("span");
        grip.className = "col-grip";
        grip.setAttribute("aria-hidden", "true");
        th.appendChild(grip);
        grip.addEventListener("click", function (ev) { ev.stopPropagation(); });
        grip.addEventListener("pointerdown", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var startX = ev.clientX, startW = th.getBoundingClientRect().width;
          headers.forEach(function (h, j) { if (j < last) cols[j].style.width = h.getBoundingClientRect().width + "px"; });
          cols[last].style.width = "";
          grip.classList.add("active");
          document.body.classList.add("col-resizing");
          try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
          function move(mv) { cols[i].style.width = Math.max(44, startW + (mv.clientX - startX)) + "px"; }
          function up() {
            grip.classList.remove("active");
            document.body.classList.remove("col-resizing");
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", up);
            try { localStorage.setItem(STORE, JSON.stringify(cols.map(function (c) { return parseFloat(c.style.width) || 0; }))); } catch (e) {}
          }
          grip.addEventListener("pointermove", move);
          grip.addEventListener("pointerup", up);
        });
      });
    }
    apply();
  });
})();
