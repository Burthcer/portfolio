// "Portfolio" goes back in history when we came from it, so the page is restored
// (scroll position kept, no intro replay) instead of being loaded from scratch.
(() => {
  const back = document.querySelector('[data-back]');
  let fromSite = false;
  try { fromSite = sessionStorage.getItem('p3d-to-resume') === '1'; } catch (e) { /* storage blocked */ }
  if (!back || !fromSite || history.length < 2) return;
  back.addEventListener('click', e => {
    e.preventDefault();
    try { sessionStorage.removeItem('p3d-to-resume'); } catch (err) { /* ignore */ }
    history.back();
  });
})();
