// Client-side date filter for feed and index pages. Hides items outside [from, to] by data-date.
(function () {
  var form = document.querySelector("[data-filter]");
  var items = document.querySelectorAll("[data-items] .item");
  if (!form || !items.length) return;
  var from = form.elements.from, to = form.elements.to, count = form.querySelector("[data-count]");
  function apply() {
    var n = 0;
    items.forEach(function (el) {
      var d = el.getAttribute("data-date") || "";
      var show = (!from.value || d >= from.value) && (!to.value || d <= to.value);
      el.hidden = !show; if (show) n++;
    });
    count.textContent = (from.value || to.value) ? n + " of " + items.length : "";
  }
  form.addEventListener("input", apply);
  form.querySelector("[data-clear]").addEventListener("click", function () { from.value = ""; to.value = ""; apply(); });
})();
