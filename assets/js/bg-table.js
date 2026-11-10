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
    return `<span class="t-av${p.bot ? ' is-bot' : ''}${extra ? ' ' + extra : ''}" style="--s:${size || 36}px" aria-hidden="true"><span class="t-av-f">${esc(p.bot ? 'B' : initials(p.name))}</span>${img}</span>`;
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
    const wrap = el(`<div class="t-sheet-wrap" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
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
        const fresh = rows.filter((r) => !me || r.user_id !== me.id);
        if (notify && fresh.length && !chat.isOpen) {
          chat.unread += fresh.length;
          fresh.slice(-2).forEach(peek);
        }
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
  function who(r) {
    return String(r.full_name || r.username || 'Biri').trim();
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
            return `<div class="t-msg${mine ? ' is-mine' : ''}">${mine ? '' : T.avatar({ name: who(r), avatar_url: r.avatar_url }, 30)}
              <div class="t-msg-b"><div class="t-msg-h">${mine ? '' : `<b>${esc(who(r))}</b>`}${r.is_player ? '' : '<span class="t-tag">izliyor</span>'}<time>${esc(hhmm(r.created_at))}</time></div><p>${esc(r.body)}</p></div></div>`;
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
  chat.open = function () {
    if (!chat.id) return;
    if (!chat.can) return T.toast('Bu masanın sohbetini göremezsin.', 'err');
    chat.isOpen = true;
    chat.unread = 0;
    paintBadge();
    $$('#tPeek .t-peek-item').forEach((n) => n.remove());
    if (!chat.panel) {
      chat.panel = el(`<aside class="t-chat" role="dialog" aria-label="Masa sohbeti">
        <div class="t-chat-head"><h3>Masa sohbeti</h3><button type="button" class="t-icon" data-x aria-label="Kapat">${ICON.close}</button></div>
        <div class="t-chat-viewers" hidden></div>
        <div class="t-chat-list"></div>
        <form class="t-chat-form" autocomplete="off"><input class="t-input" maxlength="300" placeholder="Mesaj yaz" aria-label="Mesaj"><button type="submit" class="t-icon is-send" aria-label="Gönder">${ICON.send}</button></form>
      </aside>`);
      const scrim = el('<div class="t-chat-scrim"></div>');
      scrim.addEventListener('click', () => chat.close());
      chat.scrim = scrim;
      $('[data-x]', chat.panel).addEventListener('click', () => chat.close());
      chat.panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          chat.close();
        }
      });
      const form = $('form', chat.panel);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = $('input', form);
        const body = inp.value.trim();
        if (!body || !chat.id) return;
        inp.value = '';
        try {
          await call('bg_table_chat_send', { p_table: chat.id, p_body: body });
          chat.fetch(false);
        } catch (err) {
          inp.value = body;
          T.toast(err.message || 'Mesaj gönderilemedi', 'err');
        }
      });
    }
    document.body.appendChild(chat.scrim);
    document.body.appendChild(chat.panel);
    paintList(false);
    requestAnimationFrame(() => chat.panel && chat.panel.classList.add('is-open'));
    const inp = $('input', chat.panel);
    if (!/Mobi|Android/i.test(navigator.userAgent)) setTimeout(() => inp.focus(), 60);
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
      .map((s) => T.avatar({ name: seatName(s), avatar_url: s.avatar_url, bot: s.kind === 'bot' }, 30))
      .join('');
    const title = t.title || (t.host_name ? t.host_name + ' masası' : 'Masa');
    const rules = T.cfg.rules.summary(t.rules || {}, t.seats_n);
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
        <div class="t-card-top"><h4>${esc(title)}</h4>${state}</div>
        <p class="t-card-rules">${esc(rules)}</p>
        <div class="t-card-who"><span class="t-avs">${avs}</span><span class="t-muted">${host}</span></div>
      </div>
      <div class="t-card-act">${btn}</div>
    </article>`;
  }

  function lobbyFrame() {
    return `<div class="t-lobby">
      <div class="t-lobby-head">
        <button type="button" class="t-btn is-ghost t-back" data-back>${ICON.back}<span>Geri</span></button>
        <div class="t-lobby-title"><h2>Online masalar</h2><p>Masa kur, arkadaşlarını çağır ya da açık bir masaya otur.</p></div>
        <button type="button" class="t-btn is-primary" data-create>Masa kur</button>
      </div>
      <div class="t-lobby-body"><p class="t-empty">Masalar yükleniyor…</p></div>
    </div>`;
  }

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
    return `<form class="t-form" onsubmit="return false">${title}${seg}<div class="t-rules">${T.cfg.rules.form(rules, n, opts)}</div>${vis}<p class="t-note">Boş kalan koltuklara oyun başlarken bot oturur.</p></form>`;
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
      } else if (seg.dataset.seg === 'vis') state.vis = b.dataset.v;
      else if (T.cfg.rules.onSeg) T.cfg.rules.onSeg(seg, b, body, state);
    });
  }
  function readForm(body, state) {
    state.rules = T.cfg.rules.read($('form', body), state.rules);
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
        return `<div class="t-seat${s.seat === mine ? ' is-me' : ''}${ready ? ' is-ready' : ''}" style="--x:${x}%;--y:${y}%">${tag}
          ${T.avatar({ name: nm, avatar_url: s.avatar_url, bot: s.kind === 'bot' }, 46)}
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
        <div class="t-room-side">${actions}<p class="t-note">Oyun sırasında bağlantın koparsa yerine bot oynar, geri gelince kaldığın yerden devam edersin. Oyundan çıkarsan koltuğunda bot oynamaya devam eder.</p></div>
      </div>`;
    chat.bind($('[data-chat]', box));
  };
  room.onClick = async function (e) {
    const b = e.target.closest('button');
    const cur = room.cur;
    if (!b || b.disabled || !cur) return;
    if (b.hasAttribute('data-chat')) return;
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
