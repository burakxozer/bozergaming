/* =====================================================================
   Bözer Gaming — arkadaşını canlı izle
   Oyuncunun ekranı, betik çalıştırmayan korumalı bir çerçevede
   gösterilir ve her değişiklikte yerinde güncellenir.
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};

  const WATCH_CSS = `
    *{cursor:default!important}
    input,button,select,textarea,label,a,[onclick]{pointer-events:none!important}
    input,textarea{caret-color:transparent!important}
    ::selection{background:transparent}
    html{scroll-behavior:smooth}`;

  /* ---------------- Oyun stillerini getir ---------------- */
  const cssCache = {};
  async function gameStyles(file) {
    if (cssCache[file]) return cssCache[file];
    const url = new URL(file, location.href);
    const res = await fetch(url.href + '?v=' + encodeURIComponent(BG.config.version || '2'), { cache: 'force-cache' });
    if (!res.ok) throw new Error('Oyun dosyası yüklenemedi.');
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let out = '';
    doc.querySelectorAll('link[rel~="stylesheet"][href], style').forEach((n) => {
      if (n.tagName === 'STYLE') out += '<style>' + n.textContent.replace(/<\/style/gi, '<\\/style') + '</style>';
      else out += '<link rel="stylesheet" href="' + esc(new URL(n.getAttribute('href'), url).href) + '">';
    });
    cssCache[file] = out;
    return out;
  }

  /* ---------------- Güvenli içerik ---------------- */
  const BAD_TAGS = 'script,iframe,frame,frameset,object,embed,link,meta,base,style,noscript,template,form,svg script';
  function sanitize(root) {
    root.querySelectorAll(BAD_TAGS).forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        const n = a.name.toLowerCase();
        if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction' || n === 'action') el.removeAttribute(a.name);
        else if ((n === 'href' || n === 'src' || n === 'xlink:href') && !/^(#|data:image\/)/i.test(a.value.trim())) el.removeAttribute(a.name);
      }
    });
    return root;
  }
  function attrString(o) {
    return Object.keys(o || {})
      .filter((k) => /^[a-z][a-z0-9_:.-]*$/i.test(k) && !/^on/i.test(k))
      .map((k) => ' ' + k + '="' + esc(o[k]) + '"')
      .join('');
  }
  function setAttrs(el, o) {
    o = o || {};
    Array.from(el.attributes).forEach((a) => {
      if (!(a.name in o)) el.removeAttribute(a.name);
    });
    Object.keys(o).forEach((k) => {
      if (!/^[a-z][a-z0-9_:.-]*$/i.test(k) || /^on/i.test(k)) return;
      if (el.getAttribute(k) !== o[k]) el.setAttribute(k, o[k]);
    });
  }

  /* ---------------- Yerinde güncelleme (titreşimsiz) ---------------- */
  function morph(from, to) {
    const doc = from.ownerDocument;
    const want = Array.from(to.childNodes);
    for (let i = 0; i < want.length; i++) {
      const t = want[i];
      const f = from.childNodes[i];
      if (!f) {
        from.appendChild(doc.importNode(t, true));
        continue;
      }
      if (f.nodeType !== t.nodeType || f.nodeName !== t.nodeName) {
        from.replaceChild(doc.importNode(t, true), f);
        continue;
      }
      if (t.nodeType === 3 || t.nodeType === 8) {
        if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue;
        continue;
      }
      if (t.nodeType !== 1) continue;
      Array.from(f.attributes).forEach((a) => {
        if (!t.hasAttribute(a.name)) f.removeAttribute(a.name);
      });
      Array.from(t.attributes).forEach((a) => {
        if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
      });
      if (f.tagName === 'INPUT') {
        const type = (f.type || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') f.checked = t.hasAttribute('checked');
        else if (f.value !== (t.getAttribute('value') || '')) f.value = t.getAttribute('value') || '';
      } else if (f.tagName === 'TEXTAREA') {
        if (f.value !== t.textContent) f.value = t.textContent;
      }
      morph(f, t);
    }
    while (from.childNodes.length > want.length) from.removeChild(from.lastChild);
  }

  function parseFrame(s) {
    if (!s) return null;
    try {
      const f = typeof s === 'string' ? JSON.parse(s) : s;
      return f && typeof f.content === 'string' ? f : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------------- İzleme sayfası ---------------- */
  BG.views.watch = function (params) {
    const id = params.id;
    const root = BG.frag(`
      <div class="watch-layer">
        <header class="gamebar watchbar">
          <button class="gb-back" type="button" aria-label="Geri">${icon('back')}<span class="hide-s">Geri</span></button>
          <div class="wb-who"><span class="wb-av"></span><span class="wb-text"><strong>Yükleniyor…</strong><span class="wb-game"></span></span></div>
          <div class="gb-right">
            <span class="watch-state" data-s="connecting"><span class="live-dot"></span><span class="ws-text">Bağlanıyor</span></span>
            <button class="icon-btn wb-msg" type="button" aria-label="Mesaj gönder" hidden>${icon('message')}</button>
          </div>
        </header>
        <div class="watch-stage">
          <iframe class="game-frame watch-frame" title="Canlı oyun ekranı" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>
          <div class="watch-cover" hidden><div class="watch-cover-card"></div></div>
        </div>
      </div>`);
    const iframe = root.querySelector('iframe');
    const cover = root.querySelector('.watch-cover');
    const stateEl = root.querySelector('.watch-state');
    let info = null;
    let lastSeq = 0;
    let ch = null;
    let pres = null;
    let poll = null;
    let docReady = false;
    let pendingFrame = null;
    let ended = false;
    let gone = false;

    root.querySelector('.gb-back').addEventListener('click', () => {
      if (BG.router.prevPath && !/^\/izle\//.test(BG.router.prevPath)) history.back();
      else BG.router.go('/arkadaslar', true);
    });
    root.querySelector('.wb-msg').addEventListener('click', () => info && BG.chat.openDrawer(info.username));

    function setState(s) {
      stateEl.dataset.s = s;
      stateEl.querySelector('.ws-text').textContent = { connecting: 'Bağlanıyor', live: 'Canlı', paused: 'Bağlantı bekleniyor', ended: 'Yayın bitti' }[s] || '';
    }

    function showCover(html) {
      cover.hidden = !html;
      if (html) cover.querySelector('.watch-cover-card').innerHTML = html;
    }

    function paintBar() {
      const g = BG.GAMES[info.game] || { name: info.game };
      root.querySelector('.wb-av').innerHTML = BG.avatar(info, { size: 34, online: !!info.owner_online });
      root.querySelector('.wb-text strong').textContent = info.full_name || '@' + info.username;
      root.querySelector('.wb-game').textContent = g.name + (info.title ? ': ' + info.title : '');
      root.querySelector('.wb-msg').hidden = info.owner_id === BG.store.me.id;
      document.title = (info.full_name || info.username) + ' izleniyor · Bözer Gaming';
    }

    function applyFrame(f) {
      if (!f) return;
      const d = iframe.contentDocument;
      if (!docReady || !d || !d.body) {
        pendingFrame = f;
        return;
      }
      const htmlAttrs = Object.assign({}, f.html || {}, { 'data-bg-theme': BG.theme.get(), 'data-bg-watch': '1' });
      setAttrs(d.documentElement, htmlAttrs);
      setAttrs(d.body, f.body || {});
      // Ayrıştırma ana belgedeki etkisiz bir şablonda yapılır; temizlenen içerik çerçeveye aktarılır
      const t = document.createElement('template');
      t.innerHTML = f.content || '';
      sanitize(t.content);
      morph(d.body, t.content);
    }

    async function build(frameRaw) {
      const g = BG.GAMES[info.game];
      const styles = await gameStyles(g.file);
      const f = parseFrame(frameRaw) || { html: {}, body: {}, content: '' };
      const origin = location.origin && location.origin !== 'null' ? location.origin : '';
      const csp =
        "default-src 'none'; style-src 'unsafe-inline' " + origin + ' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: ' + origin;
      const htmlAttrs = Object.assign({}, f.html || {}, { 'data-bg-theme': BG.theme.get(), 'data-bg-watch': '1' });
      const tmp = document.createElement('template');
      tmp.innerHTML = f.content || '';
      sanitize(tmp.content);
      const doc =
        '<!doctype html><html' + attrString(htmlAttrs) + '><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<meta http-equiv="Content-Security-Policy" content="' + esc(csp) + '">' +
        styles +
        '<style>' + WATCH_CSS + '</style></head><body' + attrString(f.body) + '>' + tmp.innerHTML + '</body></html>';
      docReady = false;
      iframe.addEventListener(
        'load',
        () => {
          docReady = true;
          if (pendingFrame) {
            const p = pendingFrame;
            pendingFrame = null;
            applyFrame(p);
          }
        },
        { once: true }
      );
      iframe.srcdoc = doc;
    }

    function markEnded(text) {
      ended = true;
      setState('ended');
      showCover(`${BG.tile('B', 'amber', 'tile-s')}<h2>Yayın bitti</h2><p>${esc(text || (info.full_name || info.username) + ' oyundan çıktı.')}</p>
        <div class="row-actions"><a class="btn btn-soft" href="#/arkadaslar">Arkadaşlar</a>${info.owner_id !== BG.store.me.id ? `<button class="btn btn-primary" type="button" data-msg>${icon('message', 18)}Mesaj gönder</button>` : ''}</div>`);
      const b = cover.querySelector('[data-msg]');
      if (b) b.addEventListener('click', () => BG.chat.openDrawer(info.username));
    }
    function markLive() {
      if (ended) showCover(null);
      ended = false;
      setState('live');
    }

    function onLive(row) {
      if (!row || gone) return;
      if (row.seq && row.seq <= lastSeq) return;
      lastSeq = row.seq || lastSeq;
      if (row.frame) applyFrame(parseFrame(row.frame));
      if (row.is_live === false) markEnded();
      else if (row.is_live) markLive();
    }

    async function refresh() {
      try {
        const fresh = await BG.api.rpc('bg_watch_info', { p_id: id });
        if (gone) return;
        info = fresh;
        paintBar();
        if (fresh.seq > lastSeq) onLive({ seq: fresh.seq, frame: fresh.frame, is_live: fresh.is_live });
        if (!fresh.is_live || !fresh.owner_online || !fresh.owner_here) markEnded(!fresh.owner_online ? (fresh.full_name || fresh.username) + ' çevrimdışı.' : null);
        else markLive();
      } catch (e) {}
    }

    (async () => {
      try {
        info = await BG.api.rpc('bg_watch_info', { p_id: id });
        if (gone) return;
        paintBar();
        lastSeq = info.seq || 0;
        await build(info.frame);
        if (!info.is_live || !info.owner_online || !info.owner_here) markEnded(!info.owner_online ? (info.full_name || info.username) + ' şu an çevrimdışı.' : null);
        else setState('live');
        ch = BG.api
          .channel('bg-live-' + id + '-' + Date.now().toString(36))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: 'session_id=eq.' + id }, (p) => onLive(p.new))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'presence', filter: 'user_id=eq.' + info.owner_id }, (p) => {
            const r = p.new;
            if (!r) return;
            info.owner_online = r.status === 'online';
            paintBar();
            if (r.status !== 'online') markEnded((info.full_name || info.username) + ' çevrimdışı oldu.');
            else if (r.session_id && r.session_id !== id) markEnded((info.full_name || info.username) + ' başka bir oyuna geçti.');
          })
          .subscribe();
        pres = BG.api.channel('bg-watch-' + id, { config: { presence: { key: BG.store.me.id } } });
        pres.subscribe((status) => {
          if (status === 'SUBSCRIBED' && !gone) {
            const me = BG.store.me;
            pres.track({ role: 'viewer', user_id: me.id, username: me.username, full_name: me.full_name, avatar_url: me.avatar_url }).catch(() => {});
          }
        });
        poll = setInterval(() => document.visibilityState === 'visible' && refresh(), 20000);
      } catch (e) {
        if (gone) return;
        if (e.code === 'P0002') {
          // Online masa (Americano Online, Dost Kazığı Online): masayı izleyici olarak aç
          try {
            const t = await BG.api.rpc('bg_table_state', { p_table: id, p_after: 2147483647 });
            if (!gone && t && t.table && BG.GAMES[t.table.game]) {
              BG.router.go(BG.watchHref(t.table.game, id, '').slice(1), true);
              return;
            }
          } catch (e2) {}
        }
        root.querySelector('.wb-text strong').textContent = 'Yayın açılamadı';
        setState('ended');
        showCover(`${BG.tile('?', 'ink', 'tile-s')}<h2>Bu yayını izleyemezsin</h2><p>${esc(e.message)}</p><div class="row-actions"><a class="btn btn-soft" href="#/arkadaslar">Arkadaşlara dön</a></div>`);
      }
    })();

    const offTheme = BG.bus.on('theme', (t) => {
      const d = iframe.contentDocument;
      if (d && d.documentElement) d.documentElement.setAttribute('data-bg-theme', t);
    });
    document.documentElement.classList.add('watch-open');
    return {
      node: root,
      cleanup: () => {
        gone = true;
        clearInterval(poll);
        offTheme();
        BG.api.removeChannel(ch);
        if (pres) {
          try {
            pres.untrack();
          } catch (e) {}
          BG.api.removeChannel(pres);
        }
        document.documentElement.classList.remove('watch-open');
        BG.app.paintTitle();
      },
    };
  };
})();
