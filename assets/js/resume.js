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

// shown inside the laptop's browser on the portfolio: drop the page's own top bar, and open links outside the little window
if (window.self !== window.top) {
  document.documentElement.classList.add('embedded');
  document.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
}

// light / dark sheet: dark by default, the choice is remembered on this device
(() => {
  const root = document.documentElement, btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const label = btn.querySelector('span');
  const apply = t => {
    root.dataset.theme = t;
    label.textContent = t === 'dark' ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  };
  let saved = null;
  try { saved = localStorage.getItem('resume-theme'); } catch (e) { /* storage blocked */ }
  apply(saved === 'light' ? 'light' : 'dark');
  btn.addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(t);
    try { localStorage.setItem('resume-theme', t); } catch (e) { /* ignore */ }
  });
})();
