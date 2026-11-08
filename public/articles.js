(function () {
  "use strict";

  function openGuide(hash) {
    var guide = document.getElementById(hash.slice(1));
    if (guide && guide.matches("details.article-guide")) guide.open = true;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest('a[href^="#panduan-"]');
    if (link) openGuide(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", function () { openGuide(location.hash); });
  openGuide(location.hash);
})();
