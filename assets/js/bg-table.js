/* =====================================================================
   Bözer Gaming — online masa katmanı
   Americano Online ve Dost Kazığı Online için ortak parça: online lobi,
   masa kurma, bekleme odası (koltuk seçme, hazır, başlatma), hamle
   eşitleme, bağlantısı kopan oyuncunun yerine bot, izleyiciler ve masa
   sohbeti. Oyunun kuralları tarayıcıda çalışır; sunucu yalnızca masayı,
   koltukları ve sıra numaralı hamle kaydını tutar (kurulum.sql → 8b).
   ===================================================================== */
(function () {
  'use strict';
  const T = (window.BGT = window.BGT || {});
  const AWAY_MS = 20000; // bu kadar süre ses vermeyen oyuncunun yerine bot oynar
  const DRIVER_MS = 12000; // botları yöneten tarayıcı bu kadar sessiz kalırsa sıradaki devralır
  const PING_MS = 5000;
  const PAGE = 800; // sunucunun tek seferde verdiği hamle sayısı

  /* ---------------- yardımcılar ---------------- */
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  T.esc = esc;
  T.el = el;

  /* ---------------- ses: iPhone / iPad kilidi ve sessiz mod (v3.3) ----------------
     iOS Safari'de Web Audio ancak bir dokunuşun içinde başlar, uygulama değişince
     "interrupted" durumunda kalabilir ve telefon yan anahtardan sessize alınmışsa
     varsayılan olarak susar. Oyunların ses bağlamları buraya kaydolur: her dokunuşta
     duran bağlam sürdürülür, ilk dokunuşta tek örneklik sessiz ses çalınır (eski iOS),
     ses oturumu "oynatma" türüne alınır (iOS 17+: navigator.audioSession; daha eskide
     sessiz, döngülü bir <audio>). Böylece oyun sesleri sessiz modda da duyulur; oyunun
     ses ayarından kapatılabilir. Oyunun sesi kapalıysa oturum serbest bırakılır. */
  const AU = (T.audio = T.audio || {});
  (function () {
    const ctxs = [];
    const ua = navigator.userAgent || '';
    const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const KEY = 'bg.snd.silentok';
    let pref = true;
    let want = true;
    let tag = null;
    try {
      pref = localStorage.getItem(KEY) !== '0';
    } catch (e) {}
    const u16 = (v) => String.fromCharCode(v & 255, (v >> 8) & 255);
    const u32 = (v) => u16(v & 65535) + u16((v >>> 16) & 65535);
    function silentSrc() {
      const n = 2000; // 0,25 sn, 8 kHz, 8 bit, sessiz
      const head = 'RIFF' + u32(36 + n) + 'WAVEfmt ' + u32(16) + u16(1) + u16(1) + u32(8000) + u32(8000) + u16(1) + u16(8) + 'data' + u32(n);
      return 'data:audio/wav;base64,' + btoa(head + String.fromCharCode(128).repeat(n));
    }
    function session(on) {
      try {
        const s = navigator.audioSession;
        if (s && 'type' in s) {
          const t = on ? 'playback' : 'auto';
          if (s.type !== t) s.type = t;
          return true;
        }
      } catch (e) {}
      return false;
    }
    function tagPlay(on) {
      if (!on) {
        if (tag && !tag.paused) tag.pause();
        return;
      }
      try {
        if (!tag) {
          tag = document.createElement('audio');
          tag.setAttribute('playsinline', '');
          tag.setAttribute('x-webkit-airplay', 'deny');
          tag.preload = 'auto';
          tag.loop = true;
          tag.disableRemotePlayback = true;
          tag.src = silentSrc();
        }
        if (tag.paused) {
          const p = tag.play();
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {}
    }
    function playthrough() {
      if (!iOS) return;
      const on = pref && want && document.visibilityState === 'visible';
      if (session(pref && want)) return;
      tagPlay(on);
    }
    function resume(c) {
      if (!c || c.state === 'running' || c.state === 'closed') return;
      try {
        const p = c.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
    /** Her dokunuşta: duran bağlamları sürdür, ilk seferde sessiz ses çal, oturumu ayarla */
    function kick() {
      let any = false;
      ctxs.forEach((c) => {
        if (!c || c.state === 'closed') return;
        any = true;
        resume(c);
        if (!c.__bgKick) {
          c.__bgKick = true;
          try {
            const s = c.createBufferSource();
            s.buffer = c.createBuffer(1, 1, 22050);
            s.connect(c.destination);
            s.start(0);
          } catch (e) {}
        }
      });
      if (any && want) playthrough();
    }
    ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'click', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, kick, { capture: true, passive: true }),
    );
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        ctxs.forEach(resume);
        if (want && ctxs.length) playthrough();
      } else tagPlay(false);
    });
    window.addEventListener('pagehide', () => tagPlay(false));
    AU.iOS = iOS;
    /** Oyunun ses bağlamını kaydeder (iOS kilidi, kesinti sonrası sürdürme) */
    AU.add = (c) => {
      if (!c || ctxs.indexOf(c) >= 0) return c;
      ctxs.push(c);
      try {
        c.addEventListener('statechange', () => {
          if (c.state === 'interrupted' && document.visibilityState === 'visible') setTimeout(() => resume(c), 300);
        });
      } catch (e) {}
      if (iOS && want) session(pref);
      return c;
    };
    AU.kick = kick;
    /** Oyunun sesi açık mı (kapalıysa iOS ses oturumu serbest bırakılır, müzik uygulamaları kesilmez) */
    AU.want = (on) => {
      want = !!on;
      if (!want) {
        session(false);
        tagPlay(false);
      } else if (ctxs.length) playthrough();
    };
    /** Sessiz modda (yan anahtar) da çal: varsayılan açık */
    AU.silentOk = () => pref;
    AU.setSilentOk = (on) => {
      pref = !!on;
      try {
        localStorage.setItem(KEY, pref ? '1' : '0');
      } catch (e) {}
      if (!pref) {
        session(false);
        tagPlay(false);
      } else if (want && ctxs.length) playthrough();
    };
  })();

  const ICON = {
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.3c-.5.4-1.3 0-1.3-.6V16a2.5 2.5 0 0 1-1-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9" cy="10" r="1.1" fill="currentColor"/><circle cx="12" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l15-7-5.5 15-2.5-6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chair: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v8H7zM6 12h12v3H6zM7.5 15v5M16.5 15v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5L3 8l5 4 4-6.5 4 6.5 5-4-1 9.5z" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  ICON.gift = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  ICON.coin = svg('<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>');
  ICON.lock = svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>');
  ICON.smile = svg('<circle cx="12" cy="12" r="8.8"/><path d="M8.3 14.2a4.6 4.6 0 0 0 7.4 0"/><path d="M9 9.6v.2M15 9.6v.2"/>');
  ICON.bag = svg('<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>');
  ICON.target = svg('<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>');
  ICON.trophy = svg('<path d="M8 4h8v5.2a4 4 0 0 1-8 0z"/><path d="M8 6H5.2a2.8 2.8 0 0 0 2.9 3.8M16 6h2.8a2.8 2.8 0 0 1-2.9 3.8"/><path d="M12 13.2V17M8.5 20.5h7M10 17h4"/>');
  ICON.swap = svg('<path d="M4.5 8.5h13l-3.5-3.5"/><path d="M19.5 15.5h-13l3.5 3.5"/>');
  ICON.chatLock = svg('<path d="M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.5 20l1.3-4.6a8.1 8.1 0 1 1 15.7-3.8z"/><rect x="9" y="11" width="6" height="4.5" rx="1"/><path d="M10.3 11V9.6a1.7 1.7 0 0 1 3.4 0V11"/>');
  T.ICON = ICON;

  /* ---------------- site bağlantısı ---------------- */
  function site() {
    try {
      const p = window.parent;
      if (p && p !== window && p.BG && p.BG.api) return p.BG;
    } catch (e) {}
    return null;
  }
  T.site = site;
  T.inSite = () => !!site();
  T.authed = () => {
    const B = site();
    return !!(B && B.isAuthed && B.isAuthed() && B.api && B.api.ready);
  };
  T.me = () => {
    const B = site();
    return (B && B.store && B.store.me) || null;
  };
  T.myName = () => {
    const m = T.me();
    return m ? String(m.full_name || m.username || '').trim() : '';
  };
  T.rpc = async function (name, args) {
    const B = site();
    if (!B) throw new Error('Online oyun için siteden açılmalı.');
    return B.api.rpc(name, args || {});
  };
  T.isFriend = (id) => {
    const B = site();
    const list = (B && B.store && B.store.friends) || [];
    return !!id && list.some((f) => f.relation === 'friend' && f.user_id === id);
  };
  T.avatarUrl = function (url) {
    const B = site();
    if (!url) return '';
    let u = B && B.avatarSrc ? B.avatarSrc(url) : url;
    try {
      u = new URL(u, B ? window.parent.location.href : location.href).href;
    } catch (e) {}
    return u;
  };
  const initials = (name) =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x.charAt(0).toLocaleUpperCase('tr-TR'))
      .join('') || '?';
  /** Profil fotoğrafı (yoksa baş harfler). p: {name, avatar_url, bot} */
  T.avatar = function (p, size, extra) {
    p = p || {};
    const src = p.bot ? '' : T.avatarUrl(p.avatar_url);
    const img = src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
    const bd = (!p.bot && p.badge) || null;
    const fr = bd && bd.frame && /^[a-z]+$/.test(bd.frame) ? ` has-frame fr-${bd.frame}` : '';
    const pip = bd && bd.rank && p.rankPip ? `<span class="t-av-rank">${T.rankIcon(bd.rank, Math.max(14, Math.round((size || 36) * 0.38)))}</span>` : '';
    return `<span class="t-av${p.bot ? ' is-bot' : ''}${fr}${extra ? ' ' + extra : ''}" style="--s:${size || 36}px" aria-hidden="true"><span class="t-av-f">${esc(p.bot ? 'B' : initials(p.name))}</span>${img}${pip}</span>`;
  };
  /* ---------------- BP Economy (site ile ortak) ---------------- */
  T.econ = () => {
    const B = site();
    return (B && B.bp && B.bp.state) || null;
  };
  T.owns = (id) => {
    const e = T.econ();
    return !!(e && (e.owned || []).indexOf(id) >= 0);
  };
  T.rankIcon = (r, size) => {
    const B = site();
    return B && B.rankIcon && r ? B.rankIcon(r, size) : '';
  };
  T.rankChip = (r, opts) => {
    const B = site();
    return B && B.rankChip && r ? B.rankChip(r, opts) : '';
  };
  T.prestigeChip = (n, opts) => {
    const B = site();
    return B && B.prestigeChip && n ? B.prestigeChip(n, opts) : '';
  };
  /** Profil önizlemesi (site penceresinde): rütbe, BP, istatistik, Arkadaş ekle, Hediye gönder */
  T.playerCard = function (uid) {
    const B = site();
    const me = T.me();
    if (!B || !B.player || !uid) return;
    const gift = T.cfg && T.cfg.gift ? () => T.cfg.gift(uid) : () => T.giftPicker(uid);
    B.player.preview(uid, { gift: me && uid !== me.id ? gift : null });
  };
  /** Site etkinliği: oyun olayları da aktif süre sayılır */
  T.activity = () => {
    const B = site();
    if (B && B.activity) B.activity();
  };
  /** İsim + bot işareti */
  T.nameTag = (name, bot) => `${esc(name)}${bot ? ' <span class="t-bot" title="Bot oynuyor">(B)</span>' : ''}`;

  T.params = (function () {
    const out = {};
    try {
      new URLSearchParams(location.search).forEach((v, k) => (out[k] = v));
    } catch (e) {}
    return out;
  })();

  function setRoute(q) {
    const B = site();
    if (!B || !T.cfg) return;
    try {
      if (B.host && B.host.tableRoute) B.host.tableRoute(T.cfg.game, q || '');
      else if (B.router && B.router.silentReplace) B.router.silentReplace('/oyun/' + T.cfg.game + (q ? '?' + q : ''));
    } catch (e) {}
  }
  T.setRoute = setRoute;
  function presence(tableId) {
    const B = site();
    if (!B || !B.presence || !T.cfg) return;
    try {
      B.presence.set(T.cfg.game, tableId || null);
    } catch (e) {}
  }
  T.goLogin = function () {
    const B = site();
    if (B && B.router) B.router.go('/giris?r=' + encodeURIComponent('/oyun/' + T.cfg.game + '?mod=online'));
  };
  T.toast = function (text, kind) {
    if (T.cfg && T.cfg.toast) return T.cfg.toast(text, kind);
    const box = $('#tToasts') || document.body.appendChild(el('<div id="tToasts" class="t-toasts" aria-live="polite"></div>'));
    const n = el(`<div class="t-toast${kind ? ' is-' + kind : ''}">${esc(text)}</div>`);
    box.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  };

  /* ---------------- sunucu saati ---------------- */
  const clock = { off: 0, rtt: Infinity, n: 0 };
  function sample(nowIso, t0, t1) {
    const srv = Date.parse(nowIso);
    if (!srv) return;
    const rtt = t1 - t0;
    const off = srv - (t0 + t1) / 2;
    if (!clock.n) clock.off = off;
    else if (rtt <= clock.rtt * 1.6) clock.off = clock.off * 0.6 + off * 0.4;
    clock.rtt = Math.min(clock.rtt, rtt);
    clock.n++;
  }
  T.now = () => Date.now() + clock.off;
  async function call(name, args) {
    const t0 = Date.now();
    const r = await T.rpc(name, args);
    if (r && typeof r === 'object' && r.now) sample(r.now, t0, Date.now());
    return r;
  }
  T.call = call;
  const errCode = (e) => (e && (e.code || '')) + '';

  /* ---------------- olaylar ---------------- */
  const bus = {};
  T.on = function (ev, fn) {
    (bus[ev] = bus[ev] || []).push(fn);
    return () => (bus[ev] = (bus[ev] || []).filter((f) => f !== fn));
  };
  function emit(ev, data) {
    (bus[ev] || []).slice().forEach((f) => {
      try {
        f(data);
      } catch (e) {
        console.error(e);
      }
    });
  }
  T.emit = emit;

  /* ---------------- iletişim kutuları ---------------- */
  T.sheet = function (o) {
    // top: açık sohbet panelinin üstünde açılan pencere (ör. sohbetteki Hediye düğmesi)
    const wrap = el(`<div class="t-sheet-wrap${o.top ? ' is-top' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
      <div class="t-sheet${o.wide ? ' is-wide' : ''}">
        <div class="t-sheet-head"><h3>${esc(o.title || '')}</h3><button type="button" class="t-icon" data-x aria-label="Kapat">${ICON.close}</button></div>
        <div class="t-sheet-body"></div>
        ${o.actions ? '<div class="t-sheet-foot"></div>' : ''}
      </div></div>`);
    const body = $('.t-sheet-body', wrap);
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    const close = (v) => {
      if (!wrap.isConnected) return;
      wrap.remove();
      if (o.onClose) o.onClose(v);
    };
    if (o.actions) {
      const foot = $('.t-sheet-foot', wrap);
      o.actions.forEach((a) => {
        const b = el(`<button type="button" class="t-btn${a.kind ? ' is-' + a.kind : ''}">${esc(a.label)}</button>`);
        b.addEventListener('click', async () => {
          if (a.onClick) {
            const keep = await a.onClick(wrap, b);
            if (keep === false) return;
          }
          close(a.value);
        });
        foot.appendChild(b);
      });
    }
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-x]')) close(null);
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      }
    });
    document.body.appendChild(wrap);
    setTimeout(() => {
      const f = $('input,select,textarea,button.is-primary', wrap);
      if (f && !/Mobi|Android/i.test(navigator.userAgent)) f.focus();
    }, 30);
    return { node: wrap, body, close };
  };
  T.confirm = (title, text, okText, kind) =>
    new Promise((res) => {
      T.sheet({
        title,
        body: `<p class="t-text">${esc(text)}</p>`,
        actions: [
          { label: 'Vazgeç', value: false },
          { label: okText || 'Tamam', kind: kind || 'primary', value: true },
        ],
        onClose: (v) => res(!!v),
      });
    });

  /* =====================================================================
     MASA BAĞLANTISI (gerçek zamanlı + izleyiciler)
     ===================================================================== */
  function Link(id) {
    this.id = id;
    this.ch = null;
    this.pres = null;
    this.status = 'off';
    this.viewers = [];
    this.players = [];
    const B = site();
    if (!B || !B.api || !B.api.ready) return;
    const f = (col) => col + '=eq.' + id;
    try {
      this.ch = B.api
        .channel('bgt-' + id.slice(0, 8) + '-' + uid())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_actions', filter: f('table_id') }, (p) => p.new && emit('rt-action', p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'table_seats', filter: f('table_id') }, (p) => emit('rt-seat', p.new || p.old || {}))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_tables', filter: f('id') }, (p) => p.new && emit('rt-table', p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_chat', filter: f('table_id') }, (p) => p.new && emit('rt-chat', p.new))
        .subscribe((s) => {
          this.status = s;
          emit('rt-status', s);
        });
    } catch (e) {
      console.warn('[masa] realtime', e);
    }
  }
  Link.prototype.track = function (role) {
    const B = site();
    const me = T.me();
    if (!B || !me || this.pres || !B.api.ready) return;
    try {
      const ch = (this.pres = B.api.channel('bgt-w-' + this.id, { config: { presence: { key: me.id } } }));
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState();
        const viewers = [];
        Object.keys(st).forEach((k) => {
          const p = st[k] && st[k][0];
          if (p && p.role === 'viewer' && k !== me.id) viewers.push(p);
        });
        this.viewers = viewers;
        emit('viewers', viewers);
      });
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') ch.track({ role, user_id: me.id, name: me.full_name || me.username, avatar_url: me.avatar_url || '' }).catch(() => {});
      });
      this.role = role;
    } catch (e) {
      console.warn('[masa] presence', e);
    }
  };
  Link.prototype.setRole = function (role) {
    if (this.role === role) return;
    const me = T.me();
    if (this.pres && me) {
      this.role = role;
      try {
        this.pres.track({ role, user_id: me.id, name: me.full_name || me.username, avatar_url: me.avatar_url || '' }).catch(() => {});
      } catch (e) {}
    } else this.track(role);
  };
  Link.prototype.close = function () {
    const B = site();
    if (!B) return;
    if (this.pres) {
      try {
        this.pres.untrack();
      } catch (e) {}
      B.api.removeChannel(this.pres);
    }
    if (this.ch) B.api.removeChannel(this.ch);
    this.ch = this.pres = null;
  };

  /* =====================================================================
     KOLTUK BİLGİLERİ
     ===================================================================== */
  function seatName(s) {
    if (!s) return '';
    if (s.kind === 'bot') return s.bot_name || 'Bot';
    return String(s.full_name || s.username || 'Oyuncu').trim();
  }
  T.seatName = seatName;
  function mergeSeat(list, row) {
    if (!row || row.seat == null) return list;
    const i = list.findIndex((s) => s.seat === row.seat);
    const cur = i >= 0 ? list[i] : {};
    const keepProfile = cur.user_id && cur.user_id === row.user_id;
    const next = Object.assign({}, cur, row);
    if (!keepProfile) {
      next.username = row.username || null;
      next.full_name = row.full_name || null;
      next.avatar_url = row.avatar_url || null;
    } else {
      next.username = cur.username;
      next.full_name = cur.full_name;
      next.avatar_url = cur.avatar_url;
    }
    if (next.badge === undefined && cur && cur.user_id === next.user_id) next.badge = cur.badge;
    if (i >= 0) list[i] = next;
    else list.push(next);
    list.sort((a, b) => a.seat - b.seat);
    return list;
  }

  /* =====================================================================
     SOHBET
     ===================================================================== */
  const chat = (T.chat = { id: null, rows: [], lastId: 0, unread: 0, isOpen: false, btns: [], panel: null, poll: null, can: false, off: [], fetching: null });
  chat.bind = function (btn) {
    chat.btns = chat.btns.filter((b) => b.isConnected);
    if (!btn || chat.btns.includes(btn)) return;
    chat.btns.push(btn);
    if (!$('.t-badge', btn)) btn.insertAdjacentHTML('beforeend', '<span class="t-badge" hidden></span>');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      chat.toggle();
    });
    paintBadge();
  };
  function paintBadge() {
    chat.btns.forEach((b) => {
      b.hidden = !chat.id;
      const x = $('.t-badge', b);
      if (!x) return;
      x.hidden = !chat.unread;
      x.textContent = chat.unread > 9 ? '9+' : String(chat.unread);
    });
    paintHostChat();
  }
  /** Sitenin üst çubuğundaki "Masa sohbeti" düğmesi: varsa sohbet oradan açılır, bildirim orada görünür */
  function paintHostChat(off) {
    let ok = false;
    try {
      const B = site();
      if (B && B.host && typeof B.host.tableChat === 'function') ok = B.host.tableChat(!off && !!chat.id && chat.can, chat.unread) !== false;
    } catch (e) {}
    document.documentElement.classList.toggle('bgt-hostchat', ok);
  }
  window.addEventListener('pagehide', () => paintHostChat(true));
  chat.attach = function (id, can) {
    if (chat.id === id) {
      chat.allow(can);
      return;
    }
    chat.detach();
    chat.id = id;
    chat.can = !!can;
    chat.rows = [];
    chat.lastId = 0;
    chat.unread = 0;
    paintBadge();
    chat.off.push(T.on('rt-chat', (row) => row.table_id === chat.id && chat.fetch(true)));
    chat.fetch(false);
    chat.poll = setInterval(() => {
      if (document.visibilityState === 'visible') chat.fetch(true);
    }, 9000);
  };
  chat.allow = function (can) {
    const was = chat.can;
    chat.can = !!can;
    if (chat.can && !was) chat.fetch(false);
    paintBadge();
  };
  chat.detach = function () {
    clearInterval(chat.poll);
    chat.off.forEach((f) => f());
    chat.off = [];
    chat.id = null;
    chat.rows = [];
    chat.unread = 0;
    chat.close();
    paintBadge();
  };
  chat.fetch = function (notify) {
    if (!chat.id || !chat.can) return Promise.resolve();
    if (chat.fetching) {
      chat.again = chat.again || notify;
      return chat.fetching;
    }
    const id = chat.id;
    chat.fetching = call('bg_table_chat_list', { p_table: id, p_after: chat.lastId })
      .then((rows) => {
        if (chat.id !== id) return;
        rows = (rows || []).filter((r) => r.id > chat.lastId);
        if (!rows.length) return;
        chat.lastId = rows[rows.length - 1].id;
        chat.rows = chat.rows.concat(rows).slice(-150);
        const me = T.me();
        if (notify) rows.forEach(react);
        const fresh = rows.filter((r) => (!me || r.user_id !== me.id) && !T.giftOf(r.body) && !T.emojiOf(r.body));
        if (notify && fresh.length && !chat.isOpen) {
          chat.unread += fresh.length;
          // oyuncunun mesajı avatarının yanında balon olarak görünür; avatarı ekranda olmayanlar (izleyiciler) altta kısa bildirim
          fresh.slice(-2).forEach((r) => {
            if (!sayAtAvatar(r)) peek(r);
          });
        } else if (notify) fresh.forEach((r) => sayAtAvatar(r));
        paintBadge();
        paintList(true);
      })
      .catch(() => {})
      .finally(() => {
        chat.fetching = null;
        if (chat.again) {
          chat.again = false;
          chat.fetch(true);
        }
      });
    return chat.fetching;
  };
  /** Yeni satır: hediye uçar, emoji ve mesaj avatarın yanında görünür */
  function react(r) {
    const g = T.giftOf(r.body);
    if (g) {
      emit('gift', { from: r.user_id, to: g.to, seat: g.seat, code: g.code, text: g.text, row: r });
      fx.gift(r.user_id, g.to, g.code, g.seat, r);
      return;
    }
    const m = T.emojiOf(r.body);
    if (m) {
      emit('emoji', { from: r.user_id, pack: m.pack, code: m.code, seat: m.seat });
      fx.emoji(r.user_id, m.pack, m.code, m.seat);
    }
  }
  function sayAtAvatar(r) {
    emit('say', { from: r.user_id, text: r.body, name: who(r) });
    return fx.say(r.user_id, r.body);
  }
  function who(r) {
    return String(r.full_name || r.name || r.username || 'Biri').trim();
  }
  function peek(r) {
    let box = $('#tPeek');
    if (!box) {
      box = el('<div id="tPeek" class="t-peek" aria-live="polite"></div>');
      document.body.appendChild(box);
    }
    const n = el(`<button type="button" class="t-peek-item">${T.avatar({ name: who(r), avatar_url: r.avatar_url }, 28)}<span><b>${esc(who(r))}</b>${esc(r.body)}</span></button>`);
    n.addEventListener('click', () => chat.open());
    box.appendChild(n);
    while (box.children.length > 2) box.firstElementChild.remove();
    setTimeout(() => {
      n.classList.add('is-out');
      setTimeout(() => n.remove(), 300);
    }, 3800);
  }
  const hhmm = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };
  function paintList(keepBottom) {
    const p = chat.panel;
    if (!p) return;
    const list = $('.t-chat-list', p);
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const me = T.me();
    list.innerHTML = chat.rows.length
      ? chat.rows
          .map((r) => {
            const mine = me && r.user_id === me.id;
            const nm = `<button type="button" class="t-msg-name" data-player="${esc(r.user_id)}">${esc(mine ? 'Sen' : who(r))}</button>`;
            const g = T.giftOf(r.body);
            if (g)
              return `<div class="t-msg t-gift"><img src="${giftSrc(g.code)}" srcset="${giftSrc(g.code, 2)} 2x" alt="" loading="lazy">
                <div class="t-msg-b"><div class="t-msg-h">${nm}<time>${esc(hhmm(r.created_at))}</time></div><p>${esc(g.text)}</p></div></div>`;
            const m = T.emojiOf(r.body);
            if (m)
              return `<div class="t-msg t-emo${mine ? ' is-mine' : ''}"><img src="${emojiSrc(m.pack, m.code)}" alt="" loading="lazy"><div class="t-msg-b"><div class="t-msg-h">${nm}<time>${esc(hhmm(r.created_at))}</time></div></div></div>`;
            return `<div class="t-msg${mine ? ' is-mine' : ''}">${mine ? '' : `<button type="button" class="t-msg-av" data-player="${esc(r.user_id)}" aria-label="${esc(who(r))} profili">${T.avatar({ name: who(r), avatar_url: r.avatar_url }, 30)}</button>`}
              <div class="t-msg-b"><div class="t-msg-h">${mine ? '' : nm}${r.is_player ? '' : '<span class="t-tag">izliyor</span>'}<time>${esc(hhmm(r.created_at))}</time></div><p>${esc(r.body)}</p></div></div>`;
          })
          .join('')
      : '<p class="t-empty">Henüz mesaj yok. Masadakilere ilk sen yaz.</p>';
    if (!keepBottom || nearBottom) list.scrollTop = list.scrollHeight;
    paintViewers();
  }
  function paintViewers() {
    const p = chat.panel;
    if (!p) return;
    const v = (T.cur && T.cur.link && T.cur.link.viewers) || [];
    const box = $('.t-chat-viewers', p);
    box.hidden = !v.length;
    box.innerHTML = v.length ? `${ICON.eye}<span>İzleyenler: ${v.map((x) => esc(x.name)).join(', ')}</span>` : '';
  }
  T.on('viewers', paintViewers);
  /** Sohbet yazma alanı: Geveze Paketi yoksa okunur ama yazılamaz (paket buradan da alınabilir) */
  function paintForm() {
    const p = chat.panel;
    if (!p) return;
    const box = $('.t-chat-input', p);
    const can = T.owns('geveze');
    box.innerHTML = can
      ? `<form class="t-chat-form" autocomplete="off"><input class="t-input" maxlength="300" placeholder="Mesaj yaz" aria-label="Mesaj"><button type="submit" class="t-icon is-send" aria-label="Gönder">${ICON.send}</button></form>`
      : `<div class="t-chat-lock">${ICON.chatLock}<span>Sohbeti okuyabilirsin. Yazmak için <b>Geveze Paketi</b> gerekir.</span><button type="button" class="t-btn is-primary is-sm" data-buy="geveze">50 BP · Al</button></div>`;
    const form = $('form', box);
    if (form)
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = $('input', form);
        const body = inp.value.trim();
        if (!body || !chat.id) return;
        inp.value = '';
        try {
          await call('bg_table_chat_send', { p_table: chat.id, p_body: body });
          chat.fetch(false);
          fx.say(T.me() && T.me().id, body);
        } catch (err) {
          inp.value = body;
          if (/Geveze/.test(err.message || '')) return T.buySheet('geveze');
          T.toast(err.message || 'Mesaj gönderilemedi', 'err');
        }
      });
  }
  chat.open = function () {
    if (!chat.id) return;
    if (!chat.can) return T.toast('Bu masanın sohbetini göremezsin.', 'err');
    chat.isOpen = true;
    chat.unread = 0;
    paintBadge();
    $$('#tPeek .t-peek-item').forEach((n) => n.remove());
    if (!chat.panel) {
      chat.panel = el(`<aside class="t-chat" role="dialog" aria-label="Masa sohbeti">
        <div class="t-chat-head"><h3>Masa sohbeti</h3>
          <button type="button" class="t-btn is-ghost t-emobtn" data-emoji title="Emoji tepkisi">${ICON.smile}<span>Emoji</span></button>
          <button type="button" class="t-btn is-ghost t-giftbtn" data-gift>${ICON.gift}<span>Hediye</span></button>
          <button type="button" class="t-icon" data-x aria-label="Kapat">${ICON.close}</button></div>
        <div class="t-chat-viewers" hidden></div>
        <div class="t-chat-list"></div>
        <div class="t-chat-input"></div>
      </aside>`);
      const scrim = el('<div class="t-chat-scrim"></div>');
      scrim.addEventListener('click', () => chat.close());
      chat.scrim = scrim;
      $('[data-x]', chat.panel).addEventListener('click', () => chat.close());
      $('[data-gift]', chat.panel).addEventListener('click', () => T.giftPicker());
      $('[data-emoji]', chat.panel).addEventListener('click', () => T.emojiPicker());
      chat.panel.addEventListener('click', (e) => {
        const pl = e.target.closest('[data-player]');
        if (pl && pl.dataset.player) return T.playerCard(pl.dataset.player);
        const by = e.target.closest('[data-buy]');
        if (by) T.buySheet(by.dataset.buy);
      });
      chat.panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          chat.close();
        }
      });
    }
    document.body.appendChild(chat.scrim);
    document.body.appendChild(chat.panel);
    paintForm();
    paintList(false);
    requestAnimationFrame(() => chat.panel && chat.panel.classList.add('is-open'));
    const inp = $('.t-chat-form input', chat.panel);
    if (inp && !/Mobi|Android/i.test(navigator.userAgent)) setTimeout(() => inp.focus(), 60);
    emit('chat-open', true);
  };
  chat.close = function () {
    if (!chat.isOpen) return;
    chat.isOpen = false;
    if (chat.panel) {
      chat.panel.classList.remove('is-open');
      chat.panel.remove();
    }
    if (chat.scrim) chat.scrim.remove();
    emit('chat-open', false);
  };
  chat.toggle = () => (chat.isOpen ? chat.close() : chat.open());

  /* ---------------- sistem satırları: hediye ve emoji ---------------- */
  const GIFT_RE = /^\[\[gift:([a-z_]+):([0-9a-f-]{36})(?::(\d*))?\]\]\s*(.*)$/;
  const EMOJI_RE = /^\[\[emoji:(vip|premium):([a-z_]+):(\d*)\]\]$/;
  const giftSrc = (code, x) => 'assets/gifts/' + code + (x === 2 ? '@2x' : '') + '.webp';
  const emojiSrc = (pack, code, x) => 'assets/emoji/' + pack + '/' + code + (x === 2 ? '@2x' : '') + '.webp';
  T.giftOf = (body) => {
    const m = GIFT_RE.exec(body || '');
    return m ? { code: m[1], to: m[2], seat: m[3] === '' || m[3] == null ? null : +m[3], text: m[4] } : null;
  };
  T.emojiOf = (body) => {
    const m = EMOJI_RE.exec(body || '');
    return m ? { pack: m[1], code: m[2], seat: m[3] === '' ? null : +m[3] } : null;
  };

  /* ---------------- mağaza ürünü oyun içinden ---------------- */
  const PROD = {
    geveze: { name: 'Geveze Paketi', price: 50, text: 'Americano, Dost Kazığı ve Blackjack masalarında yazılı sohbet gönderebilirsin. Mesajın saatle birlikte sohbette, kısa süre de avatarının yanında balon olarak görünür.' },
    gifter_pack: { name: 'Gifter Pack', price: 200, text: 'Masadaki arkadaşlarına ve rakiplerine eğlenceli hediyeler gönder! 16 premium sanal hediye, tek seferlik satın alma ve üç online oyunda sınırsız kullanım.' },
    emoji_vip: { name: 'Blackjack VIP Emoji Paketi', price: 50, text: 'Masada avatarının yanında beliren 16 premium emoji tepkisi.' },
    emoji_premium: { name: 'Premium Emoji Paketi', price: 100, text: 'Bözer Gaming imzalı 16 premium emoji tepkisi.' },
  };
  T.buySheet = async function (id, done) {
    const B = site();
    if (!B || !T.authed()) return T.goLogin();
    let list = [];
    try {
      const d = await call('bg_store', {});
      list = (d.products || []).filter((p) => (id === 'emoji' ? p.kind === 'emoji' : p.id === id));
    } catch (e) {
      return T.toast(e.message || 'Mağaza açılamadı', 'err');
    }
    const e0 = T.econ();
    const bal = e0 ? e0.balance : 0;
    const prev = (p) =>
      p.kind === 'emoji'
        ? `<div class="t-buy-prev is-emo">${(EMOJI[(p.meta && p.meta.pack) || 'vip'] || []).map((c) => `<img src="${emojiSrc(p.meta.pack, c)}" alt="" loading="lazy">`).join('')}</div>`
        : p.kind === 'gifter'
        ? `<div class="t-buy-prev is-gift">${GIFTS.map((c) => `<img src="${giftSrc(c)}" alt="" loading="lazy">`).join('')}</div>`
        : '';
    const sh = T.sheet({
      title: id === 'emoji' ? 'Emoji paketi' : (PROD[id] && PROD[id].name) || 'Mağaza',
      top: true,
      wide: true,
      body: list
        .map(
          (p) => `<div class="t-buy" data-id="${esc(p.id)}">${prev(p)}<h4>${esc(p.name)}</h4><p class="t-text">${esc(p.description)}</p>
          ${p.owned ? `<p class="t-ok">${ICON.check}SAHİP OLUNDU</p>${p.kind === 'emoji' ? `<button type="button" class="t-btn" data-equip="${esc(p.id)}">Kuşan</button>` : ''}` : `<button type="button" class="t-btn is-primary" data-buy="${esc(p.id)}" ${bal < p.price_bp && bal < p.price ? 'disabled' : ''}>${ICON.coin}${p.price} BP · Satın al</button>${bal < p.price ? `<p class="t-muted">Bakiyen ${bal} BP — ${p.price - bal} BP eksik.</p>` : ''}`}</div>`
        )
        .join('') + `<p class="t-note">Ürünler bir kez alınır ve hesabında kalıcıdır. Bakiyen: <b>${bal} BP</b>.</p>`,
      actions: [{ label: 'Kapat' }],
    });
    sh.body.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-buy],[data-equip]');
      if (!b || b.disabled) return;
      b.disabled = true;
      try {
        if (b.dataset.buy) {
          const r = await call('bg_store_buy', { p_product: b.dataset.buy });
          if (B.bp) {
            B.bp.setBalance(r.balance);
            await B.bp.refresh();
          }
          T.toast((PROD[b.dataset.buy] || {}).name ? PROD[b.dataset.buy].name + ' artık senin.' : 'Satın alındı.', 'good');
        } else {
          await call('bg_store_equip', { p_kind: 'emoji', p_product: b.dataset.equip });
          if (B.bp) await B.bp.refresh();
        }
        sh.close();
        paintForm();
        if (done) done();
      } catch (err) {
        b.disabled = false;
        T.toast(err.message || 'İşlem yapılamadı', 'err');
      }
    });
  };

  /* ---------------- hediye seçici (Gifter Pack) ---------------- */
  const GIFTS = ['beer', 'wine', 'whisky', 'raki', 'cocktail', 'poop', 'hotdog', 'hamburger', 'trophy', 'tea', 'coffee', 'flowers', 'baby_bottle', 'gift_box', 'nazar_boncugu', 'okey_token'];
  const EMOJI = {
    vip: ['hello_wave', 'applause', 'warm_smile', 'laughing_tears', 'crying', 'angry_tilt', 'shocked', 'cheeky', 'thumbs_up', 'fingers_crossed', 'cool_sunglasses', 'nervous_sweat', 'party_celebration', 'winner_chips', 'bad_beat', 'facepalm'],
    premium: ['hello_wave', 'applause', 'big_smile', 'laughing_tears', 'crying', 'tilt_angry', 'shocked', 'playful_wink', 'thumbs_up', 'fingers_crossed', 'cool_confident', 'nervous_sweat', 'party_celebration', 'champion_trophy', 'bad_luck', 'facepalm'],
  };
  T.EMOJI = EMOJI;
  T.GIFTS = GIFTS;
  let giftCat = null;
  /** Masadaki oyunculardan birine hediye (gönderen oyuncu ya da izleyici olabilir).
   *  opts — kendi masa modeli olan oyunlar (Blackjack) için:
   *  { game, table, people: [{ id, name, avatar_url, badge, role, seat }], after() } */
  T.giftPicker = async function (toId, opts) {
    opts = opts || {};
    const cur = T.cur;
    const me = T.me();
    const tableId = opts.table || (cur && cur.id);
    const game = opts.game || (T.cfg && T.cfg.game);
    if (!tableId || !me) return;
    if (!T.owns('gifter_pack')) return T.buySheet('gifter_pack', () => T.giftPicker(toId, opts));
    const people = [];
    if (opts.people) opts.people.forEach((p) => p.id && p.id !== me.id && people.push(p));
    else
      ((cur && cur.table && cur.table.seats) || []).forEach((s) => {
        if (s.kind === 'human' && s.user_id && s.user_id !== me.id && !s.left_game && !people.some((p) => p.id === s.user_id))
          people.push({ id: s.user_id, name: String(s.full_name || s.username || 'Oyuncu').trim(), avatar_url: s.avatar_url, badge: s.badge, role: 'Oyuncu' });
      });
    if (!people.length) return T.toast('Masada hediye gönderebileceğin başka oyuncu yok.', 'info');
    if (!giftCat) {
      try {
        giftCat = await call('bg_gift_catalog');
      } catch (e) {
        return T.toast(e.message || 'Hediyeler yüklenemedi', 'err');
      }
    }
    const key = (p) => p.id + ':' + (p.seat == null ? '' : p.seat);
    let to = key(people.find((p) => p.id === toId) || people[0]);
    const lvl = fx.level();
    const sh = T.sheet({
      title: 'Hediye gönder',
      wide: true,
      top: true,
      body: `<div class="t-gift-to" role="radiogroup" aria-label="Kime">${people
        .map((p) => `<button type="button" role="radio" data-to="${esc(key(p))}" aria-checked="${key(p) === to}">${T.avatar(p, 34)}<span><b>${esc(p.name)}</b><small>${esc(p.role || 'Oyuncu')}</small></span></button>`)
        .join('')}</div>
        <div class="t-gift-grid">${giftCat.map((g) => `<button type="button" class="t-gift-it" data-code="${g.code}"><img src="${giftSrc(g.code)}" srcset="${giftSrc(g.code, 2)} 2x" alt="" loading="lazy"><span>${esc(g.name)}</span></button>`).join('')}</div>
        <p class="t-note">Gifter Pack’in sayesinde hediyeler ücretsiz. Masadaki herkes animasyonu görür. İki hediye arasında 5 saniye beklenir.</p>
        <div class="t-field"><span class="t-lab">Hediye animasyonları (yalnızca bu cihazda)</span><div class="t-seg" data-seg="fx">${[['full', 'Tam'], ['reduced', 'Azaltılmış'], ['off', 'Kapalı']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${lvl === v}">${l}</button>`).join('')}</div></div>`,
    });
    sh.body.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-to]');
      if (t) {
        to = t.dataset.to;
        $$('[data-to]', sh.body).forEach((b) => b.setAttribute('aria-checked', String(b === t)));
        return;
      }
      const f = e.target.closest('[data-seg="fx"] button');
      if (f) {
        fx.setLevel(f.dataset.v);
        $$('[data-seg="fx"] button', sh.body).forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
        return;
      }
      const g = e.target.closest('[data-code]');
      if (!g || g.disabled) return;
      $$('[data-code]', sh.body).forEach((b) => (b.disabled = true));
      const [toUser, toSeat] = to.split(':');
      try {
        await call('bg_gift_send', { p_to: toUser, p_code: g.dataset.code, p_game: game, p_table: tableId, p_req: uid(), p_seat: toSeat === '' ? null : +toSeat });
        sh.close();
        if (opts.after) opts.after();
        else chat.fetch(true);
      } catch (err) {
        T.toast(err.message || 'Hediye gönderilemedi', 'err');
        if (/Gifter/.test(err.message || '')) {
          sh.close();
          return T.buySheet('gifter_pack');
        }
        $$('[data-code]', sh.body).forEach((b) => (b.disabled = false));
      }
    });
  };

  /* ---------------- emoji tepkisi ---------------- */
  /** opts — kendi masa modeli olan oyunlar (Blackjack) için: { game, table, seat: sayı | () => sayı } */
  T.emojiPicker = function (opts) {
    opts = opts || {};
    const cur = T.cur;
    const e0 = T.econ();
    const tableId = opts.table || (cur && cur.id);
    const game = opts.game || (T.cfg && T.cfg.game);
    if (!tableId || !T.me()) return;
    const packId = e0 && e0.emoji_pack;
    if (!packId || !T.owns(packId)) return T.buySheet('emoji', () => T.emojiPicker(opts));
    const pack = packId === 'emoji_premium' ? 'premium' : 'vip';
    const sh = T.sheet({
      title: 'Emoji tepkisi',
      top: true,
      body: `<div class="t-emo-grid">${EMOJI[pack].map((c) => `<button type="button" class="t-emo-it" data-emo="${c}" aria-label="${esc(c)}"><img src="${emojiSrc(pack, c)}" srcset="${emojiSrc(pack, c, 2)} 2x" alt="" loading="lazy"></button>`).join('')}</div>
        <p class="t-note">Seçtiğin emoji kısa süre avatarının yanında görünür; masadaki herkes görür.${T.owns('emoji_vip') && T.owns('emoji_premium') ? ' <button type="button" class="t-link" data-swap>Diğer paketi kuşan</button>' : ''}</p>`,
    });
    sh.body.addEventListener('click', async (e) => {
      if (e.target.closest('[data-swap]')) {
        try {
          await call('bg_store_equip', { p_kind: 'emoji', p_product: pack === 'vip' ? 'emoji_premium' : 'emoji_vip' });
          const B = site();
          if (B && B.bp) await B.bp.refresh();
          sh.close();
          T.emojiPicker(opts);
        } catch (err) {
          T.toast(err.message || 'Değiştirilemedi', 'err');
        }
        return;
      }
      const b = e.target.closest('[data-emo]');
      if (!b) return;
      sh.close();
      const me = T.me();
      let seat = null;
      if (opts.seat !== undefined) seat = typeof opts.seat === 'function' ? opts.seat() : opts.seat;
      else seat = T.cfg && T.cfg.mySeat ? T.cfg.mySeat() : T.cur ? mySeat(T.cur.table) : null;
      fx.emoji(me && me.id, pack, b.dataset.emo, seat);
      try {
        await call('bg_emoji_send', { p_game: game, p_table: tableId, p_code: b.dataset.emo, p_seat: seat == null ? null : seat });
        chat.fetched = true;
      } catch (err) {
        T.toast(err.message || 'Emoji gönderilemedi', 'err');
      }
    });
  };

  /* ---------------- avatar yanında efektler ---------------- */
  const fx = (T.fx = { q: [], running: false, seen: new Set() });
  fx.level = () => {
    try {
      return localStorage.getItem('bg.giftfx') || 'full';
    } catch (e) {
      return 'full';
    }
  };
  fx.setLevel = (v) => {
    try {
      localStorage.setItem('bg.giftfx', v);
    } catch (e) {}
  };
  const reduceMo = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Oyunun verdiği avatar öğesi (kullanıcı kimliği ya da koltuk ile); oyun başlamadıysa bekleme odasındaki avatar */
  const shown = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.width || r.height ? e : null;
  };
  function avEl(userId, seat) {
    let e = null;
    try {
      if (T.cfg && T.cfg.avatarEl) e = shown(T.cfg.avatarEl(userId, seat));
    } catch (x) {}
    if (!e && userId && /^[0-9a-f-]{36}$/.test(userId)) e = shown(document.querySelector('.t-room .t-avbtn[data-player="' + userId + '"]'));
    return e;
  }
  function center(elm) {
    const r = elm.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  }
  fx.say = function (userId, text) {
    const a = userId && avEl(userId);
    const c = a && center(a);
    if (!c) return false;
    const b = el(`<div class="t-say" role="status"></div>`);
    b.textContent = String(text || '').slice(0, 120);
    document.body.appendChild(b);
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const above = c.r.top > h + 24;
    let x = Math.max(8, Math.min(window.innerWidth - w - 8, c.x - w / 2));
    const y = above ? c.r.top - h - 10 : c.r.bottom + 10;
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.classList.add(above ? 'is-up' : 'is-down');
    b.style.setProperty('--tail', Math.max(14, Math.min(w - 14, c.x - x)) + 'px');
    setTimeout(() => b.classList.add('is-out'), 3200);
    setTimeout(() => b.remove(), 3600);
    return true;
  };
  fx.recent = {};
  fx.emoji = function (userId, pack, code, seat) {
    // aynı kişinin aynı emojisi 3 sn içinde ikinci kez oynamaz (kendi gönderdiğin hemen oynar, sunucudan dönen satır tekrarlamaz)
    const key = userId + ':' + code;
    if (fx.recent[key] && Date.now() - fx.recent[key] < 3000) return true;
    fx.recent[key] = Date.now();
    const a = avEl(userId, seat);
    const c = a && center(a);
    const img = el(`<img class="t-emo-pop" src="${emojiSrc(pack, code, 2)}" alt="">`);
    const size = Math.round(Math.max(56, Math.min(96, c ? c.r.width * 1.25 : 80)));
    img.style.width = img.style.height = size + 'px';
    if (c) {
      img.style.left = c.r.right - size * 0.35 + 'px';
      img.style.top = c.r.top - size * 0.65 + 'px';
    } else {
      img.style.left = window.innerWidth / 2 - size / 2 + 'px';
      img.style.top = window.innerHeight * 0.4 + 'px';
    }
    document.body.appendChild(img);
    // v3.2: emoji 1 sn daha uzun görünür (giriş ve çıkış aynı hızda, bekleme uzadı)
    if (reduceMo()) {
      setTimeout(() => img.remove(), 3200);
      return !!c;
    }
    const an = img.animate(
      [
        { transform: 'scale(.2) rotate(-18deg)', opacity: 0 },
        { transform: 'scale(1.18) rotate(6deg)', opacity: 1, offset: 0.127 },
        { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.226 },
        { transform: 'translateY(-6px) scale(1.04)', opacity: 1, offset: 0.788 },
        { transform: 'translateY(-26px) scale(.9)', opacity: 0 },
      ],
      { duration: 3400, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
    if (an) an.onfinish = () => img.remove();
    else setTimeout(() => img.remove(), 3400);
    return !!c;
  };
  /** Hediye: gönderenin avatarından alıcının avatarına uçar (kuyrukta, üst üste binmez) */
  fx.gift = function (from, to, code, seat, row) {
    if (row && fx.seen.has('g' + row.id)) return;
    if (row) fx.seen.add('g' + row.id);
    fx.q.push({ from, to, code, seat, row });
    if (fx.q.length > 6) fx.q.splice(0, fx.q.length - 6);
    if (!fx.running) fx.next();
  };
  fx.next = function () {
    const job = fx.q.shift();
    if (!job) {
      fx.running = false;
      return;
    }
    fx.running = true;
    const lvl = fx.level();
    const toEl = avEl(job.to, job.seat);
    const fromEl = avEl(job.from);
    const tc = toEl && center(toEl);
    if (lvl === 'off' || !tc) {
      if (lvl !== 'off') giftBanner(job);
      setTimeout(fx.next, lvl === 'off' ? 0 : 600);
      return;
    }
    const fc = (fromEl && center(fromEl)) || { x: window.innerWidth / 2, y: window.innerHeight + 40 };
    const size = Math.round(Math.max(54, Math.min(92, tc.r.width * 1.15)));
    const img = el(`<img class="t-gift-fly" src="${giftSrc(job.code, 2)}" alt="">`);
    img.style.width = img.style.height = size + 'px';
    document.body.appendChild(img);
    const sx = fc.x - size / 2;
    const sy = fc.y - size / 2;
    const ex = tc.x - size / 2;
    const ey = tc.r.top - size * 0.55;
    const mx = (sx + ex) / 2;
    const my = Math.min(sy, ey) - Math.max(60, Math.abs(ex - sx) * 0.25);
    const short = lvl === 'reduced' || reduceMo();
    const anim = img.animate(
      // v3.2: hediye alıcının avatarında 1 sn daha uzun kalır (uçuş aynı hızda)
      short
        ? [{ transform: `translate(${ex}px,${ey}px) scale(.4)`, opacity: 0 }, { transform: `translate(${ex}px,${ey}px) scale(1)`, opacity: 1, offset: 0.175 }, { transform: `translate(${ex}px,${ey}px) scale(1)`, opacity: 1, offset: 0.8 }, { transform: `translate(${ex}px,${ey}px) scale(1)`, opacity: 0 }]
        : [
            { transform: `translate(${sx}px,${sy}px) scale(.45) rotate(-20deg)`, opacity: 0 },
            { transform: `translate(${sx}px,${sy - 14}px) scale(.8) rotate(-10deg)`, opacity: 1, offset: 0.072 },
            { transform: `translate(${mx}px,${my}px) scale(1.25) rotate(8deg)`, opacity: 1, offset: 0.325 },
            { transform: `translate(${ex}px,${ey}px) scale(1) rotate(0)`, opacity: 1, offset: 0.52 },
            { transform: `translate(${ex}px,${ey - 6}px) scale(1.06)`, opacity: 1, offset: 0.899 },
            { transform: `translate(${ex}px,${ey - 18}px) scale(.85)`, opacity: 0 },
          ],
      { duration: short ? 2400 : 3600, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' }
    );
    if (!short)
      setTimeout(() => {
        for (let i = 0; i < 12; i++) {
          const sp = el('<span class="t-spark"></span>');
          sp.style.left = tc.x + 'px';
          sp.style.top = tc.r.top + 'px';
          document.body.appendChild(sp);
          const ang = (Math.PI * 2 * i) / 12;
          sp.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * 46}px), calc(-50% + ${Math.sin(ang) * 46}px)) scale(.3)`, opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => sp.remove();
        }
      }, 1880);
    const done = () => {
      img.remove();
      setTimeout(fx.next, 120);
    };
    if (anim) anim.onfinish = done;
    else setTimeout(done, short ? 2400 : 3600);
    toEl.classList.add('t-got-gift');
    setTimeout(() => toEl.classList.remove('t-got-gift'), 3600);
  };
  function giftBanner(job) {
    const r = job.row || {};
    const g = T.giftOf(r.body || '') || { text: '' };
    const me = T.me();
    const b = el(`<div class="t-giftfx" aria-live="polite"><img src="${giftSrc(job.code, 2)}" alt=""><p><b>${esc(me && job.from === me.id ? 'Sen' : who(r))}</b> → ${esc(g.text)}</p></div>`);
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('is-out'), 3000);
    setTimeout(() => b.remove(), 3500);
  }

  /* ---------------- maç sonu: ödüller (ÖDÜLLERİ TOPLA) ---------------- */
  /** Sonuç ekranına ödül kutusu yerleştirir; sonuç oyuncuların bildirimleriyle kesinleşene kadar bekler */
  T.mountRewards = function (box, tableId) {
    tableId = tableId || (T.cur && T.cur.id);
    if (!box || !tableId || !T.authed()) return;
    box.classList.add('t-rw');
    box.innerHTML = `<p class="t-rw-wait"><span class="t-spin"></span>Sonuç masadaki oyuncularla doğrulanıyor…</p>`;
    let tries = 0;
    let stop = false;
    const B = site();
    const me = T.me();
    async function tick() {
      if (stop || !box.isConnected) return;
      tries++;
      let d;
      try {
        d = await call('bg_table_settlement', { p_table: tableId });
      } catch (e) {
        if (tries < 40) setTimeout(tick, 3000);
        return;
      }
      if (d.state === 'playing' || d.state === 'none') {
        box.innerHTML = `<p class="t-rw-wait"><span class="t-spin"></span>Sonuç doğrulanıyor… (${d.reported}/${d.expected} oyuncu bildirdi)</p>`;
        if (tries < 120) setTimeout(tick, tries < 10 ? 1500 : 3000);
        return;
      }
      if (d.state === 'free') {
        box.innerHTML = `<p class="t-muted">Bu maç ücretsizdi (tek gerçek oyuncu), BP ödülü ve görev ilerlemesi yok.</p>`;
        return;
      }
      if (d.state === 'disputed' || d.state === 'refunded') {
        box.innerHTML = `<p class="t-rw-note">Sonuç oyuncular arasında doğrulanamadı; masa ücretin (${d.fee} BP) iade edildi.</p>`;
        if (B && B.bp) B.bp.refresh();
        return;
      }
      if (d.state === 'void') {
        box.innerHTML = `<p class="t-muted">Masa kapandığı için bu maçta ödül yok.</p>`;
        return;
      }
      const rows = (d.prizes || []).slice().sort((x, y) => x.place - y.place || x.seat - y.seat);
      const medal = (p) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p + '.');
      const rw = d.reward;
      box.innerHTML = `<div class="t-rw-h">${ICON.trophy}<b>Ödüller</b><span class="t-muted">Masa ücreti ${d.fee} BP</span></div>
        <ul class="t-rw-list">${rows
          .map(
            (r) => `<li class="${me && r.u === me.id ? 'is-me' : ''}"><span class="t-rw-pl">${r.kind === 'refund' ? '=' : medal(r.place)}</span><span class="t-rw-n">${esc(r.name)}${T.cfg.game === 'dostkazigi-online' ? ` <small class="t-muted">Takım ${r.team + 1}</small>` : ''}</span>
              <b class="t-rw-bp">${r.kind === 'refund' ? 'iade ' : ''}+${r.bp} BP</b>${r.fc ? `<span class="t-rw-fc">🤝 +${r.fc}</span>` : ''}</li>`
          )
          .join('')}</ul>
        ${
          rw && !rw.claimed
            ? `<button type="button" class="t-btn is-primary is-lg t-rw-go">${ICON.coin}ÖDÜLLERİ TOPLA · +${rw.bp} BP${rw.fc ? ' · +' + rw.fc + ' FC' : ''}</button>`
            : rw && rw.claimed
            ? `<p class="t-ok">${ICON.check}Ödüllerin hesabına eklendi.</p>`
            : `<p class="t-muted">Bu maçta sana BP ödülü çıkmadı. Görev ilerlemen işlendi.</p>`
        }`;
      const go = $('.t-rw-go', box);
      if (go)
        go.addEventListener('click', async () => {
          go.disabled = true;
          try {
            const r = B && B.bp && B.bp.collect ? await B.bp.collect(null, tableId) : await call('bg_rewards_claim', { p_table: tableId });
            if (r) {
              burst(go);
              go.outerHTML = `<p class="t-ok">${ICON.check}+${r.bp} BP${r.fc ? ' ve +' + r.fc + ' Friend Coins' : ''} hesabına eklendi.</p>`;
            } else go.disabled = false;
          } catch (e) {
            go.disabled = false;
            T.toast(e.message || 'Ödül alınamadı', 'err');
          }
        });
    }
    tick();
    return () => (stop = true);
  };
  function burst(elm) {
    if (!elm || reduceMo()) return;
    const c = center(elm);
    if (!c) return;
    for (let i = 0; i < 18; i++) {
      const sp = el('<span class="t-spark is-gold"></span>');
      sp.style.left = c.x + 'px';
      sp.style.top = c.y + 'px';
      document.body.appendChild(sp);
      const ang = (Math.PI * 2 * i) / 18;
      const dist = 50 + Math.random() * 40;
      sp.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist - 20}px)) scale(.3)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => sp.remove();
    }
  }

  /* =====================================================================
     ONLINE LOBİ
     ===================================================================== */
  const lobby = { timer: null, off: [], data: null, busy: false };
  T.mount = function (cfg) {
    T.cfg = cfg;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && T.sess) T.sess.ping();
    });
    // Bekleme odasındayken sayfadan ayrılan masadan kalkar (kurucuysa masa kapanır).
    // Oyun başladıysa ayrılmak "düşmek" sayılır: koltuk korunur, yerine bot oynar.
    window.addEventListener('pagehide', () => {
      const cur = T.cur;
      const B = site();
      // v3.2: çerçeve kapanırken gerçek zamanlı kanallar ana sayfadan kaldırılır (eski çerçeve olay almaya devam etmesin)
      try {
        if (cur && cur.link) cur.link.close();
      } catch (e) {}
      if (!cur || !room.cur || !B || !B.api || !B.api.rpcKeepalive) return;
      if (mySeat(cur.table) != null) B.api.rpcKeepalive('bg_table_leave', { p_table: cur.id });
    });
  };

  function rootEl() {
    return T.cfg.root;
  }

  function tableCard(t, kind) {
    const seats = t.seats || [];
    const humans = seats.filter((s) => s.kind === 'human');
    const filled = seats.filter((s) => s.kind !== 'empty').length;
    const me = T.me();
    const avs = seats
      .filter((s) => s.kind !== 'empty')
      .map((s) => T.avatar({ name: seatName(s), avatar_url: s.avatar_url, bot: s.kind === 'bot', badge: s.badge }, 30))
      .join('');
    const title = t.title || (t.host_name ? t.host_name + ' masası' : 'Masa');
    const rules = T.cfg.rules.summary(t.rules || {}, t.seats_n);
    const fee = t.mode === 'online' && t.fee ? `<span class="t-chip is-fee" title="Masa ücreti">${ICON.coin}${t.fee} BP</span>` : '';
    let state = '';
    let btn = '';
    if (kind === 'mine') {
      if (t.status === 'lobby') {
        state = `<span class="t-chip">Bekleme odası · ${filled}/${t.seats_n}</span>`;
        btn = `<button type="button" class="t-btn is-primary" data-open="${t.id}">Odaya dön</button>`;
      } else {
        state = `<span class="t-chip is-live">${t.mode === 'bots' ? 'Botlara karşı' : 'Oynanıyor'}</span>`;
        btn = `<button type="button" class="t-btn is-primary" data-open="${t.id}">Devam et</button>`;
      }
    } else if (kind === 'open') {
      state = `<span class="t-chip">${filled}/${t.seats_n} oyuncu</span>`;
      btn = `<button type="button" class="t-btn is-primary" data-open="${t.id}">Katıl</button>`;
    } else {
      const fr = humans.filter((s) => T.isFriend(s.user_id) && !s.left_game);
      state = `<span class="t-chip is-live">Oynanıyor</span>`;
      btn = `<button type="button" class="t-btn" data-watch="${t.id}" data-who="${esc(fr[0] ? fr[0].user_id : '')}">${ICON.eye}İzle</button>`;
    }
    const host = t.host_id && me && t.host_id === me.id ? 'Senin masan' : t.host_name ? esc(t.host_name) + ' kurdu' : '';
    return `<article class="t-card">
      <div class="t-card-main">
        <div class="t-card-top"><h4>${esc(title)}</h4>${fee}${state}</div>
        <p class="t-card-rules">${esc(rules)}</p>
        <div class="t-card-who"><span class="t-avs">${avs}</span><span class="t-muted">${host}</span></div>
      </div>
      <div class="t-card-act">${btn}</div>
    </article>`;
  }

  function econBarHTML() {
    const e = T.econ();
    if (!e) return '';
    const mr = e.missions_ready || 0;
    return `<div class="t-econ">
        <button type="button" class="t-econ-bp" data-econ="wallet" title="BP cüzdanın">${T.rankIcon(e.rank, 22)}<b>${Number(e.balance || 0).toLocaleString('tr-TR')}</b><small>BP</small>${e.prestige ? T.prestigeChip(e.prestige, { short: true }) : ''}</button>
        <button type="button" class="t-btn is-ghost" data-econ="missions">${ICON.target}<span>Görevler</span>${mr ? `<span class="t-badge">${mr}</span>` : ''}</button>
        <button type="button" class="t-btn is-ghost" data-econ="fc" title="Friend Coins → BP">${ICON.swap}<span>${Number(e.fc || 0).toLocaleString('tr-TR')} FC</span></button>
        <button type="button" class="t-btn is-ghost" data-econ="leader">${ICON.trophy}<span>Liderlik</span></button>
        ${e.rewards_ready ? `<button type="button" class="t-btn is-primary" data-econ="rewards">${ICON.coin}<span>Ödülleri topla</span><span class="t-badge">${e.rewards_ready}</span></button>` : ''}
      </div>`;
  }
  T.econBarHTML = econBarHTML;
  /** Site pencereleri: cüzdan, görevler, liderlik (oyunun üstünde açılır) */
  T.econOpen = function (what) {
    const B = site();
    if (!B) return;
    if (what === 'wallet' || what === 'rewards') return B.bp && B.bp.openPanel('wallet');
    if (what === 'fc') return B.bp && B.bp.openPanel('fc');
    if (what === 'missions') return B.missionsModal && B.missionsModal(T.cfg.game);
    if (what === 'leader') return B.leaderModal && B.leaderModal();
  };
  function lobbyFrame() {
    return `<div class="t-lobby">
      <div class="t-lobby-head">
        <button type="button" class="t-btn is-ghost t-back" data-back>${ICON.back}<span>Geri</span></button>
        <div class="t-lobby-title"><h2>Online masalar</h2><p>Masa kur, arkadaşlarını çağır ya da açık bir masaya otur.</p></div>
        <button type="button" class="t-btn is-primary" data-create>Masa kur</button>
      </div>
      <div class="t-econ-slot">${econBarHTML()}</div>
      <div class="t-lobby-body"><p class="t-empty">Masalar yükleniyor…</p></div>
    </div>`;
  }
  // BP değişince lobideki çubuk tazelenir
  (function watchEcon() {
    const B = site();
    if (!B || !B.bus) return;
    const off = B.bus.on('bp', () => {
      const slot = $('.t-econ-slot', document);
      if (slot) slot.innerHTML = econBarHTML();
    });
    window.addEventListener('pagehide', off);
  })();

  function paintLobby() {
    const root = rootEl();
    const body = $('.t-lobby-body', root);
    if (!body) return;
    const d = lobby.data;
    if (!d) return;
    const sec = (title, list, kind, empty) =>
      `<section class="t-sec"><h3>${title}</h3>${list.length ? `<div class="t-cards">${list.map((t) => tableCard(t, kind)).join('')}</div>` : `<p class="t-empty">${empty}</p>`}</section>`;
    body.innerHTML =
      (d.mine.length ? sec('Masaların', d.mine, 'mine', '') : '') +
      sec('Katılabileceğin masalar', d.open, 'open', 'Şu an açık masa yok. Bir masa kur, arkadaşların burada görsün.') +
      sec('Arkadaşlarının masaları', d.watch, 'watch', 'Oyun oynayan arkadaşın yok. Arkadaşların bir masada oynarken buradan izleyebilir, elindeki kartları görebilirsin.');
  }

  async function loadLobby() {
    if (lobby.busy || !T.authed()) return;
    lobby.busy = true;
    try {
      const d = await call('bg_table_lobby', { p_game: T.cfg.game });
      lobby.data = { mine: d.mine || [], open: d.open || [], watch: d.watch || [] };
      paintLobby();
    } catch (e) {
      const body = $('.t-lobby-body', rootEl());
      if (body && !lobby.data) body.innerHTML = `<p class="t-empty is-err">${esc(e.message || 'Masalar yüklenemedi.')}</p>`;
    } finally {
      lobby.busy = false;
    }
  }

  T.openLobby = function () {
    T.closeTable(true);
    stopLobby();
    const root = rootEl();
    if (!T.inSite() || !T.authed()) {
      root.innerHTML = `<div class="t-lobby"><div class="t-lobby-head"><button type="button" class="t-btn is-ghost t-back" data-back>${ICON.back}<span>Geri</span></button><div class="t-lobby-title"><h2>Online masalar</h2></div></div>
        <div class="t-gate">${T.inSite() ? '<h3>Online oynamak için giriş yap</h3><p>Masa kurmak, arkadaşlarınla oynamak ve onları izlemek için Bözer Gaming hesabınla giriş yapmalısın. Botlara karşı oynamak için giriş gerekmez.</p><button type="button" class="t-btn is-primary" data-login>Giriş yap</button>' : '<h3>Online masa için siteden aç</h3><p>Online oyun Bözer Gaming sitesinde, hesabınla giriş yaptığında açılır. Bu dosyada botlara karşı oynayabilirsin.</p>'}</div></div>`;
      bindLobby(root);
      setRoute('mod=online');
      return;
    }
    root.innerHTML = lobbyFrame();
    bindLobby(root);
    lobby.data = null;
    loadLobby();
    lobby.timer = setInterval(() => document.visibilityState === 'visible' && loadLobby(), 8000);
    setRoute('mod=online');
    presence(null);
  };
  function stopLobby() {
    clearInterval(lobby.timer);
    lobby.timer = null;
  }
  T.stopLobby = stopLobby;

  function bindLobby(root) {
    root.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.econ) return T.econOpen(b.dataset.econ);
      if (b.hasAttribute('data-back')) {
        stopLobby();
        setRoute('');
        return T.cfg.onBack && T.cfg.onBack();
      }
      if (b.hasAttribute('data-login')) return T.goLogin();
      if (b.hasAttribute('data-create')) return createForm();
      const id = b.dataset.open || b.dataset.watch;
      if (id) {
        b.disabled = true;
        try {
          await T.openTable(id, { watch: !!b.dataset.watch, who: b.dataset.who || '' });
        } catch (err) {
          T.toast(err.message || 'Masa açılamadı', 'err');
          b.disabled = false;
          loadLobby();
        }
      }
    };
  }

  /* ---------------- masa kurma / kural formu ---------------- */
  function rulesFormHTML(rules, n, opts) {
    opts = opts || {};
    const counts = T.cfg.seatCounts;
    const seg = `<div class="t-field"><span class="t-lab">Oyuncu sayısı</span><div class="t-seg" data-seg="seats">${counts
      .map((c) => `<button type="button" data-v="${c}" aria-pressed="${c === n}">${c}</button>`)
      .join('')}</div></div>`;
    const vis = opts.vis
      ? `<div class="t-field"><span class="t-lab">Masayı kimler görsün?</span><div class="t-seg" data-seg="vis"><button type="button" data-v="friends" aria-pressed="${opts.vis === 'friends'}">Arkadaşlarım</button><button type="button" data-v="public" aria-pressed="${opts.vis === 'public'}">Herkes</button></div></div>`
      : '';
    const title =
      opts.title != null
        ? `<div class="t-field"><label class="t-lab" for="tTitle">Masa adı</label><input class="t-input" id="tTitle" maxlength="40" placeholder="${esc((T.myName() || 'Benim') + ' masası')}" value="${esc(opts.title)}"></div>`
        : '';
    const fee = opts.vis ? feeHTML(rules.fee || 10, n) : '';
    return `<form class="t-form" onsubmit="return false">${title}${seg}${fee}<div class="t-rules">${T.cfg.rules.form(rules, n, opts)}</div>${vis}<p class="t-note">Boş kalan koltuklara oyun başlarken bot oturur.</p></form>`;
  }
  /* ---------------- masa ücreti ve ödül tablosu ---------------- */
  /* v3.2: masa ücretleri, rütbe şartları ve ödüller yönetim panelinden gelir (cüzdan özeti → levels) */
  const DEF_LEVELS = [10, 20, 30, 40, 50, 60, 70].map((fee, i) => ({
    fee,
    min_rank: [1, 6, 11, 16, 20, 24, 26][i],
    am: { 2: [[15, 35, 45, 60, 75, 90, 105][i]], 3: [[15, 35, 45, 60, 75, 90, 105][i], fee], 4: [[25, 45, 65, 85, 105, 125, 145][i], [10, 30, 45, 60, 75, 90, 105][i]], 5: [[35, 55, 85, 115, 145, 175, 205][i], [10, 30, 45, 60, 75, 90, 105][i]] },
    dk: { 4: Math.round(fee * 1.5), 6: Math.round(fee * 2.25), 8: fee * 3 },
  }));
  function levels() {
    const e = T.econ();
    const B = site();
    const l = (e && e.levels) || (B && B.publicSettings && B.publicSettings.levels);
    return Array.isArray(l) && l.length ? l : DEF_LEVELS;
  }
  /** Ücretin seviye kaydı; seviye kaldırıldıysa en yakın seviyenin ödülleri ücretle orantılanır (sunucuyla aynı kural) */
  function levelOf(fee) {
    const L = levels();
    const ex = L.find((l) => +l.fee === +fee);
    if (ex) return ex;
    const near = L.slice().sort((a, b) => Math.abs(a.fee - fee) - Math.abs(b.fee - fee) || a.fee - b.fee)[0];
    if (!near) return null;
    const f = fee / Math.max(1, near.fee);
    const am = {};
    Object.keys(near.am || {}).forEach((k) => (am[k] = (near.am[k] || []).map((v) => Math.round(v * f))));
    const dk = {};
    Object.keys(near.dk || {}).forEach((k) => (dk[k] = Math.round((near.dk[k] || 0) * f)));
    return { fee, min_rank: near.min_rank, am, dk };
  }
  function amPrizes(fee, n) {
    if (n < 2 || n > 5) return [];
    const l = levelOf(fee);
    const a = ((l && l.am && l.am[n]) || []).slice(0, n).map((v) => +v || 0);
    while (a.length < n) a.push(0);
    return a;
  }
  const dkPrize = (fee, seats) => {
    const l = levelOf(fee);
    const v = l && l.dk ? l.dk[seats || 4] : null;
    return v != null ? +v : Math.round((fee * 3 * Math.floor((seats || 4) / 2)) / 4);
  };
  T.amPrizes = amPrizes;
  T.dkPrize = dkPrize;
  /** Ödül özeti: n = ücret ödeyecek gerçek oyuncu sayısı (Americano) / masa koltuk sayısı (Dost Kazığı) */
  function prizeText(fee, n, seats) {
    if (T.cfg.game === 'dostkazigi-online') return `Kazanan takımın her oyuncusu <b>${dkPrize(fee, seats || n)} BP</b> alır; kaybeden takım almaz. Bütün takımlar berabere kalırsa ücretler iade edilir.`;
    if (n < 2) return 'Tek gerçek oyuncuyla (botlara karşı) masa ücretsiz ve ödülsüzdür.';
    const pr = amPrizes(fee, n);
    return `${n} gerçek oyuncuyla ödüller: ${pr.map((v, i) => `${i + 1}. <b>${v} BP</b>`).join(' · ')}`;
  }
  T.prizeText = prizeText;
  /** v3.3: Americano'da masa ücretlerinde rütbe şartı yok — herkes her ücretle açar (panelden açılabilir).
      Dost Kazığı'nda her ücret seviyesinin rütbe şartı geçerli. */
  function rankLocked() {
    if (T.cfg.game !== 'americano-online') return true;
    const B = site();
    return !!(B && B.publicSettings && B.publicSettings.am_rank_lock);
  }
  function feeHTML(fee, n) {
    const e = T.econ();
    const max = (e && e.max_fee) || 10;
    const bal = e ? e.balance : 0;
    const rank = (e && e.rank) || 1;
    const B = site();
    const locked = rankLocked();
    const rname = (r) => (B && B.rankInfo ? B.rankInfo(r).name : r + '. rütbe');
    return `<div class="t-field t-feebox"><span class="t-lab">Masa ücreti</span><div class="t-seg t-fee" data-seg="fee">${levels().map((l) => {
      const v = +l.fee;
      const lock = locked && (l.min_rank || 1) > rank ? `Bu masa için en az ${rname(l.min_rank)} rütbesi gerekli` : v > bal ? 'BP bakiyen yetmiyor' : '';
      return `<button type="button" data-v="${v}" aria-pressed="${v === fee}" ${lock ? `disabled title="${esc(lock)}"` : ''}>${v}${lock ? ICON.lock : ''}</button>`;
    }).join('')}</div>
      <p class="t-note t-prize" data-prize>${prizeText(fee, Math.min(n, 5), n)}</p>
      <p class="t-note">${locked ? `Rütben en fazla <b>${max} BP</b>’lik masa açmana izin veriyor.` : 'Bütün masa ücretleri herkese açık; bakiyen yettiği sürece istediğin ücreti seç.'} Ücret, oyun başlarken en az 2 gerçek oyuncu varsa herkesten alınır; ödüller maç sonunda “Ödülleri topla” ile hesaba geçer.</p></div>`;
  }
  function wireForm(body, state) {
    body.addEventListener('click', (e) => {
      const b = e.target.closest('.t-seg button');
      if (!b) return;
      const seg = b.closest('.t-seg');
      $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (seg.dataset.seg === 'seats') {
        state.n = +b.dataset.v;
        const r = $('.t-rules', body);
        state.rules = T.cfg.rules.read($('form', body), state.rules);
        r.innerHTML = T.cfg.rules.form(state.rules, state.n, state);
        const pz = $('[data-prize]', body);
        if (pz) pz.innerHTML = prizeText(state.rules.fee || 10, Math.min(state.n, 5), state.n);
      } else if (seg.dataset.seg === 'fee') {
        state.rules.fee = +b.dataset.v;
        const pz = $('[data-prize]', body);
        if (pz) pz.innerHTML = prizeText(state.rules.fee, Math.min(state.n, 5), state.n);
      } else if (seg.dataset.seg === 'vis') state.vis = b.dataset.v;
      else if (T.cfg.rules.onSeg) T.cfg.rules.onSeg(seg, b, body, state);
    });
  }
  function readForm(body, state) {
    const fee = state.rules.fee;
    state.rules = T.cfg.rules.read($('form', body), state.rules);
    const on = $('[data-seg="fee"] [aria-pressed="true"]', body);
    state.rules.fee = on ? +on.dataset.v : fee || 10;
    const t = $('#tTitle', body);
    if (t) state.title = t.value.trim();
    return state;
  }

  function createForm() {
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem('bgt.create.' + T.cfg.game) || 'null');
      } catch (e) {
        return null;
      }
    })();
    const state = Object.assign({ n: T.cfg.defSeats, vis: 'friends', title: '', rules: T.cfg.rules.defaults() }, saved || {});
    if (!T.cfg.seatCounts.includes(state.n)) state.n = T.cfg.defSeats;
    state.rules = Object.assign(T.cfg.rules.defaults(), state.rules || {});
    {
      const e = T.econ();
      // seçili ücret yoksa ya da artık açılamıyorsa: açılabilen en yüksek seviye (bakiye yetmezse en düşük)
      const rank = (e && e.rank) || 1;
      const bal = e ? e.balance : 0;
      const locked = rankLocked();
      const ok = levels().filter((l) => (!locked || (l.min_rank || 1) <= rank) && +l.fee <= bal).map((l) => +l.fee);
      if (!ok.includes(state.rules.fee)) {
        const below = ok.filter((f) => state.rules.fee && f <= state.rules.fee);
        state.rules.fee = below.length ? Math.max(...below) : ok.length ? ok[0] : +levels()[0].fee;
      }
    }
    const sh = T.sheet({
      title: 'Masa kur',
      body: rulesFormHTML(state.rules, state.n, state),
      actions: [
        { label: 'Vazgeç', value: false },
        {
          label: 'Masayı kur',
          kind: 'primary',
          onClick: async (wrap, btn) => {
            readForm(sh.body, state);
            btn.disabled = true;
            try {
              localStorage.setItem('bgt.create.' + T.cfg.game, JSON.stringify({ n: state.n, vis: state.vis, rules: state.rules }));
            } catch (e) {}
            try {
              const id = await call('bg_table_create', {
                p_game: T.cfg.game,
                p_rules: state.rules,
                p_seats: state.n,
                p_visibility: state.vis,
                p_mode: 'online',
                p_title: state.title || '',
              });
              stopLobby();
              await T.openTable(id, {});
              return true;
            } catch (e) {
              btn.disabled = false;
              T.toast(e.message || 'Masa kurulamadı', 'err');
              return false;
            }
          },
        },
      ],
    });
    wireForm(sh.body, state);
  }

  /* =====================================================================
     MASAYI AÇ
     ===================================================================== */
  T.cur = null;
  T.openTable = async function (id, opts) {
    opts = opts || {};
    const r = await call('bg_table_state', { p_table: id, p_after: 2147483647 });
    const t = r.table;
    if (!t || t.game !== T.cfg.game) throw new Error('Bu masa bu oyuna ait değil.');
    if (t.status === 'closed') throw new Error('Bu masa kapandı.');
    stopLobby();
    T.closeTable(true);
    const cur = (T.cur = { id, table: t, me: r.me || {}, link: new Link(id), opts, off: [] });
    chat.attach(id, !!(r.me && r.me.can_watch));
    if (t.status === 'lobby') return room.open(cur);
    return play(cur);
  };
  T.closeTable = function (silent) {
    const cur = T.cur;
    if (!cur) return;
    T.cur = null;
    room.close();
    if (T.sess) {
      T.sess.close();
      T.sess = null;
    }
    cur.off.forEach((f) => f());
    cur.link.close();
    chat.detach();
    presence(null);
    if (!silent) setRoute('');
  };

  /* =====================================================================
     BEKLEME ODASI
     ===================================================================== */
  const room = { cur: null, timer: null, off: [], busy: false, rt: null };
  room.open = function (cur) {
    room.close();
    room.cur = cur;
    const root = rootEl();
    root.innerHTML = `<div class="t-room"></div>`;
    root.onclick = room.onClick;
    room.paint();
    setRoute('masa=' + cur.id);
    const meSeat = mySeat(cur.table);
    presence(meSeat != null ? cur.id : null);
    cur.link.setRole(meSeat != null ? 'player' : 'viewer');
    const kick = () => room.refresh();
    room.off.push(T.on('rt-seat', kick), T.on('rt-table', kick));
    room.timer = setInterval(() => document.visibilityState === 'visible' && room.refresh(true), 4000);
    if (T.cfg.onRoom) T.cfg.onRoom(cur);
  };
  room.close = function () {
    clearInterval(room.timer);
    room.timer = null;
    room.off.forEach((f) => f());
    room.off = [];
    room.cur = null;
  };
  function mySeat(t) {
    const me = T.me();
    if (!me || !t || !t.seats) return null;
    const s = t.seats.find((x) => x.user_id === me.id && x.kind === 'human' && !x.left_game);
    return s ? s.seat : null;
  }
  T.mySeat = mySeat;
  room.refresh = async function (ping) {
    const cur = room.cur;
    if (!cur || room.busy) {
      if (cur) room.again = true;
      return;
    }
    room.busy = true;
    try {
      const me = mySeat(cur.table);
      if (ping && me != null) await call('bg_table_ping', { p_table: cur.id, p_view: null }).catch(() => {});
      const r = await call('bg_table_state', { p_table: cur.id, p_after: 2147483647 });
      if (room.cur !== cur) return;
      cur.table = r.table;
      cur.me = r.me || cur.me;
      if (r.table.status === 'playing' || r.table.status === 'finished') {
        room.close();
        chat.allow(!!(r.me && r.me.can_watch));
        return play(cur);
      }
      if (r.table.status === 'closed') {
        T.toast('Masa kapatıldı.', '');
        return T.openLobby();
      }
      if (me != null && mySeat(r.table) == null) {
        // koltuğum kalktı (kurucu oyuncu sayısını azalttı)
        presence(null);
      } else if (mySeat(r.table) != null) presence(cur.id);
      room.paint();
    } catch (e) {
      if (room.cur === cur && errCode(e) === 'P0002') {
        T.toast('Bu masaya artık erişemiyorsun.', 'err');
        T.openLobby();
      }
    } finally {
      room.busy = false;
      if (room.again) {
        room.again = false;
        setTimeout(() => room.refresh(), 60);
      }
    }
  };
  function seatPos(rel, n) {
    const dir = T.cfg.seatDir || -1;
    const a = Math.PI / 2 + (dir * rel * 2 * Math.PI) / n;
    return [50 + 41 * Math.cos(a), 50 + 37 * Math.sin(a)];
  }
  room.paint = function () {
    const cur = room.cur;
    if (!cur) return;
    const t = cur.table;
    const me = T.me();
    const isHost = me && t.host_id === me.id;
    const mine = mySeat(t);
    const ref = mine != null ? mine : 0;
    const seats = t.seats || [];
    const humans = seats.filter((s) => s.kind === 'human');
    const allReady = humans.every((s) => s.ready || s.user_id === t.host_id);
    const waiting = humans.filter((s) => !s.ready && s.user_id !== t.host_id);
    const box = $('.t-room', rootEl());
    if (!box) return;
    const seatHTML = seats
      .map((s) => {
        const [x, y] = seatPos((s.seat - ref + t.seats_n) % t.seats_n, t.seats_n);
        const tag = T.cfg.seatTag ? T.cfg.seatTag(s.seat, t.seats_n) : '';
        if (s.kind === 'empty') {
          return `<div class="t-seat is-empty" style="--x:${x}%;--y:${y}%">${tag}<span class="t-chair">${ICON.chair}</span><span class="t-seat-n">Boş koltuk</span>${
            me ? `<button type="button" class="t-btn is-sm" data-sit="${s.seat}">${mine != null ? 'Buraya geç' : 'Otur'}</button>` : ''
          }</div>`;
        }
        const nm = seatName(s);
        const host = s.user_id && s.user_id === t.host_id;
        const ready = s.ready || host;
        const away = s.kind === 'human' && s.away;
        const av = T.avatar({ name: nm, avatar_url: s.avatar_url, bot: s.kind === 'bot', badge: s.badge, rankPip: true }, 46);
        return `<div class="t-seat${s.seat === mine ? ' is-me' : ''}${ready ? ' is-ready' : ''}" style="--x:${x}%;--y:${y}%">${tag}
          ${s.kind === 'human' && s.user_id ? `<button type="button" class="t-avbtn" data-player="${esc(s.user_id)}" aria-label="${esc(nm)} profili">${av}</button>` : av}
          <span class="t-seat-n">${T.nameTag(nm, s.kind === 'bot')}${s.seat === mine ? ' <span class="t-muted">(sen)</span>' : ''}</span>
          <span class="t-seat-s">${host ? `<span class="t-host">${ICON.crown}Kurucu</span>` : ready ? `<span class="t-ok">${ICON.check}Hazır</span>` : '<span class="t-wait">Bekliyor</span>'}${away ? `<span class="t-away" title="Bağlantısı yok">${ICON.wifi}</span>` : ''}</span>
        </div>`;
      })
      .join('');
    const myS = mine != null ? seats.find((s) => s.seat === mine) : null;
    const title = t.title || (t.host_name ? t.host_name + ' masası' : 'Masa');
    let actions = '';
    if (isHost) {
      actions = `<button type="button" class="t-btn is-primary is-lg" data-start ${allReady && mine != null ? '' : 'disabled'}>Oyunu başlat</button>
        <p class="t-hint">${mine == null ? 'Başlatmak için bir koltuğa otur.' : allReady ? (humans.length < 2 ? 'Tek başınasın: boş koltuklara bot oturacak.' : 'Herkes hazır, başlatabilirsin.') : 'Hazır olmayan: ' + waiting.map((s) => esc(seatName(s))).join(', ')}</p>`;
    } else if (myS) {
      actions = `<button type="button" class="t-btn ${myS.ready ? '' : 'is-primary '}is-lg" data-ready="${myS.ready ? '0' : '1'}">${myS.ready ? 'Hazır değilim' : 'Hazırım'}</button>
        <p class="t-hint">${myS.ready ? 'Kurucunun oyunu başlatması bekleniyor.' : 'Hazır olduğunda düğmeye bas.'}</p>`;
    } else {
      actions = `<p class="t-hint">${me ? 'Oynamak için boş bir koltuğa otur.' : ''}</p>`;
    }
    const visTxt = t.visibility === 'public' ? 'Herkese açık' : 'Arkadaşlarına açık';
    const nHum = humans.length;
    const feeBox = t.mode === 'online' && t.fee
      ? `<div class="t-feeinfo"><div class="t-feeinfo-h">${ICON.coin}<b>Masa ücreti: ${t.fee} BP</b></div>
          <p>${prizeText(t.fee, Math.max(2, Math.min(nHum, 5)), t.seats_n)}</p>
          <p class="t-muted">${nHum >= 2 ? `Oyun başlarken ${nHum} gerçek oyuncunun her birinden ${t.fee} BP alınır. Ödüller maç sonunda sonuç ekranından toplanır.` : 'Şu an tek gerçek oyuncu var: böyle başlarsa masa ücretsiz ve ödülsüz oynanır. En az 2 gerçek oyuncu olunca ücret alınır.'}</p></div>`
      : '';
    box.innerHTML = `
      <div class="t-room-head">
        <button type="button" class="t-btn is-ghost t-back" data-leave>${ICON.back}<span>${isHost ? 'Masayı kapat' : mine != null ? 'Masadan kalk' : 'Geri'}</span></button>
        <div class="t-room-title"><h2>${esc(title)}</h2><p>${esc(visTxt)} · ${seats.filter((s) => s.kind !== 'empty').length}/${t.seats_n} oyuncu</p></div>
        <div class="t-room-tools">
          <button type="button" class="t-btn is-ghost" data-invite>${ICON.link}<span>Davet bağlantısı</span></button>
          <button type="button" class="t-icon t-chatbtn" data-chat aria-label="Masa sohbeti">${ICON.chat}</button>
        </div>
      </div>
      <div class="t-room-main">
        <div class="t-ring"><div class="t-felt"><div class="t-felt-in"><b>${esc(T.cfg.name)}</b><span>${esc(T.cfg.rules.summary(t.rules || {}, t.seats_n))}</span>${
          isHost ? '<button type="button" class="t-btn is-sm is-ghost" data-rules>Kuralları düzenle</button>' : ''
        }</div></div>${seatHTML}</div>
        <div class="t-room-side">${feeBox}${actions}<p class="t-note">Oyun sırasında bağlantın koparsa yerine bot oynar, geri gelince kaldığın yerden devam edersin. Oyundan çıkarsan koltuğunda bot oynamaya devam eder${t.fee ? ' ve masa ücreti iade edilmez' : ''}.</p></div>
      </div>`;
    chat.bind($('[data-chat]', box));
  };
  room.onClick = async function (e) {
    const b = e.target.closest('button');
    const cur = room.cur;
    if (!b || b.disabled || !cur) return;
    if (b.hasAttribute('data-chat')) return;
    if (b.dataset.player) return T.playerCard(b.dataset.player);
    const t = cur.table;
    const me = T.me();
    const isHost = me && t.host_id === me.id;
    try {
      if (b.dataset.sit != null) {
        b.disabled = true;
        await call('bg_table_sit', { p_table: cur.id, p_seat: +b.dataset.sit });
        cur.link.setRole('player');
        chat.allow(true);
        presence(cur.id);
        await room.refresh();
      } else if (b.dataset.ready != null) {
        b.disabled = true;
        await call('bg_table_ready', { p_table: cur.id, p_ready: b.dataset.ready === '1' });
        await room.refresh();
      } else if (b.hasAttribute('data-start')) {
        b.disabled = true;
        await call('bg_table_start', { p_table: cur.id });
        await room.refresh();
      } else if (b.hasAttribute('data-leave')) {
        const mine = mySeat(t);
        if (isHost) {
          if (!(await T.confirm('Masa kapatılsın mı?', 'Masadaki herkes lobiye döner.', 'Masayı kapat', 'danger'))) return;
        }
        if (mine != null || isHost) await call('bg_table_leave', { p_table: cur.id });
        T.openLobby();
      } else if (b.hasAttribute('data-invite')) invite(cur);
      else if (b.hasAttribute('data-rules')) editRules(cur);
    } catch (err) {
      b.disabled = false;
      T.toast(err.message || 'İşlem yapılamadı', 'err');
      room.refresh();
    }
  };
  function inviteLink(id) {
    try {
      const pl = window.parent.location;
      return pl.origin + pl.pathname + '#/oyun/' + T.cfg.game + '?masa=' + id;
    } catch (e) {
      return location.href;
    }
  }
  T.inviteLink = inviteLink;
  async function copyText(text) {
    const tries = [];
    try {
      if (window.parent.navigator.clipboard) tries.push(() => window.parent.navigator.clipboard.writeText(text));
    } catch (e) {}
    if (navigator.clipboard) tries.push(() => navigator.clipboard.writeText(text));
    for (const f of tries) {
      try {
        await f();
        return true;
      } catch (e) {}
    }
    try {
      const ta = el('<textarea style="position:fixed;opacity:0;left:-9999px"></textarea>');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }
  function invite(cur) {
    const link = inviteLink(cur.id);
    const sh = T.sheet({
      title: 'Arkadaşını masaya çağır',
      body: `<p class="t-text">Bu bağlantıyı gönder. Açan kişi masayı görür, boş bir koltuğa oturur.${cur.table.visibility === 'friends' ? ' Masa yalnızca arkadaşlarına açık; arkadaşın olmayanlar bağlantıyla da giremez.' : ''}</p>
        <div class="t-copy"><input class="t-input" readonly value="${esc(link)}" aria-label="Davet bağlantısı"><button type="button" class="t-btn is-primary" data-copy>Kopyala</button></div>`,
      actions: [{ label: 'Kapat' }],
    });
    $('[data-copy]', sh.body).addEventListener('click', async (e) => {
      const ok = await copyText(link);
      e.target.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı';
      if (!ok) $('input', sh.body).select();
    });
  }
  function editRules(cur) {
    const t = cur.table;
    const state = { n: t.seats_n, vis: t.visibility === 'public' ? 'public' : 'friends', title: t.title || '', rules: Object.assign(T.cfg.rules.defaults(), t.rules || {}) };
    const sh = T.sheet({
      title: 'Masa kuralları',
      body: rulesFormHTML(state.rules, state.n, state),
      actions: [
        { label: 'Vazgeç' },
        {
          label: 'Kaydet',
          kind: 'primary',
          onClick: async (wrap, btn) => {
            readForm(sh.body, state);
            btn.disabled = true;
            try {
              await call('bg_table_update', { p_table: cur.id, p_rules: state.rules, p_seats: state.n, p_visibility: state.vis, p_title: state.title });
              T.toast('Kurallar güncellendi. Herkes yeniden hazır olmalı.', 'good');
              room.refresh();
              return true;
            } catch (e) {
              btn.disabled = false;
              T.toast(e.message || 'Kaydedilemedi', 'err');
              return false;
            }
          },
        },
      ],
    });
    wireForm(sh.body, state);
  }

  /* =====================================================================
     BOTLARA KARŞI (hesaba kayıtlı, arkadaşlar izleyebilir)
     ===================================================================== */
  T.createBots = async function (rules, n, botNames) {
    const id = await call('bg_table_create', {
      p_game: T.cfg.game,
      p_rules: rules,
      p_seats: n,
      p_visibility: 'private',
      p_mode: 'bots',
      p_title: '',
      p_bots: botNames || null,
    });
    await T.openTable(id, {});
    return id;
  };
  /** Kaldığın yerden: son botlara karşı masam */
  T.lastBotsTable = async function () {
    if (!T.authed()) return null;
    try {
      const d = await call('bg_table_lobby', { p_game: T.cfg.game });
      return (d.mine || []).find((t) => t.mode === 'bots' && t.status === 'playing') || null;
    } catch (e) {
      return null;
    }
  };

  /* =====================================================================
     OYUN OTURUMU (hamle eşitleme)
     ===================================================================== */
  function play(cur) {
    const t = cur.table;
    const meSeat = mySeat(t);
    let watch = meSeat;
    const spect = meSeat == null;
    if (spect) {
      if (!(cur.me && cur.me.can_watch)) {
        T.toast('Bu masayı izleyemezsin: masada arkadaşın yok.', 'err');
        return T.openLobby();
      }
      const humans = (t.seats || []).filter((s) => s.kind === 'human' && !s.left_game);
      const want = cur.opts.who && humans.find((s) => s.user_id === cur.opts.who);
      const fr = humans.find((s) => T.isFriend(s.user_id));
      watch = (want || fr || humans[0] || t.seats[0] || { seat: 0 }).seat;
    }
    setRoute('masa=' + cur.id + (spect ? '&izle=1' : ''));
    presence(spect ? null : cur.id);
    cur.link.setRole(spect ? 'viewer' : 'player');
    const sess = (T.sess = new Session(cur, meSeat, watch));
    T.cfg.onPlay(sess);
    return sess;
  }

  function norm(row) {
    return {
      seq: +row.seq,
      seat: row.seat == null ? null : +row.seat,
      kind: row.kind,
      data: row.data || {},
      by: row.by || row.by_user || null,
      at: Date.parse(row.at || row.created_at) || T.now(),
    };
  }

  function Session(cur, meSeat, watch) {
    this.cur = cur;
    this.id = cur.id;
    this.table = cur.table;
    this.mode = cur.table.mode;
    this.seats = (cur.table.seats || []).slice();
    this.mySeat = meSeat;
    this.spect = meSeat == null;
    this.watch = watch;
    this.seq = 0;
    this.buf = new Map();
    this.pending = [];
    this.split = false;
    this.needRebase = false;
    this.base = null;
    this.lastAt = Date.parse(cur.table.started_at) || T.now();
    this.holdUntil = 0;
    this.inflight = false;
    this.closed = false;
    this.started = false;
    this.off = [];
    this.view = null;
    this.viewDirty = false;
    this.fails = 0;
    this.gapSince = 0;
  }
  T.Session = Session;
  const SP = Session.prototype;

  SP.start = async function (GA) {
    this.GA = GA;
    this.off.push(
      T.on('rt-action', (row) => row.table_id === this.id && this.onRow(norm(row))),
      T.on('rt-seat', (row) => row.table_id === this.id && this.onSeatRow(row)),
      T.on('rt-table', (row) => row.id === this.id && this.onTableRow(row))
    );
    let st;
    try {
      st = GA.init(this.table, this.seats);
      let after = 0;
      for (let guard = 0; guard < 60; guard++) {
        const r = await call('bg_table_state', { p_table: this.id, p_after: after });
        this.applyTableInfo(r.table);
        const acts = r.actions || [];
        for (const row of acts) {
          const a = norm(row);
          if (a.seq !== after + 1) break;
          try {
            GA.apply(st, a, true);
          } catch (e) {
            console.error('[masa] tekrar oynatma', a, e);
          }
          this.seq = after = a.seq;
          this.lastAt = a.at;
        }
        if (acts.length < PAGE) break;
      }
    } catch (e) {
      T.toast(e.message || 'Masa yüklenemedi', 'err');
      throw e;
    }
    if (this.closed) return;
    this.base = st;
    this.started = true;
    for (const k of Array.from(this.buf.keys())) if (k <= this.seq) this.buf.delete(k);
    GA.reset(st, 'load');
    this.timer = setInterval(() => this.tick(), 1000);
    this.ping();
    this.drain();
  };

  SP.close = function () {
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.viewT);
    this.off.forEach((f) => f());
    this.off = [];
  };

  /* ---- koltuk ve bağlantı durumu ---- */
  SP.seat = function (p) {
    return this.seats.find((s) => s.seat === p) || null;
  };
  SP.isAway = function (s) {
    if (!s || s.kind !== 'human' || s.left_game) return false;
    if (s.seat === this.mySeat && !this.spect) return false;
    if (!s.last_seen) return true;
    return T.now() - Date.parse(s.last_seen) > AWAY_MS;
  };
  /** 'me' | 'human' | 'away' | 'bot' */
  SP.control = function (p) {
    const s = this.seat(p);
    if (!s || s.kind !== 'human' || s.left_game) return 'bot';
    if (p === this.mySeat && !this.spect) return 'me';
    return this.isAway(s) ? 'away' : 'human';
  };
  SP.isDriver = function () {
    if (this.spect || this.mySeat == null) return false;
    const now = T.now();
    const live = this.seats
      .filter((s) => s.kind === 'human' && !s.left_game && (s.seat === this.mySeat || (s.last_seen && now - Date.parse(s.last_seen) <= DRIVER_MS)))
      .map((s) => s.seat);
    if (!live.length) return true;
    return Math.min.apply(null, live) === this.mySeat;
  };
  /** Ekranda gösterilecek oyuncu bilgisi */
  SP.who = function (p) {
    const s = this.seat(p) || {};
    const bot = s.kind !== 'human' || !!s.left_game;
    const away = this.isAway(s);
    return {
      name: s.kind === 'bot' ? s.bot_name || 'Bot' : seatName(s),
      avatar_url: s.avatar_url || '',
      bot: bot || away,
      away,
      left: !!s.left_game,
      user_id: s.user_id || null,
      badge: s.kind === 'human' ? s.badge || null : null,
      me: p === this.mySeat && !this.spect,
      friend: T.isFriend(s.user_id),
    };
  };
  SP.watchable = function () {
    // izleyicinin seçebileceği koltuklar: arkadaşlarının oturduğu koltuklar
    return this.seats.filter((s) => s.kind === 'human' && s.user_id && T.isFriend(s.user_id)).map((s) => s.seat);
  };

  SP.applyTableInfo = function (t) {
    if (!t) return;
    const prev = this.table.status;
    this.table = Object.assign({}, this.table, t);
    if (t.seats) this.seats = t.seats.slice();
    if (this.started && prev !== this.table.status && this.GA && this.GA.onStatus) this.GA.onStatus(this.table.status);
    if (this.started && this.GA && this.GA.onSeats) this.GA.onSeats(this.seats);
  };
  SP.onSeatRow = function (row) {
    if (!row || row.seat == null) return;
    const had = this.seat(row.seat);
    mergeSeat(this.seats, row);
    if (row.user_id && (!had || had.user_id !== row.user_id)) this.ping();
    if (this.started && this.GA && this.GA.onSeats) this.GA.onSeats(this.seats);
  };
  SP.onTableRow = function (row) {
    const prev = this.table.status;
    this.table = Object.assign({}, this.table, { status: row.status, last_seq: row.last_seq, result: row.result });
    if (row.last_seq > this.seq && !this.inflight) this.scheduleFetch(400);
    if (this.started && prev !== row.status && this.GA && this.GA.onStatus) this.GA.onStatus(row.status);
  };

  /* ---- nabız ---- */
  SP.ping = async function () {
    if (this.closed || this.pinging) return;
    this.pinging = true;
    const view = this.viewDirty ? this.view : null;
    this.viewDirty = false;
    try {
      let r;
      if (this.spect) r = await call('bg_table_state', { p_table: this.id, p_after: 2147483647 }).then((x) => ({ now: x.now, status: x.table.status, last_seq: x.table.last_seq, seats: x.table.seats }));
      else r = await call('bg_table_ping', { p_table: this.id, p_view: view });
      if (this.closed) return;
      this.fails = 0;
      if (r.seats) {
        this.seats = r.seats.slice();
        if (this.GA && this.GA.onSeats) this.GA.onSeats(this.seats);
      }
      if (r.status && r.status !== this.table.status) {
        this.table.status = r.status;
        if (this.GA && this.GA.onStatus) this.GA.onStatus(r.status);
      }
      if (r.last_seq > this.seq + this.buf.size) this.scheduleFetch(0);
      if (!this.spect && T.mySeat({ seats: this.seats }) == null && this.table.status === 'playing') {
        // koltuğum bota geçti (başka bir pencereden çıkıldı)
        this.spectate();
      }
    } catch (e) {
      this.fails++;
      if (view) this.viewDirty = true;
      if (this.GA && this.GA.onNet) this.GA.onNet(this.fails > 1 ? 'down' : 'slow');
    } finally {
      this.pinging = false;
    }
  };
  SP.spectate = function () {
    this.mySeat = null;
    this.spect = true;
    if (this.pending.some((p) => p.applied)) this.needRebase = true;
    this.pending = [];
    this.drain();
    if (this.GA && this.GA.onSpectate) this.GA.onSpectate();
  };
  /** Gönderilmemiş/onaylanmamış hamle ya da bekleyen düzeltme var mı */
  SP.busy = function () {
    return !!(this.pending.length || this.buf.size || this.inflight || this.needRebase || this.fetching);
  };
  /** Izgara/ıstaka düzeni gibi izleyicilere gidecek görünüm */
  SP.setView = function (v) {
    if (this.spect) return;
    const s = JSON.stringify(v);
    if (s === this.viewStr) return;
    this.viewStr = s;
    this.view = v;
    this.viewDirty = true;
    clearTimeout(this.viewT);
    this.viewT = setTimeout(() => this.ping(), 1200);
  };
  SP.tick = function () {
    if (this.closed) return;
    const now = Date.now();
    if (!this.lastPing || now - this.lastPing >= PING_MS) {
      this.lastPing = now;
      this.ping();
    }
    if (this.buf.size && !this.buf.has(this.seq + 1)) {
      if (!this.gapSince) this.gapSince = now;
      else if (now - this.gapSince > 1500) {
        this.gapSince = 0;
        this.scheduleFetch(0);
      }
    } else this.gapSince = 0;
    if (this.pending.length && !this.inflight) this.post();
    if (this.GA && this.GA.onTick) this.GA.onTick();
  };

  /* ---- hamle alma ---- */
  SP.scheduleFetch = function (ms) {
    if (this.fetchT || this.closed) return;
    this.fetchT = setTimeout(() => {
      this.fetchT = null;
      this.fetchNew();
    }, ms || 0);
  };
  SP.fetchNew = async function () {
    if (this.closed || this.fetching) return this.fetching;
    this.fetching = (async () => {
      try {
        for (let guard = 0; guard < 20; guard++) {
          const r = await call('bg_table_state', { p_table: this.id, p_after: this.seq });
          if (this.closed) return;
          const acts = r.actions || [];
          acts.forEach((row) => this.onRow(norm(row), true));
          if (r.table) {
            const prev = this.table.status;
            this.table = Object.assign({}, this.table, r.table, { seats: undefined });
            if (r.table.seats) this.seats = r.table.seats.slice();
            if (prev !== this.table.status && this.GA && this.GA.onStatus) this.GA.onStatus(this.table.status);
          }
          if (acts.length < PAGE) break;
        }
      } catch (e) {
        if (this.GA && this.GA.onNet) this.GA.onNet('slow');
      } finally {
        this.fetching = null;
      }
      this.drain();
    })();
    return this.fetching;
  };
  SP.onRow = function (a, noDrain) {
    if (this.closed || a.seq <= this.seq || this.buf.has(a.seq)) return;
    this.buf.set(a.seq, a);
    if (!noDrain) this.drain();
  };
  SP.hold = function (ms) {
    this.holdUntil = Math.max(this.holdUntil, Date.now() + ms);
  };
  SP.drain = function () {
    if (!this.started || this.closed || this.draining) return;
    this.draining = true;
    try {
      for (let guard = 0; guard < 2000; guard++) {
        const wait = this.holdUntil - Date.now();
        if (wait > 0) {
          clearTimeout(this.holdT);
          this.holdT = setTimeout(() => this.drain(), wait + 5);
          break;
        }
        const a = this.buf.get(this.seq + 1);
        if (!a) break;
        this.buf.delete(a.seq);
        this.process(a);
      }
    } finally {
      this.draining = false;
    }
    if (this.needRebase && this.holdUntil <= Date.now()) this.rebase();
    if (this.pending.length && !this.inflight) this.post();
  };
  SP.process = function (a) {
    const GA = this.GA;
    this.seq = a.seq;
    this.lastAt = a.at;
    if (!this.spect && (!this._actAt || Date.now() - this._actAt > 20000)) {
      this._actAt = Date.now();
      T.activity();
    }
    if (window.__BGT_DEBUG) {
      const p0 = this.pending[0];
      (this.dbg = this.dbg || []).push({ seq: a.seq, kind: a.kind, seat: a.seat, data: a.data, mine: !!(p0 && p0.data && a.data && a.data.u && p0.data.u === a.data.u), split: this.split, nr: this.needRebase, pend: this.pending.length });
    }
    const p0 = this.pending[0];
    if (p0 && a.data && p0.data && a.data.u && a.data.u === p0.data.u) {
      this.pending.shift();
      if (p0.applied) {
        const anyApplied = this.pending.some((x) => x.applied);
        if (this.split) {
          if (!anyApplied && !this.needRebase) {
            this.base = GA.view();
            this.split = false;
          } else GA.apply(this.base, a);
        }
      } else if (!this.split && !this.needRebase) {
        const r = GA.applyRemote(a, true);
        if (r && r.hold) this.hold(r.hold);
      } else {
        GA.apply(this.base, a);
        this.needRebase = true;
      }
      return;
    }
    if (!this.split && !this.needRebase) {
      const r = GA.applyRemote(a, false);
      if (r && r.hold) this.hold(r.hold);
    } else {
      GA.apply(this.base, a);
      this.needRebase = true;
    }
  };
  SP.rebase = function () {
    const GA = this.GA;
    this.needRebase = false;
    const v = GA.clone(this.base);
    const keep = [];
    for (const p of this.pending) {
      if (!p.applied) {
        keep.push(p);
        continue;
      }
      let r;
      try {
        r = GA.apply(v, p);
      } catch (e) {
        r = { ok: false };
      }
      if (r && r.ok !== false) keep.push(p);
    }
    this.pending = keep;
    if (keep.some((p) => p.applied)) {
      this.split = true;
      GA.reset(v, 'rebase');
    } else {
      this.split = false;
      GA.reset(v, 'rebase');
      this.base = GA.view();
    }
  };

  /* ---- hamle gönderme ---- */
  SP.canAct = function () {
    if (this.closed || this.spect || !this.started) return false;
    if (this.table.status !== 'playing') return false;
    if (this.holdUntil > Date.now()) return false;
    return true;
  };
  /**
   * Hamle: a = {seat, kind, data}. Varsayılan: hemen ekranda uygulanır
   * (sunucu onayı arkadan gelir). opts.later: önce sunucuya gider.
   */
  SP.dispatch = function (a, opts) {
    opts = opts || {};
    if (!this.canAct()) return { ok: false, wait: true, err: this.spect ? 'İzleyici olarak oynayamazsın.' : 'Bağlantı bekleniyor.' };
    const act = { seat: a.seat == null ? null : a.seat, kind: a.kind, data: Object.assign({}, a.data || {}, { u: uid() }), applied: false };
    if (opts.later) {
      this.pending.push(act);
      this.post();
      return { ok: true, later: true };
    }
    let snap = null;
    if (!this.split) snap = this.GA.clone(this.GA.view());
    const r = this.GA.applyLocal(act, opts.meta);
    if (!r || r.ok === false) return r || { ok: false };
    if (!this.split) {
      this.base = snap;
      this.split = true;
    }
    act.applied = true;
    this.pending.push(act);
    this.post();
    return r;
  };
  SP.post = async function () {
    if (this.inflight || this.closed || !this.pending.length) return;
    if (this.buf.has(this.seq + 1)) return; // önce gelen hamleler işlenmeli
    if (this.table.status !== 'playing') return;
    if (this.retryAt && Date.now() < this.retryAt) return;
    const batch = this.pending.slice(0, 40);
    const from = this.seq + 1;
    this.inflight = true;
    let again = false;
    try {
      const r = await call('bg_table_act', {
        p_table: this.id,
        p_from: from,
        p_actions: batch.map((x) => ({ seat: x.seat, kind: x.kind, data: x.data })),
      });
      this.retryAt = 0;
      this.fails = 0;
      const at = T.now();
      batch.forEach((x, i) => this.onRow({ seq: from + i, seat: x.seat, kind: x.kind, data: x.data, by: null, at }, true));
      if (r && r.seq && r.seq !== from + batch.length - 1) this.scheduleFetch(0);
      again = true;
    } catch (e) {
      const code = errCode(e);
      if (code === 'BGSEQ') {
        await this.fetchNew();
        again = true;
      } else if (code === '22023' || code === '42501' || code === 'P0002') {
        // kalıcı ret (oyun bitti, koltuk değişti…): bu hamleleri bırak
        const drop = new Set(batch);
        const hadApplied = batch.some((x) => x.applied);
        this.pending = this.pending.filter((x) => !drop.has(x));
        if (hadApplied) this.needRebase = true;
        console.warn('[masa] hamle reddedildi', e.message);
        this.drain();
        await this.fetchNew();
        this.ping();
      } else {
        this.fails++;
        this.retryAt = Date.now() + Math.min(8000, 600 * this.fails);
        if (this.GA && this.GA.onNet) this.GA.onNet('slow');
        await this.fetchNew();
      }
    } finally {
      this.inflight = false;
    }
    this.drain();
    if (again && this.pending.length) this.post();
  };

  /* ---- masa işlemleri ---- */
  SP.leave = async function () {
    try {
      await call('bg_table_leave', { p_table: this.id });
    } catch (e) {}
  };
  SP.finish = function (result) {
    if (this.spect || this.finishSent) return;
    this.finishSent = true;
    call('bg_table_finish', { p_table: this.id, p_result: result || null }).catch(() => (this.finishSent = false));
  };
  SP.serverNow = () => T.now();
  SP.viewers = function () {
    return (this.cur.link && this.cur.link.viewers) || [];
  };
})();
