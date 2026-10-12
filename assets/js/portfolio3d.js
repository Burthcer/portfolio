(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  root.classList.add('js');

  /* ================= split text ================= */
  // Wraps every word (or char) in a mask so it can rise into view. Keeps nested markup.
  function split(el, chars) {
    const parts = [];
    if (chars) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    (function walk(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 1) return walk(n);
        if (n.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (!tok.trim()) return frag.append(' ');
          const w = document.createElement('span');
          w.className = 'sw';
          if (chars) w.setAttribute('aria-hidden', 'true');
          (chars ? [...tok] : [tok]).forEach(ch => {
            const s = document.createElement('span');
            s.textContent = ch;
            w.append(s);
            parts.push(s);
          });
          frag.append(w);
        });
        n.replaceWith(frag);
      });
    })(el);
    parts.forEach((s, i) => s.style.setProperty('--i', i));
    return parts;
  }
  $$('[data-split]').forEach(el => split(el, el.dataset.split === 'chars'));
  const statements = $$('.statement').map(el => ({ el, words: split(el, false) }));
  $$('.tile').forEach((t, i) => { t.classList.add('reveal'); t.style.setProperty('--d', i % 4); });

  /* ================= reveals + counters ================= */
  // show an element; once split-text has risen, drop its masks so nothing stays clipped
  function show(el) {
    el.classList.add('in');
    const masks = $$('.sw', el);
    if (masks.length) setTimeout(() => masks.forEach(m => m.classList.add('done')), 1500 + masks.length * 60);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    show(e.target);
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -2% 0px' });   // reveal as soon as it is really on screen (a nav jump can land with content near the bottom edge)
  $$('.bench').forEach(b => {
    const bars = $$('.bar', b), max = Math.max(...bars.map(x => +x.dataset.v));
    bars.forEach(x => x.style.setProperty('--v', (x.dataset.v / max).toFixed(3)));
  });
  $$('.reveal, [data-split]').forEach(el => { if (!el.closest('.hero')) io.observe(el); });

  function count(el) {
    const raw = el.dataset.count, end = parseFloat(raw), dec = (raw.split('.')[1] || '').length;
    const t0 = performance.now();
    (function tick(now) {
      const k = clamp((now - t0) / 1800);
      el.textContent = (end * easeOut(k)).toFixed(dec);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    count(e.target);
    cio.unobserve(e.target);
  }), { threshold: 0.6 });

  /* ================= boot sequence ================= */
  let introAt = 0;
  // seen this session (e.g. coming back from the resume): skip the boot screen and intro animations
  let seen = false;
  try { seen = sessionStorage.getItem('p3d-booted') === '1'; } catch (e) { /* storage blocked */ }
  function begin(instant) {
    introAt = performance.now() - (instant ? 10000 : 0);
    if (instant) root.classList.add('no-intro');
    $$('.hero .reveal, .hero [data-split]').forEach(show);
    if (!reduce && !instant) $$('[data-count]').forEach(el => cio.observe(el));
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-intro')));
    try { sessionStorage.setItem('p3d-booted', '1'); } catch (e) { /* ignore */ }
  }
  $$('[data-resume]').forEach(a => a.addEventListener('click', () => {
    try { sessionStorage.setItem('p3d-to-resume', '1'); sessionStorage.setItem('p3d-scroll', String(Math.round(scrollY))); } catch (e) { /* ignore */ }
  }));
  // back from the resume: put the page where it was. The position is saved on every exit; it is put back after load,
  // and again once fonts and images have settled the layout, unless the visitor has already scrolled themselves
  addEventListener('pagehide', () => { try { sessionStorage.setItem('p3d-scroll', String(Math.round(scrollY))); } catch (e) { /* ignore */ } });
  try {
    const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
    const fromResume = sessionStorage.getItem('p3d-to-resume') === '1' || navType === 'back_forward';
    const y = +sessionStorage.getItem('p3d-scroll');
    sessionStorage.removeItem('p3d-to-resume');
    if (fromResume && y > 0) {
      history.scrollRestoration = 'manual';
      let moved = false;
      ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { moved = true; }, { once: true, passive: true }));
      const put = () => { if (!moved) scrollTo({ top: y, behavior: 'instant' }); };
      addEventListener('load', () => { requestAnimationFrame(put); setTimeout(put, 350); setTimeout(put, 1200); });
    }
  } catch (e) { /* storage blocked */ }
  const boot = $('#boot');
  if (reduce || !boot || seen) { if (boot) boot.remove(); begin(seen); }
  else {
    const bar = $('.boot-bar i', boot), pct = $('.boot-pct', boot), log = $('.boot-log', boot);
    const lines = ['C:\\> power on', 'network adapter ........ off', 'telemetry .............. none', 'bytes uploaded ......... 0', 'loading dev.bhamaria ...'];
    let t0 = 0, done = false;
    // the page underneath must not scroll while the loading screen is up (touch swipes and the wheel would move it)
    const hold = e => e.preventDefault();
    root.classList.add('booting');
    addEventListener('touchmove', hold, { passive: false });
    addEventListener('wheel', hold, { passive: false });
    const finish = () => {
      if (done) return;
      done = true;
      root.classList.remove('booting');
      removeEventListener('touchmove', hold);
      removeEventListener('wheel', hold);
      boot.classList.add('done');
      begin();
      setTimeout(() => boot.remove(), 1100);
    };
    boot.addEventListener('click', finish);
    addEventListener('keydown', finish, { once: true });
    // start the clock two frames in: the one-time 3D setup (shader compile) runs first, so the counter never jumps
    requestAnimationFrame(() => requestAnimationFrame(function step(now) {
      if (done) return;
      if (!t0) t0 = now;
      const k = clamp((now - t0) / 1400), e = 1 - Math.pow(1 - k, 2);
      bar.style.transform = `scaleX(${e})`;
      pct.textContent = String(Math.round(e * 100)).padStart(3, '0');
      log.textContent = lines.slice(0, Math.min(lines.length, 1 + Math.floor(k * lines.length))).join('\n');
      if (k < 1) requestAnimationFrame(step); else setTimeout(finish, 200);
    }));
  }

  /* ================= UI ================= */
  const live = $('#live');
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise((res, rej) => {   // file:// fallback
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.className = 'sr';
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  $$('[data-copy]').forEach(b => {
    const lbl = $('[data-copy-label]', b), orig = lbl.textContent;
    let tm;
    b.addEventListener('click', () => {
      const addr = b.dataset.copy;
      copyText(addr).then(
        () => { lbl.textContent = 'Copied to clipboard'; b.classList.add('ok'); live.textContent = 'Email address copied'; },
        () => { lbl.textContent = addr; live.textContent = 'Copy failed, address shown'; });
      clearTimeout(tm);
      tm = setTimeout(() => { lbl.textContent = orig; b.classList.remove('ok'); }, 2000);
    });
  });

  // lightbox (native <dialog>: Esc closes); steps through whichever viewer opened it
  const lb = $('#lightbox'), lbImg = $('img', lb), lbCap = $('.lb-cap', lb);
  let lbSet = null;
  const lbShow = () => {
    const t = lbSet.tabs[lbSet.at];
    lbImg.src = t.dataset.src; lbImg.alt = t.dataset.alt;
    lbCap.textContent = `${t.dataset.cap}  (${lbSet.at + 1} / ${lbSet.tabs.length})`;
    $$('.lb-nav', lb).forEach(x => { x.hidden = lbSet.tabs.length < 2; });
  };
  const lbStep = d => { lbSet.go(lbSet.at + d); lbShow(); };
  $('.lb-close', lb).addEventListener('click', () => lb.close());
  $('.lb-prev', lb).addEventListener('click', () => lbStep(-1));
  $('.lb-next', lb).addEventListener('click', () => lbStep(1));
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') lbStep(1);
    if (e.key === 'ArrowLeft') lbStep(-1);
  });

  // screenshot viewer: the stage has a fixed size, so switching never moves the thumbnails
  $$('[data-viewer]').forEach(v => {
    const img = $('.frame img', v), cap = $('[data-cap]', v), count = $('[data-count-label]', v);
    const tabs = $$('[role="tab"]', v);
    const state = { tabs, at: 0, go };
    function go(i, focus) {
      i = (i + tabs.length) % tabs.length;
      state.at = i;
      const t = tabs[i];
      tabs.forEach((x, j) => { x.setAttribute('aria-selected', j === i); x.tabIndex = j === i ? 0 : -1; });
      if (focus) t.focus();
      cap.textContent = t.dataset.cap;
      count.textContent = `${i + 1} / ${tabs.length}`;
      if (img.getAttribute('src') === t.dataset.src) return;
      img.classList.add('fade');
      const pre = new Image();
      pre.onload = pre.onerror = () => { img.src = t.dataset.src; img.alt = t.dataset.alt; img.classList.remove('fade'); };
      pre.src = t.dataset.src;
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => go(i));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); go(i + d, true); }
      });
    });
    $('.vnav.prev', v).addEventListener('click', () => go(state.at - 1));
    $('.vnav.next', v).addEventListener('click', () => go(state.at + 1));
    $('[data-zoom]', v).addEventListener('click', () => { lbSet = state; lbShow(); lb.showModal(); });
  });

  // bar widths come from data-w (no inline styles, so a strict CSP still works)
  $$('[data-w]').forEach(e => e.style.setProperty('--w', e.dataset.w + '%'));
  // short comparison bars put their label beside the bar instead of inside it
  $$('.pbar[data-w]').forEach(e => e.classList.toggle('out', +e.dataset.w < 45));

  // sub-sections inside a benchmarks panel (Summary, Large files, ...)
  $$('[data-sub]').forEach(box => {
    const btns = $$(':scope > .subbar > button', box), pans = $$(':scope > .subpanel', box);
    const pick = (i, focus) => {
      btns.forEach((b, j) => { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });
      pans.forEach((p, j) => { p.hidden = i !== j; });
      if (focus) btns[i].focus();
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => pick(i));
      b.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); pick((i + d + btns.length) % btns.length, true); }
      });
    });
  });

  // project mini-sections (tabs)
  $$('.ptabs').forEach(bar => {
    const tabs = $$('[role="tab"]', bar);
    function select(t, focus) {
      tabs.forEach(x => {
        const on = x === t, panel = document.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
        $$('.bench', panel).forEach(b => b.classList.remove('in'));
        if (on) requestAnimationFrame(() => requestAnimationFrame(() => $$('.bench', panel).forEach(b => b.classList.add('in'))));
      });
      if (focus) t.focus();
      // keep the tab bar in view when switching from further down a long panel
      const top = bar.getBoundingClientRect().top;
      if (top < 0 || top > H) bar.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
  });

  /* ================= centering ================= */
  // Layout position (ignores reveal transforms, which would otherwise skew the maths by 36px).
  function docTop(el) { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; }
  // Where the page rests at Contact: the heading ('Write to me.') just under the nav, never cut off. The footer below may run off the screen.
  // On a tall screen the page ends first, so it stops at the very bottom as before.
  function contactRest() { return Math.max(0, Math.min(root.scrollHeight - innerHeight, docTop($('#contact .sec-head')) - 96)); }
  // Scroll target that centres a group of elements in the visible band (below the nav,
  // above the bottom chrome). If the group is too tall, its top goes just under the nav.
  function centerY(els, where) {
    els = [].concat(els).filter(Boolean);
    const top = Math.min(...els.map(docTop)), bottom = Math.max(...els.map(e => docTop(e) + e.offsetHeight));
    const bandTop = 76, bandBottom = innerHeight - (root.classList.contains('touring') ? 84 : 24);
    const band = bandBottom - bandTop, h = bottom - top;
    // taller than the screen: start just past the section's divider line, so the frame opens on the heading, not the hairline
    if (where === 'top') return top - bandTop;
    return where === 'tall' || h > band ? top + 2 : top - bandTop - (band - h) / 2;
  }
  // What a link to a section should frame: the heading plus what follows. Centred if it fits,
  // otherwise top-aligned so as much of it as possible is on screen.
  function frameFor(target) {
    if (target.matches('.proj')) return { els: [$('.proj-head', target)], where: 'top' };
    if (target.id === 'top') return { els: [target], where: 'top' };
    const head = $('.sec-head', target);
    if (!head) return { els: [target] };
    const next = [...target.children].filter(c => c !== head && !c.matches('.proj, footer'));
    const els = [head, ...next];
    const h = Math.max(...els.map(e => docTop(e) + e.offsetHeight)) - docTop(head);
    return { els, where: 'tall' };   // sections open on their heading, just past the divider line (the owner wants no hairline at the top)
  }
  // In-page links (See the work, nav, project index, Next project) glide to a centred frame.
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href').slice(1), target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const f = frameFor(target);
    // Contact is the last section: the laptop arrives fully there, with the heading in view
    scrollTo({ top: id === 'contact' ? contactRest() : Math.max(0, centerY(f.els, f.where)), behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + id);
  });

  /* ================= guided auto-scroll ================= */
  // A scripted walk through the site: a visible cursor hovers and clicks what a visitor would,
  // and each section is brought to the centre of the screen. Wheel, key, touch or click stops it.
  const tourBtn = $('#tour');
  const STOP = Symbol('stop');
  let touring = false;
  const cursor = document.createElement('div');
  cursor.className = 'tour-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i class="tour-ring"></i><svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5 19.5 13l-7.1 1.2 4.2 7.2-2.9 1.6-4.2-7.3L4 20.5z"/></svg><span class="tour-tip"></span>';
  const tip = $('.tour-tip', cursor);
  const tourBar = document.createElement('div');
  tourBar.className = 'tour-bar';
  tourBar.innerHTML = '<span>Auto-scroll</span><span class="tb-step"></span><button type="button">Stop</button>';
  document.body.append(cursor, tourBar);
  const tbStep = $('.tb-step', tourBar);

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const wait = ms => new Promise((res, rej) => {
    const t0 = performance.now();
    (function f(now) {
      if (!touring) return rej(STOP);
      if (now - t0 >= ms) return res();
      requestAnimationFrame(f);
    })(t0);
  });
  // eased scroll whose duration follows the distance, so short hops are quick and long ones glide
  function glide(y, ms, curve = ease) {
    y = clamp(y, 0, root.scrollHeight - innerHeight);
    const y0 = scrollY, d = y - y0, dur = ms || clamp(Math.abs(d) * 1.05, 800, 2200);
    return new Promise((res, rej) => {
      const t0 = performance.now();
      (function f(now) {
        if (!touring) return rej(STOP);
        const k = clamp((now - t0) / dur);
        scrollTo({ top: y0 + d * curve(k), behavior: 'instant' });
        if (k < 1) requestAnimationFrame(f); else res();
      })(t0);
    });
  }
  const focusOn = (els, where) => glide(centerY(els, where));
  let tipTimer = 0;
  function point(el, label, fx = 0.5, fy = 0.5) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * fx;
    cursor.style.transform = `translate(${x}px, ${r.top + r.height * fy}px)`;
    // the bubble shows only once the pointer has arrived, so it never trails across the page while the pointer is still moving
    cursor.classList.remove('has-tip');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      tip.textContent = label || '';
      tip.style.left = '';
      if (label && x + 34 + tip.offsetWidth > innerWidth - 8) tip.style.left = `${-tip.offsetWidth - 14}px`;
      cursor.classList.toggle('has-tip', !!label && touring);
    }, 800);
    return wait(900);
  }
  async function press(el, real) {
    el.classList.add('tour-hover');
    await wait(550);
    cursor.classList.add('press');
    el.classList.add('tour-press');
    await wait(200);
    cursor.classList.remove('press');
    el.classList.remove('tour-press');
    if (real) el.click();
    await wait(260);
    el.classList.remove('tour-hover');
    cursor.classList.remove('has-tip');
  }
  async function showProject(id, key, name, tabs, next) {
    tbStep.textContent = name;
    await focusOn([$(`#${id} .proj-head`)], 'top');
    await wait(1500);
    for (const [n, label] of tabs) {
      const t = $(`#${key}-t${n}`);
      await point(t, label);
      await press(t, true);
      if (/screens/i.test(t.textContent)) {
        const nx = $(`#${key}-p${n} .vnav.next`);
        await wait(900);
        await point(nx, 'Next screenshot');
        for (let i = 0; i < 2; i++) { await press(nx, true); await wait(1000); }
      } else await wait(2800);
    }
    if (!next) return;
    const card = $(`#${id} .pf-next`);
    await focusOn([card]);
    await point(card, next, 0.4);
    await press(card);
  }
  // the tour is a list of stops; it starts at the stop you are currently reading, so it never jumps back to the top
  const touch = () => innerWidth < 900 || !matchMedia('(hover: hover) and (pointer: fine)').matches;
  const STEPS = [
    { el: () => $('#work'), name: 'Work', run: async () => {
      await focusOn(frameFor($('#work')).els, frameFor($('#work')).where);
      await wait(1600);
      const row = $('.pindex a[href="#ihatepdf"]');
      await point(row, 'Take me to IHatePDF', 0.28);
      await press(row);
    } },
    { el: () => $('#ihatepdf'), name: 'IHatePDF', run: () => showProject('ihatepdf', 'ihp', 'IHatePDF', [[2, 'Show me the screens'], [4, 'Show me the numbers']], 'Next project: Wisperno') },
    { el: () => $('#wisperno'), name: 'Wisperno', run: () => showProject('wisperno', 'wsp', 'Wisperno', [[5, 'Show me the app'], [4, 'Show me the numbers']], null) },
    { el: () => $('#ideas'), name: 'Ideas', run: async () => {
      cursor.classList.remove('has-tip');
      await focusOn([$('#ideas .sec-head')]);
      await wait(900);
      const st = $('#ideas .statement');
      await glide(docTop(st) + st.offsetHeight - innerHeight * 0.56, 4200, t => t);
      await wait(900);
      await focusOn([$('.rules')]); await wait(3200);
    } },
    { el: () => $('#stack'), name: 'Stack', run: async () => {
      await focusOn(frameFor($('#stack')).els, frameFor($('#stack')).where);
      await wait(1400);
      await focusOn([$('.stack'), $('#stack .practices')]); await wait(2800);
    } },
    { el: () => $('#education'), name: 'Education', run: async () => {
      await focusOn([$('#education .edu')]); await wait(3200);
    } },
    { el: () => $('#outlook'), name: 'Outlook', run: async () => {
      await focusOn([$('#outlook .sec-head')]);
      await wait(700);
      const st = $('#outlook .statement');
      await glide(docTop(st) + st.offsetHeight - innerHeight * 0.6, 4200, t => t);
      await wait(1400);
    } },
    { el: () => $('#contact'), name: 'Contact', run: async () => {
      await glide(contactRest());   // Contact: the heading in view, where the laptop is fully out
      const mail = $('.mail-big');
      await point(mail, 'Say hi', 0.5, 0.55);
      mail.classList.add('tour-hover');
      await wait(2200);
      mail.classList.remove('tour-hover');
    } }
  ];
  async function run() {
    // start at the section in view (the one whose bottom is still below the upper third of the screen)
    let i = 0;
    if (scrollY > innerHeight * 0.5) {
      const line = scrollY + innerHeight * 0.35;
      i = STEPS.findIndex(st => { const e = st.el(); return docTop(e) + e.offsetHeight > line; });
      if (i < 0) i = STEPS.length - 1;
    }
    for (; i < STEPS.length; i++) { tbStep.textContent = STEPS[i].name; await STEPS[i].run(); }
  }
  function startTour() {
    if (touring) return;
    touring = true;
    tourBtn.setAttribute('aria-pressed', 'true');
    root.classList.add('touring');
    const r = tourBtn.getBoundingClientRect();
    cursor.style.transition = 'none';
    cursor.style.transform = `translate(${r.left + r.width / 2}px, ${r.bottom}px)`;
    void cursor.offsetWidth;
    cursor.style.transition = '';
    cursor.classList.toggle('touch', touch());
    cursor.classList.add('on');
    if (nav.classList.contains('open')) { nav.classList.remove('open'); $('.nav-menu').setAttribute('aria-expanded', 'false'); }
    live.textContent = 'Auto-scroll started. Press any key to stop.';
    run().then(() => stopTour(true), e => { if (e !== STOP) { console.error(e); stopTour(); } });
  }
  function stopTour(finished) {
    if (!touring) return;
    touring = false;
    tourBtn.setAttribute('aria-pressed', 'false');
    root.classList.remove('touring');
    cursor.classList.remove('on', 'has-tip', 'press');
    $$('.tour-hover').forEach(x => x.classList.remove('tour-hover'));
    live.textContent = finished ? 'Auto-scroll finished.' : 'Auto-scroll stopped.';
  }
  tourBtn.addEventListener('click', e => { e.stopPropagation(); touring ? stopTour() : startTour(); });
  $('button', tourBar).addEventListener('click', e => { e.stopPropagation(); stopTour(); });
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, e => {
    if (touring && !tourBar.contains(e.target) && !tourBtn.contains(e.target)) stopTour();
  }, { passive: true, capture: true }));


  /* ================= scroll-linked motion ================= */
  // university logo: drawn on its white plate in a canvas. Forced dark modes (Samsung Internet) grey out the white plate
  // and dim the logo image, but leave canvas pixels alone (tested on a real phone)
  (() => {
    const img = $('.uni-logo');
    if (!img) return;
    const draw = () => {
      if (!img.naturalWidth) return;
      const k = img.naturalWidth / 300, px = Math.round(20 * k), py = Math.round(14 * k), r = 12 * k;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth + px * 2; c.height = img.naturalHeight + py * 2;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, c.width, c.height, r); g.fill();
      g.drawImage(img, px, py);
      c.className = 'uni-logo cv'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', img.alt);
      img.replaceWith(c);
    };
    if (img.complete) draw(); else img.addEventListener('load', draw, { once: true });
  })();
  const nav = $('.nav'), bar = $('.progress'), track = $('.marquee-track');
  // phones: the section links live behind a menu button
  const menuBtn = $('.nav-menu');
  const setMenu = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open); menuBtn.setAttribute('aria-label', open ? 'Close sections menu' : 'Open sections menu'); };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('.nav nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  const navLinks = $$('[data-nav]'), navSecs = navLinks.map(a => $(a.getAttribute('href')));
  const slides = $$('[data-slide]').map(el => { const [a, b] = el.dataset.slide.split(' ').map(Number); return { el, a, b }; });
  // the bar that slides in when you scroll up goes away again by itself (under a second after you stop), so it never keeps covering the
  // heading of the section you just jumped to. A pointer resting on it does not keep it open: only moving over it, or keyboard focus, does.
  let navTimer = 0, navMoved = 0;
  function armNavHide(ms = 800) {
    clearTimeout(navTimer);
    navTimer = setTimeout(() => {
      if (scrollY <= 240 || nav.classList.contains('open')) return;
      const moving = performance.now() - navMoved < 900 && nav.matches(':hover');
      if (moving || nav.querySelector(':focus-visible')) return armNavHide(500);
      nav.classList.add('hide'); dirty = true;
    }, ms);
  }
  nav.addEventListener('pointermove', () => { navMoved = performance.now(); }, { passive: true });
  nav.addEventListener('pointerleave', () => { if (!nav.classList.contains('hide')) armNavHide(); });
  nav.addEventListener('focusout', () => { if (!nav.classList.contains('hide')) armNavHide(); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) { navMoved = 0; e.target.closest('a').blur(); armNavHide(800); } });
  // the size of the 3D canvas is the one true size (it is fixed over the whole viewport); the page width can differ from it by the scrollbar
  const viewSize = () => { const c = document.getElementById('disk'); return c && c.clientWidth ? [c.clientWidth, c.clientHeight] : [document.documentElement.clientWidth, innerHeight]; };
  let [W, H] = viewSize(), dirty = true, lastY = scrollY, navY = scrollY, vel = 0, dir = 1, mx = 0;
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', () => { [W, H] = viewSize(); dirty = true; });
  const progOf = r => clamp((H - r.top) / (H + r.height));

  function domFrame(dt) {
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    vel += (dy / Math.max(dt, 1e-3) - vel) * 0.15;   // px/s, smoothed
    if (dy) dir = dy > 0 ? 1 : -1;

    // marquee: drifts on its own, speeds up and flips with scroll
    const half = track.scrollWidth / 2;
    mx -= (70 + Math.min(Math.abs(vel), 4000) * 0.35) * dir * dt;
    if (mx <= -half) mx += half;
    if (mx > 0) mx -= half;
    track.style.transform = `translate3d(${mx}px,0,0) skewX(${clamp(-vel * 0.003, -10, 10)}deg)`;

    if (!dirty) return;
    dirty = false;
    // reads first, then writes (no layout thrash)
    const max = root.scrollHeight - H;
    const slideP = slides.map(s => progOf(s.el.getBoundingClientRect()));
    const stP = statements.map(s => { const r = s.el.getBoundingClientRect(); return clamp((H * 0.94 - r.top) / r.height); });   // a word is lit once it is on screen, so a jump to the section shows it all lit
    let act = -1;
    navSecs.forEach((s, i) => { if (s.getBoundingClientRect().top <= H * 0.4) act = i; });

    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (y > navY + 6 && y > 240 && !nav.classList.contains('open')) nav.classList.add('hide');
    else if (y < navY - 6) { nav.classList.remove('hide'); armNavHide(); }
    if (Math.abs(y - navY) > 6) navY = y;
    root.classList.toggle('navshown', !nav.classList.contains('hide'));
    nav.classList.toggle('solid', y > H * 0.6);
    navLinks.forEach((a, i) => a.classList.toggle('on', i === act));
    slides.forEach((s, i) => { s.el.style.transform = `translate3d(${s.a + (s.b - s.a) * slideP[i]}vw,0,0)`; });
    statements.forEach((s, i) => {
      const lit = Math.round(stP[i] * s.words.length);
      s.words.forEach((w, j) => w.classList.toggle('lit', j < lit));
    });
  }

  /* ================= 3D device: laptop on desktop, phone on phones ================= */
  const device3d = initDevice();

  let last = performance.now(), lastDraw = 0, drawDt = 0;
  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    drawDt += dt;
    // the full-screen WebGL canvas is the heaviest thing on the page: every frame while the device moves,
    // otherwise at most ~60 times a second (the idle float doesn't need 240 Hz)
    const drawNow = device3d && (dirty || device3d.busy() || now - lastDraw >= 15);   // always on a frame that scrolled, or the scroll is missed
    // an error in one frame must never stop the loop (that froze the laptop and the page effects until a refresh)
    try {
      if (drawNow) device3d.read();
      domFrame(dt);
      if (drawNow) { device3d.draw(now, drawDt); lastDraw = now; drawDt = 0; }
    } catch (err) { if (!loop.failed) { loop.failed = true; console.error(err); } }
    requestAnimationFrame(loop);
  })(last);

  function initDevice() {
    const canvas = $('#disk'), dockEl = $('#dock');
    if (!window.THREE) { canvas.remove(); return null; }
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); return null; }
    renderer.setPixelRatio(Math.min(Math.max(2, (devicePixelRatio || 1) * 1.5), 2.5));   // supersampled: no stair-stepped edges (it only redraws every frame while moving)
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 25, 55);   // tight depth range: thin parts (screen, keys) z-fight with a wide one
    camera.position.set(0, 0, 40);
    const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();

    // studio environment for the metal reflections
    (() => {
      const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
      env.background = new THREE.Color(0.06, 0.06, 0.065);
      const box = (w, h, d, x, y, z, k) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) }));
        m.position.set(x, y, z);
        env.add(m);
      };
      box(30, 1, 14, 0, 14, 4, 5.0);
      box(1, 16, 10, -16, 2, 6, 2.6);
      box(1, 10, 4, 15, 0, -4, 1.8);
      box(10, 6, 1, 4, -2, 18, 1.4);
      box(60, 1, 60, 0, -14, 0, 0.12);
      scene.environment = pm.fromScene(env, 0.035).texture;
      pm.dispose();
    })();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2b2e, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(6, 9, 12); scene.add(key);
    const rim = new THREE.DirectionalLight(0xd8e4ff, 1.7); rim.position.set(-9, 4, -8); scene.add(rim);   // cool rim: keeps a black laptop's outline readable on the dark page
    const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(-8, 2, 10); scene.add(fill);

    function noiseCanvas(w, h, fn) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), d = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = fn(x, y), i = (y * w + x) * 4;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      return c;
    }
    const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
    const rounded = (w, h, r, y0 = -h / 2) => {
      const s = new THREE.Shape(), x0 = -w / 2, x1 = w / 2, y1 = y0 + h;
      s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
      s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
      s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
      s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
      return s;
    };
    function screenCanvas(w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return { c, g: c.getContext('2d'), tex };
    }
    const screenMat = tex => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...decal, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });

    /* ---- laptop (desktop): the owner's ROG Zephyrus G16 (GU605MI, 2024). 35.4 x 24.6 x ~1.5 cm, near-black,
       diagonal Slash Lighting stripe on the lid. Built from code to scale (1 unit = 2.95 cm); see reference/zephyrus-g16-gu605mi.
       Real 3D keys (one instanced mesh), smooth bevels, glossy screen glass. No ROG logo, by choice. ---- */
    function buildLaptop() {
      const LW = 12, LD = 8.34, BT = 0.28, LT = 0.18, LH = LD, R = 0.3, BEV = 0.06;
      const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const tex = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
      const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
      // deck drawings use a 1440 x 1000 layout (top = hinge side), rendered at 2x for sharpness
      const DW = 1440, DH = 1000, DS = 2;
      const DECK_W = LW - 0.16, DECK_D = LD - 0.16;
      const toX = px => (px / DW - 0.5) * DECK_W, toZ = py => (py / DH - 0.5) * DECK_D;

      // keyboard layout: [legend, width in key units]; row 0 is the half-height function row
      const ROWS = [
        [['esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['del', 1], ['prt sc', 1]],
        [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['backspace', 2]],
        [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]],
        [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['enter', 2.25]],
        [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 2.75]],
        [['ctrl', 1.25], ['fn', 1], ['⊞', 1], ['alt', 1], ['', 6], ['alt', 1], ['ctrl', 1.25], ['←', 1], ['↑↓', 1], ['→', 1]]
      ];
      const KX0 = 236, KSPAN = DW - 472, KTOP = 82, ROWH = [28, 54, 54, 54, 54, 54], KGAP = 7;
      const keys = [];   // [cx, cy, w, h, legend] in deck px
      (() => {
        let y = KTOP;
        ROWS.forEach((row, r) => {
          const units = row.reduce((s, k) => s + k[1], 0), u = (KSPAN - KGAP * (row.length - 1)) / units;
          let x = KX0;
          row.forEach(([lab, w]) => { const kw = w * u; keys.push([x + kw / 2, y + ROWH[r] / 2, kw, ROWH[r], lab, r]); x += kw + KGAP; });
          y += ROWH[r] + KGAP;
        });
      })();
      const PAD = [404, 470, DW - 808, 452];   // trackpad x, y, w, h

      // deck texture: anodized near-black, speaker grilles, recessed keyboard well, the little key row
      const DK = canvas(DW * DS, DH * DS);
      (() => {
        const g = DK.getContext('2d'); g.scale(DS, DS);
        g.fillStyle = '#121315'; g.fillRect(0, 0, DW, DH);
        const sheen = g.createLinearGradient(0, 0, 0, DH); sheen.addColorStop(0, 'rgba(255,255,255,.035)'); sheen.addColorStop(1, 'rgba(0,0,0,.04)');
        g.fillStyle = sheen; g.fillRect(0, 0, DW, DH);
        [50, DW - 202].forEach(x => {   // speaker grilles: fine staggered perforation
          g.fillStyle = '#26272b'; rr(g, x, 44, 152, 396, 12); g.fill();
          g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.2; rr(g, x, 44, 152, 396, 12); g.stroke();
          for (let yy = 58, row = 0; yy < 430; yy += 8, row++) for (let xx = x + 11 + (row % 2) * 4; xx < x + 144; xx += 8) {
            g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.arc(xx + 0.5, yy + 0.8, 2.9, 0, 7); g.fill();   // lit lower rim of each hole
            g.fillStyle = '#000'; g.beginPath(); g.arc(xx, yy, 2.6, 0, 7); g.fill();
          }
        });
        g.fillStyle = '#060607'; rr(g, KX0 - 16, KTOP - 14, KSPAN + 32, 404, 14); g.fill();      // keyboard well
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1.5; rr(g, KX0 - 16, KTOP - 14, KSPAN + 32, 404, 14); g.stroke();
        g.fillStyle = '#131416';
        for (let i = 0; i < 4; i++) { rr(g, 574 + i * 62, 26, 50, 24, 6); g.fill(); }   // the four small keys
        rr(g, DW - 306, 22, 52, 30, 9); g.fill();                                        // power key
        g.fillStyle = 'rgba(0,0,0,.5)'; rr(g, PAD[0] - 3, PAD[1] - 3, PAD[2] + 6, PAD[3] + 6, 20); g.fill();   // trackpad recess line
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; rr(g, PAD[0] - 3, PAD[1] - 3, PAD[2] + 6, PAD[3] + 6, 20); g.stroke();
        g.fillStyle = '#1e1f22'; g.fillRect(DW / 2 - 80, DH - 8, 160, 8);                // front thumb notch
      })();
      // key legends on a transparent layer that sits on the key tops
      const KL = canvas(DW * DS, DH * DS);
      (() => {
        const g = KL.getContext('2d'); g.scale(DS, DS);
        g.fillStyle = '#eceef2'; g.textBaseline = 'middle';
        keys.forEach(([cx, cy, w, h, lab, r]) => {
          if (!lab) return;
          const word = lab.length > 2;
          g.font = `600 ${!r ? 12 : word ? 14 : 22}px "Segoe UI", Arial, sans-serif`;
          if (word || !r) g.fillText(lab, cx - w / 2 + 9, cy);
          else { g.textAlign = 'center'; g.fillText(lab, cx, cy); g.textAlign = 'left'; }
        });
        g.strokeStyle = '#eceef2'; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
        const speaker = (x, y) => { g.beginPath(); g.moveTo(x - 7, y - 3); g.lineTo(x - 4, y - 3); g.lineTo(x, y - 7); g.lineTo(x, y + 7); g.lineTo(x - 4, y + 3); g.lineTo(x - 7, y + 3); g.closePath(); g.stroke(); };
        const icons = [
          (x, y) => { speaker(x - 2, y); g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 8, y); g.stroke(); },                                                   // volume down
          (x, y) => { speaker(x - 2, y); g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 9, y); g.moveTo(x + 6, y - 3); g.lineTo(x + 6, y + 3); g.stroke(); },   // volume up
          (x, y) => { g.beginPath(); g.moveTo(x - 2.5, y - 2); g.lineTo(x - 2.5, y - 5); g.arc(x, y - 5, 2.5, Math.PI, 0); g.lineTo(x + 2.5, y + 1); g.arc(x, y + 1, 2.5, 0, Math.PI); g.closePath(); g.stroke();
                      g.beginPath(); g.moveTo(x - 5, y + 1); g.arc(x, y + 1, 5, Math.PI, 0, true); g.moveTo(x, y + 6); g.lineTo(x, y + 8); g.moveTo(x - 6, y - 7); g.lineTo(x + 6, y + 7); g.stroke(); },   // mic mute
          (x, y) => { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a + 0.9) * 5.5, y + Math.sin(a + 0.9) * 5.5); g.stroke(); } }   // Armoury Crate (fan)
        ];
        icons.forEach((draw, i) => draw(574 + i * 62 + 25, 38));
        g.beginPath(); g.arc(DW - 280, 38, 6.5, -Math.PI * 0.32, Math.PI * 1.32); g.moveTo(DW - 280, 29.5); g.lineTo(DW - 280, 37); g.stroke();   // power
      })();

      // lid back: matte near-black, mirrored Slash stripe with LED segments, engraved plate outline
      const LB = canvas(1440 * DS, 1000 * DS);
      const S0 = [0.14, 0.137], S1 = [0.873, 0.858], SEG = 46;   // stripe ends (from the top-down photo) and LED segments
      (() => {
        const g = LB.getContext('2d'), W = 1440, H = 1000; g.scale(DS, DS);
        g.fillStyle = '#1c1d20'; g.fillRect(0, 0, W, H);
        const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,.035)'); gr.addColorStop(1, 'rgba(0,0,0,.05)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.save(); g.translate(S0[0] * W, S0[1] * H);
        const dx = (S1[0] - S0[0]) * W, dy = (S1[1] - S0[1]) * H, len = Math.hypot(dx, dy);
        g.rotate(Math.atan2(dy, dx));
        const st = g.createLinearGradient(0, -12, 0, 12); st.addColorStop(0, '#2a2b30'); st.addColorStop(0.5, '#050506'); st.addColorStop(1, '#1a1b1f');
        g.fillStyle = st; rr(g, 0, -12, len, 24, 12); g.fill();                     // mirrored black stripe
        for (let i = 0; i < SEG; i++) {                                              // LED segments (off)
          const sx = 24 + i * (len - 48) / (SEG - 1); g.save(); g.translate(sx, 0); g.rotate(-0.5);
          g.fillStyle = '#34353a'; g.fillRect(-1.6, -7, 3.2, 14); g.restore();
        }
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5; rr(g, 0.05 * W, 0.87 * H, 0.17 * W, 0.05 * H, 4); g.stroke();   // plate, no logo
      })();
      // LED glow: separate emissive texture with a soft halo, redrawn only while the lid's back can be seen
      const LE = canvas(1080, 750), lg2 = LE.getContext('2d');
      function drawLeds(t) {
        const W = 1080, H = 750, dx = (S1[0] - S0[0]) * W, dy = (S1[1] - S0[1]) * H, len = Math.hypot(dx, dy);
        lg2.fillStyle = '#000'; lg2.fillRect(0, 0, W, H);
        lg2.save(); lg2.translate(S0[0] * W, S0[1] * H); lg2.rotate(Math.atan2(dy, dx));
        lg2.shadowColor = '#fff'; lg2.shadowBlur = 10;
        const head = (t * 0.42) % 1.5 - 0.25;   // a soft band of light flowing along the stripe
        for (let i = 0; i < SEG; i++) {
          const p = i / (SEG - 1), d = (p - head) * 7, wave = Math.exp(-d * d);
          const v = Math.round(255 * Math.min(1, 0.22 + wave));
          lg2.fillStyle = `rgb(${v},${v},${v})`;
          const sx = 18 + i * (len - 36) / (SEG - 1); lg2.save(); lg2.translate(sx, 0); lg2.rotate(-0.5); lg2.fillRect(-1.8, -6, 3.6, 12); lg2.restore();
        }
        lg2.restore();
      }
      drawLeds(0);
      const ledTex = tex(LE);

      const M = {
        alu: new THREE.MeshStandardMaterial({ color: srgb('#1a1b1e'), roughness: 0.5, metalness: 0.3, envMapIntensity: 0.3 }),
        deck: new THREE.MeshStandardMaterial({ map: tex(DK), roughness: 0.55, metalness: 0.15, envMapIntensity: 0.3, ...decal }),
        keyTop: new THREE.MeshStandardMaterial({ color: srgb('#26272b'), roughness: 0.55, metalness: 0, envMapIntensity: 0.35 }),
        keySide: new THREE.MeshStandardMaterial({ color: srgb('#08080a'), roughness: 0.7, metalness: 0, envMapIntensity: 0.15 }),
        legend: new THREE.MeshBasicMaterial({ map: tex(KL), transparent: true, depthWrite: false, toneMapped: false, ...decal, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }),
        pad: new THREE.MeshStandardMaterial({ color: srgb('#141517'), roughness: 0.3, metalness: 0.1, envMapIntensity: 0.45, ...decal }),
        lidBack: new THREE.MeshStandardMaterial({ map: tex(LB), emissiveMap: ledTex, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 2.4, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.35, ...decal }),
        hinge: new THREE.MeshStandardMaterial({ color: srgb('#121315'), roughness: 0.45, metalness: 0.6 }),
        glass: new THREE.MeshStandardMaterial({ color: srgb('#040405'), roughness: 0.65, metalness: 0, envMapIntensity: 0.08, ...decal }),
        port: new THREE.MeshBasicMaterial({ color: 0x050505 })
      };
      const rig = new THREE.Group(), body = new THREE.Group();
      rig.add(body);
      body.position.set(0, -3.4, 0.6);   // roughly centre the open laptop on the rig's origin

      // base: rounded slab with smooth bevelled edges
      const bg = new THREE.ExtrudeGeometry(rounded(LW, LD, R), { depth: BT, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV * 0.8, bevelSegments: 6, curveSegments: 24 });
      bg.rotateX(-Math.PI / 2);
      body.add(new THREE.Mesh(bg, M.alu));
      const TOP = BT + BEV + 0.002;
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(DECK_W, DECK_D), M.deck);
      deck.rotation.x = -Math.PI / 2; deck.position.y = TOP; body.add(deck);
      // keys: one instanced, slightly rounded cap geometry, scaled per key
      const KEY_H = 0.05, sx = DECK_W / DW, sz = DECK_D / DH;
      const capShape = rounded(1, 1, 0.14);
      const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: KEY_H, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 });
      capGeo.rotateX(-Math.PI / 2);
      const caps = new THREE.InstancedMesh(capGeo, [M.keyTop, M.keySide], keys.length + 5);   // lighter key tops, near-black sides
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
      let n = 0;
      const addCap = (cx, cy, w, h) => { v3.set(toX(cx), TOP, toZ(cy)); sc3.set((w - 6) * sx, 1, (h - 6) * sz); caps.setMatrixAt(n++, m4.compose(v3, q, sc3)); };
      keys.forEach(([cx, cy, w, h]) => addCap(cx, cy, w, h));
      for (let i = 0; i < 4; i++) addCap(574 + i * 62 + 25, 38, 50, 24);
      addCap(DW - 280, 37, 52, 30);
      caps.count = n; body.add(caps);
      const legends = new THREE.Mesh(new THREE.PlaneGeometry(DECK_W, DECK_D), M.legend);
      legends.rotation.x = -Math.PI / 2; legends.position.y = TOP + KEY_H + 0.014; body.add(legends);
      // trackpad: a separate glossy glass panel
      const padGeo = new THREE.ShapeGeometry(rounded(PAD[2] * sx, PAD[3] * sz, 0.12), 12);
      padGeo.rotateX(-Math.PI / 2);
      const pad = new THREE.Mesh(padGeo, M.pad);
      pad.position.set(toX(PAD[0] + PAD[2] / 2), TOP + 0.002, toZ(PAD[1] + PAD[3] / 2)); body.add(pad);
      // ports along both sides (left: USB-C, HDMI, USB-C, USB-A, audio; right: SD, USB-A, USB-C)
      const port = (side, z, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), M.port); m.position.set(side * (LW / 2 + BEV * 0.8 + 0.004), BT / 2, z); body.add(m); };
      [[-2.6, 0.32, 0.1], [-1.9, 0.5, 0.14], [-1.2, 0.32, 0.1], [-0.4, 0.42, 0.14], [0.35, 0.12, 0.12]].forEach(([z, w, h]) => port(-1, z, w, h));
      [[-2.2, 0.55, 0.06], [-1.3, 0.42, 0.14], [-0.5, 0.32, 0.1]].forEach(([z, w, h]) => port(1, z, w, h));

      // lid: hinge at y = 0, screen facing +z, back face (Slash stripe) facing -z
      const lid = new THREE.Group();
      lid.position.set(0, BT + BEV, -LD / 2 + 0.25);
      body.add(lid);
      const lgeo = new THREE.ExtrudeGeometry(rounded(LW, LH, R, 0), { depth: LT, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 5, curveSegments: 24 });
      lgeo.translate(0, 0, -LT);
      lid.add(new THREE.Mesh(lgeo, M.alu));
      const back = new THREE.Mesh(new THREE.ShapeGeometry(rounded(LW - 0.04, LH - 0.04, R - 0.02), 24), M.lidBack);
      back.geometry.translate(0, 0, 0);
      // ShapeGeometry UVs follow the shape's coordinates: remap them to 0..1 across the lid so the canvas fits
      (() => { const uv = back.geometry.attributes.uv, pos = back.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (LW - 0.04) + 0.5, pos.getY(i) / (LH - 0.04) + 0.5); uv.needsUpdate = true; })();
      back.rotation.y = Math.PI; back.position.set(0, LH / 2, -LT - 0.036); lid.add(back);
      // front: one sheet of black glass edge to edge (thin bezels: ~0.5 cm sides, 0.75 cm top, chin at the bottom)
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(rounded(LW - 0.06, LH - 0.06, R - 0.03), 24), M.glass);
      glass.position.set(0, LH / 2, 0.036); lid.add(glass);
      const SW = LW - 0.36, SH = SW * 10 / 16, scr = screenCanvas(1280, 800);   // 16" 16:10 panel
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat(scr.tex));
      panel.position.set(0, LH - 0.25 - SH / 2, 0.038); lid.add(panel);
      const cam = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), M.hinge);
      cam.position.set(0, LH - 0.125, 0.039); lid.add(cam);
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, LW - 1.4, 32), M.hinge);
      hinge.rotation.z = Math.PI / 2; hinge.position.set(0, 0.02, -0.08); lid.add(hinge);

      const toCam = new THREE.Vector3(), lidN = new THREE.Vector3();
      let lastLed = 0;
      return {
        rig, scr, panel, KH: 10.5, dockFit: 0.64, portrait: false,
        // dock: seen from the screen centre the corner laptop looks shifted up-left, so the slot is nudged
        dockNudge: { x: 0.55, y: 0.55 },
        open: o => { lid.rotation.x = Math.PI / 2 - o * (Math.PI / 2 + 0.3); },   // 0 = shut, 1 = a little past upright
        // Slash Lighting: animate only while the lid's back faces the camera (closed in the intro, or spinning round)
        tick: now => {
          if (now - lastLed < 40) return false;
          lid.getWorldDirection(lidN).negate();
          back.getWorldPosition(toCam); toCam.subVectors(camera.position, toCam).normalize();
          if (lidN.dot(toCam) < 0.05) return false;
          lastLed = now; drawLeds(now / 1000); ledTex.needsUpdate = true;
          return true;
        },
        hero: { rx: 0.3, ry: -0.5, rz: 0.02 }, big: { rx: 0.12, ry: Math.PI * 2 - 0.16, rz: 0 },
        parked: [{ rx: 0.16, ry: 0.12, rz: 0 }, { rx: 0.18, ry: -0.1, rz: 0 }, { rx: 0.15, ry: 0.06, rz: 0 }, { rx: 0.17, ry: -0.08, rz: 0 }]
      };
    }

    /* ---- phone (mobile): the owner's Galaxy S24 Ultra in Titanium Gray, to scale (1 unit = 1 cm: 7.9 x 16.23 x 0.86).
       Flat titanium frame with tight corners, flat display with a centred punch-hole, right-side keys, S Pen slot,
       and the back camera layout (three big lenses in a column, the periscope lens, flash and laser AF beside them). No logos. ---- */
    function buildPhone() {
      const PW = 7.9, PH = 16.23, PT = 0.78, R = 0.5, BEV = 0.04;
      const M = {
        frame: new THREE.MeshStandardMaterial({ color: srgb('#8f8d89'), roughness: 0.36, metalness: 0.85, envMapIntensity: 1.0 }),
        glass: new THREE.MeshStandardMaterial({ color: srgb('#050506'), roughness: 0.2, envMapIntensity: 0.5, ...decal }),
        back: new THREE.MeshStandardMaterial({ color: srgb('#7e7d79'), roughness: 0.55, metalness: 0.12, envMapIntensity: 0.6, ...decal }),
        ring: new THREE.MeshStandardMaterial({ color: srgb('#8c8a86'), roughness: 0.3, metalness: 0.9 }),
        lens: new THREE.MeshStandardMaterial({ color: srgb('#060608'), roughness: 0.06, metalness: 0.3, envMapIntensity: 1.4 }),
        flash: new THREE.MeshStandardMaterial({ color: srgb('#e9e4d4'), roughness: 0.3, emissive: new THREE.Color(0.08, 0.08, 0.07) }),
        dark: new THREE.MeshBasicMaterial({ color: 0x0a0a0b })
      };
      const rig = new THREE.Group();
      // titanium frame: flat sides, small bevel, tight corners
      const g = new THREE.ExtrudeGeometry(rounded(PW, PH, R), { depth: PT, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 4, curveSegments: 24 });
      g.translate(0, 0, -PT / 2);
      rig.add(new THREE.Mesh(g, M.frame));
      const FZ = PT / 2 + BEV + 0.002;
      const sheet = (w, h, r, mat, z, flip) => {
        const m = new THREE.Mesh(new THREE.ShapeGeometry(rounded(w, h, r), 24), mat);
        m.position.z = z; if (flip) m.rotation.y = Math.PI; rig.add(m); return m;
      };
      sheet(PW - 0.12, PH - 0.12, R - 0.06, M.glass, FZ);                 // front glass, edge to edge
      // display: thin even bezels (~1.8 mm), small rounded corners
      const SW = PW - 0.36, SH = PH - 0.36, scr = screenCanvas(600, 1273);
      const pg = new THREE.ShapeGeometry(rounded(SW, SH, 0.34), 24);
      (() => { const uv = pg.attributes.uv, pos = pg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / SW + 0.5, pos.getY(i) / SH + 0.5); uv.needsUpdate = true; })();
      const panel = new THREE.Mesh(pg, screenMat(scr.tex));
      panel.position.z = FZ + 0.002; panel.userData = { w: SW, h: SH }; rig.add(panel);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32), M.dark);   // punch-hole selfie camera
      hole.position.set(0, PH / 2 - 0.62, FZ + 0.004); rig.add(hole);
      sheet(PW - 0.12, PH - 0.12, R - 0.06, M.back, -FZ, true);            // matte back glass
      // right-side keys (front view): volume rocker above the power key
      const key = (y, h) => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.34), M.frame); k.position.set(PW / 2 + BEV + 0.02, y, 0); rig.add(k); };
      key(3.6, 1.9); key(1.5, 1.0);
      // bottom edge: S Pen slot (left), USB-C (centre), speaker grille (right)
      const edge = (x, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, h), M.dark); m.position.set(x, -PH / 2 - BEV - 0.006, 0); rig.add(m); };
      edge(-2.3, 0.75, 0.32); edge(0, 0.85, 0.26);
      for (let i = 0; i < 6; i++) edge(1.6 + i * 0.22, 0.1, 0.1);
      // back cameras (seen from behind the column is top-left; in model space that is +x)
      const lens = (x, y, r) => {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.14, 48), M.ring);
        ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -FZ - 0.07); rig.add(ring);
        const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 48), M.lens);
        glass.position.set(x, y, -FZ - 0.141); glass.rotation.y = Math.PI; rig.add(glass);
      };
      const CX = PW / 2 - 1.55;
      lens(CX, PH / 2 - 1.75, 0.6); lens(CX, PH / 2 - 3.3, 0.6); lens(CX, PH / 2 - 4.85, 0.6);
      lens(CX - 1.45, PH / 2 - 1.75, 0.42);                                // periscope (5x) beside the top lens
      const dot = (y, r, mat) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat); m.position.set(CX - 1.45, y, -FZ - 0.003); m.rotation.y = Math.PI; rig.add(m); };
      dot(PH / 2 - 3.05, 0.17, M.flash); dot(PH / 2 - 3.6, 0.11, M.dark);   // flash, laser AF
      return {
        rig, scr, panel, KH: 18, dockFit: 0.95, portrait: true, dockNudge: { x: 0.53, y: 0.54 },
        open: () => {},
        hero: { rx: 0.08, ry: -0.42, rz: 0.04 }, big: { rx: 0.04, ry: Math.PI * 2 + 0.1, rz: 0 },
        parked: [{ rx: 0.05, ry: 0.12, rz: 0 }, { rx: 0.06, ry: -0.1, rz: 0 }, { rx: 0.04, ry: 0.08, rz: 0 }, { rx: 0.05, ry: -0.08, rz: 0 }]
      };
    }
    const LAPTOP = buildLaptop(), PHONE = buildPhone();
    scene.add(LAPTOP.rig, PHONE.rig);
    renderer.compile(scene, camera);   // compile every shader program up front, under the boot screen, not mid-animation
    let dev = LAPTOP;

    /* ---- screens: drawn on a canvas, never fake app screenshots; only facts from the page ---- */
    const GH = { bg: '#0d1117', bar: '#161b22', line: '#30363d', ink: '#e6edf3', dim: '#9198a1', link: '#4493f8' };
    function wrap(g, text, x, y, maxW, lh, maxLines = 9) {
      const words = text.split(' ');
      let line = '', n = 0;
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines) return y; }
        else line = t;
      }
      if (line) { g.fillText(line, x, y); y += lh; }
      return y;
    }
    function fit(g, text, weight, size, family, maxW, min) {
      let fs = size; g.font = `${weight} ${fs}px ${family}`;
      while (g.measureText(text).width > maxW && fs > min) { fs -= 2; g.font = `${weight} ${fs}px ${family}`; }
      return fs;
    }
    function pill(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
    function addressBar(g, w, k, text) {
      g.fillStyle = GH.bar; g.fillRect(0, 0, w, 66 * k);
      g.fillStyle = '#21262d'; pill(g, 24 * k, 14 * k, w - 48 * k, 38 * k, 19 * k); g.fill();
      g.fillStyle = GH.dim; g.font = `500 ${20 * k}px "JetBrains Mono", monospace`; g.textBaseline = 'middle';
      g.fillText(text, 44 * k, 34 * k); g.textBaseline = 'alphabetic';
    }
    const SANS = '"Inter Tight", Arial, sans-serif', MONO = '"JetBrains Mono", monospace';
    // parked: the device is ~100px wide, so the screen shows one big line instead of a page
    function bigCard(g, w, h, k, bg, fg, sub, top, main, cursor) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillStyle = sub; g.font = `600 ${70 * k}px ${SANS}`;
      g.fillText(top, w / 2, h * 0.24);
      const fs = fit(g, main, 800, 260 * k, SANS, w * 0.88, 40 * k);
      g.fillStyle = fg; g.fillText(main, w / 2, h * 0.58);
      if (cursor) { const tw = g.measureText(main).width; g.fillStyle = '#ff5714'; g.fillRect(w / 2 + tw / 2 + 10 * k, h * 0.58 - fs * 0.38, fs * 0.42, fs * 0.76); }
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    }
    const SMALL = {
      type: (g, w, h, k, d, st) => bigCard(g, w, h, k, '#121211', '#ecebe6', '#8a877f', 'C:\\', d.name.slice(0, st.typed) || ' ', st.typed < d.name.length || st.blink),
      repo: (g, w, h, k, d) => bigCard(g, w, h, k, GH.bg, GH.ink, GH.dim, 'GitHub', d.repo.split('/')[1]),
      profile: (g, w, h, k) => bigCard(g, w, h, k, GH.bg, GH.ink, GH.dim, 'GitHub', 'Burthcer'),
      mail: (g, w, h, k) => bigCard(g, w, h, k, '#ffffff', '#1f1f1f', '#5f6368', 'New message', 'Email Dev'),
      resume: (g, w, h, k) => bigCard(g, w, h, k, '#fafaf7', '#111111', '#666666', 'resume.html', 'Resume'),
      linkedin: (g, w, h, k) => bigCard(g, w, h, k, '#1b1f23', '#ffffff', '#a0a7ae', 'linkedin.com', 'LinkedIn'),
      devto: (g, w, h, k) => bigCard(g, w, h, k, '#0a0a0a', '#f5f5f5', '#a3a3a3', 'dev.to', 'DEV')
    };
    const S = {
      // the section's file being typed out, like the dock caption
      type(g, w, h, k, d, st) {
        g.fillStyle = '#121211'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1c1b19'; g.fillRect(0, 0, w, 70 * k);
        const nm = 'C:\\' + d.name.slice(0, st.typed);
        g.font = `500 ${30 * k}px ${MONO}`; g.textBaseline = 'middle'; g.fillStyle = '#aaa79e';
        g.fillText(nm, 40 * k, 37 * k);
        if (st.typed < d.name.length || st.blink) { g.fillStyle = '#ff5714'; g.fillRect(40 * k + g.measureText(nm).width + 6 * k, 20 * k, 16 * k, 34 * k); }
        g.textBaseline = 'alphabetic'; g.fillStyle = '#ecebe6';
        const fs = fit(g, d.sub, 800, 112 * k, SANS, w - 110 * k, 40 * k);
        const y = wrap(g, d.sub, 56 * k, 150 * k + fs, w - 110 * k, fs * 1.05, 3);
        g.fillStyle = '#75726a'; g.font = `500 ${30 * k}px ${MONO}`; g.fillText(d.tags, 60 * k, y + 20 * k);
        g.fillStyle = '#242320';
        const L = [0.8, 0.7, 0.85, 0.5, 0.74, 0.6, 0.82, 0.66];
        for (let i = 0, yy = y + 110 * k; yy < h - 40 * k && i < 14; i++, yy += 50 * k) g.fillRect(60 * k, yy, (w - 120 * k) * L[i % 8], 18 * k);
      },
      // the project's GitHub repository (title, visibility, description from this page)
      repo(g, w, h, k, d) {
        const [owner, name] = d.repo.split('/');
        g.fillStyle = GH.bg; g.fillRect(0, 0, w, h);
        addressBar(g, w, k, 'github.com/' + d.repo);
        let y = 140 * k;
        g.font = `400 ${34 * k}px ${SANS}`; g.fillStyle = GH.link;
        g.fillText(owner + ' / ', 48 * k, y);
        const ox = 48 * k + g.measureText(owner + ' / ').width;
        g.font = `700 ${34 * k}px ${SANS}`; g.fillText(name, ox, y);
        const px = ox + g.measureText(name).width + 18 * k;
        g.strokeStyle = GH.line; g.lineWidth = 2 * k; pill(g, px, y - 28 * k, 92 * k, 36 * k, 18 * k); g.stroke();
        g.fillStyle = GH.dim; g.font = `500 ${20 * k}px ${SANS}`; g.fillText('Public', px + 16 * k, y - 4 * k);
        y += 56 * k;
        g.font = `500 ${24 * k}px ${SANS}`;
        let tx = 48 * k;
        ['Code', 'Issues', 'Pull requests', 'Actions'].forEach((t, i) => {
          g.fillStyle = i ? GH.dim : GH.ink; g.fillText(t, tx, y);
          if (!i) { g.fillStyle = '#f78166'; g.fillRect(tx - 6 * k, y + 16 * k, g.measureText(t).width + 12 * k, 4 * k); }
          tx += g.measureText(t).width + 40 * k;
        });
        g.fillStyle = GH.line; g.fillRect(0, y + 20 * k, w, 2 * k);
        y += 80 * k;
        g.fillStyle = GH.ink; g.font = `400 ${28 * k}px ${SANS}`;
        y = wrap(g, d.desc, 48 * k, y, w - 96 * k, 40 * k, 4);
        g.fillStyle = '#238636'; pill(g, 48 * k, y, 130 * k, 50 * k, 10 * k); g.fill();
        g.fillStyle = '#fff'; g.font = `600 ${22 * k}px ${SANS}`; g.fillText('<>  Code', 66 * k, y + 33 * k);
        y += 86 * k;
        g.strokeStyle = GH.line; pill(g, 48 * k, y, w - 96 * k, h - y - 40 * k, 12 * k); g.stroke();
        g.fillStyle = GH.dim; g.font = `600 ${20 * k}px ${SANS}`; g.fillText('README', 72 * k, y + 40 * k);
        g.fillStyle = GH.line; g.fillRect(48 * k, y + 62 * k, w - 96 * k, 2 * k);
        g.fillStyle = GH.ink; g.font = `800 ${58 * k}px ${SANS}`; g.fillText(name, 72 * k, y + 140 * k);
        g.fillStyle = GH.dim; g.font = `500 ${22 * k}px ${MONO}`; g.fillText(d.tags, 74 * k, y + 186 * k);
        g.fillStyle = '#21262d';
        for (let i = 0, yy = y + 230 * k; yy < h - 70 * k && i < 10; i++, yy += 42 * k) g.fillRect(74 * k, yy, (w - 160 * k) * [0.9, 0.75, 0.84, 0.6][i % 4], 14 * k);
      },
    };

    /* ---- contact: a browser with three tabs (Gmail, GitHub, resume) that switches tabs like Edge/Chrome ----
       GitHub and the resume are real screenshots (assets/js/shots.js, tools/capture-shots.js); Gmail is drawn, since it needs a login */
    const shotImg = {};
    Object.entries(window.SHOTS || {}).forEach(([k, v]) => ['wide', 'tall'].forEach(s => {
      const im = new Image(); im.onload = () => { shownSig = ''; }; im.src = v[s]; shotImg[k + s] = im;
    }));
    const TABS = [
      { id: 'mail', title: 'New Message - Gmail', url: 'mail.google.com/mail/u/0/#inbox?compose=new' },
      { id: 'resume', title: 'Resume | Dev Bhamaria', url: 'devbhamaria.com/resume.html' },
      { id: 'profile', title: 'Burthcer · GitHub', url: 'github.com/Burthcer' },
      { id: 'linkedin', title: 'LinkedIn | Dev Bhamaria', url: 'linkedin.com/in/dev-bhamaria-22b1503ab' },
      { id: 'devto', title: 'DEV Community | Dev Bhamaria', url: 'dev.to/burthcer' }
    ];
    const PAGE_BG = { mail: '#1b1b1b', profile: '#0d1117', resume: '#151514', linkedin: '#000000', devto: '#0a0a0a' };
    const UI = '"Segoe UI", Arial, sans-serif';
    function favicon(g, id, x, y, r) {   // simple marks, not the real logos
      if (id === 'mail') { g.strokeStyle = '#ea4335'; g.lineWidth = r * 0.22; g.strokeRect(x - r, y - r * 0.7, r * 2, r * 1.4); g.beginPath(); g.moveTo(x - r, y - r * 0.7); g.lineTo(x, y + r * 0.1); g.lineTo(x + r, y - r * 0.7); g.stroke(); }
      else if (id === 'profile') { g.fillStyle = '#f0f6fc'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0d1117'; g.beginPath(); g.arc(x, y + r * 0.1, r * 0.55, 0, Math.PI * 2); g.fill(); }
      else if (id === 'linkedin' || id === 'devto') { g.fillStyle = id === 'linkedin' ? '#0a66c2' : '#f5f5f5'; pill(g, x - r, y - r, r * 2, r * 2, r * 0.25); g.fill(); g.fillStyle = id === 'linkedin' ? '#fff' : '#0a0a0a'; g.font = `800 ${r * (id === 'linkedin' ? 1.2 : 0.8)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(id === 'linkedin' ? 'in' : 'DEV', x, y + r * 0.08); g.textAlign = 'left'; }
      else { g.fillStyle = '#ff5714'; pill(g, x - r, y - r, r * 2, r * 2, r * 0.4); g.fill(); g.fillStyle = '#0c0c0b'; g.font = `800 ${r * 1.3}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D', x, y + r * 0.08); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
    }
    const clip = (g, t, max) => { if (g.measureText(t).width <= max) return t; while (t.length > 1 && g.measureText(t + '...').width > max) t = t.slice(0, -1); return t + '...'; };
    function chromeWide(g, w, active) {
      g.fillStyle = '#202124'; g.fillRect(0, 0, w, 52);
      const tw = Math.min(292, Math.floor((w - 250) / TABS.length) - 2);
      TABS.forEach((t, i) => {
        const x = 10 + i * (tw + 2), on = t.id === active;
        if (on) { g.fillStyle = '#35363a'; pill(g, x, 8, tw, 52, 10); g.fill(); }
        else if (i && TABS[i - 1].id !== active) { g.fillStyle = '#4a4c50'; g.fillRect(x - 1, 18, 2, 22); }
        favicon(g, t.id, x + 22, 30, 8);
        g.fillStyle = on ? '#e8eaed' : '#9aa0a6'; g.font = `400 15px ${UI}`; g.textBaseline = 'middle';
        g.fillText(clip(g, t.title, tw - 80), x + 40, 30);
        g.strokeStyle = g.fillStyle; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + tw - 26, 25); g.lineTo(x + tw - 16, 35); g.moveTo(x + tw - 16, 25); g.lineTo(x + tw - 26, 35); g.stroke();
      });
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 1.6; const px = 10 + TABS.length * (tw + 2) + 18;
      g.beginPath(); g.moveTo(px, 30); g.lineTo(px + 14, 30); g.moveTo(px + 7, 23); g.lineTo(px + 7, 37); g.stroke();
      g.beginPath(); g.moveTo(w - 128, 30); g.lineTo(w - 116, 30); g.stroke();          // window controls
      g.strokeRect(w - 80, 24, 12, 12);
      g.beginPath(); g.moveTo(w - 34, 24); g.lineTo(w - 22, 36); g.moveTo(w - 22, 24); g.lineTo(w - 34, 36); g.stroke();
      g.fillStyle = '#35363a'; g.fillRect(0, 52, w, 52);                                   // toolbar
      g.strokeStyle = '#c4c7c5'; g.lineWidth = 2;
      const arrow = (x, dir) => { g.beginPath(); g.moveTo(x + 8 * dir, 70); g.lineTo(x, 78); g.lineTo(x + 8 * dir, 86); g.moveTo(x, 78); g.lineTo(x + 16 * dir, 78); g.stroke(); };
      arrow(22, 1); g.strokeStyle = '#6b6e72'; arrow(78, -1); g.strokeStyle = '#c4c7c5';
      g.beginPath(); g.arc(110, 78, 8, -0.3, Math.PI * 1.6); g.stroke();
      g.fillStyle = '#202124'; pill(g, 140, 60, w - 240, 36, 18); g.fill();
      g.strokeStyle = '#9aa0a6'; g.lineWidth = 1.6; g.strokeRect(160, 76, 10, 8); g.beginPath(); g.arc(165, 76, 4, Math.PI, 0); g.stroke();   // lock
      g.fillStyle = '#e8eaed'; g.font = `400 16px ${UI}`; g.fillText(TABS.find(t => t.id === active).url, 184, 79);
      g.fillStyle = '#5f6368'; g.beginPath(); g.arc(w - 50, 78, 14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8eaed'; g.font = `600 13px ${UI}`; g.textAlign = 'center'; g.fillText('D', w - 50, 79); g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      return 104;
    }
    function chromeTall(g, w, active) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, 40);
      g.fillStyle = '#202124'; g.fillRect(0, 40, w, 90);
      g.fillStyle = '#303134'; pill(g, 76, 60, w - 196, 50, 25); g.fill();
      g.strokeStyle = '#c4c7c5'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(22, 88); g.lineTo(38, 72); g.lineTo(54, 88); g.moveTo(28, 84); g.lineTo(28, 100); g.lineTo(48, 100); g.lineTo(48, 84); g.stroke();   // home
      g.fillStyle = '#e8eaed'; g.font = `400 22px ${UI}`; g.textBaseline = 'middle';
      g.fillText(clip(g, TABS.find(t => t.id === active).url, w - 250), 100, 86);
      g.strokeRect(w - 100, 72, 30, 30); g.font = `600 17px ${UI}`; g.textAlign = 'center'; g.fillText(String(TABS.length), w - 85, 88); g.textAlign = 'left';   // tab count
      g.fillStyle = '#c4c7c5'; [74, 86, 98].forEach(y => { g.beginPath(); g.arc(w - 34, y, 3, 0, Math.PI * 2); g.fill(); });
      g.textBaseline = 'alphabetic';
      return 130;
    }
    function gmailWide(g, w, h, y0, st) {
      g.fillStyle = '#f6f8fc'; g.fillRect(0, y0, w, h - y0);
      g.strokeStyle = '#444746'; g.lineWidth = 2; [0, 7, 14].forEach(d => { g.beginPath(); g.moveTo(24, y0 + 28 + d); g.lineTo(44, y0 + 28 + d); g.stroke(); });
      g.fillStyle = '#5f6368'; g.font = `400 24px ${UI}`; g.fillText('Gmail', 66, y0 + 44);
      g.fillStyle = '#e9eef6'; pill(g, 250, y0 + 12, 660, 46, 23); g.fill();
      g.fillStyle = '#5f6368'; g.font = `400 16px ${UI}`; g.fillText('Search mail', 300, y0 + 41);
      g.fillStyle = '#c2e7ff'; pill(g, 14, y0 + 78, 140, 54, 16); g.fill();
      g.fillStyle = '#001d35'; g.font = `500 15px ${UI}`; g.fillText('Compose', 62, y0 + 111);
      ['Inbox', 'Starred', 'Snoozed', 'Sent', 'Drafts'].forEach((t, i) => {
        if (!i) { g.fillStyle = '#d3e3fd'; pill(g, 0, y0 + 148, 230, 32, 16); g.fill(); }
        g.fillStyle = '#1f1f1f'; g.font = `${i ? 400 : 600} 14px ${UI}`; g.fillText(t, 56, y0 + 169 + i * 34);
      });
      g.fillStyle = '#fff'; pill(g, 246, y0 + 72, w - 262, h - y0 - 84, 16); g.fill();
      for (let i = 0; i < 12; i++) {   // blurred-out inbox rows, nothing made up
        const ry = y0 + 100 + i * 44; if (ry > h - 30) break;
        g.fillStyle = '#e6e8eb'; g.fillRect(290, ry, 150, 10); g.fillRect(480, ry, 420 - (i * 37) % 160, 10);
        g.fillStyle = '#f1f3f4'; g.fillRect(246, ry + 26, w - 262, 1);
      }
      const cx = w - 560, cy = h - 470, cw = 540;   // compose window
      g.fillStyle = 'rgba(0,0,0,.18)'; pill(g, cx - 2, cy + 4, cw + 4, 470, 12); g.fill();
      g.fillStyle = '#fff'; pill(g, cx, cy, cw, 470, 10); g.fill();
      g.fillStyle = '#f2f6fc'; pill(g, cx, cy, cw, 42, 10); g.fill(); g.fillRect(cx, cy + 30, cw, 12);
      g.fillStyle = '#041e49'; g.font = `500 15px ${UI}`; g.fillText('New Message', cx + 16, cy + 27);
      const row = (yy, label, val) => { g.fillStyle = '#5f6368'; g.font = `400 15px ${UI}`; g.fillText(label, cx + 16, yy); g.fillStyle = '#1f1f1f'; g.fillText(val, cx + 16 + g.measureText(label).width + 10, yy); g.fillStyle = '#e8eaed'; g.fillRect(cx + 16, yy + 14, cw - 32, 1); };
      row(cy + 72, 'To', 'dev.bhamaria@gmail.com'); row(cy + 112, 'Subject', 'Hello Dev');
      typeBody(g, cx + 16, cy + 152, cw - 32, 15, 24, st);
      g.fillStyle = '#0b57d0'; pill(g, cx + 16, cy + 470 - 60, 92, 40, 20); g.fill();
      g.fillStyle = '#fff'; g.font = `500 15px ${UI}`; g.fillText('Send', cx + 44, cy + 470 - 34);
    }
    function gmailTall(g, w, h, y0, st) {
      g.fillStyle = '#fff'; g.fillRect(0, y0, w, h - y0);
      g.strokeStyle = '#444746'; g.lineWidth = 3; g.beginPath(); g.moveTo(46, y0 + 40); g.lineTo(30, y0 + 56); g.lineTo(46, y0 + 72); g.moveTo(30, y0 + 56); g.lineTo(62, y0 + 56); g.stroke();
      g.fillStyle = '#1f1f1f'; g.font = `500 28px ${UI}`; g.fillText('Compose', 90, y0 + 66);
      g.fillStyle = '#0b57d0'; g.beginPath(); g.moveTo(w - 70, y0 + 40); g.lineTo(w - 30, y0 + 56); g.lineTo(w - 70, y0 + 72); g.lineTo(w - 62, y0 + 56); g.fill();   // send
      const row = (yy, label, val) => { g.fillStyle = '#5f6368'; g.font = `400 24px ${UI}`; g.fillText(label, 30, yy); g.fillStyle = '#1f1f1f'; g.fillText(val, 30 + g.measureText(label).width + 16, yy); g.fillStyle = '#e8eaed'; g.fillRect(0, yy + 24, w, 2); };
      row(y0 + 150, 'To', 'dev.bhamaria@gmail.com'); row(y0 + 220, 'Subject', 'Hello Dev');
      typeBody(g, 30, y0 + 300, w - 60, 24, 36, st);
    }
    function typeBody(g, x, y, mw, fs, lh, st) {
      const msg = 'Hi Dev, I went through your portfolio and IHatePDF. Are you open to an internship conversation this month?';
      const n = Math.min(msg.length, st.mailChars);
      g.fillStyle = '#1f1f1f'; g.font = `400 ${fs}px ${UI}`;
      const end = wrap(g, msg.slice(0, n), x, y, mw, lh, 10);
      if (st.blink || n < msg.length) g.fillRect(x, end - lh * 0.95, 2, fs * 1.2);
    }
    function browser(g, w, h, active, st) {
      g.fillStyle = '#202124'; g.fillRect(0, 0, w, h);
      const tall = dev.portrait, y0 = tall ? chromeTall(g, w, active) : chromeWide(g, w, active);
      // while the device moves, the page area is just the page's own dark colour: the live browser (sharp, clickable) is the one picture of each page,
      // so there is no older-looking screenshot that gets swapped for it a moment later
      g.fillStyle = PAGE_BG[active] || '#0d1117'; g.fillRect(0, y0, w, h - y0);
    }
    ['mail', 'profile', 'resume', 'linkedin', 'devto'].forEach(t => { S[t] = (g, w, h, k, d, st) => browser(g, w, h, t, st); });
    const URLS = { repo: d => 'https://github.com/' + d.repo, profile: () => 'https://github.com/Burthcer', linkedin: () => 'https://www.linkedin.com/in/dev-bhamaria-22b1503ab', devto: () => 'https://dev.to/burthcer', mail: () => 'mailto:dev.bhamaria@gmail.com', resume: () => 'resume.html' };
    const LABEL = { repo: d => `Open ${d.repo.split('/')[1]} on GitHub`, profile: () => 'Open github.com/Burthcer', linkedin: () => 'Open LinkedIn', devto: () => 'Open DEV', mail: () => 'Write an email to Dev', resume: () => 'Open the resume' };

    // every [data-stop] element is one screen: add a project article and it gets its own screen + pose
    const stops = $$('[data-stop]');
    const DISKS = stops.map(el => ({ name: el.dataset.file, sub: el.dataset.sub, tags: el.dataset.tags, repo: el.dataset.repo, desc: el.dataset.desc, land: el.dataset.land || (el.dataset.repo ? 'repo' : null) }));
    const order = DISKS.map((_, i) => i);
    /* ---- the browser on the screen at Contact: real HTML (sharp, clickable, scrollable), GitHub open by default ---- */
    const sui = $('#sui'), suiTabs = $$('[data-tab]', sui), suiPages = $$('[data-page]', sui);
    const TAB = { mail: ['mail.google.com/mail/u/0/#inbox?compose=new', 'mailto:dev.bhamaria@gmail.com'], resume: ['devbhamaria.com/resume.html', 'resume.html'], profile: ['github.com/Burthcer', 'https://github.com/Burthcer'], linkedin: ['linkedin.com/in/dev-bhamaria-22b1503ab', 'https://www.linkedin.com/in/dev-bhamaria-22b1503ab'], devto: ['dev.to/burthcer', 'https://dev.to/burthcer'] };
    let uiTab = 'profile', hist = ['profile'], hi = 0;   // tab history for back / forward
    const navBtn = n => $(`[data-act="${n}"]`, sui);
    function setTab(t, fromHistory) {
      if (!fromHistory && t !== hist[hi]) { hist = hist.slice(0, hi + 1); hist.push(t); hi = hist.length - 1; }
      navBtn('back').disabled = hi === 0; navBtn('fwd').disabled = hi === hist.length - 1;
      uiTab = t;
      suiTabs.forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
      suiPages.forEach(pg => { pg.hidden = pg.dataset.page !== t; });
      $$('[data-url]', sui).forEach(u => { u.textContent = TAB[t][0]; });
      $$('[data-open]', sui).forEach(o => { o.href = TAB[t][1]; if (t === 'mail') o.removeAttribute('target'); else o.target = '_blank'; });
      $$('[data-card]', sui).forEach(c => c.setAttribute('aria-current', c.dataset.card === t));
      if (t === 'resume') { const f = $('iframe', sui); if (!f.src) f.src = f.dataset.src; }   // load the resume only when asked for
    }
    suiTabs.forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    navBtn('back').addEventListener('click', () => { if (hi > 0) setTab(hist[--hi], true); });
    navBtn('fwd').addEventListener('click', () => { if (hi < hist.length - 1) setTab(hist[++hi], true); });
    navBtn('reload').addEventListener('click', () => {
      const pg = $(`[data-page="${uiTab}"]`, sui); pg.scrollTop = 0;
      const f = $('iframe', pg); if (f && f.src) f.src = f.src;
    });
    // GitHub page: Overview / Repositories switch inside the page, like the real profile
    $$('[data-gh]', sui).forEach(b => b.addEventListener('click', () => {
      $$('[data-gh]', sui).forEach(x => x.toggleAttribute('aria-current', x === b));
      $$('[data-gh-view]', sui).forEach(v => { v.hidden = v.dataset.ghView !== b.dataset.gh; });
      $('[data-page="profile"]', sui).scrollTop = 0;
    }));
    $('[data-mail]', sui).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.currentTarget;
      location.href = 'mailto:dev.bhamaria@gmail.com?subject=' + encodeURIComponent(f.subject.value) + '&body=' + encodeURIComponent(f.body.value);
    });
    // the contact buttons switch tabs too, after the pointer rests on one for a moment (a mouse passing over does nothing)
    const DWELL = 250;
    let dwellTimer = 0;
    $$('[data-shows]').forEach(el => {
      el.addEventListener('pointerenter', () => { clearTimeout(dwellTimer); dwellTimer = setTimeout(() => setTab(el.dataset.shows), DWELL); });
      el.addEventListener('pointerleave', () => clearTimeout(dwellTimer));
      el.addEventListener('focus', () => setTab(el.dataset.shows));
    });
    setTab('profile');

    // map the 640x400 (laptop) or 360x763 (phone) browser onto the 4 projected corners of the 3D screen (square-to-quad homography)
    function quad(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
      const den = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
      const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
      return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1].map(n => +n.toFixed(6)).join(',') + ')';
    }
    const corners = [0, 1, 2, 3].map(() => new THREE.Vector3());
    let uiOn = false, uiSig = '';
    function placeUI(show) {
      if (show !== uiOn) {
        uiOn = show;
        if (show) { sui.classList.toggle('tall', dev.portrait); sui.hidden = false; requestAnimationFrame(() => sui.classList.add('on')); }
        else { sui.classList.remove('on'); sui.hidden = true; }   // gone at once when the device starts to move
        // while the live browser covers the screen, the 3D screen picture under it is hidden: only black glass is left,
        // so a sub-pixel gap at the edge never shows a light line
        dev.panel.visible = !show;
      }
      if (!show) return;
      const pr = dev.panel.userData.w ? { width: dev.panel.userData.w, height: dev.panel.userData.h } : dev.panel.geometry.parameters, hw = pr.width / 2, hh = pr.height / 2;
      [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].forEach(([x, y], i) => corners[i].set(x, y, 0).applyMatrix4(dev.panel.matrixWorld).project(camera));
      const m = quad(dev.portrait ? 360 : 640, dev.portrait ? 763 : 400, corners.map(v => [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]));
      if (m !== uiSig) { uiSig = m; sui.style.transform = m; }
    }
    let calm = 0;   // 1 at Contact: no idle float or mouse tilt, so the browser holds still under the cursor

    /* ---- choreography: one pose per stop, generated so any number of sections works ----
       first = hero (big beside the headline), last = finale (returns big), everything between parks in the dock */
    function KF(i) {
      if (i === 0) return { ...dev.hero, mode: 'hero' };
      if (i === stops.length - 1) return { ...dev.big, mode: 'big' };
      return { ...dev.parked[(i - 1) % dev.parked.length], mode: 'dock' };
    }
    const capName = $('#capName');
    let sayTimer = 0;

    let slot = { x: 0, y: 0, s: 100 }, stage = { x: 0, y: 0, s: 100 }, cstage = { x: 0, y: 0, s: 100 };
    const stageEl = $('#heroStage'), cstageEl = $('#contactStage');
    const wide = () => W >= 900;
    // phones: tap the parked phone at Contact and it comes forward, big, with a Chrome-style browser on its screen
    // po: how open it is (0..1); pt: progress of the current open/close move; pFrom: where that move started.
    // The move is a fixed, eased timeline (not a chase), so it can't wobble or overshoot.
    let phoneOpen = false, po = 0, pt = 1, pFrom = null;
    // facing straight at you; ry keeps the same whole turn as the parked pose, so it never spins round to get there
    const openTarget = ry => { const P = phonePose(); return { x: P.x, y: P.y, s: P.s, rx: 0, ry: Math.round(ry / (2 * Math.PI)) * 2 * Math.PI, rz: 0, dock: 0 }; };
    const phonePose = () => {
      const hpx = Math.min(H - 84, (W - 36) * 16.23 / 7.9);   // leaves a border all round; the top gap holds the close button
      return { x: W / 2, y: H / 2 + 18, s: hpx * dev.KH / 16.23 };
    };
    const isDock = m => m === 'dock' || (m !== 'dock' && !wide());   // phones: the device always stays parked in the corner (no room to show it big)
    function pose(m) {
      if (m === 'hero') return wide() ? { x: W * 0.74, y: H * 0.5, s: Math.min(H * 0.52, W * 0.26) } : slot;
      if (m === 'big') return wide() ? { x: W * 0.762, y: H * 0.49, s: Math.min(H * 0.651, W * 0.3255) } : slot;   // desktop: a fixed spot clear of the email line; phones: the slot under the buttons
      return slot;
    }
    const rectSlot = (el, f) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.height * f }; };
    function measure() {
      renderer.setPixelRatio(wide() ? Math.min(Math.max(2, (devicePixelRatio || 1) * 1.5), 2.5) : Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      dev = wide() ? LAPTOP : PHONE;   // laptop on desktop, phone on phones
      if (wide() && phoneOpen) { phoneOpen = false; po = 0; pt = 1; root.classList.remove('phone-open', 'phone-z'); }   // turned the phone sideways into laptop layout
      LAPTOP.rig.visible = dev === LAPTOP; PHONE.rig.visible = dev === PHONE;
      const r = $('#dockSlot').getBoundingClientRect();
      slot = { x: r.left + r.width * dev.dockNudge.x, y: r.top + r.height * dev.dockNudge.y, s: r.height * dev.dockFit };
      shownSig = '';
    }

    let idx = 0, segT = 0, activeKey = null, typeStart = 0, landAt = 0, shownSig = '';
    let lastKind = '', kindAt = 0, fadeAt = -1e9, busy = true;
    const fadeCopy = document.createElement('canvas');
    const tgt = {}, cur = {};
    function read() {
      if (!dirty) return;
      const line = H * 0.5, tops = stops.map(el => el.getBoundingClientRect().top - line);
      idx = 0;
      tops.forEach((t, i) => { if (t <= 0) idx = i; });
      segT = 0;
      // phones: the hero and contact phones scroll with their slots in the page
      stage = rectSlot(stageEl, 0.95); cstage = rectSlot(cstageEl, wide() ? 1 : 0.95);
      // hero -> dock follows the first screen of scroll (desktop) or the slot leaving the screen (phones); later stops blend near the boundary
      if (idx === 0) segT = wide() ? smooth(0.06, 0.8, scrollY / H) : smooth(0, 1, (H * 0.2 - stage.y) / (H * 0.25));
      else if (idx < tops.length - 1) segT = smooth(0.45, 1, -tops[idx] / (tops[idx + 1] - tops[idx]));

      // the last move (dock <-> Contact) follows how much of the Contact section fills the view: the device is big only
      // while Contact is on screen, and heads back to the corner as soon as it starts to scroll away (it never lingers over Education)
      if (idx >= tops.length - 2) {
        idx = tops.length - 2;
        segT = wide()
          ? 1 - smooth(0.015, 0.2, (contactRest() - scrollY) / H)   // starts leaving with the first bit of scroll up from where Contact rests
          : (r => smooth(0.15, 0.9, (H - r.top) / r.height))(cstageEl.getBoundingClientRect());
      }
      const k = order[segT > 0.5 ? Math.min(idx + 1, order.length - 1) : idx];
      if (k !== activeKey) setScreen(k);
    }
    function target() {
      const A = KF(order[idx]), B = KF(order[Math.min(idx + 1, order.length - 1)]), t = segT;
      const pa = pose(A.mode), pb = pose(B.mode);
      tgt.rx = A.rx + (B.rx - A.rx) * t;
      tgt.ry = A.ry + (B.ry - A.ry) * t;
      tgt.rz = A.rz + (B.rz - A.rz) * t;
      tgt.x = pa.x + (pb.x - pa.x) * t;
      tgt.y = pa.y + (pb.y - pa.y) * t;
      tgt.s = pa.s + (pb.s - pa.s) * (B.mode === 'big' ? t * t : t);   // flying out to Contact: rise first, grow late, so it never pokes past the bottom edge
      tgt.dock = (isDock(A.mode) ? 1 : 0) * (1 - t) + (isDock(B.mode) ? 1 : 0) * t;
      if (!wide() && phoneOpen && pt >= 1) Object.assign(tgt, openTarget(tgt.ry));   // opened: hold it straight and still in the middle
    }
    function setScreen(k) {
      activeKey = k;
      typeStart = performance.now();
      // type the file name, then land on the page (Contact skips the typing: its browser shows as soon as the device arrives)
      landAt = DISKS[k].land === 'contact' ? typeStart : typeStart + DISKS[k].name.length * 55 + 900;
      // announce the new file next to the dock for a moment
      dockEl.classList.add('say');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => dockEl.classList.remove('say'), 2600);
    }
    // what the screen shows right now: the typed file, or the page it lands on
    function shown(now) {
      const d = DISKS[activeKey];
      if (!d.land || (!reduce && now < landAt)) return 'type';
      if (d.land !== 'contact') return d.land;
      return uiTab;
    }
    function openShown() {
      const d = DISKS[activeKey], s = shown(performance.now());
      if (!URLS[s]) return false;
      const url = URLS[s](d);
      if (s === 'resume') location.href = url; else window.open(url, url.startsWith('mailto:') ? '_self' : '_blank', 'noopener');
      return true;
    }
    // the parked device opens the page on its screen; with nothing to open it goes back to the top
    dockEl.addEventListener('click', () => {
      if (!wide() && DISKS[activeKey].land === 'contact') { setPhone(true); return; }
      if (!openShown()) scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });

    // ---- the opened phone: veil, close button, history (the phone's back button closes it), Escape ----
    const closeBtn = $('#phoneClose');
    function setPhone(v) {
      if (v === phoneOpen || wide()) return;
      phoneOpen = v;
      pFrom = { ...cur };
      pt = reduce ? 1 : 0;
      root.classList.toggle('phone-open', v);
      if (v) {
        root.classList.add('phone-z');
        try { history.pushState({ phone: 1 }, ''); } catch (e) { /* ignore */ }
        closeBtn.focus({ preventScroll: true });
        cmReset(); cmToast();
      } else { cmReset(); }
      dirty = true;
    }
    const closePhone = () => { if (!phoneOpen) return; if (history.state && history.state.phone) history.back(); else setPhone(false); };
    addEventListener('popstate', () => { if (phoneOpen) setPhone(false); });
    closeBtn.addEventListener('click', closePhone);
    $('#phoneVeil').addEventListener('click', closePhone);
    addEventListener('keydown', e => { if (e.key === 'Escape' && phoneOpen) closePhone(); });

    // ---- Chrome-style controls on the phone screen ----
    const cmPop = $('.cm-pop', sui), cmSw = $('.cm-switcher', sui), cmGrid = $('[data-grid]', sui), cmT = $('.cm-toast', sui);
    const order5 = suiTabs.map(b => b.dataset.tab);
    suiTabs.forEach(b => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'cm-card'; c.dataset.card = b.dataset.tab;
      c.innerHTML = '<span class="cm-card-h"></span><span class="cm-card-b"></span>';
      $('.cm-card-h', c).append($('.fav', b).cloneNode(true), Object.assign(document.createElement('b'), { textContent: $('span', b).textContent }));
      $('.cm-card-b', c).textContent = TAB[b.dataset.tab][0];
      c.addEventListener('click', () => { setTab(b.dataset.tab); cmSw.hidden = true; });
      cmGrid.append(c);
    });
    $('[data-tabs-n]', sui).textContent = order5.length;
    $('[data-sw-title]', sui).textContent = order5.length + ' tabs';
    $$('[data-card]', sui).forEach(c => c.setAttribute('aria-current', c.dataset.card === uiTab));
    function cmReset() { cmPop.hidden = true; cmSw.hidden = true; $('[data-cm="menu"]', sui).setAttribute('aria-expanded', 'false'); }
    let toastDone = false;
    function cmToast() {
      if (toastDone) return;
      toastDone = true;
      setTimeout(() => { cmT.hidden = false; setTimeout(() => { cmT.hidden = true; }, 2800); }, 1200);
    }
    sui.addEventListener('click', e => {
      const b = e.target.closest('[data-cm]');
      if (!b) { if (!e.target.closest('.cm-pop')) cmPop.hidden = true; return; }
      const k = b.dataset.cm;
      if (k === 'switcher') { cmPop.hidden = true; cmSw.hidden = false; const c = $('[data-card][aria-current="true"]', sui); if (c) c.focus({ preventScroll: true }); }
      else if (k === 'sw-close') cmSw.hidden = true;
      else if (k === 'menu') { cmPop.hidden = !cmPop.hidden; b.setAttribute('aria-expanded', String(!cmPop.hidden)); }
      else if (k === 'reload') { navBtn('reload').click(); cmPop.hidden = true; }
      else if (k === 'close') { cmPop.hidden = true; closePhone(); }
    });
    // swipe the address bar sideways to change tab, like Chrome on a phone
    (() => {
      const bar = $('.cm-bar', sui);
      let x0 = null, y0 = 0;
      const go = d => {
        const n = order5.indexOf(uiTab) + d;
        if (n < 0 || n >= order5.length) return;
        setTab(order5[n]);
        const pg = $(`[data-page="${uiTab}"]`, sui);
        if (pg.animate && !reduce) pg.animate([{ transform: `translateX(${d * 46}px)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
      };
      bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; });
      bar.addEventListener('pointerup', e => {
        if (x0 === null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
      });
      bar.addEventListener('pointercancel', () => { x0 = null; });
    })();
    // the clock on the phone's status bar
    const clock = () => { const t = new Date(); $('[data-clock]', sui).textContent = (t.getHours() % 12 || 12) + ':' + String(t.getMinutes()).padStart(2, '0'); };
    clock();
    setInterval(clock, 20000);

    const pointer = { x: 0, y: 0 }, pcur = { x: 0, y: 0 };

    // click the big device: open the page on its screen, or (hero README) play Stay Offline
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let hot = false;
    function overDevice(e) {
      if (cur.dock > 0.2 || !introAt || !e.target.closest) return false;
      if (e.target.closest('a, button, input, textarea, select, dialog, .game, .sui')) return false;
      ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(dev.rig, true).length > 0;
    }
    addEventListener('pointermove', e => {
      const h = overDevice(e) && DISKS[activeKey].land !== 'contact';
      if (h !== hot) { hot = h; document.body.classList.toggle('disk-hot', h); }
    }, { passive: true });
    addEventListener('click', e => {
      if (!overDevice(e)) return;
      if (DISKS[activeKey].land === 'contact') return;   // at Contact only the browser on the screen is interactive, not the laptop body
      hot = false;
      document.body.classList.remove('disk-hot');
      if (!openShown() && window.StayOffline) window.StayOffline.open();
    });
    addEventListener('pointermove', e => { pointer.x = (e.clientX / W - 0.5) * 2; pointer.y = (e.clientY / H - 0.5) * 2; }, { passive: true });

    function draw(now, dt) {
      target();
      if (!wide() && pt < 1 && pFrom) {
        // opening / closing the phone: one eased move from where it was to where it goes, with a small turn in flight
        pt = Math.min(1, pt + dt / (phoneOpen ? 0.55 : 0.3));
        const e = pt < 0.5 ? 4 * pt * pt * pt : 1 - Math.pow(-2 * pt + 2, 3) / 2, to = phoneOpen ? openTarget(tgt.ry) : tgt;
        for (const p in to) cur[p] = pFrom[p] + (to[p] - pFrom[p]) * e;
        cur.ry += Math.sin(Math.PI * e) * (phoneOpen ? -0.3 : 0.3);
        po = phoneOpen ? e : 1 - e;
        if (pt >= 1 && !phoneOpen) root.classList.remove('phone-z');
      } else {
        const k = reduce ? 1 : 1 - Math.pow(0.003, dt);
        for (const p in tgt) cur[p] += (tgt[p] - cur[p]) * k;
        if (!wide() && tgt.dock < 0.01 && cur.dock < 0.05) { cur.x = tgt.x; cur.y = tgt.y; cur.s = tgt.s; }
        if (!wide()) po = phoneOpen ? 1 : 0;
      }
      pcur.x += (pointer.x - pcur.x) * Math.min(1, dt * 4);
      pcur.y += (pointer.y - pcur.y) * Math.min(1, dt * 4);

      // intro: the device rises into place, then the laptop lid opens
      // cubic ease-out: moves right away, settles gently (quartic felt snappy, smootherstep felt slow)
      const ip = reduce ? 1 : introAt ? clamp((now - introAt - 150) / 1900) : 0;
      const out3 = t => 1 - Math.pow(1 - t, 3), soft = t => t * t * (3 - 2 * t);
      const ie = out3(ip), lidIn = reduce ? 1 : soft(clamp((ip - 0.2) / 0.6));
      const atContact = DISKS[activeKey].land === 'contact' && cur.dock < 0.05;
      calm += ((atContact ? 1 : 0) - calm) * Math.min(1, dt * 4);
      if (!wide() && po > 0) calm = 1;   // no idle float or finger tilt while the phone is opening, open or closing
      const tt = now / 1000, idle = reduce ? 0 : 1, free = (1 - cur.dock * 0.7) * (1 - calm);
      const visH = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360), visW = visH * camera.aspect;
      const sc = Math.max(1e-3, cur.s / H * visH / dev.KH), rig = dev.rig;
      rig.position.set((cur.x / W - 0.5) * visW, -(cur.y / H - 0.5) * visH - (1 - ie) * visH * 0.4 + Math.sin(tt * 0.9) * 0.12 * sc * idle * free, 0);
      rig.scale.setScalar(sc * (0.8 + 0.2 * ie));
      rig.rotation.set(
        cur.rx + (pcur.y * 0.08 + Math.sin(tt * 0.7) * 0.02 * idle) * free,
        cur.ry - (1 - ie) * 0.8 + (pcur.x * 0.14 + Math.sin(tt * 0.5) * 0.03 * idle) * free,
        cur.rz);
      dev.open(lidIn);
      if (dev.tick) dev.tick(now);   // laptop: Slash Lighting on the lid

      // screen: redraw only when what it shows changes
      const d = DISKS[activeKey], s = shown(now);
      const st = {
        typed: reduce ? d.name.length : Math.min(d.name.length, Math.floor((now - typeStart) / 55)),
        blink: (now / 500 | 0) % 2 === 0,
        mailChars: 0
      };
      const small = cur.dock > 0.6, kind = `${small}|${activeKey}|${s}`;
      if (kind !== lastKind) {   // a new screen: keep a copy of the old one to fade out over it
        const tabSwitch = /\|(mail|profile|resume|linkedin|devto)$/.test(lastKind) && /\|(mail|profile|resume|linkedin|devto)$/.test(kind) && !small;
        if (lastKind && !reduce && !tabSwitch) { fadeCopy.width = dev.scr.c.width; fadeCopy.height = dev.scr.c.height; fadeCopy.getContext('2d').drawImage(dev.scr.c, 0, 0); fadeAt = now; }
        lastKind = kind; kindAt = now;
      }
      st.mailChars = reduce ? 999 : Math.floor((now - kindAt) / 40);
      const fade = clamp((now - fadeAt) / 300);
      const sig = `${kind}|${fade < 1 ? Math.round(fade * 20) : ''}|${s === 'type' ? st.typed : ''}|${s === 'type' || s === 'mail' ? st.blink : ''}|${s === 'mail' ? st.mailChars : ''}`;
      if (sig !== shownSig) {
        shownSig = sig;
        const { c, g, tex } = dev.scr;
        (small ? SMALL : S)[s](g, c.width, c.height, dev.portrait ? c.width / 640 : c.width / 1280, d, st);
        if (fade < 1 && fadeCopy.width === c.width) { g.globalAlpha = 1 - fade * fade * (3 - 2 * fade); g.drawImage(fadeCopy, 0, 0); g.globalAlpha = 1; }
        tex.needsUpdate = true;
        capName.textContent = s === 'type' ? d.name.slice(0, st.typed) : d.name;
        dockEl.setAttribute('aria-label', URLS[s] ? LABEL[s](d) : 'Back to top');
      }
      // the box fades with the device's arrival instead of popping, so it never sits on the page without it
      dockEl.style.opacity = clamp((cur.dock - 0.55) / 0.35);
      dockEl.classList.toggle('on', cur.dock > 0.9);
      // moving (or fading/intro): draw every frame so it keeps pace with the page on 120/240 Hz screens
      busy = ip < 1 || fade < 1 || Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) + Math.abs(tgt.s - cur.s) > 0.4 ||
        Math.abs(tgt.rx - cur.rx) + Math.abs(tgt.ry - cur.ry) > 0.003 || Math.abs(pointer.x - pcur.x) + Math.abs(pointer.y - pcur.y) > 0.01 ||
        Math.abs((atContact ? 1 : 0) - calm) > 0.01 || (!wide() && pt < 1);
      renderer.render(scene, camera);
      // the real browser lies on the screen once the device has settled at Contact (it follows it while the page scrolls)
      // laptop: once it has settled at Contact. Phone: the whole time it is opening, open or closing, so the screen never swaps picture mid-move
      placeUI(wide() ? atContact && s !== 'type' && ip >= 1 && calm > 0.9 && Math.abs(tgt.s - cur.s) < 4 && Math.abs(tgt.ry - cur.ry) < 0.02 : po > 0.001 && DISKS[activeKey].land === 'contact');
    }

    addEventListener('resize', measure);
    // The canvas is the truth. A scrollbar appearing or going away (the loading screen, an opened phone, a dialog) changes the width
    // without a resize event, which left the 3D picture and the browser on its screen about 14px out of step. Re-measure whenever it changes.
    if (window.ResizeObserver) new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (w !== W || h !== H)) { W = w; H = h; measure(); dirty = true; }
    }).observe(canvas);
    measure();
    // first paint: snap to wherever the page was opened (e.g. via #hash)
    dirty = true;
    read();
    target();
    Object.assign(cur, tgt);
    if (document.fonts) {
      Promise.all([document.fonts.load('800 100px "Inter Tight"'), document.fonts.load('500 30px "JetBrains Mono"')])
        .then(() => { shownSig = ''; });
    }
    return { read, draw, busy: () => busy };
  }
})();
