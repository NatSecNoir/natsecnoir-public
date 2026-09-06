// Client-side keyword filter for feed and index pages. Every word typed must appear in the item's
// data-search text (title, issuing body, document type, docket, lists, entities, excerpt).
(function () {
  var form = document.querySelector("[data-filter]");
  var items = document.querySelectorAll("[data-items] .item");
  if (!form || !items.length) return;
  var q = form.elements.q, count = form.querySelector("[data-count]");
  function apply() {
    var words = q.value.toLowerCase().split(/\s+/).filter(Boolean), n = 0;
    items.forEach(function (el) {
      var hay = el.getAttribute("data-search") || "";
      var show = words.every(function (w) { return hay.indexOf(w) !== -1; });
      el.hidden = !show; if (show) n++;
    });
    count.textContent = words.length ? n + " of " + items.length : "";
  }
  form.addEventListener("input", apply);
  form.querySelector("[data-clear]").addEventListener("click", function () { q.value = ""; apply(); q.focus(); });
  if (q.value) apply();
})();
