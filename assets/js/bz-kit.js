/* =====================================================================
   BÖZER GAMING · Oyun kiti (BZ) — site sürümü (v3.4.3: Kızma Birader, Yalancı Zar, Amiral Battı)
   Ortak yardımcılar: seçiciler, tohumlu rastgelelik, kalıcı ayar, ses sentezi,
   bildirim/pencere/kutlama, başlangıç ekranı, üst çubuk, sonuç tablosu,
   üç boyutlu zar ve özgün iskambil kartları.
   ===================================================================== */
(function (root) {
  'use strict';
  const doc = root.document;
  const $ = (s, e) => (e || doc).querySelector(s);
  const $$ = (s, e) => Array.from((e || doc).querySelectorAll(s));
  function el(html) {
    const t = doc.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /** Tohumlu rastgelelik (mulberry32): aynı tohum aynı oyunu üretir (online kilit adım için) */
  function rng(seed) {
    let a = seed >>> 0 || 1;
    const f = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.state = () => a;
    return f;
  }
  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  const newSeed = () => (Math.random() * 4294967295) >>> 0 || 7;
  /** Kalıcı ayar (localStorage; gizli sekmede de çalışır) */
  function store(key, def) {
    let v = Object.assign({}, def);
    try {
      v = Object.assign({}, def, JSON.parse(localStorage.getItem('bz.' + key) || '{}'));
    } catch (e) {}
    return {
      v,
      save() {
        try {
          localStorage.setItem('bz.' + key, JSON.stringify(v));
        } catch (e) {}
      },
    };
  }
  const BOT_NAMES = ['Ayşe', 'Mehmet', 'Zeynep', 'Mustafa', 'Elif', 'Emre', 'Fatma', 'Burak', 'Selin', 'Kerem', 'Deniz', 'Cem', 'Ebru', 'Oğuz', 'Gizem', 'Murat', 'Hülya', 'Serkan', 'Derya', 'Tolga', 'Nazlı', 'Kaan', 'Ceren', 'Umut'];
  function botNames(n, avoid) {
    const pool = BOT_NAMES.filter((x) => x !== avoid);
    shuffle(pool);
    return pool.slice(0, n);
  }

  /* =====================================================================
     SES (Web Audio ile üretilir; dosya yok)
     ===================================================================== */
  const SND = (() => {
    let ctx = null;
    let out = null;
    let verb = null;
    let on = true;
    function make() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(comp);
      try {
        verb = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 0.8);
        const b = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = b.getChannelData(ch);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
        }
        verb.buffer = b;
        const vg = ctx.createGain();
        vg.gain.value = 0.14;
        verb.connect(vg);
        vg.connect(comp);
      } catch (e) {
        verb = null;
      }
      return ctx;
    }
    const dst = (wet) => (wet && verb ? [out, verb] : [out]);
    function noise(c, dur, freq, q, gain, delay, type, wet) {
      const t = c.currentTime + (delay || 0);
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q || 1;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(f);
      f.connect(g);
      dst(wet).forEach((x) => g.connect(x));
      src.start(t);
    }
    function tone(c, freq, dur, gain, type, delay, slide, wet) {
      const o = c.createOscillator();
      const g = c.createGain();
      const t = c.currentTime + (delay || 0);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.connect(g);
      dst(wet !== false).forEach((x) => g.connect(x));
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const knock = (c, f, dur, gain, delay, wet) => {
      noise(c, dur, f, 3.5, gain, delay, 'bandpass', wet);
      tone(c, f * 0.42, 0.09, gain * 0.45, 'sine', delay, 0.7, wet);
    };
    const S = {
      tap: (c) => knock(c, 2400, 0.04, 0.25),
      click: (c) => knock(c, 3000, 0.03, 0.2),
      select: (c) => tone(c, 880, 0.08, 0.05, 'triangle'),
      flick: (c) => noise(c, 0.07, 2600, 0.8, 0.35, 0, 'highpass'),
      card: (c) => {
        noise(c, 0.09, 1800, 0.7, 0.5, 0, 'bandpass', true);
        knock(c, 1500, 0.05, 0.25, 0.04, true);
      },
      deal: (c) => noise(c, 0.06, 3200, 0.9, 0.3, 0, 'highpass'),
      shuffle: (c) => {
        for (let i = 0; i < 9; i++) noise(c, 0.05, 2000 + Math.random() * 1500, 1, 0.22, i * 0.045);
      },
      place: (c) => knock(c, 1250, 0.07, 0.5, 0, true),
      clack: (c) => knock(c, 3400, 0.03, 0.55, 0, true),
      thud: (c) => {
        tone(c, 120, 0.18, 0.5, 'sine', 0, 0.5);
        noise(c, 0.08, 400, 1, 0.4, 0, 'lowpass');
      },
      roll: (c) => {
        for (let i = 0; i < 7; i++) knock(c, 1800 + Math.random() * 1600, 0.05, 0.22, i * 0.065 + Math.random() * 0.02, i > 4);
      },
      bounce: (c) => {
        knock(c, 2300, 0.05, 0.42, 0, true);
        knock(c, 2650, 0.045, 0.34, 0.035, true);
      },
      bounce2: (c) => knock(c, 2500, 0.04, 0.26, 0, true),
      bounce3: (c) => knock(c, 2700, 0.035, 0.14, 0, false),
      shake: (c) => {
        for (let i = 0; i < 9; i++) knock(c, 1400 + Math.random() * 1400, 0.03, 0.16, i * 0.038 + Math.random() * 0.012, false);
      },
      cup: (c) => {
        tone(c, 180, 0.12, 0.35, 'sine', 0, 0.6);
        noise(c, 0.06, 1200, 0.8, 0.25, 0, 'bandpass');
      },
      pop: (c) => tone(c, 520, 0.09, 0.08, 'sine', 0, 1.9),
      whoosh: (c) => noise(c, 0.28, 900, 0.6, 0.35, 0, 'bandpass'),
      coin: (c) => {
        tone(c, 1318, 0.09, 0.06, 'square', 0);
        tone(c, 1760, 0.22, 0.06, 'square', 0.07);
      },
      ding: (c) => tone(c, 1568, 0.5, 0.07, 'sine'),
      tick: (c) => tone(c, 1200, 0.04, 0.04, 'square'),
      turn: (c) => {
        tone(c, 784, 0.18, 0.05);
        tone(c, 1175, 0.24, 0.045, 'sine', 0.08);
      },
      error: (c) => tone(c, 200, 0.14, 0.06, 'sawtooth'),
      correct: (c) => [784, 988, 1318].forEach((f, i) => tone(c, f, 0.22, 0.07, 'triangle', i * 0.07)),
      wrong: (c) => {
        tone(c, 330, 0.25, 0.08, 'sawtooth', 0, 0.6);
        tone(c, 220, 0.35, 0.07, 'sawtooth', 0.12, 0.6);
      },
      win: (c) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, 0.55, 0.08, 'triangle', 0.12 * i)),
      lose: (c) => [392, 349, 311, 262].forEach((f, i) => tone(c, f, 0.5, 0.06, 'triangle', 0.16 * i)),
      kick: (c) => {
        tone(c, 160, 0.12, 0.6, 'sine', 0, 0.4);
        noise(c, 0.06, 900, 1, 0.5);
      },
      whistle: (c) => {
        tone(c, 2900, 0.35, 0.05, 'sine', 0, 1.02, false);
        tone(c, 3050, 0.35, 0.03, 'square', 0, 1.02, false);
      },
      cheer: (c) => {
        for (let i = 0; i < 6; i++) noise(c, 0.9, 700 + i * 260, 0.5, 0.12, i * 0.05, 'bandpass', true);
      },
      groan: (c) => noise(c, 0.8, 300, 0.7, 0.3, 0, 'lowpass', true),
      splash: (c) => {
        noise(c, 0.45, 1200, 0.5, 0.5, 0, 'highpass', true);
        noise(c, 0.3, 500, 0.6, 0.3, 0.05, 'bandpass', true);
      },
      boom: (c) => {
        tone(c, 90, 0.6, 0.7, 'sine', 0, 0.35);
        noise(c, 0.7, 300, 0.6, 0.6, 0, 'lowpass', true);
      },
      buzz: (c) => tone(c, 140, 0.4, 0.09, 'square', 0, 0.98),
      stone: (c) => knock(c, 2000 + Math.random() * 600, 0.05, 0.3, 0, true),
      puck: (c) => knock(c, 2800, 0.035, 0.5, 0, false),
      goal: (c) => {
        noise(c, 0.5, 1500, 0.4, 0.4, 0, 'bandpass', true);
        [523, 784, 1047].forEach((f, i) => tone(c, f, 0.35, 0.06, 'square', 0.05 + i * 0.09));
      },
    };
    return {
      play(k) {
        if (!on || !S[k]) return;
        try {
          const c = make();
          if (!c) return;
          if (c.state !== 'running') c.resume().catch(() => {});
          S[k](c);
        } catch (e) {}
      },
      setOn(v) {
        on = !!v;
      },
      get on() {
        return on;
      },
      unlock() {
        try {
          const c = make();
          if (c && c.state !== 'running') c.resume().catch(() => {});
        } catch (e) {}
      },
    };
  })();
  const haptic = (ms) => {
    try {
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms || 20);
    } catch (e) {}
  };

  /* =====================================================================
     SİMGELER
     ===================================================================== */
  const ICONS = {
    menu: '<line x1="4" x2="20" y1="7" y2="7"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="17" y2="17"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    vol: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    mute: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    again: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    trophy: '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    compress: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    dice: '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  };
  const icon = (k, s, sw) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

  /* =====================================================================
     BİLDİRİM, PENCERE, KUTLAMA
     ===================================================================== */
  function layer(cls) {
    let n = $('.' + cls);
    if (!n) {
      n = el(`<div class="${cls}"></div>`);
      doc.body.appendChild(n);
    }
    return n;
  }
  function toast(text, kind, ms) {
    const box = layer('bz-toasts');
    const t = el(`<div class="bz-toast ${kind || ''}">${text}</div>`);
    box.appendChild(t);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => t.classList.add('out'), ms || 2200);
    setTimeout(() => t.remove(), (ms || 2200) + 320);
  }
  /** Pencere: html içinde data-m="..." düğmeleri onAction(m) çağırır; dönüş: kapatma işlevi */
  function modal(html, onAction, opts) {
    opts = opts || {};
    const box = layer('bz-modals');
    const w = el(`<div class="bz-mwrap"${opts.name ? ` data-modal="${opts.name}"` : ''}><div class="bz-mbox ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`);
    const close = () => w.remove();
    w.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) {
        SND.play('tap');
        const r = onAction ? onAction(b.dataset.m, close, b) : null;
        if (r !== false && b.dataset.keep == null) close();
        return;
      }
      if (e.target === w && opts.dismiss !== false) {
        close();
        if (opts.onDismiss) opts.onDismiss();
      }
    });
    box.appendChild(w);
    const f = w.querySelector('[data-m].gold, [data-m]');
    if (f && !opts.noFocus) setTimeout(() => f.focus({ preventScroll: true }), 30);
    return close;
  }
  const closeModals = () => $$('.bz-modals .bz-mwrap').forEach((n) => n.remove());
  const hasModal = () => !!$('.bz-modals .bz-mwrap');
  function banner(title, sub, good, ms) {
    const b = el(`<div class="bz-banner${good === false ? ' bad' : ''}"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
    doc.body.appendChild(b);
    const t = ms || 1700;
    setTimeout(() => b.classList.add('out'), t);
    setTimeout(() => b.remove(), t + 400);
  }
  function confetti(n, colors) {
    if (reduceMotion) return;
    const box = el('<div class="bz-confetti" aria-hidden="true"></div>');
    const cs = colors || ['#f8e2a4', '#e2bf6e', '#ec5a5f', '#4fd690', '#63a6ff', '#ffffff'];
    let h = '';
    for (let i = 0; i < (n || 90); i++) {
      const left = Math.random() * 100;
      const dur = 1.8 + Math.random() * 1.8;
      h += `<i style="left:${left}vw;background:${cs[i % cs.length]};--dx:${Math.round((Math.random() - 0.5) * 240)}px;--rot:${Math.round(Math.random() * 1080 - 540)}deg;animation-duration:${dur}s;animation-delay:${Math.random() * 0.5}s"></i>`;
    }
    box.innerHTML = h;
    doc.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }

  /* ---------------- tam ekran (sitede oyun katmanı, tek sayfada tarayıcı) ---------------- */
  const isFull = () => {
    try {
      if (root.BGT && root.BGT.isFull) return root.BGT.isFull();
    } catch (e) {}
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  };
  function toggleFull() {
    try {
      if (root.BGT && root.BGT.fullscreen) return root.BGT.fullscreen();
    } catch (e) {}
    const de = doc.documentElement;
    try {
      if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
      else (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    } catch (e) {}
  }
  const fullBtn = () => `<button class="bz-ib" data-a="full" aria-label="${isFull() ? 'Tam ekrandan çık' : 'Tam ekran'}" title="${isFull() ? 'Tam ekrandan çık' : 'Tam ekran'}">${icon(isFull() ? 'compress' : 'expand', 20)}</button>`;
  function refreshFull() {
    let inSite = false;
    try {
      inSite = !!(root.BGT && root.BGT.inSite && root.BGT.inSite());
    } catch (e) {}
    doc.documentElement.classList.toggle('bz-insite', inSite);
    doc.documentElement.classList.toggle('bz-full', isFull());
    $$('[data-a="full"]').forEach((b) => {
      b.innerHTML = icon(isFull() ? 'compress' : 'expand', 20);
      b.setAttribute('aria-label', isFull() ? 'Tam ekrandan çık' : 'Tam ekran');
      b.title = b.getAttribute('aria-label');
    });
  }
  root.addEventListener('resize', () => setTimeout(refreshFull, 80));
  doc.addEventListener('fullscreenchange', refreshFull);

  /* =====================================================================
     EKRANLAR
     ===================================================================== */
  /** Başlangıç ekranı. cfg: { root, key, title, tagline, chips, art, options:[{key,label,choices:[[v,label]]}],
      settings (kalıcı nesne), actions:[{id,label,kind,icon}], onAction(id), rules } */
  function startScreen(cfg) {
    const s = cfg.settings;
    const seg = (o) =>
      `<div class="bz-seg" role="group" aria-label="${esc(o.label)}">${o.choices
        .map(([v, l]) => `<button type="button" data-k="${o.key}" data-v="${esc(v)}" aria-pressed="${String(s[o.key]) === String(v)}">${l}</button>`)
        .join('')}</div>`;
    const opts = (cfg.options || []).filter((o) => !o.when || o.when(s));
    cfg.root.innerHTML = `<div class="bz-start"><div class="bz-start-in">
      <div class="bz-top"><span class="bz-brand">${icon('grid', 18)}<span><b>BÖZER</b> GAMING</span></span>
        <span class="bz-top-r">${fullBtn()}<button class="bz-ib" data-a="snd" aria-label="Ses">${icon(SND.on ? 'vol' : 'mute', 20)}</button></span></div>
      <section class="bz-hero"><div><h1>${cfg.title}</h1><p>${cfg.tagline}</p><div class="bz-chips">${(cfg.chips || []).map((c) => `<span class="bz-chip">${c}</span>`).join('')}</div></div>
        <div class="bz-art" aria-hidden="true">${cfg.art || ''}</div></section>
      <div class="bz-panels${cfg.online ? ' two' : ''}">
      <section class="bz-panel"><h2>${cfg.panelTitle || 'Oyun ayarları'}</h2><div class="bz-opts">
        ${opts.map((o) => `<div class="bz-opt"><span>${o.label}</span>${o.input ? o.input(s) : seg(o)}</div>`).join('')}
      </div>
      <div class="bz-acts">${(cfg.actions || []).map((a) => `<button class="bz-btn ${a.kind || ''}" data-go="${a.id}">${a.icon ? icon(a.icon, 18) : ''}${a.label}</button>`).join('')}
        ${cfg.online ? '' : `<button class="bz-btn ghost" data-go="rules">${icon('book', 17)} Nasıl oynanır</button>`}</div></section>
      ${cfg.online ? `<section class="bz-panel bz-online"><h2>${cfg.online.title || 'Online'}</h2><p>${cfg.online.text || ''}</p>
        <div class="bz-acts"><button class="bz-btn gold big" data-go="online">${icon('users', 18)} ${cfg.online.label || 'Online masalar'}</button>
        <button class="bz-btn ghost" data-go="rules">${icon('book', 17)} Nasıl oynanır</button></div></section>` : ''}
      </div>
    </div></div>`;
    cfg.root.onclick = (e) => {
      SND.unlock();
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'snd') {
        SND.setOn(!SND.on);
        s.sound = SND.on;
        if (cfg.save) cfg.save();
        b.innerHTML = icon(SND.on ? 'vol' : 'mute', 20);
        return;
      }
      if (b.dataset.a === 'full') {
        toggleFull();
        setTimeout(refreshFull, 120);
        return;
      }
      if (b.dataset.k) {
        const o = (cfg.options || []).find((x) => x.key === b.dataset.k);
        const raw = b.dataset.v;
        const v = o && o.choices.find(([x]) => String(x) === raw);
        s[b.dataset.k] = v ? v[0] : raw;
        if (cfg.onChange) cfg.onChange(b.dataset.k, s[b.dataset.k], s);
        if (cfg.save) cfg.save();
        SND.play('select');
        return startScreen(cfg);
      }
      if (b.dataset.go === 'rules') return showRules(cfg.title, cfg.rules);
      if (b.dataset.go) {
        SND.play('tap');
        cfg.onAction(b.dataset.go);
      }
    };
    cfg.root.oninput = (e) => {
      if (e.target.dataset.in) {
        s[e.target.dataset.in] = e.target.value;
        if (cfg.save) cfg.save();
      }
    };
    refreshFull();
  }
  function showRules(title, html) {
    modal(`<h2>${title} · Kurallar</h2><div class="bz-rules">${html}</div><div class="bz-acts"><button class="bz-btn gold" data-m="ok">Anladım</button></div>`);
  }
  /** Üst çubuk. cfg: { root, title, sub, onMenu, right } → { sub(t), msg(t, cls) } */
  function hud(cfg) {
    cfg.root.innerHTML = `<button class="bz-ib" data-a="menu" aria-label="Menü">${icon('menu', 20)}</button>
      <div class="bz-hud-t"><b>${cfg.title}</b><span data-sub>${cfg.sub || ''}</span></div>
      <div class="bz-hud-mid"><span class="bz-msg" data-msg hidden></span></div>
      ${cfg.right || ''}${cfg.chat ? `<button class="bz-ib bz-tchat" data-a="tchat" aria-label="Masa sohbeti" hidden>${icon('chat', 20)}</button>` : ''}${cfg.full === false ? '' : fullBtn()}<button class="bz-ib" data-a="snd" aria-label="Ses">${icon(SND.on ? 'vol' : 'mute', 20)}</button>`;
    cfg.root.onclick = (e) => {
      SND.unlock();
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'menu') return cfg.onMenu && cfg.onMenu();
      if (b.dataset.a === 'full') {
        toggleFull();
        setTimeout(refreshFull, 120);
        return;
      }
      if (b.dataset.a === 'snd') {
        SND.setOn(!SND.on);
        if (cfg.onSound) cfg.onSound(SND.on);
        b.innerHTML = icon(SND.on ? 'vol' : 'mute', 20);
        return;
      }
      if (cfg.onAction) cfg.onAction(b.dataset.a, b);
    };
    const m = $('[data-msg]', cfg.root);
    // online masa sohbeti (sitede tam ekrandayken burada; değilken sitenin üst çubuğunda)
    const tc = $('[data-a="tchat"]', cfg.root);
    if (tc && root.BGT && root.BGT.chat && root.BGT.chat.bind) {
      tc.removeAttribute('data-a');
      root.BGT.chat.bind(tc);
    }
    refreshFull();
    return {
      sub: (t) => ($('[data-sub]', cfg.root).textContent = t),
      msg(t, cls) {
        m.hidden = !t;
        m.className = 'bz-msg ' + (cls || '');
        m.textContent = t || '';
      },
    };
  }
  /** Oyun menüsü: devam, kurallar, yeniden başlat, ana menü, vitrin */
  function gameMenu(o) {
    modal(
      `<h2>Menü</h2><div class="bz-acts" style="flex-direction:column;align-items:stretch;justify-content:flex-start">
        <button class="bz-btn gold" data-m="resume">${icon('play', 17)} Devam et</button>
        <button class="bz-btn" data-m="rules">${icon('book', 17)} Kurallar</button>
        ${o.extra || ''}
        ${o.online ? '' : `<button class="bz-btn" data-m="restart">${icon('again', 17)} Yeniden başlat</button>`}
        <button class="bz-btn" data-m="home">${icon(o.online ? 'users' : 'home', 17)} ${o.homeLabel || 'Oyun ayarlarına dön'}</button></div>`,
      (m) => {
        if (m === 'rules') return showRules(o.title, o.rules);
        if (o.onAction) o.onAction(m);
      },
    );
  }
  /** Sonuç penceresi. rows: [{name, val, me, win}] */
  function results(o) {
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1 + '.';
    let place = 0;
    const rows = o.rows
      .map((r, i) => {
        if (i > 0 && r.val !== o.rows[i - 1].val) place = i;
        return `<li class="${r.win ? 'win' : ''}${r.me ? ' me' : ''}"><span>${o.noMedal ? i + 1 + '.' : medal(o.tiePlaces === false ? i : place)}</span><b>${esc(r.name)}</b><i>${r.label != null ? r.label : r.val}</i></li>`;
      })
      .join('');
    modal(
      `<div style="text-align:center">${icon('trophy', 40, 1.6)}</div><h2 style="text-align:center">${o.title}</h2>${o.sub ? `<p style="text-align:center">${o.sub}</p>` : ''}
       <ol class="bz-res">${rows}</ol>${o.extra || ''}
       <div class="bz-acts"><button class="bz-btn" data-m="home">${icon('home', 17)} Ayarlar</button><button class="bz-btn gold" data-m="again">${icon('again', 17)} Tekrar oyna</button></div>`,
      (m) => {
        if (m === 'again' && o.onAgain) o.onAgain();
        if (m === 'home' && o.onHome) o.onHome();
      },
      { name: 'results', dismiss: false },
    );
  }

  /* =====================================================================
     ÜÇ BOYUTLU ZAR
     ===================================================================== */
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const faceHTML = (v) => `<div class="f f${v}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].indexOf(i + 1) >= 0 ? 'on' : ''}"></i>`).join('')}</div>`;
  const dieRot = (v, z, tx, ty) => `rotateZ(${z || 0}deg) rotateX(${FACE_ROT[v][0] + (tx || 0)}deg) rotateY(${FACE_ROT[v][1] + (ty || 0)}deg)`;
  /** Zar öğesi (v: 1..6; v boşsa rastgele duruş) */
  function dieHTML(v, size, z, cls) {
    v = v || 1;
    return `<div class="bz-die ${cls || ''}" data-v="${v}" style="--ds:${size || 52}px"><div class="sh"></div><div class="cube" style="transform:${dieRot(v, z || 0)}">${[1, 2, 3, 4, 5, 6].map(faceHTML).join('')}</div></div>`;
  }
  function setDie(node, v, z) {
    node.dataset.v = v;
    $('.cube', node).style.transform = dieRot(v, z || 0);
  }
  /**
   * Zar at: node'lar yerinde durur, dx/dy kadar öteden dönerek gelip seker ve v değerinde oturur.
   * o: { from: {x, y} (piksel ofset), dur }
   */
  function rollDice(nodes, values, o) {
    o = o || {};
    const T = reduceMotion ? 1 : o.dur || 950;
    SND.play('roll');
    if (T < 50 || !nodes[0] || !nodes[0].animate) {
      nodes.forEach((n, i) => setDie(n, values[i], o.z ? o.z[i] : 0));
      return Promise.resolve();
    }
    nodes.forEach((n, i) => {
      const v = values[i];
      const z = o.z ? o.z[i] : Math.round((Math.random() - 0.5) * 30);
      const fx = (o.from ? o.from.x : 0) + (Math.random() - 0.5) * 60;
      const fy = (o.from ? o.from.y : 120) + (Math.random() - 0.5) * 30;
      const lag = i * 0.04;
      const k = (f) => Math.min(1, lag + f * (1 - lag));
      n.animate(
        [
          { transform: `translate(${fx}px, ${fy}px) scale(1.5)`, offset: 0, easing: 'cubic-bezier(.35,0,.75,.45)' },
          { transform: `translate(${fx * 0.3}px, ${fy * 0.22}px) scale(1)`, offset: k(0.42), easing: 'cubic-bezier(.2,.6,.4,1)' },
          { transform: `translate(${fx * 0.14}px, ${fy * 0.1}px) scale(1.15)`, offset: k(0.57), easing: 'cubic-bezier(.5,0,.8,.5)' },
          { transform: `translate(${fx * 0.05}px, ${fy * 0.035}px) scale(1)`, offset: k(0.73), easing: 'cubic-bezier(.2,.6,.4,1)' },
          { transform: 'translate(0, 0) scale(1)', offset: 1 },
        ],
        { duration: T, fill: 'both' },
      );
      const sx = 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
      const sy = 360 * (1 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
      const cube = $('.cube', n);
      cube.animate(
        [
          { transform: `rotateZ(${z + (Math.random() - 0.5) * 280}deg) rotateX(${FACE_ROT[v][0] + sx}deg) rotateY(${FACE_ROT[v][1] + sy}deg)` },
          { transform: dieRot(v, z), offset: 0.86 },
          { transform: dieRot(v, z) },
        ],
        { duration: T, easing: 'cubic-bezier(.18,.62,.28,1)', fill: 'both' },
      );
      cube.style.transform = dieRot(v, z);
      n.dataset.v = v;
    });
    setTimeout(() => SND.play('bounce'), T * 0.42);
    setTimeout(() => SND.play('bounce'), T * 0.73);
    return sleep(T + 20);
  }

  /**
   * v3.4.3: gerçekçi zar atışı. Zarlar atanın tarafından havaya fırlar, yerçekimiyle üç kez seker (her
   * sekmede yükseklik ve dönüş azalır), gölge yükseklikle kayar ve büyür, sonunda kısa bir kayışla oturur ve
   * üst yüz parlar. box: konumlu kap. o: { values, at:[{x,y}] (zar merkezi), from:{x,y}, size, dur, height, z }
   * Döner: Promise(zar öğeleri). Zarlar kapta kalır (sonraki atışta temizlenir).
   */
  function throwDice(box, o) {
    const size = o.size || 56;
    const T = reduceMotion ? 0 : Math.max(0, o.dur == null ? 1300 : o.dur);
    const nodes = o.values.map((v, i) => {
      const z = o.z ? o.z[i] : Math.round((Math.random() - 0.5) * 50);
      const n = el(dieHTML(v, size, z, 'bz-throw'));
      n.style.left = o.at[i].x - size / 2 + 'px';
      n.style.top = o.at[i].y - size / 2 + 'px';
      n.dataset.z = z;
      box.appendChild(n);
      return n;
    });
    const land = () =>
      nodes.forEach((n) => {
        n.classList.remove('land');
        void n.offsetWidth;
        n.classList.add('land');
      });
    if (!T || T < 60 || !nodes[0].animate) {
      land();
      return Promise.resolve(nodes);
    }
    SND.play('roll');
    const H0 = o.height || 150;
    const B = [0.36, 0.58, 0.74, 0.85]; // yere değme anları
    const hs = [H0, H0 * 0.34, H0 * 0.12, H0 * 0.04];
    const hAt = (t) => {
      if (t <= B[0]) {
        const k = t / B[0];
        return hs[0] * (1 - k * k);
      }
      for (let j = 1; j < B.length; j++) {
        if (t <= B[j]) {
          const u = (t - B[j - 1]) / (B[j] - B[j - 1]);
          return hs[j] * 4 * u * (1 - u);
        }
      }
      return 0;
    };
    const K = 34;
    nodes.forEach((n, i) => {
      const v = o.values[i];
      const z = +n.dataset.z;
      const lag = i * 0.035;
      const fx = o.from.x - o.at[i].x + (Math.random() - 0.5) * size * 0.8;
      const fy = o.from.y - o.at[i].y + (Math.random() - 0.5) * size * 0.8;
      const sx = 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
      const sy = 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
      const sz = (Math.random() - 0.5) * 260;
      const kw = [];
      const kc = [];
      const ks = [];
      for (let k = 0; k <= K; k++) {
        const t0 = k / K;
        const t = Math.max(0, Math.min(1, (t0 - lag) / (1 - lag)));
        const h = hAt(t);
        const d = 1 - Math.pow(1 - t, 2.6); // sürtünmeyle yavaşlayan ilerleme
        const x = fx * (1 - d);
        const y = fy * (1 - d) - h * 0.32;
        const sc = 1 + (h / H0) * 0.55;
        // değme anında hafif ezilme
        let sq = 1;
        for (let j = 0; j < B.length; j++) if (Math.abs(t - B[j]) < 0.018) sq = 1 - 0.07 * (1 - j / B.length);
        kw.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(sc * (2 - sq)).toFixed(3)}, ${(sc * sq).toFixed(3)})`, offset: t0 });
        const r = Math.pow(1 - t, 2.3); // kalan dönüş
        const wob = t > B[3] ? Math.sin((t - B[3]) * 40) * 5 * (1 - t) : 0;
        kc.push({ transform: `rotateZ(${(z + sz * r + wob).toFixed(1)}deg) rotateX(${(FACE_ROT[v][0] + sx * r).toFixed(1)}deg) rotateY(${(FACE_ROT[v][1] + sy * r).toFixed(1)}deg)`, offset: t0 });
        ks.push({ transform: `translate(${(4 + h * 0.22).toFixed(1)}px, ${(7 + h * 0.42).toFixed(1)}px) scale(${(1 + (h / H0) * 0.6).toFixed(3)})`, opacity: (0.55 - (h / H0) * 0.38).toFixed(3), offset: t0 });
      }
      n.animate(kw, { duration: T, easing: 'linear', fill: 'both' });
      $('.cube', n).animate(kc, { duration: T, easing: 'linear', fill: 'both' });
      $('.sh', n).animate(ks, { duration: T, easing: 'linear', fill: 'both' });
    });
    setTimeout(() => SND.play('bounce'), T * B[0]);
    setTimeout(() => SND.play('bounce2'), T * B[1]);
    setTimeout(() => SND.play('bounce3'), T * B[2]);
    return sleep(T + 20).then(() => {
      land();
      return nodes;
    });
  }
  /** Zarı elde sallama (atmadan önce kısa titreşim) */
  function shakeDie(node, ms) {
    if (reduceMotion || !node || !node.animate) return Promise.resolve();
    SND.play('shake');
    const T = ms || 360;
    const kf = [];
    for (let k = 0; k <= 10; k++) kf.push({ transform: `translate(${k % 2 ? 4 : -4}px, ${k % 3 ? -3 : 3}px) rotate(${k % 2 ? 9 : -9}deg)`, offset: k / 10 });
    kf[10] = { transform: 'none', offset: 1 };
    node.animate(kf, { duration: T, easing: 'linear' });
    return sleep(T);
  }

  /* =====================================================================
     İSKAMBİL (özgün çizim: köşe indeksleri, pip dizilimi, özgün saray kartları)
     ===================================================================== */
  const SUITS = ['S', 'H', 'D', 'C'];
  const SUIT_NAME = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek' };
  const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK = (r) => (r === 1 || r === 14 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r));
  const isRed = (s) => s === 'H' || s === 'D';
  const SUIT_PATH = {
    H: '<path d="M50 90 C22 66 6 48 6 30 C6 15 17 5 30 5 C40 5 47 11 50 19 C53 11 60 5 70 5 C83 5 94 15 94 30 C94 48 78 66 50 90 Z"/>',
    D: '<path d="M50 3 L88 50 L50 97 L12 50 Z"/>',
    S: '<path d="M50 4 C41 22 7 38 7 61 C7 75 17 84 30 84 C38 84 44 80 47 74 C46 84 42 90 33 96 L67 96 C58 90 54 84 53 74 C56 80 62 84 70 84 C83 84 93 75 93 61 C93 38 59 22 50 4 Z"/>',
    C: '<circle cx="50" cy="28" r="20"/><circle cx="27" cy="60" r="20"/><circle cx="73" cy="60" r="20"/><path d="M45 50 L55 50 C55 75 60 87 68 96 L32 96 C40 87 45 75 45 50 Z"/>',
  };
  const PIP_POS = {
    1: [[125, 175, 2.2]],
    2: [[125, 78], [125, 272]],
    3: [[125, 78], [125, 175], [125, 272]],
    4: [[78, 78], [172, 78], [78, 272], [172, 272]],
    5: [[78, 78], [172, 78], [125, 175], [78, 272], [172, 272]],
    6: [[78, 78], [172, 78], [78, 175], [172, 175], [78, 272], [172, 272]],
    7: [[78, 78], [172, 78], [125, 126], [78, 175], [172, 175], [78, 272], [172, 272]],
    8: [[78, 78], [172, 78], [125, 126], [78, 175], [172, 175], [125, 224], [78, 272], [172, 272]],
    9: [[78, 78], [172, 78], [78, 143], [172, 143], [125, 175], [78, 207], [172, 207], [78, 272], [172, 272]],
    10: [[78, 78], [172, 78], [125, 110], [78, 143], [172, 143], [78, 207], [172, 207], [125, 240], [78, 272], [172, 272]],
  };
  const suitUse = (s, x, y, sz, flip, col) =>
    `<g transform="translate(${x - sz / 2} ${y - sz / 2}) ${flip ? `rotate(180 ${sz / 2} ${sz / 2})` : ''} scale(${sz / 100})" fill="${col}">${SUIT_PATH[s]}</g>`;
  const COURT = {
    11: (c) => `<path d="M125 112 l10 40 h-20 z" fill="${c}" opacity=".85"/><rect x="117" y="150" width="16" height="70" rx="3" fill="${c}" opacity=".85"/><rect x="100" y="146" width="50" height="8" rx="4" fill="#c9a24b"/>`,
    12: (c) => `<path d="M95 150 q30 -55 60 0 q-30 -18 -60 0z" fill="${c}" opacity=".85"/><circle cx="125" cy="118" r="9" fill="#c9a24b"/><path d="M98 156h54" stroke="#c9a24b" stroke-width="6" stroke-linecap="round"/>`,
    13: (c) => `<path d="M92 158 l8 -42 l18 22 l7 -30 l7 30 l18 -22 l8 42 z" fill="#c9a24b" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="114" r="5" fill="${c}"/><circle cx="150" cy="114" r="5" fill="${c}"/><circle cx="125" cy="84" r="5" fill="${c}"/>`,
  };
  /** Kart yüzü SVG (c: {s, r}) */
  function cardSVG(c, o) {
    o = o || {};
    if (!c) return backSVG(o);
    const col = isRed(c.s) ? '#c1272d' : '#16181d';
    const r = c.r === 14 ? 1 : c.r;
    const rk = RANK(r);
    const idx = (flip) =>
      `<g ${flip ? 'transform="rotate(180 125 175)"' : ''}><text x="${rk === '10' ? 31 : 32}" y="52" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${rk === '10' ? 40 : 46}" text-anchor="middle" fill="${col}" letter-spacing="${rk === '10' ? -3 : 0}">${rk}</text>${suitUse(c.s, 32, 76, 30, false, col)}</g>`;
    let mid = '';
    if (r >= 11) {
      mid = `<rect x="58" y="58" width="134" height="234" rx="14" fill="${isRed(c.s) ? '#fff1ef' : '#f1f3f7'}" stroke="${col}" stroke-width="3"/>
        <rect x="66" y="66" width="118" height="218" rx="10" fill="none" stroke="#c9a24b" stroke-width="2.5"/>
        ${COURT[r](col)}
        <text x="125" y="268" font-family="Georgia, serif" font-weight="700" font-size="44" text-anchor="middle" fill="${col}">${rk}</text>
        ${suitUse(c.s, 125, 196, 40, false, col)}`;
    } else {
      mid = PIP_POS[r].map(([x, y, k]) => suitUse(c.s, x, y, k ? 30 * k : 40, y > 180, col)).join('');
    }
    return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-label="${SUIT_NAME[c.s]} ${rk}"><rect x="2" y="2" width="246" height="346" rx="20" fill="#fffdf7" stroke="rgba(0,0,0,.18)" stroke-width="3"/>${idx(false)}${idx(true)}${mid}</svg>`;
  }
  function backSVG(o) {
    const a = (o && o.back) || '#7d1f2a';
    const b = (o && o.back2) || '#4a0f18';
    return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-label="Kapalı kart"><defs><pattern id="bzlat" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="${b}"/><path d="M0 11h22M11 0v22" stroke="${a}" stroke-width="5"/></pattern></defs>
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#fffdf7" stroke="rgba(0,0,0,.2)" stroke-width="3"/><rect x="14" y="14" width="222" height="322" rx="13" fill="url(#bzlat)"/>
      <rect x="14" y="14" width="222" height="322" rx="13" fill="none" stroke="#e2bf6e" stroke-width="3"/><circle cx="125" cy="175" r="44" fill="${b}" stroke="#e2bf6e" stroke-width="4"/>
      <text x="125" y="191" font-family="Georgia, serif" font-weight="700" font-size="44" text-anchor="middle" fill="#f8e2a4">BG</text></svg>`;
  }
  const deck52 = () => {
    const d = [];
    for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ s, r, id: s + r });
    return d;
  };

  /* =====================================================================
     SİTE OYUNU KABUĞU (v3.4.3): ekranlar, online masalar (BGT), adres parametreleri
     cfg: { game, name, seatCounts, defSeats, rules, tiers, seatTag, onPlay(sess), onOffline(), onStart(),
            avatarEl(uid, seat), onBack() }
     ===================================================================== */
  function shell(cfg) {
    const NET = root.BGT || null;
    const sh = {
      NET,
      show(id) {
        ['start', 'net', 'game'].forEach((k) => {
          const n = doc.getElementById(k);
          if (n) n.hidden = k !== id;
        });
        doc.body.classList.toggle('in-game', id === 'game');
      },
      online() {
        if (!NET || !NET.inSite()) return toast('Online oyun için oyunu Bözer Gaming sitesinden aç.', 'bad');
        if (!NET.authed()) return NET.goLogin();
        sh.show('net');
        NET.openLobby();
      },
      lobby() {
        if (NET && NET.inSite()) {
          NET.closeTable(true);
          sh.show('net');
          NET.openLobby();
        } else {
          sh.show('start');
          cfg.onStart();
        }
      },
      async leave(net, spect) {
        if (spect) return sh.lobby();
        const ok = await NET.confirm('Masadan çıkılsın mı?', 'Koltuğunda bot oynamaya devam eder. Bu masaya oyuncu olarak geri dönemezsin; istersen izleyebilirsin.', 'Masadan çık', 'danger');
        if (!ok) return false;
        try {
          await net.leave();
        } catch (e) {}
        sh.lobby();
        return true;
      },
      boot() {
        if (NET) {
          NET.mount({
            game: cfg.game,
            name: cfg.name,
            root: doc.getElementById('net'),
            seatCounts: cfg.seatCounts,
            defSeats: cfg.defSeats,
            seatDir: -1,
            tiers: !!cfg.tiers,
            rules: cfg.rules,
            seatTag: cfg.seatTag,
            toast: (t, k) => toast(esc(t), k === 'err' ? 'bad' : k === 'good' ? 'good' : ''),
            onPlay: (sess) => cfg.onPlay(sess),
            mySeat: cfg.mySeat,
            avatarEl: cfg.avatarEl,
            onBack: () => {
              sh.show('start');
              cfg.onStart();
            },
          });
          const q = NET.params || {};
          if (q.masa && NET.authed()) {
            sh.show('net');
            NET.openTable(q.masa, { watch: q.izle === '1', who: q.kim || '' }).catch((e) => {
              toast(esc(e.message || 'Masa açılamadı'), 'bad');
              NET.openLobby();
            });
            return;
          }
          if (q.mod === 'online' && NET.authed()) {
            sh.show('net');
            NET.openLobby();
            return;
          }
          if (q.mod === 'bot' && cfg.onOffline) return cfg.onOffline();
        }
        sh.show('start');
        cfg.onStart();
      },
    };
    return sh;
  }
  /** Sıra süresi göstergesi: kalan oran (0..1) */
  const timeLeft = (start, sec, now) => (sec > 0 ? Math.max(0, 1 - ((now || Date.now()) - start) / (sec * 1000)) : 1);

  root.BZ = {
    shell, timeLeft,
    $, $$, el, esc, sleep, clamp, lerp, rng, shuffle, newSeed, store, botNames, reduceMotion,
    snd: SND, haptic, icon, toast, modal, closeModals, hasModal, banner, confetti,
    startScreen, showRules, hud, gameMenu, results, isFull, toggleFull, refreshFull,
    dieHTML, setDie, rollDice, dieRot, throwDice, shakeDie,
    cards: { SUITS, SUIT_NAME, SUIT_SYM, RANK, isRed, cardSVG, backSVG, deck52, suitUse, SUIT_PATH },
  };
})(window);
