// A built page can be older than a comment deadline: once the browser's date passes `data-until`,
// show the closed line instead of the open one (the build already did this for deadlines it knew had passed).
(function () {
  var today = new Date().toISOString().slice(0, 10);
  var items = document.querySelectorAll(".frpanel li[data-until]");
  for (var i = 0; i < items.length; i++) {
    var li = items[i];
    if (li.getAttribute("data-until") < today) {
      var open = li.querySelector(".open"), closed = li.querySelector(".closed");
      if (open) open.hidden = true;
      if (closed) closed.hidden = false;
    }
  }
})();
