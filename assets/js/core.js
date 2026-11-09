/* =====================================================================
   Bözer Gaming — çekirdek: yardımcılar, ikonlar, bildirimler, pencereler,
   yönlendirici, tema, avatarlar ve oyun kataloğu
   ===================================================================== */
(function () {
  'use strict';

  const BG = (window.BG = window.BG || {});
  BG.config = window.BG_CONFIG || {};

  /* ---------------- DOM yardımcıları ---------------- */
  BG.$ = (sel, root) => (root || document).querySelector(sel);
  BG.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  BG.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Küçük hyperscript: h('button.btn', {onclick}, 'Metin', childNode) */
  BG.h = function h(tag, attrs, ...children) {
    const m = String(tag).match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => {
      if (t === '.') el.classList.add(v);
      else el.id = v;
    });
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    };
    children.forEach(add);
    return el;
  };

  /** HTML metninden düğüm(ler) üret */
  BG.frag = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
  };

  BG.debounce = function (fn, ms) {
    let t;
    const d = function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
    d.cancel = () => clearTimeout(t);
    return d;
  };
  BG.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  BG.ls = {
    get(k, def) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    },
    keys(prefix) {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) out.push(k);
        }
      } catch (e) {}
      return out;
    },
  };

  /* ---------------- Metin ---------------- */
  const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u', â: 'a', î: 'i', û: 'u' };
  /** Kullanıcı adını normalize et: küçük harf, Türkçe karakter → Latin, boşluk → _ */
  BG.normalizeUsername = (s) =>
    String(s || '')
      .replace(/[çğıİöşüÇĞÖŞÜâîû]/g, (c) => TR_MAP[c] || c)
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 20);
  BG.validUsername = (u) => /^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9_]$/.test(u) && !/\.\./.test(u);

  BG.initials = (name) =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toLocaleUpperCase('tr-TR');

  /* ---------------- Zaman biçimleri ---------------- */
  const toDate = (d) => (d instanceof Date ? d : new Date(d));
  BG.fmt = {
    clock(d) {
      return toDate(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    },
    date(d) {
      return toDate(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    dateShort(d) {
      return toDate(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    },
    dayLabel(d) {
      const x = toDate(d);
      const today = new Date();
      const y = new Date();
      y.setDate(today.getDate() - 1);
      if (x.toDateString() === today.toDateString()) return 'Bugün';
      if (x.toDateString() === y.toDateString()) return 'Dün';
      return x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    },
    ago(d) {
      if (!d) return '';
      const s = Math.max(0, (Date.now() - toDate(d).getTime()) / 1000);
      if (s < 45) return 'az önce';
      if (s < 3600) return Math.round(s / 60) + ' dk önce';
      if (s < 86400) return Math.round(s / 3600) + ' sa önce';
      if (s < 86400 * 2) return 'dün';
      if (s < 86400 * 7) return Math.round(s / 86400) + ' gün önce';
      return BG.fmt.dateShort(d);
    },
    /** Sohbet listesi için kısa saat */
    short(d) {
      const x = toDate(d);
      const s = (Date.now() - x.getTime()) / 1000;
      if (x.toDateString() === new Date().toDateString()) return BG.fmt.clock(x);
      if (s < 86400 * 6) return x.toLocaleDateString('tr-TR', { weekday: 'short' });
      return BG.fmt.dateShort(x);
    },
  };

  /* ---------------- Olay yolu ---------------- */
  const listeners = {};
  BG.bus = {
    on(ev, fn) {
      (listeners[ev] = listeners[ev] || []).push(fn);
      return () => BG.bus.off(ev, fn);
    },
    off(ev, fn) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
    },
    emit(ev, data) {
      (listeners[ev] || []).slice().forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error('[bus]', ev, e);
        }
      });
    },
  };

  /* ---------------- Uygulama durumu ---------------- */
  BG.store = {
    session: null, // Supabase oturumu
    me: null, // bg_me() sonucu
    unread: 0,
    requests: 0,
    friends: [], // bg_friends() sonucu
    online: navigator.onLine !== false,
  };
  BG.isAuthed = () => !!(BG.store.session && BG.store.me);
  BG.isAdmin = () => !!(BG.store.me && BG.store.me.is_admin);

  /* ---------------- İkonlar (24×24, çizgi) ---------------- */
  const I = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/>',
    tiles: '<rect x="3.5" y="4.5" width="7.5" height="15" rx="1.6"/><rect x="13" y="4.5" width="7.5" height="15" rx="1.6"/><path d="M3.5 12h7.5M13 12h7.5"/>',
    chart: '<path d="M5 20v-7"/><path d="M12 20V5"/><path d="M19 20v-10"/><path d="M3 20.5h18"/>',
    users: '<circle cx="9" cy="8.2" r="3.4"/><path d="M2.8 19.5c.9-3.4 3.3-5.2 6.2-5.2s5.3 1.8 6.2 5.2"/><path d="M15.6 4.9a3.4 3.4 0 0 1 0 6.6"/><path d="M17.7 14.6c1.8.7 3 2.3 3.5 4.9"/>',
    message: '<path d="M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.5 20l1.3-4.6a8.1 8.1 0 1 1 15.7-3.8z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
    shield: '<path d="M12 3 4.8 6v5.8c0 4.4 3.1 7.7 7.2 9.2 4.1-1.5 7.2-4.8 7.2-9.2V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.1v.1"/>',
    phone: '<path d="M5 4h3.5l1.6 4-2.2 1.5a10.6 10.6 0 0 0 6.6 6.6l1.5-2.2 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6C10 20.2 3.8 14 3.4 5.7A1.6 1.6 0 0 1 5 4z"/>',
    logout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5"/><path d="M10 16.5 5.5 12 10 7.5"/><path d="M5.8 12H15"/>',
    login: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5"/><path d="M9.5 16.5 14 12 9.5 7.5"/><path d="M4 12h10"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M3.5 3.5l17 17"/><path d="M10.4 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.7 16.7 0 0 1-2.9 3.7"/><path d="M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9.2 9.2 0 0 0 4.6-1.2"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    back: '<path d="M15 18.5 8.5 12 15 5.5"/>',
    next: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
    play: '<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4.5 7h15"/><path d="M10 11v6M14 11v6"/><path d="M6.5 7l.9 12.5h9.2L17.5 7"/><path d="M9.5 7V4.5h5V7"/>',
    send: '<path d="M20.5 3.5 10.2 13.8"/><path d="M20.5 3.5 14 20.5l-3.8-6.7-6.7-3.8z"/>',
    check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
    checks: '<path d="M2 12.6l4.4 4.4L15.2 8"/><path d="M11.4 16l1 1L21.5 8"/>',
    cloud: '<path d="M7.2 18.5h9.9a4.4 4.4 0 0 0 .5-8.8 5.9 5.9 0 0 0-11.4 1.1 3.9 3.9 0 0 0 1 7.7z"/>',
    cloudCheck: '<path d="M7.2 18.5h9.9a4.4 4.4 0 0 0 .5-8.8 5.9 5.9 0 0 0-11.4 1.1 3.9 3.9 0 0 0 1 7.7z"/><path d="M9.5 13.5l1.8 1.8 3.4-3.6"/>',
    cloudOff: '<path d="M3.5 3.5l17 17"/><path d="M8.4 6.2a5.9 5.9 0 0 1 9.2 3.5 4.4 4.4 0 0 1 2.6 7.4"/><path d="M16.8 18.5H7.2a3.9 3.9 0 0 1-1-7.7 5.8 5.8 0 0 1 .3-1.6"/>',
    device: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M11 18h2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.1-4.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    userPlus: '<circle cx="9.5" cy="8" r="3.8"/><path d="M2.8 20c.9-3.7 3.6-5.6 6.7-5.6 1.6 0 3 .5 4.1 1.3"/><path d="M18.5 13v6M15.5 16h6"/>',
    userX: '<circle cx="9.5" cy="8" r="3.8"/><path d="M2.8 20c.9-3.7 3.6-5.6 6.7-5.6 1.6 0 3 .5 4.1 1.3"/><path d="M16.2 14.2l4.6 4.6M20.8 14.2l-4.6 4.6"/>',
    camera: '<path d="M4 8.3h3.2l1.6-2.5h6.4l1.6 2.5H20V19H4z"/><circle cx="12" cy="13.3" r="3.4"/>',
    eraser: '<path d="M8.5 20.5 3.8 15.8a1.6 1.6 0 0 1 0-2.3l9.4-9.4a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3l-9.9 9.5"/><path d="M8.5 20.5H20.5"/><path d="m8 10.5 6 6"/>',
    upload: '<path d="M12 15.5v-11"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 16.5l-5-5-8.5 8"/>',
    key: '<circle cx="8" cy="15" r="3.8"/><path d="M10.8 12.2 19 4"/><path d="M16 7l2.6 2.6"/><path d="M13.6 9.4l2 2"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M4.5 15.5V6.5a2 2 0 0 1 2-2h9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.6"/><path d="M12 7.6v.1"/>',
    book: '<path d="M5 5a1.8 1.8 0 0 1 1.8-1.8H19v14.6H6.8A1.8 1.8 0 0 0 5 19.6z"/><path d="M5 19.6a1.8 1.8 0 0 0 1.8 1.8H19v-3.6"/><path d="M9 7.5h6"/>',
    live: '<circle cx="12" cy="12" r="2.4"/><path d="M8.4 8.4a5.1 5.1 0 0 0 0 7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2"/><path d="M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13"/>',
    more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
    palette: '<path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.3 0 2-.9 2-1.9 0-1.4-1.1-1.9-1.1-3 0-1 .8-1.7 1.9-1.7h2.3a3.3 3.3 0 0 0 3.3-3.3c0-4.3-3.9-7.7-8.4-7.7z"/><circle cx="7.6" cy="11.2" r="1"/><circle cx="10.2" cy="7.4" r="1"/><circle cx="15" cy="7.7" r="1"/>',
    refresh: '<path d="M19.5 11.2a7.6 7.6 0 1 0-2.2 5.6"/><path d="M19.8 4.5v6.7h-6.7"/>',
    trophy: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0z"/><path d="M8 6H5.2a2.8 2.8 0 0 0 2.9 3.8M16 6h2.8a2.8 2.8 0 0 1-2.9 3.8"/><path d="M12 13.2V17M8.5 20.5h7M10 17h4"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
    mail: '<rect x="3" y="5.2" width="18" height="13.6" rx="2"/><path d="M3.6 6.7 12 12.8l8.4-6.1"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.4l5-3v9.2l-5-3"/>',
    external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    dots: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>',
  };
  BG.icon = function (name, size) {
    const s = size || 20;
    return `<svg class="ic ic-${name}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[name] || ''}</svg>`;
  };
  BG.iconEl = (name, size) => BG.frag(BG.icon(name, size));

  /* ---------------- Skor tabelası kapakçığı (imza öğesi) ---------------- */
  /** tone: ink | amber | coral | mint | sky | violet */
  BG.tile = function (text, tone, extraClass) {
    return `<span class="tile tile-${tone || 'ink'}${extraClass ? ' ' + extraClass : ''}" aria-hidden="true"><b>${BG.esc(text)}</b></span>`;
  };
  /** Her karakter ayrı kapakçıkta (logo, sayılar) */
  BG.flapRow = function (text, tone, extraClass) {
    return Array.from(String(text))
      .map((ch) => (ch === ' ' ? '<span class="tile-space" aria-hidden="true"></span>' : BG.tile(ch, tone, extraClass)))
      .join('');
  };
  /** Tabela gibi dönerek yerine oturma (sayfa açılışında bir kez) */
  BG.flipIn = function (root) {
    if (!root) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pool = 'ABCDEFGHIKLMNOPRSTUVYZÇÖŞÜ0123456789';
    root.querySelectorAll('.tile').forEach((cell, i) => {
      const b = cell.querySelector('b');
      if (!b) return;
      const target = b.textContent;
      const flips = 6 + i * 2;
      let n = 0;
      const step = () => {
        if (!cell.isConnected) return;
        cell.classList.remove('flip-tick');
        void cell.offsetWidth;
        cell.classList.add('flip-tick');
        if (n >= flips) {
          b.textContent = target;
          return;
        }
        b.textContent = pool[Math.floor(Math.random() * pool.length)];
        n++;
        setTimeout(step, 60);
      };
      setTimeout(step, 140 + i * 45);
    });
  };
  /** Rozet: küçük tabela kutusunda sayı */
  BG.countBadge = function (n) {
    if (!n) return '';
    return `<span class="count-tile" aria-label="${n} yeni">${n > 99 ? '99+' : n}</span>`;
  };

  /* ---------------- Avatarlar ---------------- */
  BG.AVATARS = [
    ['ordek', 'Ördek'], ['kurt', 'Kurt'], ['tilki', 'Tilki'], ['robot', 'Robot'], ['rakun', 'Rakun'],
    ['ejderha', 'Ejderha'], ['kedi', 'Kara kedi'], ['astronot', 'Astronot'], ['panda', 'Kızıl panda'],
    ['baykus', 'Baykuş'], ['kopekbaligi', 'Köpekbalığı'], ['samuray', 'Samuray'], ['koala', 'Koala'],
    ['kaplan', 'Kaplan'], ['tavsan', 'Tavşan'], ['buyucu', 'Büyücü'], ['susamuru', 'Su samuru'],
    ['uzayli', 'Uzaylı'], ['sovalye', 'Şövalye'],
  ];
  BG.avatarSrc = function (url) {
    if (!url) return '';
    if (url.indexOf('preset:') === 0) return 'assets/avatars/' + url.slice(7) + '.webp';
    return url;
  };
  /** person: {avatar_url, full_name, username} ; opts: {size, online, ring} */
  BG.avatar = function (person, opts) {
    opts = opts || {};
    const size = opts.size || 40;
    const p = person || {};
    const src = BG.avatarSrc(p.avatar_url);
    const label = p.full_name || p.username || '';
    const inner = src
      ? `<img src="${BG.esc(src)}" alt="" loading="lazy" decoding="async" width="${size}" height="${size}" onerror="this.remove()">`
      : '';
    const dot =
      opts.online === true
        ? '<span class="presence-dot is-on" title="Çevrimiçi"></span>'
        : opts.online === false
        ? '<span class="presence-dot" title="Çevrimdışı"></span>'
        : '';
    return `<span class="avatar${opts.ring ? ' has-ring' : ''}" style="--s:${size}px" title="${BG.esc(label)}"><span class="avatar-fallback">${BG.esc(BG.initials(label))}</span>${inner}${dot}</span>`;
  };

  /* ---------------- Oyun kataloğu ---------------- */
  BG.GAMES = {
    americano: { key: 'americano', file: 'americano.html', name: 'Americano', glyph: 'A', color: 'coral', activity: 'Americano oynuyor', group: 'americano' },
    somali: { key: 'somali', file: 'somali.html', name: 'Somali', glyph: '13', color: 'amber', activity: 'Somali oynuyor', group: 'somali' },
    kura: { key: 'kura', file: 'kura-cek.html', name: 'Kura Çek', glyph: 'K', color: 'mint', activity: 'Kura çekiyor', group: 'kura' },
    lig: { key: 'lig', file: 'lig.html', name: 'Lig Oluştur', glyph: '1', color: 'violet', activity: 'Lig yönetiyor', group: 'lig' },
    dartbot: { key: 'dartbot', file: 'dart/dartbot-v1.html', name: 'Dartbot', glyph: '20', color: 'sky', activity: 'Dartbot ile oynuyor', group: 'dart' },
    'dart-turnuva': { key: 'dart-turnuva', file: 'dart/dart-turnuva.html', name: 'Dart Turnuva', glyph: '20', color: 'sky', activity: 'Dart turnuvasında', group: 'dart' },
    'dart-mac': { key: 'dart-mac', file: 'dart/dart-mac.html', name: 'Dart Maç', glyph: '20', color: 'sky', activity: 'Dart maçında', group: 'dart' },
  };
  BG.gameTile = (key, extra) => {
    const g = BG.GAMES[key];
    return g ? BG.tile(g.glyph, g.color, extra) : BG.tile('?', 'ink', extra);
  };

  /* ---------------- Tema ---------------- */
  BG.THEMES = [
    ['gece', 'Gece', 'Koyu lacivert masa'],
    ['cuha', 'Çuha', 'Yeşil oyun masası'],
    ['gunduz', 'Gündüz', 'Açık ve ferah'],
  ];
  BG.theme = {
    get() {
      const t = BG.ls.get('bg.theme', 'gece');
      return BG.THEMES.some((x) => x[0] === t) ? t : 'gece';
    },
    apply(t) {
      document.documentElement.setAttribute('data-theme', t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', { gece: '#15122c', cuha: '#0d2a22', gunduz: '#f4efe4' }[t] || '#15122c');
    },
    set(t) {
      BG.ls.set('bg.theme', t);
      BG.theme.apply(t);
      BG.bus.emit('theme', t);
    },
  };

  /* ---------------- Bildirimler (toast) ---------------- */
  function toastRoot() {
    let r = document.getElementById('toasts');
    if (!r) {
      r = BG.h('div#toasts', { 'aria-live': 'polite', 'aria-atomic': 'false' });
      document.body.appendChild(r);
    }
    return r;
  }
  /**
   * BG.toast({type:'success'|'error'|'info'|'message', title, text, person, duration, onClick, action:{label, onClick}})
   */
  BG.toast = function (o) {
    if (typeof o === 'string') o = { text: o };
    const type = o.type || 'info';
    const duration = o.duration || (type === 'message' ? 3000 : type === 'error' ? 5000 : 3200);
    const lead =
      type === 'message' && o.person
        ? BG.avatar(o.person, { size: 38 })
        : `<span class="toast-ic">${BG.icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : type === 'message' ? 'message' : 'info', 18)}</span>`;
    const el = BG.frag(
      `<div class="toast toast-${type}" role="${type === 'error' ? 'alert' : 'status'}">
        ${lead}
        <div class="toast-body">${o.title ? `<strong>${BG.esc(o.title)}</strong>` : ''}${o.text ? `<span>${BG.esc(o.text)}</span>` : ''}</div>
        ${o.action ? `<button class="toast-action" type="button">${BG.esc(o.action.label)}</button>` : ''}
        <span class="toast-timer" style="animation-duration:${duration}ms"></span>
      </div>`
    );
    const close = () => {
      if (!el.isConnected) return;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    };
    let timer = setTimeout(close, duration);
    // Fareyle üzerine gelince bekler (dokunmatik ekranda beklemez)
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer);
      el.classList.add('is-paused');
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      el.classList.remove('is-paused');
      clearTimeout(timer);
      timer = setTimeout(close, 1200);
    });
    if (o.onClick) el.classList.add('is-clickable');
    el.addEventListener('click', (e) => {
      if (e.target.closest('.toast-action')) return;
      close();
      if (o.onClick) o.onClick();
    });
    if (o.action) {
      el.querySelector('.toast-action').addEventListener('click', () => {
        close();
        o.action.onClick();
      });
    }
    const root = toastRoot();
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    return { close };
  };
  BG.toastError = (err, title) =>
    BG.toast({ type: 'error', title: title || 'İşlem tamamlanamadı', text: (err && err.message) || String(err || '') });

  /* ---------------- Pencereler (modal) ---------------- */
  const modalStack = [];
  /**
   * BG.modal({title, body: Node|string, actions:[{label, kind, onClick, close}], size:'s'|'m'|'l', onClose, dismissable})
   * Döndürür: {el, close}
   */
  BG.modal = function (o) {
    const prevFocus = document.activeElement;
    const wrap = BG.frag(
      `<div class="modal-wrap" role="dialog" aria-modal="true">
        <div class="modal-backdrop"></div>
        <div class="modal modal-${o.size || 'm'}">
          ${o.title ? `<header class="modal-head"><h2>${BG.esc(o.title)}</h2>${o.dismissable === false ? '' : `<button class="icon-btn modal-x" type="button" aria-label="Kapat">${BG.icon('x')}</button>`}</header>` : ''}
          <div class="modal-body"></div>
          <footer class="modal-foot"></footer>
        </div>
      </div>`
    );
    const body = wrap.querySelector('.modal-body');
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    const foot = wrap.querySelector('.modal-foot');
    let closed = false;
    const api = {
      el: wrap,
      body,
      close(result) {
        if (closed) return;
        closed = true;
        wrap.classList.add('is-leaving');
        const i = modalStack.indexOf(api);
        if (i >= 0) modalStack.splice(i, 1);
        setTimeout(() => wrap.remove(), 200);
        document.removeEventListener('keydown', onKey);
        if (o.onClose) o.onClose(result);
        if (prevFocus && prevFocus.focus) {
          try {
            prevFocus.focus({ preventScroll: true });
          } catch (e) {}
        }
      },
    };
    (o.actions || []).forEach((a) => {
      const b = BG.h('button', { type: 'button', class: 'btn ' + (a.kind ? 'btn-' + a.kind : 'btn-ghost') }, a.label);
      if (a.id) b.id = a.id;
      b.addEventListener('click', async () => {
        if (a.onClick) {
          b.disabled = true;
          try {
            const r = await a.onClick(api, b);
            if (r === false) return;
          } finally {
            b.disabled = false;
          }
        }
        if (a.close !== false) api.close(a.value);
      });
      foot.appendChild(b);
    });
    if (!foot.children.length) foot.remove();
    const dismiss = () => {
      if (o.dismissable !== false) api.close();
    };
    wrap.querySelector('.modal-backdrop').addEventListener('click', dismiss);
    const x = wrap.querySelector('.modal-x');
    if (x) x.addEventListener('click', dismiss);
    function onKey(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === api) dismiss();
    }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    modalStack.push(api);
    requestAnimationFrame(() => {
      const f = wrap.querySelector('[autofocus], input, textarea, select, .modal-foot .btn-primary, .modal-foot .btn');
      if (f) {
        try {
          f.focus({ preventScroll: true });
        } catch (e) {}
      }
    });
    return api;
  };
  BG.closeAllModals = () => modalStack.slice().forEach((m) => m.close());

  BG.confirm = function (o) {
    return new Promise((resolve) => {
      BG.modal({
        title: o.title,
        size: 's',
        body: `<p class="modal-text">${o.html || BG.esc(o.text || '')}</p>`,
        actions: [
          { label: o.cancelText || 'Vazgeç', kind: 'ghost', value: false },
          { label: o.okText || 'Tamam', kind: o.danger ? 'danger' : 'primary', value: true },
        ],
        onClose: (r) => resolve(!!r),
      });
    });
  };

  /* ---------------- Panoya kopyala ---------------- */
  BG.copy = async function (text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = BG.h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {}
      ta.remove();
    }
    BG.toast({ type: 'success', text: okMsg || 'Kopyalandı' });
  };

  /* ---------------- Şifre göster/gizle düğmeli alan ---------------- */
  BG.passwordField = function (o) {
    const id = o.id || 'pw' + Math.random().toString(36).slice(2, 8);
    const el = BG.frag(
      `<div class="field">
        <label class="field-label" for="${id}">${BG.esc(o.label)}</label>
        <div class="input-wrap has-action">
          <input class="input" id="${id}" type="password" autocomplete="${o.autocomplete || 'current-password'}" ${o.placeholder ? `placeholder="${BG.esc(o.placeholder)}"` : ''} maxlength="72" ${o.required === false ? '' : 'required'}>
          <button class="input-action" type="button" aria-label="Şifreyi göster" aria-pressed="false">${BG.icon('eye')}</button>
        </div>
        ${o.hint ? `<p class="field-hint">${BG.esc(o.hint)}</p>` : ''}
        <p class="field-msg" aria-live="polite"></p>
      </div>`
    );
    const input = el.querySelector('input');
    const btn = el.querySelector('.input-action');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = BG.icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
      btn.setAttribute('aria-pressed', String(show));
      input.focus({ preventScroll: true });
    });
    return el;
  };
  /** Alan altındaki mesajı ayarla */
  BG.fieldMsg = function (fieldEl, text, kind) {
    const f = fieldEl.closest ? fieldEl.closest('.field') : fieldEl;
    if (!f) return;
    const m = f.querySelector('.field-msg');
    if (m) {
      m.textContent = text || '';
      m.className = 'field-msg' + (kind ? ' is-' + kind : '');
    }
    f.classList.toggle('has-error', kind === 'error');
    f.classList.toggle('has-ok', kind === 'ok');
  };

  /* ---------------- Yönlendirici (hash) ---------------- */
  const routes = [];
  BG.router = {
    current: null,
    add(pattern, handler, opts) {
      const keys = [];
      const re = new RegExp(
        '^' +
          pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => {
            keys.push(k);
            return '([^/]+)';
          }) +
          '$'
      );
      routes.push({ pattern, re, keys, handler, opts: opts || {} });
    },
    parse(hash) {
      const raw = (hash || location.hash || '#/').replace(/^#/, '') || '/';
      const [path, qs] = raw.split('?');
      const query = {};
      new URLSearchParams(qs || '').forEach((v, k) => (query[k] = v));
      return { path: path || '/', query, raw };
    },
    go(path, replace) {
      const target = '#' + path;
      if (location.hash === target) {
        BG.router.resolve();
        return;
      }
      if (replace) {
        history.replaceState(null, '', target);
        BG.router.resolve();
      } else location.hash = target;
    },
    /** URL'yi değiştir ama sayfayı yeniden çizme */
    silentReplace(path) {
      history.replaceState(null, '', '#' + path);
      BG.router.current = BG.router.parse('#' + path);
    },
    resolve() {
      const loc = BG.router.parse();
      for (const r of routes) {
        const m = loc.path.match(r.re);
        if (m) {
          const params = {};
          r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
          const prev = BG.router.current;
          BG.router.current = Object.assign({}, loc, { params, route: r });
          BG.bus.emit('route', { to: BG.router.current, from: prev });
          r.handler(params, loc.query, BG.router.current);
          return;
        }
      }
      BG.router.go('/', true);
    },
  };
  window.addEventListener('hashchange', () => BG.router.resolve());
})();
