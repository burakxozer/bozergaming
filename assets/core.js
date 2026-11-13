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
    coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8v13M12 8c-1.5-3.5-6-4-6-1.5S10 8 12 8zm0 0c1.5-3.5 6-4 6-1.5S14 8 12 8z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    compress: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    chats: '<path d="M5 4h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8.5L5 15.8V13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M17.5 9H19a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2v2.8L15.5 18H11a2 2 0 0 1-2-2v-.5"/>',
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
    bell: '<path d="M6.2 16.5V11a5.8 5.8 0 0 1 11.6 0v5.5l1.7 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    bag: '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
    target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    crown: '<path d="M3.5 8.5l4.3 3.8L12 5.5l4.2 6.8 4.3-3.8-1.6 10H5.1z"/><path d="M5.6 20.5h12.8"/>',
    medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.6 10.2 6 3.5h4l2 4.2 2-4.2h4l-2.6 6.7"/><path d="M12 12v5"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.6 2.8-5.4 3.4-9.3 2.4 1.6 3.8 3.6 4 6 .8-.7 1.3-1.8 1.4-3 2 1.6 4.2 3.8 4.2 6.5 0 3.5-2.5 6-6.5 6z"/>',
    swap: '<path d="M4.5 8.5h13l-3.5-3.5"/><path d="M19.5 15.5h-13l3.5 3.5"/>',
    history: '<path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8"/><path d="M3.5 4.5v4h4"/><path d="M12 8v4.2l2.8 1.8"/>',
    smile: '<circle cx="12" cy="12" r="8.8"/><path d="M8.3 14.2a4.6 4.6 0 0 0 7.4 0"/><path d="M9 9.6v.2M15 9.6v.2"/>',
    sparkle: '<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.6L17 21l-1.5-7.5"/>',
    filter: '<path d="M4 5.5h16l-6.2 7.2v5.6l-3.6 2v-7.6z"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.5 4 2.5 4H5.5"/>',
    ban: '<circle cx="12" cy="12" r="8.8"/><path d="M5.8 5.8l12.4 12.4"/>',
    chatLock: '<path d="M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.5 20l1.3-4.6a8.1 8.1 0 1 1 15.7-3.8z"/><rect x="9" y="11" width="6" height="4.5" rx="1"/><path d="M10.3 11V9.6a1.7 1.7 0 0 1 3.4 0V11"/>',
    pen: '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 2.9 0l.6.6a2 2 0 0 1 0 2.9L8.5 19z"/><path d="M14.5 6l3.5 3.5"/>',
    gamepad: '<path d="M7 8h10a4.5 4.5 0 0 1 4.3 5.8l-1 3.4a2.4 2.4 0 0 1-4 1L14 16h-4l-2.3 2.2a2.4 2.4 0 0 1-4-1l-1-3.4A4.5 4.5 0 0 1 7 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="16" cy="11.6" r=".9" fill="currentColor"/><circle cx="17.8" cy="13.4" r=".9" fill="currentColor"/>',
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
  /** person: {avatar_url, full_name, username, frame?, badge?} ; opts: {size, online, ring, frame, rank} */
  BG.avatar = function (person, opts) {
    opts = opts || {};
    const size = opts.size || 40;
    const p = person || {};
    const badge = p.badge || {};
    const frame = opts.frame !== undefined ? opts.frame : p.frame !== undefined ? p.frame : badge.frame;
    const rank = opts.rank !== undefined ? opts.rank : null;
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
    const fr = frame && BG.FRAMES && BG.FRAMES[frame] ? ` has-frame fr-${frame}` : '';
    const pip = rank ? `<span class="avatar-rank">${BG.rankIcon(rank, Math.max(14, Math.round(size * 0.36)))}</span>` : '';
    return `<span class="avatar${opts.ring && !fr ? ' has-ring' : ''}${fr}" style="--s:${size}px" title="${BG.esc(label)}"><span class="avatar-fallback">${BG.esc(BG.initials(label))}</span>${inner}${dot}${pip}</span>`;
  };

  /* ---------------- BP Economy: rütbeler, prestij, çerçeveler ---------------- */
  /** Rütbe tablosu: [ad, alt sınır, renk, simge]. v3.2: yönetim panelinden değiştirilir (sunucudan gelir, tarayıcıda saklanır).
      Aynı renkteki ardışık rütbeler bir grup sayılır; simgedeki şerit sayısı grup içi kademedir. */
  const RANK_DEF = [
    ['Stajyer', 0, '#3fc272', 'stripes'], ['Çömez', 500, '#3fc272', 'stripes'], ['Çırak', 600, '#3fc272', 'stripes'], ['Çaylak', 700, '#3fc272', 'stripes'], ['Acemi', 800, '#3fc272', 'stripes'],
    ['Tecrübeli', 950, '#4d8dff', 'stripes'], ['Savaşçı', 1000, '#4d8dff', 'stripes'], ['Muhafız', 1300, '#4d8dff', 'stripes'], ['Seçkin', 1700, '#4d8dff', 'stripes'], ['Uzman', 2000, '#4d8dff', 'stripes'],
    ['Usta', 2500, '#f4c430', 'stripes'], ['Şövalye', 3000, '#f4c430', 'stripes'], ['Komutan', 3500, '#f4c430', 'stripes'], ['Mareşal', 4000, '#f4c430', 'stripes'], ['Şampiyon', 4500, '#f4c430', 'stripes'],
    ['Gladyatör', 5000, '#ff8b2e', 'stripes'], ['Hükümdar', 5500, '#ff8b2e', 'stripes'], ['İmparator', 6000, '#ff8b2e', 'stripes'], ['Titan', 6500, '#ff8b2e', 'stripes'],
    ['Efsane', 7000, '#f04848', 'stripes'], ['Üstat', 7500, '#f04848', 'stripes'], ['Başkomutan', 8000, '#f04848', 'stripes'], ['İlahi', 8500, '#f04848', 'stripes'],
    ['Ölümsüz', 9000, '#ff6fb3', 'stripes'], ['Ebedi', 9500, '#ff6fb3', 'stripes'], ['Global', 11000, '#a970ff', 'star'],
    ['Platin', 15000, '#d5dde9', 'gem'], ['Elmas', 25000, '#7fe0ff', 'diamond'], ['Yüce', 50000, '#9b5de5', 'crown'],
    ['Kozmik', 100000, '#ff3fbf', 'planet'], ['Galaktik', 200000, '#ffc83d', 'galaxy'],
  ];
  BG.RANK_COLOR_NAMES = { '#3fc272': 'Yeşil', '#4d8dff': 'Mavi', '#f4c430': 'Sarı', '#ff8b2e': 'Turuncu', '#f04848': 'Kırmızı', '#ff6fb3': 'Pembe', '#a970ff': 'Mor',
    '#d5dde9': 'Platin Gümüşü', '#7fe0ff': 'Buz Mavisi', '#9b5de5': 'Ametist', '#ff3fbf': 'Kozmik Fuşya', '#ffc83d': 'Galaktik Altın' };
  BG.RANK_ICONS = { stripes: 'Kademe şeritleri', star: 'Yıldız', gem: 'Mücevher', diamond: 'Elmas', crown: 'Taç', planet: 'Gezegen', galaxy: 'Galaksi' };
  const LS_RANKS = 'bg.ranks.v32';
  BG.RANKS = (() => {
    try {
      const c = JSON.parse(localStorage.getItem(LS_RANKS) || 'null');
      if (Array.isArray(c) && c.length && c.every((x) => Array.isArray(x) && x.length >= 3)) return c;
    } catch (e) {}
    return RANK_DEF.slice();
  })();
  // Americano / Dost Kazığı masa seviyeleri: [ücret, en düşük rütbe] (masa ücreti sınırı için)
  BG.LEVELS = [[10, 1], [20, 6], [30, 11], [40, 16], [50, 20], [60, 24], [70, 26]];
  BG.PRESTIGE_MIN = 26;
  BG.PRESTIGE_STEPS = [25000, 50000, 100000, 200000, 400000, 750000, 1250000, 2000000, 3500000, 5000000];
  BG.FRAMES = { bronz: 'Bronz', gumus: 'Gümüş', altin: 'Altın', neon: 'Neon', ates: 'Ateş', buz: 'Buz', kraliyet: 'Kraliyet',
    zumrut: 'Zümrüt', yildirim: 'Yıldırım', rgb: 'RGB', galaksi: 'Galaksi', elmas: 'Elmas',
    // v3.4.1 taraftar çerçeveleri (renk temalı, logosuz)
    sarikirmizi: 'Sarı-Kırmızı', sarilacivert: 'Sarı-Lacivert', siyahbeyaz: 'Siyah-Beyaz' };
  /* v3.4: profil arka planları (mağazadan; hareketli, yalnız CSS) */
  BG.PBG = { aurora: 'Kuzey Işıkları', galaksi: 'Galaksi', volkan: 'Volkan', neon: 'Neon Şehir', saray: 'Altın Saray',
    // v3.4.1 taraftar tribünleri (renk temalı; kulüp arması kullanılmaz)
    sarikirmizi: 'Sarı-Kırmızı Tribün', sarilacivert: 'Sarı-Lacivert Tribün', siyahbeyaz: 'Siyah-Beyaz Tribün' };
  // Volkan sahnesinde koninin üstünde akan lav ırmakları (satır içi SVG; renkler düz, kimlik kullanılmaz)
  const PBG_EXTRA = {
    sarikirmizi: `<svg class="art lion" viewBox="0 0 220 200" preserveAspectRatio="xMidYMid meet" focusable="false"> <g class="lion-g"><path class="mane" d="M110.0 8.0 L126.0 33.8 L151.7 17.5 L154.9 47.7 L185.1 44.1 L174.9 72.8 L203.6 82.6 L182.0 104.0 L203.6 125.4 L174.9 135.2 L185.1 163.9 L154.9 160.3 L151.7 190.5 L126.0 174.2 L110.0 200.0 L94.0 174.2 L68.3 190.5 L65.1 160.3 L34.9 163.9 L45.1 135.2 L16.4 125.4 L38.0 104.0 L16.4 82.6 L45.1 72.8 L34.9 44.1 L65.1 47.7 L68.3 17.5 L94.0 33.8 Z"/><path class="mane2" d="M127.8 26.0 L136.9 48.1 L159.9 41.5 L158.5 65.3 L182.1 69.3 L170.4 90.2 L190.0 104.0 L170.4 117.8 L182.1 138.7 L158.5 142.7 L159.9 166.5 L136.9 159.9 L127.8 182.0 L110.0 166.0 L92.2 182.0 L83.1 159.9 L60.1 166.5 L61.5 142.7 L37.9 138.7 L49.6 117.8 L30.0 104.0 L49.6 90.2 L37.9 69.3 L61.5 65.3 L60.1 41.5 L83.1 48.1 L92.2 26.0 L110.0 42.0 Z"/> <path class="ear" d="M138.0 30.0 L160.0 22.0 L154.0 50.0 Z"/><path class="ear" d="M82.0 30.0 L60.0 22.0 L66.0 50.0 Z"/> <path class="face" d="M110.0 34.0 L140.0 48.0 L152.0 84.0 L146.0 118.0 L130.0 146.0 L110.0 160.0 L90.0 146.0 L74.0 118.0 L68.0 84.0 L80.0 48.0 Z"/><path class="fore" d="M110.0 36.0 L136.0 50.0 L128.0 72.0 L110.0 78.0 L92.0 72.0 L84.0 50.0 Z"/><path class="cheek" d="M136.0 92.0 L150.0 86.0 L144.0 118.0 L126.0 128.0 L122.0 108.0 Z"/><path class="cheek" d="M84.0 92.0 L70.0 86.0 L76.0 118.0 L94.0 128.0 L98.0 108.0 Z"/> <path class="muz" d="M96.0 116.0 L110.0 112.0 L124.0 116.0 L128.0 132.0 L118.0 142.0 L110.0 140.0 L102.0 142.0 L92.0 132.0 Z"/><path class="nose" d="M96.0 104.0 L124.0 104.0 L118.0 116.0 L110.0 120.0 L102.0 116.0 Z"/> <path class="brow" d="M118 82 L144 74 M102 82 L76 74"/> <path class="eye" d="M120.0 88.0 L140.0 82.0 L136.0 92.0 L124.0 94.0 Z"/><path class="eye" d="M100.0 88.0 L80.0 82.0 L84.0 92.0 L96.0 94.0 Z"/> <circle class="glint" cx="131" cy="87" r="2"/><circle class="glint" cx="89" cy="87" r="2"/> <path class="mouth" d="M110 120 V130 M110 130 C104 136 98 136 94 132 M110 130 C116 136 122 136 126 132"/> <path class="whisk" d="M122 124 h10 M122 128 h8 M98 124 h-10 M98 128 h-8"/></g> </svg>`,
    sarilacivert: `<svg class="art lighthouse" viewBox="0 0 220 200" preserveAspectRatio="xMidYMax meet" focusable="false"> <g class="beam"><path d="M110 58 L-420 0 L-420 116 Z" class="bm"/><path d="M110 58 L-420 26 L-420 90 Z" class="bm in"/><path d="M110 58 L640 0 L640 116 Z" class="bm"/><path d="M110 58 L640 26 L640 90 Z" class="bm in"/></g> <path class="rock" d="M40 200 C52 180 70 176 84 178 C96 170 124 168 138 178 C156 174 176 182 186 200 Z"/> <path class="tower" d="M98 78 H122 L132 184 H88 Z"/> <path class="stripe" d="M96.4 96 H123.6 L125.4 116 H94.6 Z M93 134 H127 L128.8 154 H91.2 Z"/> <path class="door" d="M104 184 V170 a6 6 0 0 1 12 0 V184 Z"/> <rect class="gallery" x="92" y="72" width="36" height="8" rx="2"/> <path class="rail" d="M94 72 V66 M102 72 V66 M110 72 V66 M118 72 V66 M126 72 V66 M92 66 H128"/> <rect class="lamp" x="100" y="48" width="20" height="18" rx="3"/> <path class="roof" d="M96 48 H124 L110 32 Z"/><circle class="tip" cx="110" cy="31" r="2.6"/> <circle class="glow" cx="110" cy="58" r="18"/> </svg><svg class="art canary" viewBox="0 0 64 40" focusable="false"> <g class="bird"><path class="w1" d="M31 24 C25 12 15 6 2 7 C10 12 17 19 24 28 Z"/> <path class="tl" d="M24 26 L14 22 L16 30 Z"/> <ellipse class="bd" cx="32" cy="27" rx="10" ry="6.4"/><circle class="bd" cx="41.5" cy="22" r="5.6"/> <path class="bk" d="M46.4 20.6 L52 22.4 L46.4 24.2 Z"/><circle class="ey" cx="43" cy="20.8" r="1.2"/> <path class="w2" d="M34 24 C40 11 50 5 62 5 C55 11 49 18 43 28 Z"/></g> </svg>`,
    siyahbeyaz: `<svg class="art eagle" viewBox="0 0 220 200" preserveAspectRatio="xMidYMid meet" focusable="false"> <g class="wing wl"><g transform="translate(220 0) scale(-1 1)"><path class="fp" d="M130.6 95.5 Q158.3 45.0 161.6 21.4 Q143.8 37.3 117.4 88.5 Z"/><path class="fp" d="M136.4 94.2 Q179.9 50.2 190.7 27.1 Q168.1 38.7 125.6 83.8 Z"/><path class="fp" d="M141.8 92.5 Q199.5 60.0 217.7 40.0 Q191.2 45.7 134.2 79.5 Z"/><path class="fp" d="M146.8 90.3 Q207.1 76.0 228.4 62.2 Q203.1 60.0 143.2 75.7 Z"/><path class="fp" d="M151.7 87.5 Q209.3 90.3 232.0 82.8 Q209.9 73.8 152.3 72.5 Z"/><path class="fp" d="M156.7 84.1 Q207.1 101.3 229.4 99.9 Q212.2 85.6 161.3 69.9 Z"/><path class="cov" d="M116 104 C120 84 136 66 160 58 C176 54 190 58 196 64 C182 66 168 74 156 86 C146 96 134 106 120 112 Z"/><path class="cov2" d="M118 108 C130 96 146 88 166 86 C176 86 184 90 188 96 C172 96 158 102 144 110 C136 114 126 116 118 116 Z"/></g></g><g class="wing wr"><path class="fp" d="M130.6 95.5 Q158.3 45.0 161.6 21.4 Q143.8 37.3 117.4 88.5 Z"/><path class="fp" d="M136.4 94.2 Q179.9 50.2 190.7 27.1 Q168.1 38.7 125.6 83.8 Z"/><path class="fp" d="M141.8 92.5 Q199.5 60.0 217.7 40.0 Q191.2 45.7 134.2 79.5 Z"/><path class="fp" d="M146.8 90.3 Q207.1 76.0 228.4 62.2 Q203.1 60.0 143.2 75.7 Z"/><path class="fp" d="M151.7 87.5 Q209.3 90.3 232.0 82.8 Q209.9 73.8 152.3 72.5 Z"/><path class="fp" d="M156.7 84.1 Q207.1 101.3 229.4 99.9 Q212.2 85.6 161.3 69.9 Z"/><path class="cov" d="M116 104 C120 84 136 66 160 58 C176 54 190 58 196 64 C182 66 168 74 156 86 C146 96 134 106 120 112 Z"/><path class="cov2" d="M118 108 C130 96 146 88 166 86 C176 86 184 90 188 96 C172 96 158 102 144 110 C136 114 126 116 118 116 Z"/></g><path class="tf" d="M94.7 158.8 Q103.6 176.9 113.1 180.7 Q115.3 170.7 105.3 153.2 Z"/><path class="tf" d="M99.2 157.5 Q104.2 180.0 112.7 187.0 Q117.0 176.8 110.8 154.5 Z"/><path class="tf" d="M104.0 156.0 Q103.4 181.9 110.0 192.0 Q116.6 181.9 116.0 156.0 Z"/><path class="tf" d="M109.2 154.5 Q103.0 176.8 107.3 187.0 Q115.8 180.0 120.8 157.5 Z"/><path class="tf" d="M114.7 153.2 Q104.7 170.7 106.9 180.7 Q116.4 176.9 125.3 158.8 Z"/> <path class="body" d="M110 66 C126 66 134 80 134 98 C134 122 126 144 118 160 L102 160 C94 144 86 122 86 98 C86 80 94 66 110 66 Z"/> <path class="chest" d="M98 92 C104 98 116 98 122 92 M96 106 C104 112 116 112 124 106 M98 120 C104 126 116 126 122 120 M100 134 C106 140 114 140 120 134"/> <path class="talon" d="M100 156 l-8 12 M104 158 l-3 14 M116 158 l3 14 M120 156 l8 12"/> <path class="head" d="M100 42 C110 35 124 37 130 47 C134 54 134 62 130 68 L122 76 L100 76 C93 71 91 62 93 54 C94 48 96 45 100 42 Z"/><path class="beak" d="M125 49 C136 49 145 55 145 64 C145 70 141 75 136 77 C137 71 134 67 128 67 L121 67 Z"/> <path class="brow" d="M110 51 L130 47"/><circle class="eye" cx="121" cy="55" r="2.8"/><path class="neck" d="M100 76 C104 80 116 80 122 76"/> </svg>`,
    volkan: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><path class="rim" d="M0 100 L33 21 L41 11 M59 11 L67 21"/>
      <path class="lava-g" d="M48 13 C46 30 40 42 42 58 C44 72 36 86 31 100"/><path class="lava" d="M48 13 C46 30 40 42 42 58 C44 72 36 86 31 100"/><path class="lava-h" d="M48 13 C46 30 40 42 42 58 C44 72 36 86 31 100"/>
      <path class="lava-g" d="M53 13 C56 28 62 40 60 54 C58 66 66 82 71 100"/><path class="lava" d="M53 13 C56 28 62 40 60 54 C58 66 66 82 71 100"/><path class="lava-h b" d="M53 13 C56 28 62 40 60 54 C58 66 66 82 71 100"/></svg>`,
  };
  BG.pbgHTML = (k) =>
    k && BG.PBG[k]
      ? `<div class="pbg pbg-${k}" aria-hidden="true"><span class="l1"></span><span class="l2"></span><span class="l3">${PBG_EXTRA[k] || ''}</span><span class="l4"></span><span class="pt">${'<i></i>'.repeat(12)}</span></div>`
      : '';
  /** Sunucudaki herkese açık ayarlardan rütbe tablosu ve masa seviyeleri (açılışta ve panelde kaydedince) */
  BG.applyEconSettings = function (r) {
    if (!r) return;
    if (Array.isArray(r.ranks) && r.ranks.length) {
      BG.RANKS = r.ranks.map((x) => [x.name, Number(x.min) || 0, (x.color || '#a970ff').toLowerCase(), x.icon || 'stripes']);
      try {
        localStorage.setItem(LS_RANKS, JSON.stringify(BG.RANKS));
      } catch (e) {}
    }
    if (Array.isArray(r.levels) && r.levels.length) BG.LEVELS = r.levels.map((l) => [Number(l.fee) || 0, Number(l.min_rank) || 1]);
    if (r.prestige_min_rank) BG.PRESTIGE_MIN = r.prestige_min_rank;
    // v3.4.1: yayından kaldırılan oyunlar (açılışta hemen uygulanabilsin diye saklanır)
    if (Array.isArray(r.games_off)) {
      try {
        localStorage.setItem('bg.gamesOff', JSON.stringify(r.games_off));
      } catch (e) {}
    }
    BG.publicSettings = r;
    if (BG.bus) BG.bus.emit('econ-settings', r);
  };
  /* ---------------- v3.4.1: oyunların yayın durumu (panelden) ---------------- */
  BG.gamesOffList = function () {
    const ps = BG.publicSettings;
    if (ps && Array.isArray(ps.games_off)) return ps.games_off;
    try {
      const v = JSON.parse(localStorage.getItem('bg.gamesOff') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };
  BG.gameOff = (key) => !!key && BG.gamesOffList().indexOf(key) >= 0;
  const DART_KEYS = ['dartbot', 'dart-mac', 'dart-turnuva', 'dart-lig'];
  /** Ana sayfa gibi listelerde yayında olmayan oyunları gizler (yönetici kesik çerçeveyle görür) */
  BG.applyGamesOff = function (root) {
    if (!root || !root.querySelectorAll) return;
    const admin = !!(BG.store && BG.store.me && BG.store.me.is_admin);
    root.querySelectorAll('[data-game]').forEach((el) => {
      const k = el.dataset.game;
      const off = k === 'dart' ? DART_KEYS.every(BG.gameOff) : BG.gameOff(k);
      el.hidden = off && !admin;
      el.classList.toggle('is-game-off', off);
    });
    root.querySelectorAll('a[href^="#/oyun/"]').forEach((a) => {
      const m = /^#\/oyun\/([^?]+)(?:\?(.*))?$/.exec(a.getAttribute('href') || '');
      if (!m || /(^|&)(masa|devam)=/.test(m[2] || '')) return;
      const off = BG.gameOff(m[1]);
      const holder = a.closest('.mode, .hv-mode');
      if (holder) {
        holder.hidden = off && !admin;
        holder.classList.toggle('is-game-off', off);
      } else if (!a.closest('[data-game]')) {
        a.hidden = off && !admin;
        a.classList.toggle('is-game-off', off);
      }
    });
  };
  BG.rankOf = function (bal) {
    bal = Number(bal) || 0;
    let r = 1;
    BG.RANKS.forEach((x, i) => {
      if (bal >= x[1]) r = i + 1;
    });
    return r;
  };
  /** Rengin koyu tonu (#rrggbb → %38 karartılmış) */
  function shade(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#333';
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - (k == null ? 0.38 : k)))));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  BG.maxFeeFor = function (idx) {
    let f = 0;
    (BG.LEVELS || []).forEach((l) => {
      if (l[1] <= idx && l[0] > f) f = l[0];
    });
    return f;
  };
  BG.rankInfo = function (idx) {
    const R = BG.RANKS;
    const i = Math.max(1, Math.min(R.length, idx || 1));
    const x = R[i - 1];
    const next = R[i];
    let grp = 0;
    let tier = 0;
    for (let k = 0; k < i; k++) {
      if (k === 0 || R[k][2] !== R[k - 1][2]) {
        grp++;
        tier = 0;
      }
      tier++;
    }
    const color = x[2] || '#a970ff';
    return { idx: i, name: x[0], min: x[1], next: next ? next[1] : null, nextName: next ? next[0] : null, grp, tier, color, color2: shade(color),
             icon: x[3] || 'stripes', group: BG.RANK_COLOR_NAMES[color] || '', maxFee: BG.maxFeeFor(i), top: i === R.length };
  };
  /** Rütbe rengini taşıyan stil (kartlar, rozetler) */
  BG.rankStyle = function (r) {
    r = typeof r === 'number' ? BG.rankInfo(r) : r;
    return `--rk-c:${r.color};--rk-c2:${r.color2}`;
  };
  BG.roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.max(1, Math.min(10, n || 1)) - 1];
  const RANK_GLYPH = {
    star: '<path d="M12 6.4l1.7 3.5 3.8.5-2.8 2.7.7 3.8L12 15.1l-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill="#fff"/>',
    gem: '<path d="M8.3 8.1h7.4l2.3 3.1L12 17.6l-6-6.4z" fill="#fff"/><path d="M8.3 8.1 12 17.6l3.7-9.5M6 11.2h12" fill="none" stroke="var(--rk-c2)" stroke-width=".9"/>',
    diamond: '<path d="M12 5.6 17.4 12 12 18.4 6.6 12z" fill="#fff"/><path d="M12 5.6v12.8M6.6 12h10.8M9.3 8.8 12 12l2.7-3.2" fill="none" stroke="var(--rk-c2)" stroke-width=".85"/>',
    crown: '<path d="M6.4 15.2 5.7 9l3.3 2.6L12 6.8l3 4.8L18.3 9l-.7 6.2z" fill="#fff"/><rect x="6.4" y="15.9" width="11.2" height="1.8" rx=".6" fill="#fff"/><circle cx="12" cy="12.6" r="1" fill="var(--rk-c2)"/>',
    planet: '<circle cx="12" cy="12" r="3.7" fill="#fff"/><ellipse cx="12" cy="12" rx="7" ry="2.3" transform="rotate(-24 12 12)" fill="none" stroke="#fff" stroke-width="1.25"/><circle cx="12" cy="12" r="3.7" fill="none" stroke="var(--rk-c2)" stroke-width=".6"/>',
    galaxy: '<path d="M12 12c0-1.5 1.7-2.3 3-1.4 1.7 1.2 1.1 3.9-.7 4.6-2.6 1-5.2-.9-5.3-3.4-.2-3.2 2.9-5.5 5.9-4.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="1.3" fill="#fff"/><circle cx="17.2" cy="7.4" r=".8" fill="#fff"/><circle cx="6.9" cy="16.4" r=".7" fill="#fff"/>',
  };
  /** Rütbe simgesi: rütbe renginde altıgen; içinde kademe şeridi ya da özel simge (Global yıldız, Platin mücevher …) */
  BG.rankIcon = function (idx, size) {
    const r = BG.rankInfo(idx);
    const s = size || 18;
    let inner = RANK_GLYPH[r.icon] || '';
    if (!inner) {
      const n = Math.max(1, Math.min(5, r.tier));
      const h = 2.1;
      const gap = 1.25;
      const total = n * h + (n - 1) * gap;
      let y = 12 - total / 2;
      for (let k = 0; k < n; k++) {
        inner += `<path d="M7.6 ${(y + h).toFixed(2)} 12 ${(y).toFixed(2)} 16.4 ${(y + h).toFixed(2)}" fill="none" stroke="#fff" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>`;
        y += h + gap;
      }
    }
    const fancy = r.icon !== 'stripes' && r.icon !== 'star';
    return `<svg class="rank-ic g${r.grp}${fancy ? ' rk-fancy' : ''}" style="${BG.rankStyle(r)}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${fancy ? '<path d="M12 .4 22.2 6.3v11.4L12 23.6 1.8 17.7V6.3z" fill="none" stroke="var(--rk-c)" stroke-opacity=".55" stroke-width=".8"/>' : ''}<path d="M12 1.8 20.8 6.9v10.2L12 22.2 3.2 17.1V6.9z" fill="var(--rk-c)" stroke="rgba(0,0,0,.28)" stroke-width="1"/><path d="M12 3.6 19.2 7.8v3.1L12 6.7 4.8 10.9V7.8z" fill="#fff" opacity=".22"/>${inner}</svg>`;
  };
  /** Rütbe etiketi: simge + ad (opts.min: yalnızca simge) */
  BG.rankChip = function (idx, opts) {
    opts = opts || {};
    const r = BG.rankInfo(idx);
    return `<span class="rank-chip g${r.grp}${opts.cls ? ' ' + opts.cls : ''}" style="${BG.rankStyle(r)}" title="Rütbe: ${BG.esc(r.name)}${r.group ? ' (' + BG.esc(r.group) + ')' : ''}">${BG.rankIcon(r.idx, opts.size || 16)}${opts.min ? '' : `<b>${BG.esc(r.name)}</b>`}</span>`;
  };
  BG.prestigeChip = function (n, opts) {
    if (!n) return '';
    opts = opts || {};
    return `<span class="prestige-chip${opts.cls ? ' ' + opts.cls : ''}" title="Prestij ${BG.roman(n)}">${BG.icon('star', opts.size || 12)}<b>${opts.short ? BG.roman(n) : 'Prestij ' + BG.roman(n)}</b></span>`;
  };
  /** Sayı: 12.450 */
  BG.n0 = (n) => (Math.round(Number(n) || 0)).toLocaleString('tr-TR');
  /** Süre: saniye → "12,5 saat" (tek ondalık, Türkçe) */
  BG.hours = (secs) => (Math.round(((Number(secs) || 0) / 3600) * 10) / 10).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' saat';
  /** Yüzde: %63,4 */
  BG.pct = (a, b) => (b ? '%' + (Math.round((a / b) * 1000) / 10).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');

  /* ---------------- Oyun kataloğu ---------------- */
  BG.GAMES = {
    americano: { key: 'americano', file: 'americano.html', name: 'Americano', glyph: 'A', color: 'coral', activity: 'Americano oynuyor', group: 'americano' },
    somali: { key: 'somali', file: 'somali.html', name: 'Somali', glyph: '13', color: 'amber', activity: 'Somali oynuyor', group: 'somali' },
    kura: { key: 'kura', file: 'kura-cek.html', name: 'Kura Çek', glyph: 'K', color: 'mint', activity: 'Kura çekiyor', group: 'kura' },
    lig: { key: 'lig', file: 'lig.html', name: 'Lig Oluştur', glyph: '1', color: 'violet', activity: 'Lig yönetiyor', group: 'lig' },
    dartbot: { key: 'dartbot', file: 'dart/dartbot-v1.html', name: 'Dartbot', glyph: '20', color: 'sky', activity: 'Dartbot ile oynuyor', group: 'dart' },
    'dart-turnuva': { key: 'dart-turnuva', file: 'dart/dart-turnuva.html', name: 'Dart Turnuva', glyph: '20', color: 'sky', activity: 'Dart turnuvasında', group: 'dart' },
    'dart-mac': { key: 'dart-mac', file: 'dart/dart-mac.html', name: 'Dart Maç', glyph: '20', color: 'sky', activity: 'Dart maçında', group: 'dart' },
    'dart-lig': { key: 'dart-lig', file: 'dart/dart-lig.html', name: 'Dart Lig', glyph: '20', color: 'sky', activity: 'Dart liginde', group: 'dart' },
    'americano-online': { key: 'americano-online', file: 'americano-online.html', name: 'Americano Online', glyph: 'A', color: 'green', activity: 'Americano Online oynuyor', group: 'americano-online', table: true },
    'dostkazigi-online': { key: 'dostkazigi-online', file: 'dost-kazigi-online.html', name: 'Dost Kazığı Online', glyph: 'DK', color: 'rose', activity: 'Dost Kazığı oynuyor', group: 'dostkazigi-online', table: true },
    blackjack: { key: 'blackjack', file: 'blackjack.html', name: 'Blackjack Royale', glyph: 'BJ', color: 'gold', activity: 'Blackjack Royale masasında', group: 'blackjack', table: true },
    'pisti-online': { key: 'pisti-online', file: 'pisti-online.html', name: 'Pişti Online', glyph: 'P', color: 'teal', activity: 'Pişti oynuyor', group: 'pisti-online', table: true },
    'tavla-online': { key: 'tavla-online', file: 'tavla-online.html', name: 'Tavla Online', glyph: 'T', color: 'wood', activity: 'Tavla oynuyor', group: 'tavla-online', table: true },
  };
  /** Arkadaşı izleme bağlantısı: online masada masaya izleyici olarak, diğerlerinde canlı yayına */
  BG.watchHref = function (game, sessionId, userId) {
    const g = BG.GAMES[game];
    if (g && g.table) return '#/oyun/' + g.key + '?masa=' + encodeURIComponent(sessionId) + '&izle=1' + (userId ? '&kim=' + encodeURIComponent(userId) : '');
    return '#/izle/' + encodeURIComponent(sessionId);
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
