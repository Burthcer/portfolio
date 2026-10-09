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
  }), { rootMargin: '0px 0px -10% 0px' });
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
  // back from the resume: put the page where it was (instant, not the smooth scroll the page uses for links)
  try {
    const y = +sessionStorage.getItem('p3d-scroll');
    sessionStorage.removeItem('p3d-scroll');
    if (y > 0) { history.scrollRestoration = 'manual'; addEventListener('load', () => requestAnimationFrame(() => scrollTo({ top: y, behavior: 'instant' }))); }
  } catch (e) { /* storage blocked */ }
  const boot = $('#boot');
  if (reduce || !boot || seen) { if (boot) boot.remove(); begin(seen); }
  else {
    const bar = $('.boot-bar i', boot), pct = $('.boot-pct', boot), log = $('.boot-log', boot);
    const lines = ['A:\\> mount 3.5" HD diskette', 'network adapter ........ off', 'telemetry .............. none', 'bytes uploaded ......... 0', 'loading dev.bhamaria ...'];
    let t0 = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
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

  // project mini-sections (tabs). "How it works" also opens the disk's shutter.
  const events = new EventTarget();
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
      events.dispatchEvent(new CustomEvent('arch', { detail: /How it works/.test(t.textContent) }));
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
  // Scroll target that centres a group of elements in the visible band (below the nav,
  // above the bottom chrome). If the group is too tall, its top goes just under the nav.
  function centerY(els, where) {
    els = [].concat(els).filter(Boolean);
    const top = Math.min(...els.map(docTop)), bottom = Math.max(...els.map(e => docTop(e) + e.offsetHeight));
    const bandTop = 76, bandBottom = innerHeight - (root.classList.contains('touring') ? 84 : 24);
    const band = bandBottom - bandTop, h = bottom - top;
    return where === 'top' || h > band ? top - bandTop : top - bandTop - (band - h) / 2;
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
    return { els, where: h <= innerHeight - 100 ? 'center' : 'top' };
  }
  // In-page links (See the work, nav, project index, Next project) glide to a centred frame.
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href').slice(1), target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const f = frameFor(target);
    scrollTo({ top: Math.max(0, centerY(f.els, f.where)), behavior: reduce ? 'auto' : 'smooth' });
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
  tourBar.innerHTML = '<span class="tb-dot" aria-hidden="true"></span><span>Auto-scroll</span><span class="tb-step"></span><button type="button">Stop</button>';
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
  function point(el, label, fx = 0.5, fy = 0.5) {
    const r = el.getBoundingClientRect();
    cursor.style.transform = `translate(${r.left + r.width * fx}px, ${r.top + r.height * fy}px)`;
    tip.textContent = label || '';
    cursor.classList.toggle('has-tip', !!label);
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
  async function run() {
    tbStep.textContent = 'Work';
    await focusOn(frameFor($('#work')).els, frameFor($('#work')).where);
    await wait(1600);
    const row = $('.pindex a[href="#ihatepdf"]');
    await point(row, 'Take me to IHatePDF', 0.28);
    await press(row);
    await showProject('ihatepdf', 'ihp', 'IHatePDF', [[2, 'Show me the screens'], [4, 'Show me the numbers']], 'Next project: Wisperno');
    await showProject('wisperno', 'wsp', 'Wisperno', [[5, 'Show me the app'], [4, 'Show me the numbers']], null);
    cursor.classList.remove('has-tip');

    tbStep.textContent = 'Ideas';
    await focusOn([$('#ideas .sec-head')]);
    await wait(900);
    // read the statement: drift slowly until its last line is lit (lit once it rises above 60% of the screen)
    const st = $('.statement');
    await glide(docTop(st) + st.offsetHeight - innerHeight * 0.56, 4200, t => t);
    await wait(900);
    await focusOn([$('.rules')]);
    await wait(3200);

    tbStep.textContent = 'Stack';
    await focusOn(frameFor($('#stack')).els, frameFor($('#stack')).where);
    await wait(1400);
    await focusOn([$('.stack'), $('#stack .practices')]);
    await wait(2800);

    tbStep.textContent = 'Education';
    await focusOn([$('#education .edu')]);
    await wait(3200);

    tbStep.textContent = 'Contact';
    await focusOn([$('#contact .contact-body')]);
    const mail = $('.mail-big');
    await point(mail, 'Say hi', 0.5, 0.55);
    mail.classList.add('tour-hover');
    await wait(2200);
    mail.classList.remove('tour-hover');
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
    cursor.classList.add('on');
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
  const nav = $('.nav'), bar = $('.progress'), track = $('.marquee-track');
  const navLinks = $$('[data-nav]'), navSecs = navLinks.map(a => $(a.getAttribute('href')));
  const slides = $$('[data-slide]').map(el => { const [a, b] = el.dataset.slide.split(' ').map(Number); return { el, a, b }; });
  let W = document.documentElement.clientWidth, H = innerHeight, dirty = true, lastY = scrollY, navY = scrollY, vel = 0, dir = 1, mx = 0;
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', () => { W = document.documentElement.clientWidth; H = innerHeight; dirty = true; });
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
    const stP = statements.map(s => { const r = s.el.getBoundingClientRect(); return clamp((H * 0.8 - r.top) / (r.height + H * 0.2)); });
    let act = -1;
    navSecs.forEach((s, i) => { if (s.getBoundingClientRect().top <= H * 0.4) act = i; });

    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (y > navY + 6 && y > 240) nav.classList.add('hide');
    else if (y < navY - 6) nav.classList.remove('hide');
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

  /* ================= 3D floppy disk ================= */
  const disk3d = initDisk();

  let last = performance.now(), lastDraw = 0, drawDt = 0;
  (function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    drawDt += dt;
    // the full-screen WebGL canvas is the heaviest thing on the page: every frame while the disk moves (as fast as the
    // screen refreshes, so 60 on a 60 Hz monitor), otherwise at most ~60 times a second
    const drawNow = disk3d && (dirty || disk3d.busy() || now - lastDraw >= 15);   // always on a frame that scrolled, or the scroll is missed
    if (drawNow) disk3d.read();
    domFrame(dt);
    if (drawNow) { disk3d.draw(now, drawDt); lastDraw = now; drawDt = 0; }
    requestAnimationFrame(loop);
  })(last);

  function initDisk() {
    const canvas = $('#disk'), dockEl = $('#dock');
    if (!window.THREE) { canvas.remove(); return null; }
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));   // a full-screen canvas at 2x costs 4x the pixels for little visible gain
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 25, 55);   // tight depth range: a wide one makes the label z-fight with the body when the disk is small
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
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3631, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(6, 9, 12); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb08a, 1.2); rim.position.set(-9, -3, -8); scene.add(rim);

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
    const grainTex = new THREE.CanvasTexture(noiseCanvas(256, 256, () => 118 + Math.random() * 30));
    grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(0.6, 0.6);
    const rows = Array.from({ length: 256 }, Math.random);
    const brushTex = new THREE.CanvasTexture(noiseCanvas(256, 256, (x, y) => 90 + rows[y] * 70 + Math.random() * 25));
    brushTex.wrapS = brushTex.wrapT = THREE.RepeatWrapping; brushTex.repeat.set(0.35, 1.2);

    const M = {
      body: new THREE.MeshStandardMaterial({ color: srgb('#FF4F00'), roughness: 0.5, metalness: 0, roughnessMap: grainTex, bumpMap: grainTex, bumpScale: 0.004, envMapIntensity: 0.55 }),
      bodyDark: new THREE.MeshStandardMaterial({ color: srgb('#C83A00'), roughness: 0.6, metalness: 0 }),
      metal: new THREE.MeshStandardMaterial({ color: srgb('#D7DADF'), roughness: 0.32, metalness: 1, roughnessMap: brushTex, bumpMap: brushTex, bumpScale: 0.002, envMapIntensity: 1.25 }),
      hub: new THREE.MeshStandardMaterial({ color: srgb('#C9CCD1'), roughness: 0.22, metalness: 1, envMapIntensity: 1.3 }),
      media: new THREE.MeshStandardMaterial({ color: srgb('#2B2019'), roughness: 0.28, metalness: 0.35, envMapIntensity: 0.9 }),
      black: new THREE.MeshStandardMaterial({ color: srgb('#141414'), roughness: 0.55, metalness: 0 }),
      hole: new THREE.MeshBasicMaterial({ color: 0x050505 })
    };

    /* ---- geometry (3.5" diskette, built from code) ---- */
    const DW = 9.0, DH = 9.4, T = 0.30, BEV = 0.03, FZ = T / 2 + BEV;
    const WX = 0.4, WY0 = 2.1, WH = 2.35, WW = 1.3;
    const rect = (x, y, w, h) => { const p = new THREE.Path(); p.moveTo(x, y); p.lineTo(x, y + h); p.lineTo(x + w, y + h); p.lineTo(x + w, y); p.lineTo(x, y); return p; };
    const disk = new THREE.Group();
    scene.add(disk);

    (() => { // body
      const r = 0.3, c = 0.6, x0 = -DW / 2, x1 = DW / 2, y0 = -DH / 2, y1 = DH / 2, s = new THREE.Shape();
      s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
      s.lineTo(x1, y1 - c); s.lineTo(x1 - c, y1);
      s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
      s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
      s.holes.push(rect(WX - WW / 2, WY0, WW, WH), rect(-4.15, -4.3, 0.5, 0.55), rect(3.65, -4.3, 0.5, 0.55));
      const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3, curveSegments: 10 });
      g.translate(0, 0, -T / 2);
      disk.add(new THREE.Mesh(g, M.body));
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.04), M.bodyDark);
      strip.position.set(-0.2, 1.62, FZ + 0.001); disk.add(strip);
      const strip2 = strip.clone(); strip2.position.z = -FZ - 0.001; strip2.rotation.y = Math.PI; disk.add(strip2);
    })();

    const media = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.15, 0.02, 96), M.media);
    media.rotation.x = Math.PI / 2; disk.add(media);

    const shutter = new THREE.Group(); disk.add(shutter);
    (() => {
      const s = new THREE.Shape(), sx0 = -2.5, sx1 = 2.5, sy0 = 1.7, sy1 = DH / 2 + 0.01;
      s.moveTo(sx0, sy0); s.lineTo(sx1, sy0); s.lineTo(sx1, sy1); s.lineTo(sx0, sy1); s.lineTo(sx0, sy0);
      s.holes.push(rect(-WW / 2, WY0, WW, WH));
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false, curveSegments: 4 });
      const f = new THREE.Mesh(g, M.metal); f.position.z = FZ + 0.002; shutter.add(f);
      const b = new THREE.Mesh(g, M.metal); b.position.z = -FZ - 0.016; shutter.add(b);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.02, 2 * FZ + 0.036), M.metal);
      spine.position.set(0, sy1, 0); shutter.add(spine);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.01), M.metal);
      rib.position.set(-1.9, 3.15, FZ + 0.02); shutter.add(rib);
    })();
    const SHUT_OPEN = WX, SHUT_CLOSED = WX - 1.7;

    const LBL = document.createElement('canvas'); LBL.width = 1024; LBL.height = 800;
    const lctx = LBL.getContext('2d');
    const labelTex = new THREE.CanvasTexture(LBL);
    labelTex.encoding = THREE.sRGBEncoding;
    labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 5.55), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.82, metalness: 0, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    label.position.set(0, -1.52, FZ + 0.004); disk.add(label);

    (() => { // embossed arrow + HD mark
      const s = new THREE.Shape(); s.moveTo(0, 0.32); s.lineTo(0.22, -0.05); s.lineTo(-0.22, -0.05); s.lineTo(0, 0.32);
      const a = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), M.bodyDark);
      a.position.set(-3.9, 3.95, FZ); disk.add(a);
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#B83500'; g.font = '800 50px Arial'; g.textBaseline = 'middle'; g.fillText('HD', 22, 34);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      const hd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }));
      hd.position.set(-3.85, -3.55, FZ + 0.002); disk.add(hd);
    })();

    (() => { // back: hub, spindle, write-protect
      const BZ = -FZ;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.72, 72), M.black);
      ring.position.set(0, 0, BZ - 0.002); ring.rotation.y = Math.PI; disk.add(ring);
      const hubShape = new THREE.Shape(); hubShape.absarc(0, 0, 1.3, 0, Math.PI * 2, false);
      hubShape.holes.push(rect(-0.24, -0.24, 0.48, 0.48), rect(0.5, -0.75, 0.42, 0.62));
      const hub = new THREE.Mesh(new THREE.ExtrudeGeometry(hubShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.015, bevelSegments: 2, curveSegments: 48 }), M.hub);
      hub.position.z = BZ - 0.05; disk.add(hub);
      const back = new THREE.Mesh(new THREE.CircleGeometry(1.32, 48), M.hole);
      back.position.z = BZ + 0.03; back.rotation.y = Math.PI; disk.add(back);
      const wp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.16), M.black);
      wp.position.set(3.9, -4.15, -0.06); disk.add(wp);
      for (let i = 0; i < 5; i++) {
        const rd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.02), M.bodyDark);
        rd.position.set(-3.6 + i * 0.22, -2.6, BZ - 0.01); disk.add(rd);
      }
    })();

    /* ---- label ---- */
    const paperNoise = noiseCanvas(256, 256, () => 225 + Math.random() * 30);
    const fibres = document.createElement('canvas'); fibres.width = 1024; fibres.height = 800;
    (() => {
      const g = fibres.getContext('2d');
      for (let i = 0; i < 900; i++) {
        g.strokeStyle = `rgba(80,70,50,${0.03 + Math.random() * 0.05})`; g.lineWidth = 0.6 + Math.random();
        const x = Math.random() * 1024, y = Math.random() * 800, a = Math.random() * Math.PI, l = 4 + Math.random() * 14;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    })();
    // every [data-stop] element is one "disk": add a project article and it gets its own label + pose
    const stops = $$('[data-stop]');
    const DISKS = stops.map(el => ({ name: el.dataset.file, sub: el.dataset.sub, tags: el.dataset.tags }));
    const order = DISKS.map((_, i) => i);
    function drawLabel(d, chars) {
      const g = lctx, Wd = 1024, Hd = 800, n = order.indexOf(activeKey) + 1;
      g.fillStyle = g.createPattern(paperNoise, 'repeat'); g.fillRect(0, 0, Wd, Hd);
      g.fillStyle = 'rgba(247,244,236,0.82)'; g.fillRect(0, 0, Wd, Hd);
      g.drawImage(fibres, 0, 0);
      g.fillStyle = '#111110'; g.fillRect(0, 0, Wd, 104);
      g.fillStyle = '#F4F1EA'; g.font = '600 34px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
      g.fillText('D. BHAMARIA', 56, 54);
      g.textAlign = 'right'; g.fillText(`DISK ${String(n).padStart(2, "0")}/${String(order.length).padStart(2, "0")}`, Wd - 56, 54); g.textAlign = 'left';
      g.fillStyle = '#FF4F00'; g.fillRect(0, 104, Wd, 14);
      g.strokeStyle = 'rgba(17,17,16,0.22)'; g.lineWidth = 2;
      [330, 460, 580, 700].forEach(y => { g.beginPath(); g.moveTo(56, y); g.lineTo(Wd - 56, y); g.stroke(); });
      g.fillStyle = 'rgba(17,17,16,0.5)'; g.font = '500 26px "JetBrains Mono", monospace'; g.textBaseline = 'alphabetic';
      g.fillText('FILE', 56, 196);
      g.textAlign = 'right'; g.fillText('1.44 MB · HD', Wd - 56, 196); g.textAlign = 'left';
      const nm = d.name.slice(0, chars);
      let fs = 112; g.font = `800 ${fs}px "JetBrains Mono", monospace`;
      while (g.measureText(d.name).width > Wd - 112 && fs > 60) { fs -= 4; g.font = `800 ${fs}px "JetBrains Mono", monospace`; }
      g.fillStyle = '#111110'; g.fillText(nm, 52, 310);
      if (chars < d.name.length || (Date.now() / 500 | 0) % 2 === 0) {
        g.fillStyle = '#FF4F00'; g.fillRect(52 + g.measureText(nm).width + 6, 310 - fs * 0.72, fs * 0.5, fs * 0.78);
      }
      g.fillStyle = '#111110'; g.font = '600 50px "Inter Tight", Arial, sans-serif'; g.fillText(d.sub, 56, 440);
      g.fillStyle = 'rgba(17,17,16,0.62)'; g.font = '500 30px "JetBrains Mono", monospace'; g.fillText(d.tags, 56, 560);
      g.fillStyle = '#111110'; g.font = '700 30px "JetBrains Mono", monospace'; g.fillText('OWN YOUR SOFTWARE.', 56, 680);
      g.fillStyle = '#FF4F00'; g.fillRect(Wd - 96, 640, 40, 40);
      labelTex.needsUpdate = true;
    }

    /* ---- choreography: one pose per stop, generated so any number of sections works ----
       first = hero (big beside the headline), last = finale (returns big), everything between parks in the dock */
    const TAU = Math.PI * 2;
    // parked poses stay small: big tilts or spins push the corners out of the dock box
    const PARKED = [
      { rx: -0.14, ry: 0.32, rz: -0.05, sh: 1 },
      { rx: -0.1, ry: -0.3, rz: 0.05, sh: 0.45 },
      { rx: -0.16, ry: 0.22, rz: 0.04, sh: 0 },
      { rx: -0.08, ry: -0.24, rz: -0.04, sh: 1 }
    ];
    const KF = stops.map((_, i) => {
      if (i === 0) return { rx: -0.32, ry: -0.52, rz: 0.10, sh: 0, mode: 'hero', co: ['shutter', 'label'] };
      if (i === stops.length - 1) return { rx: -0.14, ry: TAU - 0.45, rz: 0.06, sh: 0.6, mode: 'big', co: ['shutter', 'media', 'label'] };
      const p = PARKED[(i - 1) % PARKED.length];
      return { ...p, mode: 'dock', co: [] };
    });
    const capName = $('#capName');
    let sayTimer = 0;

    let slot = { x: 0, y: 0, s: 100 };
    const wide = () => W >= 900;
    const isDock = m => m === 'dock' || (m === 'big' && !wide());
    function pose(m) {
      if (m === 'hero') return wide() ? { x: W * 0.73, y: H * 0.5, s: Math.min(H * 0.6, W * 0.33) } : { x: W * 0.5, y: H * 0.27, s: Math.min(W * 0.56, H * 0.3) };
      if (m === 'big' && wide()) return { x: W * 0.76, y: H * 0.5, s: Math.min(H * 0.5, W * 0.3) };
      return slot;
    }
    function measure() {
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      const r = $('#dockSlot').getBoundingClientRect();
      slot = { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.height * 0.72 };
    }
    addEventListener('resize', measure);
    measure();

    let idx = 0, segT = 0, activeKey = null, typed = 0, typeStart = 0, coSet = [], forceShutter = false, busy = true;
    const tgt = {}, cur = {};
    function read() {
      if (!dirty) return;
      const line = H * 0.5, tops = stops.map(el => el.getBoundingClientRect().top - line);
      idx = 0;
      tops.forEach((t, i) => { if (t <= 0) idx = i; });
      segT = 0;
      // hero -> dock follows the first screen of scroll; later stops blend near the boundary
      if (idx === 0) segT = smooth(0.06, 0.8, scrollY / H);
      else if (idx < tops.length - 1) segT = smooth(0.45, 1, -tops[idx] / (tops[idx + 1] - tops[idx]));

      // the last move (dock <-> Contact) follows how much of the Contact section fills the view: the disk is big only
      // while Contact is on screen, and heads back to the dock as soon as it starts to scroll away (it never lingers over Education)
      if (wide() && idx >= tops.length - 2) {
        idx = tops.length - 2;
        segT = smooth(0.35, 0.8, (H - stops[tops.length - 1].getBoundingClientRect().top) / H);
      }
      const k = order[segT > 0.5 ? Math.min(idx + 1, order.length - 1) : idx];
      if (k !== activeKey) setDisk(k);
    }
    function target() {
      const A = KF[order[idx]], B = KF[order[Math.min(idx + 1, order.length - 1)]], t = segT;
      const pa = pose(A.mode), pb = pose(B.mode);
      tgt.rx = A.rx + (B.rx - A.rx) * t;
      tgt.ry = A.ry + (B.ry - A.ry) * t;
      tgt.rz = A.rz + (B.rz - A.rz) * t;
      tgt.sh = Math.max(A.sh + (B.sh - A.sh) * t, forceShutter ? 1 : 0);
      tgt.x = pa.x + (pb.x - pa.x) * t;
      tgt.y = pa.y + (pb.y - pa.y) * t;
      tgt.s = pa.s + (pb.s - pa.s) * (B.mode === 'big' ? t * t : t);   // flying out to Contact: rise first, grow late, so it never pokes past the bottom edge
      tgt.dock = (isDock(A.mode) ? 1 : 0) * (1 - t) + (isDock(B.mode) ? 1 : 0) * t;
    }
    function setDisk(k) {
      activeKey = k;
      const d = DISKS[k];
      typed = reduce ? d.name.length : 0;
      typeStart = performance.now();
      coSet = KF[k].co;
      forceShutter = false;
      drawLabel(d, typed);
      // announce the new file next to the dock for a moment
      dockEl.classList.add('say');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => dockEl.classList.remove('say'), 2600);
    }
    dockEl.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
    events.addEventListener('arch', e => { forceShutter = e.detail; });

    /* ---- callouts ---- */
    const coEls = {};
    $$('.co').forEach(el => { coEls[el.dataset.co] = el; });
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const anchors = {
      shutter: { p: V(1.8, 3.9, FZ + 0.02), n: V(0, 0, 1), move: true },
      media:   { p: V(WX, 3.0, 0), n: V(0, 0, 1) },
      label:   { p: V(-2.9, -3.6, FZ + 0.01), n: V(0, 0, 1) }
    };
    const tmpV = V(0, 0, 0), tmpN = V(0, 0, 0), camDir = V(0, 0, 0);
    function placeCallouts(show) {
      Object.keys(anchors).forEach(k => {
        const a = anchors[k], el = coEls[k];
        tmpV.copy(a.p);
        if (a.move) tmpV.x += shutter.position.x - SHUT_OPEN;
        disk.localToWorld(tmpV);
        tmpN.copy(a.n).applyQuaternion(disk.quaternion);
        camDir.copy(camera.position).sub(tmpV).normalize();
        const want = show && coSet.includes(k) && tmpN.dot(camDir) > 0.25 && (k !== 'media' || cur.sh > 0.7);
        el.classList.toggle('on', want);
        if (!want) return;
        tmpV.project(camera);
        const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H, left = x > W * 0.8;
        el.classList.toggle('left', left);
        el.style.transform = `translate(${left ? x - el.offsetWidth + 4.5 : x}px,${y - el.offsetHeight / 2}px)`;
      });
    }

    const pointer = { x: 0, y: 0 }, pcur = { x: 0, y: 0 };

    // easter egg: click the disk while it's big (hero or finale) to play Stay Offline
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let hot = false;
    function overDisk(e) {
      if (cur.dock > 0.2 || !introAt || !e.target.closest) return false;
      if (e.target.closest('a, button, input, textarea, select, dialog, .game')) return false;
      ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(disk, true).length > 0;
    }
    addEventListener('pointermove', e => {
      const h = overDisk(e);
      if (h !== hot) { hot = h; document.body.classList.toggle('disk-hot', h); }
    }, { passive: true });
    addEventListener('click', e => {
      if (!overDisk(e) || !window.StayOffline) return;
      hot = false;
      document.body.classList.remove('disk-hot');
      window.StayOffline.open();
    });
    addEventListener('pointermove', e => { pointer.x = (e.clientX / W - 0.5) * 2; pointer.y = (e.clientY / H - 0.5) * 2; }, { passive: true });
    let blink = -1;

    function draw(now, dt) {
      target();
      const k = reduce ? 1 : 1 - Math.pow(0.003, dt);
      for (const p in tgt) cur[p] += (tgt[p] - cur[p]) * k;
      pcur.x += (pointer.x - pcur.x) * Math.min(1, dt * 4);
      pcur.y += (pointer.y - pcur.y) * Math.min(1, dt * 4);

      // intro: disk spins up from below once the boot screen lifts
      const ip = reduce ? 1 : introAt ? clamp((now - introAt - 150) / 1800) : 0;
      const ie = easeOut(ip), tt = now / 1000, idle = reduce ? 0 : 1, free = 1 - cur.dock * 0.7;
      const visH = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360), visW = visH * camera.aspect;
      const sc = Math.max(1e-3, cur.s / H * visH / DH);
      disk.position.set((cur.x / W - 0.5) * visW, -(cur.y / H - 0.5) * visH - (1 - ie) * visH * 0.6 + Math.sin(tt * 0.9) * 0.12 * sc * idle, 0);
      disk.scale.setScalar(sc * (0.7 + 0.3 * ie));
      disk.rotation.set(
        cur.rx + (pcur.y * 0.1 + Math.sin(tt * 0.7) * 0.025 * idle) * free,
        cur.ry - (1 - ie) * 5 + (pcur.x * 0.16 + Math.sin(tt * 0.5) * 0.04 * idle) * free,
        cur.rz + (1 - ie) * 0.8);
      shutter.position.x = SHUT_CLOSED + (SHUT_OPEN - SHUT_CLOSED) * cur.sh;

      const d = DISKS[activeKey];
      const want = reduce ? d.name.length : Math.min(d.name.length, Math.floor((now - typeStart) / 55));
      if (want !== typed || (now / 500 | 0) !== blink) {
        typed = want;
        blink = now / 500 | 0;
        drawLabel(d, typed);
        capName.textContent = d.name.slice(0, typed);
      }
      // the box fades with the disk's arrival instead of popping, so the disk never sits on the page without it
      dockEl.style.opacity = clamp((cur.dock - 0.55) / 0.35);
      dockEl.classList.toggle('on', cur.dock > 0.9);
      // moving or in the intro: draw every frame so the disk keeps pace with the page on 120/240 Hz screens
      busy = ip < 1 || Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) + Math.abs(tgt.s - cur.s) > 0.4 ||
        Math.abs(tgt.rx - cur.rx) + Math.abs(tgt.ry - cur.ry) + Math.abs(tgt.sh - cur.sh) > 0.003 || Math.abs(pointer.x - pcur.x) + Math.abs(pointer.y - pcur.y) > 0.01;
      renderer.render(scene, camera);
      placeCallouts(ip >= 1 && cur.dock < 0.15);
    }

    renderer.compile(scene, camera);   // compile every shader program up front, under the boot screen, not mid-animation
    // first paint: snap to wherever the page was opened (e.g. via #hash)
    dirty = true;
    read();
    target();
    Object.assign(cur, tgt);
    if (document.fonts) {
      Promise.all([document.fonts.load('800 100px "JetBrains Mono"'), document.fonts.load('600 50px "Inter Tight"')])
        .then(() => drawLabel(DISKS[activeKey], typed));
    }
    return { read, draw, busy: () => busy };
  }
})();
