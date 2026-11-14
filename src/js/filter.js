// Client-side filter for feed and index pages. Two parts, both must match:
//  - keyword box: every word typed must appear in the item's data-search text (title, issuing body,
//    document type, docket, lists, entities, excerpt). A ?q= parameter prefills it (rail links).
//  - tag chips: built from the tags on the page's own items (data-lists, a JSON [{slug,label}] array).
//    Selected tags are ANDed: an item shows only if it carries every one. ?tags=1260h,litigation
//    preselects them, and the URL follows the selection so a filtered view can be linked.
(function () {
  var form = document.querySelector("[data-filter]");
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-items] .item"));
  if (!form || !items.length) return;
  var q = form.elements.q, count = form.querySelector("[data-count]");
  var box = document.querySelector("[data-tagchips]");
  var labels = {}, tagsOf = new Map(), selected = [];

  items.forEach(function (el) {
    var list = [];
    try { list = JSON.parse(el.getAttribute("data-lists") || "[]"); } catch (e) { list = []; }
    var slugs = [];
    list.forEach(function (l) { if (l && l.slug) { slugs.push(l.slug); labels[l.slug] = l.label || l.slug; } });
    tagsOf.set(el, slugs);
  });

  function words() { return q.value.toLowerCase().split(/\s+/).filter(Boolean); }
  function matches(el, ws, tags) {
    var hay = el.getAttribute("data-search") || "", own = tagsOf.get(el);
    return ws.every(function (w) { return hay.indexOf(w) !== -1; }) &&
      tags.every(function (t) { return own.indexOf(t) !== -1; });
  }

  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    var p = new URLSearchParams(location.search);
    if (selected.length) p.set("tags", selected.join(",")); else p.delete("tags");
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s.replace(/%2C/g, ",") : "") + location.hash);
  }

  function renderChips(ws, shown) {
    if (!box) return;
    var counts = {};
    Object.keys(labels).forEach(function (t) {
      var on = selected.indexOf(t) !== -1;
      var withT = on ? selected : selected.concat([t]);
      counts[t] = items.filter(function (el) { return matches(el, ws, withT); }).length;
    });
    // A chip earns a place if it is on, or clicking it would narrow the list without emptying it.
    var shownTags = Object.keys(labels).filter(function (t) {
      return selected.indexOf(t) !== -1 || (counts[t] > 0 && counts[t] < shown);
    }).sort(function (a, b) { return counts[b] - counts[a] || labels[a].localeCompare(labels[b]); });
    box.innerHTML = "";
    if (!shownTags.length) { box.hidden = true; return; }
    box.hidden = false;
    var head = document.createElement("span"); head.className = "tl"; head.textContent = "Tags";
    box.appendChild(head);
    shownTags.forEach(function (t) {
      var on = selected.indexOf(t) !== -1, b = document.createElement("button");
      b.type = "button"; b.className = "tagchip" + (on ? " on" : "");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("data-tag", t);
      b.title = on ? "Remove this tag" : "Show only records also tagged " + labels[t];
      b.appendChild(document.createTextNode(labels[t] + " "));
      var n = document.createElement("span"); n.className = "n"; n.textContent = counts[t];
      b.appendChild(n);
      box.appendChild(b);
    });
  }

  function apply() {
    var ws = words(), n = 0;
    items.forEach(function (el) { var show = matches(el, ws, selected); el.hidden = !show; if (show) n++; });
    count.textContent = (ws.length || selected.length) ? n + " of " + items.length : "";
    renderChips(ws, n);
  }

  if (box) box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tag]"); if (!b) return;
    var t = b.getAttribute("data-tag"), i = selected.indexOf(t);
    if (i === -1) selected.push(t); else selected.splice(i, 1);
    syncUrl(); apply();
    var again = box.querySelector('[data-tag="' + t + '"]'); if (again) again.focus();
  });
  form.addEventListener("input", apply);
  form.querySelector("[data-clear]").addEventListener("click", function () {
    q.value = ""; selected = []; syncUrl(); apply(); q.focus();
  });
  var params = new URLSearchParams(location.search);
  var param = params.get("q");
  if (param && !q.value) q.value = param;
  (params.get("tags") || "").split(",").forEach(function (t) {
    t = t.trim().toLowerCase(); if (t && labels[t] && selected.indexOf(t) === -1) selected.push(t);
  });
  apply();
})();
