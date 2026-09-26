// "Cite this record": progressive enhancement. The citation is plain text in <pre class="cite"> and
// selectable without JS; the copy button is revealed only when the clipboard API is available and
// shows a short "Copied" state announced through a polite live region.
(function () {
  var btn = document.querySelector("[data-copy]"), pre = document.querySelector("pre.cite");
  if (!btn || !pre || !navigator.clipboard || !navigator.clipboard.writeText) return;
  var live = document.querySelector("[data-copied]"), label = btn.textContent, timer;
  btn.hidden = false;
  btn.addEventListener("click", function () {
    navigator.clipboard.writeText(pre.textContent.trim()).then(function () {
      btn.textContent = "Copied";
      if (live) live.textContent = "Citation copied to the clipboard";
      clearTimeout(timer);
      timer = setTimeout(function () { btn.textContent = label; if (live) live.textContent = ""; }, 2000);
    }, function () { /* clipboard refused: leave the text selectable and the button as it was */ });
  });
})();
