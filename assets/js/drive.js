/* Drive A: the 3D disk is a real (tiny) drive. Click it, or any [data-drive] button, to get a
   DOS-style prompt that can list the "files" on the disk and jump to them. */
(() => {
  'use strict';
  const EMAIL = 'dev.bhamaria@gmail.com';
  const FILES = [
    ['README.TXT', 'Start here'],
    ['IHATEPDF.EXE', '28 PDF tools that never upload'],
    ['WISPERNO.EXE', 'Dictation on your own GPU'],
    ['MANIFESTO.TXT', 'Three rules I build by'],
    ['STACK.CFG', 'What I build with'],
    ['BCA.DOC', 'Where I study'],
    ['RESUME.PDF', 'One page, for recruiters'],
    ['STAYOFF.EXE', 'A small game: keep your files offline'],
    ['CONTACT.TXT', EMAIL]
  ];
  const TEXT = {
    readme: ['Hi, I\'m Dev. I build free, open-source apps that run with no internet at all.', 'Try: DIR, RUN IHATEPDF, TYPE MANIFESTO, RESUME, TOUR.'],
    manifesto: ['1. If it runs on my computer, it should work without the internet.', '2. Everyday tools shouldn\'t be a subscription.', '3. The safest upload is the one that never happens.'],
    stack: ['TypeScript, JavaScript, Python 3.12', 'WebAssembly, pdf-lib, pdf.js, CUDA, faster-whisper, llama-cpp-python', 'React, Tailwind, PySide6 (Qt), Electron'],
    bca: ['Bachelor of Computer Applications, Aug 2024 to 2029 (expected)', 'D Y Patil Deemed to be University, School of Humanities and Sciences', 'Sector 4, CBD Belapur, Navi Mumbai']
  };
  const COMMANDS = ['play', 'help', 'dir', 'run ihatepdf', 'run wisperno', 'type readme', 'type manifesto', 'type stack', 'type bca', 'resume', 'contact', 'tour', 'whoami', 'cls', 'exit'];
  const CHIPS = [['PLAY GAME', 'play'], ['DIR', 'dir'], ['IHATEPDF.EXE', 'run ihatepdf'], ['WISPERNO.EXE', 'run wisperno'], ['MANIFESTO.TXT', 'type manifesto'], ['RESUME.PDF', 'resume'], ['CONTACT', 'contact'], ['EXIT', 'exit']];

  let el, out, input, opener = null, busy = false;
  const hist = [];
  let hi = 0;

  function build() {
    el = document.createElement('div');
    el.className = 'drive';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Drive A, a small command prompt for this site');
    el.innerHTML = `
      <div class="drive-win">
        <div class="drive-top"><span class="drive-led"></span><span>A:\\ &nbsp;DEV.BHAMARIA &nbsp;&middot;&nbsp; 1.44 MB &nbsp;&middot;&nbsp; offline</span><button type="button" class="drive-x" aria-label="Eject and close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <div class="drive-out" aria-live="polite"></div>
        <form class="drive-in" autocomplete="off"><label for="drive-cmd">A:\\&gt;</label><input id="drive-cmd" spellcheck="false" autocapitalize="off" aria-label="Command"></form>
        <div class="drive-chips">${CHIPS.map(([l, c]) => `<button type="button" data-cmd="${c}">${l}</button>`).join('')}</div>
      </div>`;
    document.body.append(el);
    out = el.querySelector('.drive-out');
    input = el.querySelector('input');
    el.querySelector('.drive-x').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => { exec(b.dataset.cmd); input.focus(); }));
    el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; exec(v); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = hist[hi]; }
      if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.toLowerCase(), m = COMMANDS.filter(c => c.startsWith(v));
        if (m.length === 1) input.value = m[0]; else if (m.length) print(m.join('   '), 'dim');
      }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  }

  function print(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    out.append(p);
    out.scrollTop = out.scrollHeight;
    return p;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function lines(arr, cls, gap = 70) { for (const l of arr) { print(l, cls); await sleep(gap); } }

  async function open() {
    if (!el) build();
    if (!el.hidden) return;
    opener = document.activeElement;
    el.hidden = false;
    document.documentElement.classList.add('drive-on');
    out.textContent = '';
    input.focus();
    busy = true;
    await lines(['Reading 3.5" HD diskette ........ ok', 'Volume in drive A is DEV.BHAMARIA', 'Network adapter ................. off'], 'dim', 160);
    print('Type HELP, or click a file below.');
    busy = false;
  }
  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    document.documentElement.classList.remove('drive-on');
    if (opener && opener.focus) opener.focus();
  }
  function go(hash, then) {
    close();
    const t = document.querySelector(hash);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (then) setTimeout(then, 900);
  }

  async function exec(raw) {
    const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (busy) return;
    print('A:\\> ' + raw.trim(), 'cmd');
    if (!cmd) return;
    hist.push(raw.trim()); hi = hist.length;
    const arg = cmd.split(' ').slice(1).join(' ').replace(/\.(exe|txt|cfg|doc|pdf)$/, '');
    const verb = cmd.split(' ')[0].replace(/\.(exe|txt|cfg|doc|pdf)$/, '');
    busy = true;
    try {
      switch (verb) {
        case 'help': case '?':
          await lines(['DIR              list the files on this disk', 'RUN <name>       open a project (ihatepdf, wisperno)', 'TYPE <file>      read a file (readme, manifesto, stack, bca)', 'RESUME           open the one-page resume', 'CONTACT          copy my email address', 'TOUR             let the site scroll itself', 'PLAY             play Stay Offline', 'CLS, EXIT        clear the screen, eject the disk'], '', 40);
          break;
        case 'dir': case 'ls':
          print(' Directory of A:\\', 'dim');
          await lines(FILES.map(([f, d]) => `${f.padEnd(15)}  ${d}`), '', 50);
          print(`        ${FILES.length} file(s)       0 bytes uploaded`, 'dim');
          break;
        case 'run': case 'open': case 'start': case 'ihatepdf': case 'wisperno': {
          const name = verb === 'ihatepdf' || verb === 'wisperno' ? verb : arg;
          if (name === 'ihatepdf' || name === 'wisperno') {
            print(`Loading ${name.toUpperCase()}.EXE ...`);
            await sleep(500);
            go('#' + name);
          } else if (name === 'resume') { location.href = 'resume.html'; }
          else print('Bad command or file name. Try RUN IHATEPDF or RUN WISPERNO.', 'err');
          break;
        }
        case 'type': case 'cat': case 'readme': case 'manifesto': case 'stack': case 'bca': {
          const f = TEXT[verb in TEXT ? verb : arg];
          if (f) await lines(f, '', 60); else print('File not found. Try TYPE README, MANIFESTO, STACK or BCA.', 'err');
          break;
        }
        case 'resume':
          print('Opening RESUME.PDF ...');
          await sleep(400);
          try { sessionStorage.setItem('p3d-to-resume', '1'); } catch (e) { /* ignore */ }
          location.href = 'resume.html';
          break;
        case 'contact': case 'mail': case 'email':
          try { await navigator.clipboard.writeText(EMAIL); print(`Copied ${EMAIL} to your clipboard.`, 'ok'); }
          catch (e) { print(EMAIL + '  (copy it from here)', 'ok'); }
          break;
        case 'tour': case 'autoscroll':
          print('Starting the tour ...');
          await sleep(400);
          close();
          document.getElementById('tour')?.click();
          break;
        case 'play': case 'game': case 'stayoff': case 'stayoffline':
          print('Loading STAYOFF.EXE ...');
          await sleep(400);
          close();
          window.StayOffline && window.StayOffline.open();
          break;
        case 'whoami':
          print('dev.bhamaria: BCA student, builds offline-first apps, MIT licensed.');
          break;
        case 'ping': case 'curl': case 'wget': case 'upload':
          print('Request blocked. This machine is offline by design.', 'err');
          break;
        case 'format': case 'del': case 'rm':
          print('Refused. Nothing on this disk is going anywhere.', 'err');
          break;
        case 'sudo':
          print('Nice try.', 'err');
          break;
        case 'cls': case 'clear':
          out.textContent = '';
          break;
        case 'exit': case 'eject': case 'quit':
          close();
          break;
        default:
          print('Bad command or file name. Type HELP.', 'err');
      }
    } finally { busy = false; }
  }

  window.Drive = { open, close };
  document.querySelectorAll('[data-drive]').forEach(b => b.addEventListener('click', open));
})();
