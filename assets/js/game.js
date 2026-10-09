/* STAY OFFLINE: an endless runner. You are the floppy disk; everything the cloud throws at you
   (paywalls, cookie banners, upload clouds, telemetry drones) is in the way.
   Jump: Space / Up / W / tap (hold to glide). Dash: left-click toward the cursor, swipe, or Shift / X.
   Compress (duck): Down / S / swipe down. Esc closes.
   Opened by clicking the 3D disk, any [data-play] button, or `play` in drive A:. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BEST = 'stay-offline-best';
  const C = { bg: '#0c0c0b', ink: '#ecebe6', ink2: '#aaa79e', ink3: '#75726a', hair: '#2a2926', acc: '#ff5714', gold: '#f2c14e', bad: '#ff8a5c' };
  const FONT = '"JetBrains Mono", Consolas, monospace', SANS = '"Inter Tight", Arial, sans-serif';
  const TYPES = {
    paywall:   { w: 56,  h: [70, 96], air: false, label: '$9.99/mo', tag: 'PAYWALL', why: 'a $9.99/mo paywall' },
    cookie:    { w: 156, h: [34, 34], air: false, label: 'Accept all cookies?', tag: '', why: 'a cookie banner' },
    login:     { w: 74,  h: [96, 110], air: false, label: 'LOGIN', tag: 'REQUIRED', why: 'a mandatory login' },
    upload:    { w: 104, h: [48, 48], air: true, label: 'UPLOAD', tag: '', why: 'an upload cloud' },
    telemetry: { w: 40,  h: [24, 24], air: true, label: 'PING', tag: '', why: 'a telemetry drone' }
  };

  let el, cv, g, W = 0, H = 0, G = 0, dpr = 1, raf = 0, last = 0, opener = null, S = null, mode = 'idle';
  const keys = { down: false, jump: false };
  let touch = null;

  function build() {
    el = document.createElement('div');
    el.className = 'game';
    el.hidden = true;
    el.tabIndex = -1;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Stay Offline, a mini-game');
    el.innerHTML = `
      <canvas aria-hidden="true"></canvas>
      <div class="g-card" data-intro>
        <p class="g-kick">A:\\STAY_OFFLINE.EXE</p>
        <h2>Stay offline.</h2>
        <p>You're the disk. Everything the cloud wants from you is in the way. Keep your files local as long as you can.</p>
        <ul class="g-keys">
          <li><span><kbd>Space</kbd><kbd>&uarr;</kbd> or tap</span>Jump, twice in the air. Hold to glide.</li>
          <li><span><kbd>Click</kbd> or swipe</span>Dash through the air toward the cursor</li>
          <li><span><kbd>&darr;</kbd> or swipe down</span>Compress to slide under upload clouds</li>
          <li class="g-note"><i class="g-ico pdf"></i>PDFs are points. <i class="g-ico mic"></i>Wisperno: shield. <i class="g-ico merge"></i>Merge: pulls in every PDF.</li>
        </ul>
        <div class="g-btns"><button type="button" class="btn solid" data-start>Start <kbd>Space</kbd></button><button type="button" class="btn" data-close>Close</button></div>
        <p class="g-small" data-bestline></p>
      </div>
      <div class="g-card" data-over hidden>
        <p class="g-kick" data-reason></p>
        <h2>Uploaded.</h2>
        <dl class="g-stats"><div><dt>Kept local</dt><dd data-kept></dd></div><div><dt>PDFs saved</dt><dd data-pdfs></dd></div><div><dt>Best</dt><dd data-best></dd></div></dl>
        <p class="g-small">IHatePDF and Wisperno never get uploaded: they don't talk to the cloud at all.</p>
        <div class="g-btns"><button type="button" class="btn solid" data-start>Play again <kbd>Space</kbd></button><button type="button" class="btn" data-close>Back to the site</button></div>
      </div>
      <button class="g-x" type="button" data-close aria-label="Close the game"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <p class="sr" aria-live="polite" data-live></p>`;
    document.body.append(el);
    cv = el.querySelector('canvas');
    g = cv.getContext('2d');
    el.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); start(); }));
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    el.addEventListener('keydown', onKey);
    el.addEventListener('keyup', e => { if (['ArrowDown', 's', 'S'].includes(e.key)) keys.down = false; if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { keys.jump = false; release(); } });
    // mouse: left-click dashes toward the cursor. touch: tap jumps (hold glides), swipe dashes, swipe down compresses.
    cv.addEventListener('pointerdown', e => {
      if (mode === 'attract') return start();
      if (mode !== 'play') return;
      if (e.pointerType === 'mouse') { if (e.button === 0) dash(e.clientX, e.clientY); return; }
      touch = { x: e.clientX, y: e.clientY, t: performance.now(), acted: false };
      keys.jump = true;
      jump();
    });
    cv.addEventListener('pointermove', e => {
      if (mode !== 'play' || !touch || touch.acted) return;
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      if (dy > 28 && dy > Math.abs(dx)) { keys.down = true; touch.acted = true; keys.jump = false; }
      else if (Math.hypot(dx, dy) > 34 && performance.now() - touch.t < 350) { dash(S.p.x + dx * 10, S.p.y - 23 + dy * 10); touch.acted = true; }
    });
    addEventListener('pointerup', () => { if (touch) { touch = null; keys.down = false; keys.jump = false; release(); } });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('resize', size);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    const isJump = [' ', 'ArrowUp', 'w', 'W'].includes(e.key), isDuck = ['ArrowDown', 's', 'S'].includes(e.key);
    if (mode !== 'play') {
      // after a crash, ignore keys until the results card has been on screen briefly
      if (mode === 'over' && performance.now() < S.restartAt) { if (isJump) e.preventDefault(); return; }
      if ((isJump || e.key === 'Enter') && !e.target.closest('button[data-close]')) { e.preventDefault(); start(); }
      return;
    }
    if (isJump) { e.preventDefault(); keys.jump = true; if (!e.repeat) jump(); }
    if (isDuck) { e.preventDefault(); keys.down = true; }
    if (['Shift', 'x', 'X'].includes(e.key) && !e.repeat) { e.preventDefault(); dash(S.p.x + 300, S.p.y - 120); }
  }

  function size() {
    if (!cv) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight; G = Math.round(H * (W < H ? 0.6 : 0.7));
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }

  /* ---------- state ---------- */
  function fresh(auto) {
    return {
      auto, t: 0, speed: 420, dist: 0, kept: 0, pdfs: 0, next: 1.2, shield: 0, shake: 0, slow: 0, dead: false, disk: 1,
      p: { x: Math.round(W * 0.18), home: Math.round(W * 0.18), y: 0, vx: 0, vy: 0, ground: true, duck: 0, rot: 0, jumps: 0, hold: false, buffer: 0, coyote: 0, dashCd: 0, dashT: 0, glide: false, trail: [] },
      merge: 0,
      obs: [], items: [], parts: [], toasts: [], stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.62, z: 0.2 + Math.random() * 0.8 })),
      racks: Array.from({ length: 9 }, (_, i) => ({ x: i * 170 + Math.random() * 60, h: 60 + Math.random() * 110, w: 70 + Math.random() * 40 }))
    };
  }
  function open() {
    if (!el) build();
    if (!el.hidden) return;
    opener = document.activeElement;
    size();
    el.hidden = false;
    document.documentElement.classList.add('game-on');
    attract();
    last = performance.now();
    loop(last);
    el.focus();
  }
  function close() {
    if (!el || el.hidden) return;
    cancelAnimationFrame(raf);
    el.hidden = true;
    mode = 'idle';
    document.documentElement.classList.remove('game-on');
    if (opener && opener.focus) opener.focus();
  }
  function cards(which) {
    el.querySelector('[data-intro]').hidden = which !== 'intro';
    el.querySelector('[data-over]').hidden = which !== 'over';
  }
  const best = () => +(localStorage.getItem(BEST) || 0);
  function attract() {
    mode = 'attract';
    S = fresh(true);
    cards('intro');
    const b = best();
    el.querySelector('[data-bestline]').textContent = b ? `Your best: ${fmt(b)} kept local.` : '';
  }
  function start() {
    mode = 'play';
    S = fresh(false);
    cards('none');
    el.focus();
    toast('GO', C.acc);
  }
  function over(type) {
    mode = 'over';
    S.restartAt = performance.now() + 1300;
    const b = Math.max(best(), S.kept);
    try { localStorage.setItem(BEST, Math.round(b)); } catch (e) { /* private mode */ }
    el.querySelector('[data-reason]').textContent = `Dragged into the cloud by ${TYPES[type].why}`;
    el.querySelector('[data-kept]').textContent = fmt(S.kept);
    el.querySelector('[data-pdfs]').textContent = S.pdfs;
    el.querySelector('[data-best]').textContent = fmt(b);
    el.querySelector('[data-live]').textContent = `Game over. ${fmt(S.kept)} kept local.`;
    setTimeout(() => { if (mode === 'over') { cards('over'); el.querySelector('[data-over] [data-start]').focus(); } }, 700);
  }
  const fmt = kb => kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : Math.round(kb) + ' KB';

  /* ---------- player ---------- */
  // a press slightly before landing (buffer) or just after leaving the ground (coyote) still counts
  function jump() {
    const p = S.p;
    if (p.ground || p.coyote > 0) { p.vy = -1000; p.ground = false; p.coyote = 0; p.jumps = 1; p.hold = true; p.buffer = 0; dust(p.x, G, 8); }
    else if (p.jumps === 1) { p.vy = -840; p.jumps = 2; p.hold = true; p.buffer = 0; ring(p.x, p.y - 23); }   // one mid-air second jump
    else p.buffer = 0.16;
  }
  // dash: a short burst through the air toward a point (the cursor, or the swipe direction)
  function dash(tx, ty) {
    const p = S.p;
    if (mode !== 'play' || S.dead || p.dashCd > 0) return;
    let dx = tx - p.x, dy = ty - (p.y - 23);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    if (p.ground && dy > -0.15) dy = -0.35;           // from the ground, always lift off a little
    p.vx = dx * 1150;
    p.vy = dy * 980;
    if (p.ground) p.coyote = 0.1;
    p.ground = false; p.dashT = 0.2; p.dashCd = 0.7; p.jumps = Math.max(p.jumps, 1);
    ring(p.x, p.y - 23);
    burst(p.x, p.y - 23, C.acc, 10, 220);
  }
  function release() { if (S && S.p.vy < -380 && S.p.hold) S.p.vy = -380; if (S) S.p.hold = false; }
  function box(p) {
    const h = 46 - 24 * p.duck, w = 44 + 8 * p.duck;
    return { x: p.x - w / 2, y: p.y - h, w, h };
  }

  /* ---------- spawning ---------- */
  function spawn() {
    const d = Math.min(1, S.t / 70);
    const pool = [['paywall', 3], ['cookie', 2], ['upload', 1 + d * 2.5], ['login', d * 2], ['telemetry', d * 2.2]];
    let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), type = 'paywall';
    for (const [t, w] of pool) { if ((r -= w) <= 0) { type = t; break; } }
    const T = TYPES[type], h = T.h[0] + Math.random() * (T.h[1] - T.h[0]);
    const o = { type, x: W + 40, w: T.w, h, phase: Math.random() * 6 };
    o.y = type === 'upload' ? G - 58 : type === 'telemetry' ? G - 70 : G;   // y = bottom edge
    S.obs.push(o);
    // pickups between obstacles
    if (Math.random() < 0.6) {
      const high = Math.random() < 0.45;
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) S.items.push({ kind: 'pdf', x: W + 40 + o.w + 120 + i * 46, y: high ? G - 150 : G - 30, bob: Math.random() * 6 });
    }
    if (Math.random() < 0.09 + d * 0.05) S.items.push({ kind: 'mic', x: W + 40 + o.w + 260, y: G - 130, bob: 0 });
    else if (Math.random() < 0.08) S.items.push({ kind: 'merge', x: W + 40 + o.w + 260, y: G - 110, bob: 0 });
    const gap = S.speed * (0.95 + Math.random() * 0.75) * (1.15 - d * 0.25);
    S.next = Math.max(0.55, gap / S.speed);
  }

  /* ---------- effects ---------- */
  function burst(x, y, col, n, sp) {
    if (reduce) n = Math.min(n, 6);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random()); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + Math.random() * 0.5, max: 1, col, s: 2 + Math.random() * 3 }); }
  }
  const dust = (x, y, n) => { for (let i = 0; i < n; i++) S.parts.push({ x: x + (Math.random() - 0.5) * 30, y, vx: -60 - Math.random() * 120, vy: -40 - Math.random() * 60, life: 0.4, max: 0.4, col: C.ink3, s: 2 }); };
  const ring = (x, y) => S.parts.push({ ring: true, x, y, life: 0.35, max: 0.35, col: C.acc });
  function toast(text, col) { S.toasts.push({ text, col: col || C.ink, life: 1.4 }); }

  /* ---------- update ---------- */
  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function obsBox(o) {
    if (o.type === 'telemetry') { const cy = o.y + Math.sin(o.phase) * 30; return { x: o.x + 4, y: cy - o.h, w: o.w - 8, h: o.h }; }
    if (o.type === 'upload') return { x: o.x + 8, y: o.y - o.h + 6, w: o.w - 16, h: o.h - 6 };
    return { x: o.x + 4, y: o.y - o.h + 4, w: o.w - 8, h: o.h - 4 };
  }
  function autopilot() {
    const p = S.p, pb = box(p);
    const ahead = S.obs.find(o => o.x + o.w > p.x - 10 && o.x < p.x + S.speed * 0.42);
    keys.down = false;
    if (!ahead) return;
    const ob = obsBox(ahead), dx = ob.x - (pb.x + pb.w);
    if (TYPES[ahead.type].air && ob.y + ob.h < G - 24) { keys.down = dx < S.speed * 0.3; return; }
    if (p.ground && dx < S.speed * (ahead.type === 'cookie' ? 0.2 : 0.17) && dx > -10) jump();
  }

  function update(dt) {
    const p = S.p;
    if (S.dead) { S.slow = Math.max(0, S.slow - dt); dt *= 0.25; }
    S.t += dt;
    if (!S.dead) {
      S.speed = Math.min(980, 420 + S.t * 9);
      S.dist += S.speed * dt;
      const before = S.kept;
      S.kept += S.speed * dt / 38;
      if (Math.floor(before / 1474.56) < Math.floor(S.kept / 1474.56)) { S.disk++; toast(`1.44 MB kept local. Disk ${S.disk} inserted`, C.gold); }
    }
    if (S.auto) autopilot();
    // player physics
    const wantDuck = keys.down ? 1 : 0;
    p.duck += (wantDuck - p.duck) * Math.min(1, dt * 18);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    if (p.dashT > 0) p.dashT -= dt;
    // horizontal: dashes push you forward or back, then you drift home
    p.x += p.vx * dt;
    p.vx *= Math.pow(p.dashT > 0 ? 0.5 : 0.004, dt);
    if (p.dashT <= 0) p.x += (p.home - p.x) * Math.min(1, dt * 1.4);
    p.x = Math.max(40, Math.min(W * 0.62, p.x));
    if (p.dashT > 0 || Math.abs(p.vx) > 120) p.trail.push({ x: p.x, y: p.y, life: 0.22 });
    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter(t => t.life > 0);
    if (!p.ground) {
      p.glide = keys.jump && p.vy > 0 && !keys.down && p.dashT <= 0;
      p.vy += (keys.down ? 5200 : p.dashT > 0 ? 900 : 2900) * dt;
      if (p.glide) p.vy = Math.min(p.vy, 170);      // hold jump while falling to glide
      p.y += p.vy * dt;
      if (p.y < 70) { p.y = 70; p.vy = Math.max(p.vy, 0); }
      p.rot += dt * (p.glide ? 2 : 7);
      if (p.y >= G) {
        p.y = G; p.vy = 0; p.ground = true; p.jumps = 0; p.rot = 0; p.glide = false; dust(p.x, G, 6);
        if (p.buffer > 0) jump();
      }
    } else { p.y = G; p.glide = false; }
    if (S.shield > 0) S.shield -= dt;
    // world
    S.next -= dt;
    if (S.next <= 0 && !S.dead) spawn();
    const pb = box(p);
    for (const o of S.obs) {
      o.x -= S.speed * dt; o.phase += dt * 3.2;
      if (!S.dead && !o.passed && hit(pb, obsBox(o))) {
        if (S.shield > 0) { o.passed = true; o.smashed = 0.4; S.shield = 0; burst(o.x + o.w / 2, o.y - o.h / 2, C.gold, 26, 320); toast('Blocked. Shield used', C.gold); if (!reduce) S.shake = 8; }
        else { S.dead = true; S.slow = 0.6; burst(p.x, p.y - 23, C.acc, 60, 520); if (!reduce) S.shake = 16; if (!S.auto) over(o.type); else setTimeout(attractReset, 900); }
      }
      if (!o.passed && o.x + o.w < pb.x) { o.passed = true; if (!S.auto) S.kept += 6; }
      if (o.smashed) o.smashed -= dt;
    }
    S.obs = S.obs.filter(o => o.x + o.w > -60 && !(o.smashed !== undefined && o.smashed <= 0));
    if (S.merge > 0) S.merge -= dt;
    for (const it of S.items) {
      it.x -= S.speed * dt; it.bob += dt * 4;
      if (S.merge > 0 && it.kind === 'pdf' && it.x < W && !S.dead) {   // Merge: PDFs fly into the disk
        const k = Math.min(1, dt * 7);
        it.x += (p.x - it.x) * k + S.speed * dt * k; it.y += ((p.y - 23) - it.y) * k;
      }
      if (!it.got && !S.dead && hit(pb, { x: it.x - 12, y: it.y - 16 + Math.sin(it.bob) * 4, w: 24, h: 30 })) {
        it.got = true;
        if (it.kind === 'pdf') { S.pdfs++; S.kept += 25; burst(it.x, it.y, C.ink, 8, 160); }
        else if (it.kind === 'merge') { S.merge = 6; burst(it.x, it.y, C.acc, 20, 260); toast('Merge: every PDF comes to you', C.acc); }
        else { S.shield = 7; burst(it.x, it.y, C.gold, 20, 260); toast('Wisperno: local mode shield', C.gold); }
      }
    }
    S.items = S.items.filter(i => i.x > -40 && !i.got);
    for (const q of S.parts) { q.life -= dt; if (!q.ring) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; } }
    S.parts = S.parts.filter(q => q.life > 0);
    for (const t of S.toasts) t.life -= dt;
    S.toasts = S.toasts.filter(t => t.life > 0);
    S.shake *= 0.86;
    for (const r of S.racks) { r.x -= S.speed * dt * 0.18; if (r.x + r.w < 0) { r.x += 9 * 170; r.h = 60 + Math.random() * 110; } }
  }
  function attractReset() { if (mode === 'attract') S = fresh(true); }

  /* ---------- draw ---------- */
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  function drawDisk(x, y, w, h, rot, label, glow) {
    g.save(); g.translate(x, y - h / 2); g.rotate(rot);
    if (glow) { g.shadowColor = C.acc; g.shadowBlur = 18; }
    g.fillStyle = C.acc; rr(-w / 2, -h / 2, w, h, 4); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#d7dadf'; g.fillRect(-w * 0.22, -h / 2, w * 0.5, h * 0.36);           // shutter
    g.fillStyle = C.acc; g.fillRect(-w * 0.02, -h / 2 + 2, w * 0.12, h * 0.3);
    g.fillStyle = '#f4f2ec'; g.fillRect(-w * 0.36, -h * 0.02, w * 0.72, h * 0.46);        // label
    g.fillStyle = '#111'; g.font = `700 ${Math.max(7, h * 0.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 0, h * 0.21);
    g.restore();
  }
  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sh = S.shake > 0.4 ? S.shake : 0;
    g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    // sky
    const sky = g.createLinearGradient(0, 0, 0, G);
    sky.addColorStop(0, '#0a0a09'); sky.addColorStop(1, '#171512');
    g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
    for (const s of S.stars) {
      s.x -= S.speed * 0.00002 * s.z; if (s.x < 0) s.x += 1;
      g.fillStyle = `rgba(236,235,230,${0.15 + s.z * 0.35})`; g.fillRect(s.x * W, s.y * G, s.z * 2, s.z * 2);
    }
    // the cloud, far away: data-centre racks with blinking LEDs
    g.fillStyle = 'rgba(236,235,230,0.18)'; g.font = `500 11px ${FONT}`; g.textAlign = 'left';
    g.fillText('THE CLOUD  ->  where your files are not going', 24, G - 196);
    for (const r of S.racks) {
      g.fillStyle = '#1b1a17'; g.fillRect(r.x, G - r.h, r.w, r.h);
      g.strokeStyle = '#26241f'; g.strokeRect(r.x + 0.5, G - r.h + 0.5, r.w - 1, r.h - 1);
      for (let yy = G - r.h + 10; yy < G - 8; yy += 12) {
        g.fillStyle = '#23211d'; g.fillRect(r.x + 6, yy, r.w - 12, 7);
        const on = ((yy * 7 + r.x | 0) + (now / 260 | 0)) % 5 === 0;
        g.fillStyle = on ? 'rgba(255,87,20,.9)' : 'rgba(255,87,20,.18)'; g.fillRect(r.x + r.w - 12, yy + 2, 3, 3);
      }
    }
    // floor with perspective grid
    const fl = g.createLinearGradient(0, G, 0, H);
    fl.addColorStop(0, '#191714'); fl.addColorStop(1, '#0c0c0b');
    g.fillStyle = fl; g.fillRect(-20, G, W + 40, H - G + 20);
    g.strokeStyle = 'rgba(255,87,20,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, G + 1); g.lineTo(W, G + 1); g.stroke();
    g.lineWidth = 1;
    const off = (S.dist % 80);
    for (let i = -2; i < W / 80 + 3; i++) {
      const x0 = i * 80 - off, vx = W * 0.5;
      g.strokeStyle = 'rgba(236,235,230,0.06)'; g.beginPath(); g.moveTo(x0, G); g.lineTo(vx + (x0 - vx) * 3.2, H); g.stroke();
    }
    for (let k = 1; k < 6; k++) { const yy = G + (H - G) * Math.pow(k / 6, 1.8); g.strokeStyle = 'rgba(236,235,230,0.05)'; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    // speed lines
    if (S.speed > 650 && !reduce) {
      g.strokeStyle = 'rgba(236,235,230,.07)';
      for (let i = 0; i < 10; i++) { const yy = (i * 97 + now / 3) % G; const xx = W - ((now * 1.3 + i * 211) % (W + 200)); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 80, yy); g.stroke(); }
    }
    // pickups
    for (const it of S.items) {
      const y = it.y + Math.sin(it.bob) * 4;
      if (it.kind === 'pdf') {
        g.fillStyle = '#f4f2ec'; g.beginPath(); g.moveTo(it.x - 10, y - 14); g.lineTo(it.x + 4, y - 14); g.lineTo(it.x + 10, y - 8); g.lineTo(it.x + 10, y + 14); g.lineTo(it.x - 10, y + 14); g.closePath(); g.fill();
        g.fillStyle = C.acc; g.font = `700 7px ${FONT}`; g.textAlign = 'center'; g.fillText('PDF', it.x, y + 8);
        g.fillStyle = 'rgba(17,17,16,.35)'; g.fillRect(it.x - 6, y - 7, 12, 2); g.fillRect(it.x - 6, y - 2, 9, 2);
      } else if (it.kind === 'merge') {
        g.save(); g.shadowColor = C.acc; g.shadowBlur = 14;
        g.fillStyle = C.acc; rr(it.x - 15, y - 15, 30, 30, 8); g.fill(); g.restore();
        g.fillStyle = '#f4f2ec'; g.fillRect(it.x - 9, y - 9, 10, 13); g.fillRect(it.x - 2, y - 4, 10, 13);
        g.strokeStyle = C.acc; g.lineWidth = 1.5; g.strokeRect(it.x - 2, y - 4, 10, 13);
      } else {
        g.save(); g.shadowColor = C.gold; g.shadowBlur = 14;
        g.fillStyle = '#8b7cf6'; rr(it.x - 15, y - 15, 30, 30, 15); g.fill(); g.restore();
        g.fillStyle = '#fff';
        [-8, -4, 0, 4, 8].forEach((dx, i) => { const hh = [6, 12, 16, 12, 6][i] * (0.7 + 0.3 * Math.sin(now / 120 + i)); g.fillRect(it.x + dx - 1.2, y - hh / 2, 2.4, hh); });
      }
    }
    // obstacles
    for (const o of S.obs) {
      const b = obsBox(o), T = TYPES[o.type];
      g.save();
      if (o.smashed) g.globalAlpha = Math.max(0, o.smashed / 0.4);
      if (o.type === 'upload') {
        const cx = o.x + o.w / 2, cy = o.y - o.h / 2;
        g.fillStyle = '#2b2925'; g.strokeStyle = C.bad; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx - 26, cy + 6, 16, 0, Math.PI * 2); g.arc(cx, cy - 6, 22, 0, Math.PI * 2); g.arc(cx + 28, cy + 6, 15, 0, Math.PI * 2); g.fill();
        rr(cx - 42, cy + 2, 84, 20, 10); g.fill();
        g.fillStyle = C.bad; g.font = `700 11px ${FONT}`; g.textAlign = 'center'; g.fillText('\u2191 UPLOAD', cx, cy + 16);
        g.strokeStyle = 'rgba(255,138,92,.25)'; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(cx, o.y); g.lineTo(cx, G); g.stroke(); g.setLineDash([]);
      } else if (o.type === 'telemetry') {
        const cy = b.y + b.h / 2, cx = o.x + o.w / 2;
        g.fillStyle = '#2b2925'; rr(o.x, b.y, o.w, b.h, 6); g.fill();
        g.strokeStyle = C.bad; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = (now / 200 | 0) % 2 ? C.bad : '#5c2a17'; g.beginPath(); g.arc(cx, cy, 3.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,138,92,.4)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(o.x - 6, b.y - 3); g.lineTo(o.x + o.w + 6, b.y - 3); g.stroke();
        for (let k = 1; k <= 2; k++) { g.globalAlpha = 0.5 / k; g.beginPath(); g.arc(cx, cy, 8 + k * 9 + (now / 40 % 9), -0.6, 0.6); g.stroke(); }
        g.globalAlpha = 1; g.fillStyle = C.bad; g.font = `600 9px ${FONT}`; g.textAlign = 'center'; g.fillText('PING', cx, b.y - 8);
      } else {
        const x = o.x, y = o.y - o.h;
        g.fillStyle = o.type === 'cookie' ? '#24221e' : '#2b2925';
        rr(x, y, o.w, o.h, o.type === 'cookie' ? 8 : 4); g.fill();
        g.strokeStyle = C.bad; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = C.bad; g.textAlign = 'center';
        if (o.type === 'cookie') {
          g.font = `600 10px ${FONT}`; g.fillText(T.label, x + o.w / 2 - 14, y + 21);
          g.fillStyle = C.bad; rr(x + o.w - 34, y + 9, 26, 16, 8); g.fill();
          g.fillStyle = '#111'; g.font = `700 8px ${FONT}`; g.fillText('OK', x + o.w - 21, y + 20);
        } else {
          g.font = `700 ${o.type === 'login' ? 11 : 10}px ${FONT}`; g.fillText(T.label, x + o.w / 2, y + 22);
          g.fillStyle = 'rgba(255,138,92,.6)'; g.font = `500 8px ${FONT}`; g.fillText(T.tag, x + o.w / 2, y + 36);
          if (o.type === 'login') { g.strokeStyle = 'rgba(255,138,92,.5)'; rr(x + 12, y + 50, o.w - 24, 12, 3); g.stroke(); rr(x + 12, y + 70, o.w - 24, 12, 3); g.stroke(); }
          else { g.strokeStyle = 'rgba(255,138,92,.5)'; g.beginPath(); g.arc(x + o.w / 2, y + o.h - 22, 8, Math.PI, 0); g.stroke(); rr(x + o.w / 2 - 11, y + o.h - 22, 22, 15, 3); g.stroke(); }
        }
      }
      g.restore();
    }
    // player
    const p = S.p;
    if (!S.dead) {
      for (const t of p.trail) { g.globalAlpha = t.life / 0.22 * 0.35; g.fillStyle = C.acc; rr(t.x - 22, t.y - 46, 44, 46, 4); g.fill(); }
      g.globalAlpha = 1;
      const h = 46 - 24 * p.duck, w = 44 + 8 * p.duck;
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(p.x, G + 3, w * 0.5 * (p.ground ? 1 : 0.6), 4, 0, 0, Math.PI * 2); g.fill();
      drawDisk(p.x, p.y, w, h, p.ground ? Math.sin(S.t * 24) * 0.04 : p.rot, p.duck > 0.5 ? 'ZIP' : 'A:', S.shield > 0);
      if (S.shield > 0) {
        g.strokeStyle = `rgba(242,193,78,${S.shield < 1.5 ? (Math.sin(now / 60) + 1) / 2 : 0.85})`; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y - h / 2, 38, 0, Math.PI * 2); g.stroke();
      }
      if (p.duck > 0.5) { g.fillStyle = C.acc; g.font = `600 9px ${FONT}`; g.textAlign = 'center'; g.fillText('COMPRESSED', p.x, p.y - h - 8); }
      if (p.glide) {   // a little canopy while gliding
        g.strokeStyle = 'rgba(236,235,230,.7)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(p.x, p.y - h - 26, 26, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        g.beginPath(); g.moveTo(p.x - 22, p.y - h - 36); g.lineTo(p.x - 10, p.y - h); g.moveTo(p.x + 22, p.y - h - 36); g.lineTo(p.x + 10, p.y - h); g.stroke();
      }
      if (S.merge > 0) { g.strokeStyle = `rgba(255,87,20,${0.35 + 0.25 * Math.sin(now / 90)})`; g.setLineDash([4, 6]); g.beginPath(); g.arc(p.x, p.y - h / 2, 60, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    }
    for (const q of S.parts) {
      const a = Math.max(0, q.life / q.max);
      if (q.ring) { g.strokeStyle = `rgba(255,87,20,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 34 * (1 - a) + 10, 0, Math.PI * 2); g.stroke(); continue; }
      g.globalAlpha = a; g.fillStyle = q.col; g.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); g.globalAlpha = 1;
    }
    // HUD
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === 'play' || mode === 'over') {
      g.textAlign = 'left'; g.fillStyle = C.ink3; g.font = `500 11px ${FONT}`;
      g.fillText('KEPT LOCAL', 24, 34);
      g.fillStyle = C.ink; g.font = `800 30px ${SANS}`; g.fillText(fmt(S.kept), 24, 66);
      g.fillStyle = C.ink3; g.font = `500 11px ${FONT}`;
      g.fillText(`PDFs ${S.pdfs}   \u00b7   DISK ${S.disk}   \u00b7   ${Math.round(S.speed / 4.2)}% SPEED`, 24, 88);
      g.textAlign = 'right'; g.fillText(`BEST ${fmt(Math.max(best(), S.kept))}`, W - 84, 34);
      g.fillStyle = C.acc; g.fillText('0 BYTES UPLOADED', W - 84, 52);
      let hy = 70;
      if (S.shield > 0) { g.fillStyle = C.gold; g.fillText(`SHIELD ${S.shield.toFixed(1)}s`, W - 84, hy); hy += 18; }
      if (S.merge > 0) { g.fillStyle = C.acc; g.fillText(`MERGE ${S.merge.toFixed(1)}s`, W - 84, hy); hy += 18; }
      const ready = S.p.dashCd <= 0, frac = 1 - S.p.dashCd / 0.7;   // dash meter
      g.textAlign = 'left'; g.fillStyle = ready ? C.ink : C.ink3; g.fillText(ready ? 'DASH READY' : 'DASH', 24, 112);
      g.fillStyle = C.hair; g.fillRect(24, 120, 96, 3); g.fillStyle = ready ? C.acc : C.ink3; g.fillRect(24, 120, 96 * frac, 3);
      if (S.t < 5 && mode === 'play') { g.textAlign = 'center'; g.fillStyle = `rgba(170,167,158,${Math.min(1, 5 - S.t)})`; g.fillText(W < 700 ? 'TAP JUMP  \u00b7  HOLD GLIDE  \u00b7  SWIPE DASH  \u00b7  SWIPE DOWN COMPRESS' : 'SPACE JUMP (TWICE)  \u00b7  HOLD TO GLIDE  \u00b7  CLICK TO DASH TOWARD THE CURSOR  \u00b7  DOWN TO COMPRESS', W / 2, H - 28); }
    }
    let ty = H * 0.3;
    for (const t of S.toasts) {
      g.globalAlpha = Math.min(1, t.life * 2); g.textAlign = 'center'; g.fillStyle = t.col;
      g.font = t.text === 'GO' ? `850 64px ${SANS}` : `700 16px ${SANS}`;
      g.fillText(t.text, W / 2, ty - (1.4 - t.life) * 20); ty += 30; g.globalAlpha = 1;
    }
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.033);
    last = now;
    if (mode === 'play' || mode === 'attract' || mode === 'over') update(dt);
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  window.StayOffline = { open, close };
  document.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', open));
})();
