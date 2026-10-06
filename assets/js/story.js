/* The story: five chapters drawn on one canvas, driven by scroll position.
   Every scroll-linked position is a pure function of progress, so scrolling back rewinds exactly. */
(() => {
  const section = document.querySelector('.story');
  if (!section) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                       // chapters stay as a readable static list
  document.documentElement.classList.add('story-live');

  const canvas = section.querySelector('.story-canvas');
  const ctx = canvas.getContext('2d');
  const chapters = [...section.querySelectorAll('.ch')];
  const bar = section.querySelector('.story-bar i');

  // chapter windows on the 0..1 progress line
  const W = [[0, .18], [.18, .40], [.40, .54], [.54, .80], [.80, 1.0001]];
  const RED = '179,25,31', HOT = '227,57,46', PAPER = '235,233,228';

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  const portrait = new Image();
  portrait.src = 'assets/img/profile_alt.webp';

  // ---------- content for the "trapped" walls ----------
  const CODE = [
    'TypeError: undefined is not a function', 'npm ERR! code ERESOLVE', 'Segmentation fault (core dumped)',
    'const app = express();', 'while (true) { retry(); }', 'git push --force', 'Uncaught (in promise) Error',
    'SELECT * FROM users WHERE 1=1;', 'ModuleNotFoundError: No module named', 'def main():', 'return null;',
    '404 Not Found', 'CORS policy: blocked', 'Build failed in 3m 12s', 'import torch', 'if (err) throw err;',
    'StackOverflowError', 'docker: permission denied', 'merge conflict in index.html', 'FATAL: password authentication failed',
    'async function fix() {', '}', 'TODO: fix later', 'deploy rejected', 'ReferenceError: x is not defined',
  ];
  const isErr = s => /error|ERR|fault|failed|denied|rejected|conflict|blocked|404|FATAL|Overflow/i.test(s);

  let cols = [];       // wall columns
  let shards = [];     // breakout particles
  let dust = [];       // ambient darkroom dust
  let nodes = [];      // agent network
  let inflow = [];     // superintelligence particles

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w > 900 ? w * .62 : w / 2; cy = w > 900 ? h * .5 : h * .38; R = Math.min(w, h) * (w > 900 ? 1 : .95);
    seed = 7;

    const colW = w < 700 ? 120 : 190;
    const n = Math.ceil(w / 2 / colW) + 1;
    cols = [];
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      cols.push({ side, i, speed: 18 + rnd() * 40, off: rnd() * 1000,
        lines: Array.from({ length: 40 }, () => CODE[Math.floor(rnd() * CODE.length)]) });
    }
    shards = Array.from({ length: w < 700 ? 220 : 420 }, () => {
      const side = rnd() < .5 ? -1 : 1;
      const x = cx + side * (w * .12 + rnd() * w * .38), y = rnd() * h;
      const a = Math.atan2(y - cy, x - cx) + (rnd() - .5) * .6;
      return { x, y, a, d: R * (.5 + rnd() * 1.1), s: 3 + rnd() * 12, r: rnd() * 6.28, spin: (rnd() - .5) * 8,
        err: rnd() < .25, ch: CODE[Math.floor(rnd() * CODE.length)][Math.floor(rnd() * 8)] || '{' };
    });
    dust = Array.from({ length: 70 }, () => ({ x: rnd() * w, y: rnd() * h, r: .5 + rnd() * 1.6, v: 4 + rnd() * 12, o: rnd() }));
    const AGENTS = ['Planner', 'Researcher', 'Coder', 'Critic', 'Memory', 'Tool user', 'Vision', 'Voice', 'Router', 'Evaluator', 'Writer', 'Deployer'];
    nodes = AGENTS.map((label, i) => {
      const ring = i < 6 ? 0 : 1;
      const k = ring ? (i - 6) / 6 : i / 6;
      return { label, ring, ang: k * Math.PI * 2 + (ring ? Math.PI / 6 : -Math.PI / 2), rad: R * (ring ? .40 : .25), t0: i / AGENTS.length };
    });
    // extra unlabeled sub-agents
    for (let i = 0; i < 26; i++) nodes.push({ label: '', ring: 2, ang: rnd() * 6.28, rad: R * (.48 + rnd() * .14), t0: .45 + rnd() * .5, small: true });
    inflow = Array.from({ length: w < 700 ? 160 : 300 }, () => ({ a: rnd() * 6.28, r0: R * (.35 + rnd() * .9), sp: .3 + rnd() * .9, s: .6 + rnd() * 1.8 }));
  }

  // ---------- drawing helpers ----------
  function glow(x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function drawPortrait(x, y, size, alpha, develop, circle) {
    if (!portrait.complete || !portrait.naturalWidth || alpha <= 0) return;
    const iw = portrait.naturalWidth, ih = portrait.naturalHeight;
    const s = size / Math.min(iw, ih * .62);
    const dw = iw * s, dh = ih * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (circle) { ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.clip(); }
    ctx.filter = `grayscale(1) contrast(${.3 + develop * .8}) brightness(${2.4 - develop * 1.4})`;
    ctx.drawImage(portrait, x - dw / 2, y - dh * .38, dw, dh);
    ctx.filter = 'none';
    if (develop < 1) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${RED},${.65 * (1 - develop)})`; ctx.fillRect(x - dw / 2, y - dh / 2, dw, dh); }
    ctx.restore();
  }

  // ---------- chapters ----------
  function darkroom(k, t, fadeOut) {
    const a = 1 - fadeOut;
    if (a <= 0) return;
    glow(w * .72, h * .18, R * .9, RED, .45 * a);
    // the print on the developing tray
    const size = R * (.42 + k * .06);
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(cx + w * .12, cy + 10); ctx.rotate(-.04 + k * .03);
    ctx.fillStyle = '#efede7'; ctx.fillRect(-size * .56, -size * .62, size * 1.12, size * 1.34);
    ctx.restore();
    ctx.save(); ctx.translate(cx + w * .12, cy + 10); ctx.rotate(-.04 + k * .03);
    ctx.beginPath(); ctx.rect(-size * .5, -size * .56, size, size * 1.12); ctx.clip();
    drawPortrait(0, -size * .05, size * 1.02, a * clamp(k * 1.6), ease(clamp(k * 1.2)), false);
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const d of dust) {
      const y = (d.y - t * d.v) % h; const yy = y < 0 ? y + h : y;
      ctx.fillStyle = `rgba(${PAPER},${.25 * d.o * a})`; ctx.beginPath(); ctx.arc(d.x, yy, d.r, 0, 6.28); ctx.fill();
    }
  }

  function walls(k, t, shatter) {
    // walls close in as the chapter advances; they vanish when they shatter
    if (k <= 0 || shatter >= 1) return;
    const gap = w * (.5 - ease(k) * .34);          // half-width of the free space in the middle
    const a = (1 - shatter) * clamp(k * 3);
    ctx.font = `${w < 700 ? 11 : 13}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    const colW = w < 700 ? 120 : 190, lh = w < 700 ? 16 : 19;
    for (const c of cols) {
      const x = c.side < 0 ? cx - gap - (c.i + 1) * colW : cx + gap + c.i * colW;
      if (x > w || x + colW < 0) continue;
      const scroll = (t * c.speed + c.off) % (lh * c.lines.length);
      for (let j = 0; j < c.lines.length; j++) {
        let y = j * lh - scroll; if (y < -lh) y += lh * c.lines.length;
        if (y > h) continue;
        const s = c.lines[j], err = isErr(s);
        const depth = 1 - c.i * .22;
        ctx.fillStyle = err ? `rgba(${HOT},${a * .95 * depth})` : `rgba(${PAPER},${a * .28 * depth})`;
        ctx.fillText(s.length > 24 ? s.slice(0, 24) + '…' : s, x + 6, y);
      }
    }
    // the edge of each wall, pressing in
    ctx.fillStyle = `rgba(${RED},${a * .5})`;
    ctx.fillRect(cx - gap - 2, 0, 2, h); ctx.fillRect(cx + gap, 0, 2, h);
    // a small figure trapped between them
    const fig = R * (.16 - ease(k) * .04);
    drawPortrait(cx, cy, fig, a * .9, 1, true);
    ctx.strokeStyle = `rgba(${HOT},${a * .9})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, fig / 2 + 4, 0, 6.28); ctx.stroke();
  }

  function breakout(k, t) {
    if (k <= 0 || k >= 1) return;
    // flash at the moment of impact
    if (k < .25) { ctx.fillStyle = `rgba(255,255,255,${(1 - k / .25) * .35})`; ctx.fillRect(0, 0, w, h); }
    const e = easeOut(k);
    ctx.font = `700 ${w < 700 ? 15 : 20}px ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of shards) {
      const x = p.x + Math.cos(p.a) * p.d * e, y = p.y + Math.sin(p.a) * p.d * e;
      const al = Math.min(1, (1 - k) * 1.4);
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.r + p.spin * e);
      if (p.s > 7) { ctx.fillStyle = p.err ? `rgba(${HOT},${al})` : `rgba(${PAPER},${al * .8})`; ctx.fillText(p.ch, 0, 0); }
      else { ctx.fillStyle = p.err ? `rgba(${HOT},${al})` : `rgba(${PAPER},${al * .6})`; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .5); }
      ctx.restore();
    }
    ctx.textAlign = 'left';
    // the figure grows, free
    const fig = R * (.12 + e * .14);
    glow(cx, cy, fig * 2.2, RED, .5 * (1 - k * .3));
    drawPortrait(cx, cy, fig, 1, 1, true);
  }

  function network(k, t, collapse) {
    if (k <= 0) return;
    const c = ease(collapse);
    const fig = R * (.26 - c * .14);
    glow(cx, cy, R * (.55 + k * .25), RED, .28 + k * .12);
    const pos = nodes.map(n => {
      const ang = n.ang + t * (n.ring === 2 ? .05 : .03) * (n.ring % 2 ? -1 : 1) + c * 4.5;
      const rad = n.rad * (.6 + .4 * easeOut(seg(k, n.t0 * .7, n.t0 * .7 + .25))) * (1 - c * .92);
      return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * .82];
    });
    // edges: hub to agents, agents to neighbours
    nodes.forEach((n, i) => {
      const vis = seg(k, n.t0 * .7, n.t0 * .7 + .2);
      if (vis <= 0) return;
      const [x, y] = pos[i];
      ctx.strokeStyle = `rgba(${n.small ? PAPER : HOT},${(n.small ? .12 : .45) * vis})`; ctx.lineWidth = n.small ? .6 : 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (x - cx) * vis, cy + (y - cy) * vis); ctx.stroke();
      if (!n.small && i < 11 && nodes[i + 1] && !nodes[i + 1].small) {
        const [x2, y2] = pos[i + 1];
        ctx.strokeStyle = `rgba(${PAPER},${.12 * vis})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      }
      // a signal travelling along the edge
      if (!n.small && vis >= 1) {
        const q = (t * .6 + i * .13) % 1;
        ctx.fillStyle = `rgba(255,255,255,${.9 * (1 - c)})`;
        ctx.beginPath(); ctx.arc(cx + (x - cx) * q, cy + (y - cy) * q, 2.2, 0, 6.28); ctx.fill();
      }
    });
    // nodes and labels
    ctx.font = `600 ${w < 700 ? 11 : 13}px Instrument, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    nodes.forEach((n, i) => {
      const vis = seg(k, n.t0 * .7, n.t0 * .7 + .2);
      if (vis <= 0) return;
      const [x, y] = pos[i];
      const r = n.small ? 2.4 : 7;
      ctx.fillStyle = n.small ? `rgba(${PAPER},${.5 * vis})` : `rgba(${HOT},${vis})`;
      ctx.beginPath(); ctx.arc(x, y, r * vis, 0, 6.28); ctx.fill();
      if (!n.small) { ctx.strokeStyle = `rgba(${PAPER},${.6 * vis})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 6.28); ctx.stroke(); }
      if (n.label && c < .5) { ctx.fillStyle = `rgba(${PAPER},${vis * (1 - c * 2)})`; ctx.fillText(n.label, x, y + 13); }
    });
    ctx.textAlign = 'left';
    drawPortrait(cx, cy, fig, 1 - c * .6, 1, true);
    ctx.strokeStyle = `rgba(${HOT},${.9 - c})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, fig / 2 + 6, 0, 6.28); ctx.stroke();
  }

  function singularity(k, t) {
    if (k <= 0) return;
    const e = ease(k);
    // particles spiralling into the core, faster as it grows
    for (const p of inflow) {
      const life = ((t * p.sp * (1 + e * 3)) % 1);
      const r = p.r0 * (1 - life) * (1 - e * .35);
      const a = p.a + life * (3 + e * 6);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .82;
      ctx.fillStyle = `rgba(${life > .7 ? '255,255,255' : HOT},${k * (1 - life * .3)})`;
      ctx.fillRect(x, y, p.s, p.s);
    }
    // the core
    const core = R * (.03 + e * .2);
    glow(cx, cy, core * 4.5, RED, .55 * k);
    glow(cx, cy, core * 1.8, HOT, .7 * k);
    glow(cx, cy, core, '255,255,255', .95 * k);
    // rays
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .08);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI * 2 / 18);
      ctx.fillStyle = `rgba(255,255,255,${.06 * e})`;
      ctx.fillRect(0, -1, R * (.4 + e * .6), 2);
    }
    ctx.restore();
    // the end: the light floods the room
    if (k > .85) { ctx.fillStyle = `rgba(255,255,255,${(k - .85) / .15 * .25})`; ctx.fillRect(0, 0, w, h); }
  }

  // ---------- frame ----------
  let progress = 0, shown = 0, visible = false, last = performance.now();
  function frame(now) {
    if (!visible) { running = false; return; }
    const t = now / 1000;
    shown += (progress - shown) * .14;               // gentle catch-up so scrubbing never jitters
    const p = shown;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

    const k1 = seg(p, W[0][0], W[0][1]), k2 = seg(p, W[1][0], W[1][1]), k3 = seg(p, W[2][0], W[2][1]),
          k4 = seg(p, W[3][0], W[3][1]), k5 = seg(p, W[4][0], W[4][1]);
    darkroom(k1, t, seg(p, .15, .24));
    walls(k2, t, k3 > 0 ? 1 : 0);
    breakout(k3, t);
    network(seg(p, .50, .80), t, seg(p, .80, .93));
    singularity(seg(p, .80, 1), t);

    // chapter text: each chapter fades in and out inside its window
    chapters.forEach((el, i) => {
      const [a, b] = W[i];
      const local = seg(p, a, b);
      const o = i === 4 ? clamp(local * 5) : Math.min(clamp(local * 5), clamp((1 - local) * 5));
      if (Math.abs((+el.dataset.o || 0) - o) > .01) {
        el.dataset.o = o;
        el.style.opacity = o;
        el.style.transform = `translateY(${(1 - o) * 24}px)`;
        el.style.visibility = o < .01 ? 'hidden' : 'visible';
      }
    });
    bar.style.transform = `scaleX(${p})`;
    requestAnimationFrame(frame);
  }
  let running = false;
  const start = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  // progress from the section's own scroll position (works with Lenis and native scroll)
  function measure() {
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    progress = clamp(-r.top / total);
  }
  window.addEventListener('scroll', measure, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { measure(); start(); } }, { rootMargin: '100px' }).observe(section);
  window.addEventListener('resize', () => { build(); measure(); });
  build(); measure();
  portrait.addEventListener('load', () => start());
})();
