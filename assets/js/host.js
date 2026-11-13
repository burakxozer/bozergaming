/* =====================================================================
   Bözer Gaming — oyun katmanı
   Oyunu açar, her değişiklikte hesaba kaydeder (üye değilse bu cihaza),
   kaldığı yerden devam ettirir ve arkadaşların izlemesi için ekranı yayınlar.
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;

  const FRAME_MS = 250; // canlı yayın karesi en sık bu aralıkla gider
  const STATE_QUIET_MS = 900; // son değişiklikten sonra durum kaydı
  const STATE_MAX_MS = 4000; // sürekli değişimde en geç bu aralıkla kayıt

  const DOCS = {
    americano: [['tpl-rules-americano', 'Americano oyun kuralları', 'book'], ['tpl-info-americano', 'Americano skor tablosu nasıl kullanılır?', 'info']],
    dartbot: [['tpl-info-dartbot', 'Dartbot nasıl oynanır?', 'info']],
    kura: [['tpl-info-kura', 'Kura Çek nasıl kullanılır?', 'info']],
    lig: [['tpl-info-lig', 'Lig Oluştur nasıl kullanılır?', 'info']],
    somali: [['tpl-info-somali', 'Somali skor tablosu nasıl kullanılır?', 'info']],
    'americano-online': [['tpl-rules-americano', 'Americano oyun kuralları', 'book']],
    'dostkazigi-online': [['tpl-rules-dostkazigi', 'Dost Kazığı oyun kuralları', 'book']],
    blackjack: [['tpl-rules-blackjack', 'Blackjack Royale oyun kuralları', 'book']],
  };
  /** Online masa oyunlarına geçen adres parametreleri */
  const TABLE_PARAMS = ['masa', 'izle', 'kim', 'mod'];
  function tableQuery(query) {
    const q = new URLSearchParams();
    TABLE_PARAMS.forEach((k) => {
      if (query && query[k]) q.set(k, String(query[k]).slice(0, 80));
    });
    return q.toString();
  }

  const host = (BG.host = { cur: null });
  let layer, frame, bar;

  host.isOpen = () => !!host.cur;

  function bridge() {
    try {
      const w = frame && frame.contentWindow;
      return w && w.__bgBridge && w.__bgBridge.supported ? w.__bgBridge : null;
    } catch (e) {
      return null;
    }
  }
  host.bridge = bridge;

  /* ---------------- Katman ---------------- */
  function ensureLayer() {
    if (layer) return;
    layer = BG.frag(`
      <div class="game-layer" id="gameLayer" hidden>
        <header class="gamebar">
          <button class="gb-back" type="button" aria-label="Oyundan çık">${icon('back')}<span class="hide-s">Oyunlar</span></button>
          <div class="gb-title"><span class="gb-tile"></span><strong></strong></div>
          <div class="gb-right">
            <span class="save-state" data-s="idle" role="status" aria-live="polite"></span>
            <span class="live-pill" hidden title="Arkadaşların bu oyunu canlı izleyebilir"><span class="live-dot"></span><span class="lp-text">Canlı</span><span class="lp-viewers" hidden>${icon('eye', 15)}<b>0</b></span></span>
            <button class="icon-btn gb-tchat" type="button" aria-label="Masa sohbeti" title="Masa sohbeti" hidden>${icon('chats')}<span class="gb-badge"></span></button>
            <button class="icon-btn gb-chat" type="button" aria-label="Mesajlar">${icon('message')}<span class="gb-badge"></span></button>
            <button class="icon-btn gb-full" type="button" aria-label="Tam ekran" title="Tam ekran">${icon('expand')}</button>
            <button class="icon-btn gb-help" type="button" aria-label="Kurallar ve kullanım">${icon('book')}</button>
          </div>
        </header>
        <iframe class="game-frame" title="Oyun" allow="autoplay; vibrate; clipboard-write; fullscreen"></iframe>
        <div class="gl-float" hidden>
          <button class="gl-fbtn gl-tchat" type="button" aria-label="Masa sohbeti" hidden>${icon('chats', 19)}<span class="gb-badge"></span></button>
          <button class="gl-fbtn gl-exitfs" type="button" aria-label="Tam ekrandan çık" title="Tam ekrandan çık">${icon('compress', 19)}</button>
        </div>
      </div>`);
    document.body.appendChild(layer);
    frame = layer.querySelector('.game-frame');
    bar = layer.querySelector('.gamebar');
    bar.querySelector('.gb-back').addEventListener('click', host.exit);
    bar.querySelector('.gb-chat').addEventListener('click', () => {
      if (!BG.isAuthed()) {
        BG.toast({ type: 'info', title: 'Mesajlaşmak için giriş yap', text: 'Oyunun bu cihazda kaydediliyor, giriş yapınca kaldığın yerden devam edebilirsin.' });
        return;
      }
      BG.chat.openDrawer();
    });
    bar.querySelector('.gb-help').addEventListener('click', helpMenu);
    const tableChatToggle = () => {
      try {
        const w = frame.contentWindow;
        if (w && w.BGT && w.BGT.chat) w.BGT.chat.toggle();
      } catch (e) {}
    };
    bar.querySelector('.gb-tchat').addEventListener('click', tableChatToggle);
    layer.querySelector('.gl-tchat').addEventListener('click', tableChatToggle);
    bar.querySelector('.gb-full').addEventListener('click', () => host.fullscreen());
    layer.querySelector('.gl-exitfs').addEventListener('click', () => host.fullscreen(false));
    const onFs = () => {
      // tarayıcının kendi çıkışı (Esc, geri hareketi): site çubuklarını geri getir
      if (!fsEl() && layer._realFs) {
        layer._realFs = false;
        setFull(false);
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    frame.addEventListener('load', onFrameLoad);
    window.addEventListener('message', (e) => {
      if (!host.cur || !frame || e.source !== frame.contentWindow) return;
      if (e.data && e.data.bg === 'change') onChange();
    });
    BG.bus.on('counts', paintBadge);
    BG.bus.on('theme', (t) => {
      const b = bridge();
      if (b) b.setTheme(t);
    });
  }

  function helpMenu() {
    const c = host.cur;
    const docs = c && DOCS[c.key];
    if (!docs || !docs.length) {
      BG.modal({
        title: c ? c.g.name : 'Oyun',
        size: 's',
        body: `<p class="modal-text">Karambol Kriket kurallarını bilmiyorsan videodan öğrenebilirsin.</p>
          <a class="btn btn-soft btn-block" href="https://www.youtube.com/watch?v=mSMOEP9QWJk" target="_blank" rel="noopener">${icon('video', 18)}YouTube’da izle</a>`,
        actions: [{ label: 'Kapat', kind: 'primary' }],
      });
      return;
    }
    if (docs.length === 1) return BG.showDoc(docs[0][0], docs[0][1]);
    const body = BG.frag(`<div class="menu-list"></div>`);
    let m;
    docs.forEach(([tpl, title, ic]) => {
      const b = BG.frag(`<button class="menu-item" type="button">${icon(ic)}<span>${esc(title)}</span>${icon('next', 18)}</button>`);
      b.addEventListener('click', () => {
        m.close();
        setTimeout(() => BG.showDoc(tpl, title), 120);
      });
      body.appendChild(b);
    });
    m = BG.modal({ title: c.g.name, size: 's', body });
  }

  function paintBadge() {
    if (!bar) return;
    const n = BG.store.unread || 0;
    bar.querySelector('.gb-chat .gb-badge').innerHTML = BG.countBadge(n);
  }

  /** Online masa sohbeti düğmesi: masadaki oyun (bg-table.js) açar, kapatır ve okunmamışı bildirir */
  host.tableChat = function (on, unread) {
    if (!bar) return false;
    [bar.querySelector('.gb-tchat'), layer.querySelector('.gl-tchat')].forEach((b) => {
      b.hidden = !on || !host.cur;
      b.querySelector('.gb-badge').innerHTML = on ? BG.countBadge(unread || 0) : '';
      b.setAttribute('aria-label', on && unread ? `Masa sohbeti, ${unread} yeni mesaj` : 'Masa sohbeti');
    });
    return true;
  };

  /* ---------------- Kayma ve yakınlaşma kilidi (v3.4) ----------------
     Oyun açıkken sayfa yakınlaştırılamaz ve oyunun arkasındaki site kaymaz. Online kart
     oyunlarında (Blackjack, Americano, Dost Kazığı) ve tam ekranda oyun ekranının kendisi de
     kaymaz; yalnız sohbet, liste gibi kendi kaydırma alanı olan bölümler kaydırılır. */
  const STRICT = ['blackjack', 'americano-online', 'dostkazigi-online'];
  const NOZOOM = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  let vpOrig = null;
  let lockOn = false;
  let scrollKeep = 0;
  const stopGesture = (e) => e.preventDefault();
  /** Dokunuşun altında kendi kaydırma alanı var mı (o yönde kaydırılabilir mi) */
  function scrollableFrom(node, stop, rootOk) {
    for (let n = node; n && n !== stop && n.nodeType === 1; n = n.parentNode) {
      const cs = n.ownerDocument.defaultView.getComputedStyle(n);
      const oy = cs.overflowY;
      const ox = cs.overflowX;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return true;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable) return true;
    }
    // uzun sayfalı eski oyunlar (lig tablosu gibi) kendi sayfasında kaydırılabilir
    const doc = node && node.ownerDocument;
    const se = doc && doc.scrollingElement;
    return !!(rootOk && se && se.scrollHeight > se.clientHeight + 1);
  }
  function touchGuard(strictFn, rootFn) {
    return function (e) {
      if (e.touches && e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!strictFn()) return;
      const doc = e.target && e.target.ownerDocument;
      if (!scrollableFrom(e.target, doc && doc.documentElement, rootFn ? rootFn() : false) && e.cancelable) e.preventDefault();
    };
  }
  const siteTouch = touchGuard(() => true);
  function lockPage(on) {
    if (on === lockOn) return;
    lockOn = on;
    const vp = document.querySelector('meta[name="viewport"]');
    if (on) {
      scrollKeep = window.scrollY || 0;
      if (vp) {
        if (vpOrig == null) vpOrig = vp.getAttribute('content');
        vp.setAttribute('content', NOZOOM);
      }
      document.documentElement.classList.add('page-lock');
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, stopGesture, { passive: false }));
      // site katmanında (oyun çubuğu, kenarlar) yakınlaşma ve kayma olmaz
      document.addEventListener('touchmove', siteTouch, { passive: false });
    } else {
      if (vp && vpOrig != null) vp.setAttribute('content', vpOrig);
      document.documentElement.classList.remove('page-lock');
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.removeEventListener(ev, stopGesture));
      document.removeEventListener('touchmove', siteTouch);
      if (scrollKeep) window.scrollTo(0, scrollKeep);
    }
  }
  /** Oyun belgesinin içinde: iki parmak yakınlaşma, çift dokunma yakınlaşması ve (sıkı modda) sayfa kayması yok */
  function lockFrame() {
    const c = host.cur;
    let d;
    let w;
    try {
      d = frame && frame.contentDocument;
      w = frame && frame.contentWindow;
    } catch (e) {
      return;
    }
    if (!d || !w || !c) return;
    w.__bgStrict = STRICT.indexOf(c.key) >= 0 || host.isFull();
    if (d.__bgLock) return;
    d.__bgLock = 1;
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => d.addEventListener(ev, stopGesture, { passive: false }));
    d.addEventListener('touchmove', touchGuard(() => !!w.__bgStrict, () => !w.__bgCard), { passive: false, capture: true });
    // online kart oyunlarının belgesi hiç kaymaz (iPhone'da adres çubuğu yüzünden taşsa bile)
    w.__bgCard = STRICT.indexOf(c.key) >= 0;
    if (w.__bgCard) d.documentElement.classList.add('bg-strict');
    try {
      const st = d.createElement('style');
      st.textContent =
        'html{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
        'html,body{overscroll-behavior:none}' +
        'html.bg-strict,html.bg-strict body{overflow:hidden;height:100%}';
      (d.head || d.documentElement).appendChild(st);
    } catch (e) {}
  }
  function strictFrame() {
    try {
      const w = frame && frame.contentWindow;
      const d = frame && frame.contentDocument;
      const c = host.cur;
      if (!w || !d || !c) return;
      w.__bgStrict = STRICT.indexOf(c.key) >= 0 || host.isFull();
      // tam ekranda sayfası kayan eski oyunlar (lig, dart) yine kendi içinde kaydırılabilir:
      // yalnız belge kökünün sallanması (rubber band) ve yakınlaşma durur
    } catch (e) {}
  }

  /* ---------------- Tam ekran ----------------
     Oyun katmanı tarayıcının tam ekranına alınır; site çubukları gizlenir.
     Tam ekrana izin vermeyen tarayıcılarda (iPhone Safari) site çubukları yine
     gizlenir, oyun bütün pencereyi kaplar. */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const canFs = () =>
    !!(layer && (document.fullscreenEnabled || document.webkitFullscreenEnabled) && (layer.requestFullscreen || layer.webkitRequestFullscreen));
  host.isFull = () => !!(layer && layer.classList.contains('is-full'));
  function setFull(on) {
    if (!layer) return;
    layer.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('game-full', on);
    strictFrame();
    layer.querySelector('.gl-float').hidden = !on;
    const b = bar.querySelector('.gb-full');
    b.innerHTML = icon(on ? 'compress' : 'expand');
    b.setAttribute('aria-label', on ? 'Tam ekrandan çık' : 'Tam ekran');
    b.title = on ? 'Tam ekrandan çık' : 'Tam ekran';
    try {
      const w = frame && frame.contentWindow;
      if (w) setTimeout(() => w.dispatchEvent(new Event('resize')), 60);
    } catch (e) {}
  }
  host.fullscreen = async function (on) {
    if (!layer || !host.cur) return;
    if (on === undefined) on = !host.isFull();
    if (on) {
      if (canFs() && !fsEl()) {
        try {
          await (layer.requestFullscreen ? layer.requestFullscreen({ navigationUI: 'hide' }) : layer.webkitRequestFullscreen());
        } catch (e) {}
      }
      layer._realFs = !!fsEl();
      setFull(true);
      const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      if (!layer._realFs && !standalone && !BG.ls.get('bg.fsHint')) {
        BG.ls.set('bg.fsHint', 1);
        BG.toast({
          type: 'info',
          title: 'Site çubukları gizlendi',
          text: 'Bu tarayıcı tam ekrana izin vermiyor. iPhone’da adres çubuğu olmadan oynamak için Safari’de Paylaş → Ana Ekrana Ekle ile Bözer Gaming’i uygulama gibi aç.',
          duration: 9000,
        });
      }
    } else {
      layer._realFs = false;
      if (fsEl()) {
        try {
          await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
        } catch (e) {}
      }
      setFull(false);
    }
  };

  function setSave(s, extra) {
    if (!bar) return;
    const el = bar.querySelector('.save-state');
    el.dataset.s = s;
    const map = {
      idle: BG.isAuthed() ? '' : `${icon('device', 16)}<span class="hide-s">Bu cihazda saklanır</span>`,
      saving: `${icon('cloud', 16)}<span class="hide-s">Kaydediliyor…</span>`,
      saved: `${icon('cloudCheck', 16)}<span class="hide-s">Kaydedildi</span>`,
      local: `${icon('device', 16)}<span class="hide-s">Bu cihazda kaydedildi</span>`,
      error: `${icon('cloudOff', 16)}<span class="hide-s">Bağlantı yok, cihazda tutuluyor</span>`,
    };
    el.innerHTML = map[s] || '';
    el.title =
      s === 'local' || s === 'idle'
        ? 'Üye olursan oyunların hesabına kaydedilir ve her cihazdan devam edebilirsin.'
        : s === 'error'
        ? extra || 'Sunucuya ulaşılamadı. İlerlemen bu cihazda saklanıyor, bağlantı gelince kaydedilecek.'
        : '';
  }

  function paintLive() {
    const c = host.cur;
    const pill = bar.querySelector('.live-pill');
    const on = !!(c && c.sessionId && BG.isAuthed());
    pill.hidden = !on;
    const n = c ? c.viewers.length : 0;
    const vb = pill.querySelector('.lp-viewers');
    vb.hidden = !n;
    vb.querySelector('b').textContent = n;
    pill.title = n
      ? 'İzleyenler: ' + c.viewers.map((v) => v.full_name || v.username).join(', ')
      : 'Arkadaşların bu oyunu canlı izleyebilir';
  }

  /* ---------------- İzleyiciler (Realtime presence) ---------------- */
  function watchViewers() {
    const c = host.cur;
    unwatchViewers();
    if (!c || !c.sessionId || !BG.isAuthed() || !BG.api.ready) return;
    try {
      const ch = BG.api.channel('bg-watch-' + c.sessionId, { config: { presence: { key: BG.store.me.id } } });
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState();
        const list = [];
        Object.keys(st).forEach((k) => {
          if (k === BG.store.me.id) return;
          const p = st[k] && st[k][0];
          if (p && p.role === 'viewer') list.push(p);
        });
        const before = new Set(c.viewers.map((v) => v.user_id));
        c.viewers = list;
        list.forEach((v) => {
          if (!before.has(v.user_id) && c.viewersReady) BG.toast({ type: 'info', title: (v.full_name || '@' + v.username) + ' seni izliyor', duration: 2600 });
        });
        c.viewersReady = true;
        paintLive();
      });
      ch.subscribe();
      c.viewerCh = ch;
    } catch (e) {
      console.warn('[host] viewers', e);
    }
  }
  function unwatchViewers() {
    const c = host.cur;
    if (c && c.viewerCh) {
      BG.api.removeChannel(c.viewerCh);
      c.viewerCh = null;
      c.viewers = [];
    }
  }

  /* ---------------- Kayıt ---------------- */
  function backupLocal(c, st, meta, status) {
    if (!c.sessionId) return;
    BG.ls.set('bg.backup.' + c.sessionId, { state: st, meta, status, ts: Date.now() });
    // en fazla 12 yedek tut
    const keys = BG.ls.keys('bg.backup.');
    if (keys.length > 12) {
      keys
        .map((k) => [k, (BG.ls.get(k, {}) || {}).ts || 0])
        .sort((a, b) => a[1] - b[1])
        .slice(0, keys.length - 12)
        .forEach(([k]) => BG.ls.del(k));
    }
  }

  function saveLocal(c, br) {
    const st = br.getState();
    if (!st) return;
    const meta = br.meta() || {};
    BG.ls.set('bg.local.' + c.key, {
      state: st,
      title: meta.title || '',
      summary: meta.summary || '',
      status: br.isFinished() ? 'finished' : 'active',
      updated_at: Date.now(),
    });
    c.savedSomething = true;
    setSave('local');
    // Sayfa yenilenirse bu cihazdaki kayıttan devam edilsin
    if (host.cur === c && !/devam=/.test(location.hash)) BG.router.silentReplace('/oyun/' + c.key + '?devam=yerel');
  }

  function onSessionCreated(c) {
    BG.router.silentReplace('/oyun/' + c.key + '?devam=' + c.sessionId);
    BG.presence.set(c.key, c.sessionId);
    BG.games.invalidate();
    BG.bus.emit('games-changed');
    watchViewers();
    paintLive();
  }

  async function saveRemote(c, p) {
    const args = {
      p_id: c.sessionId,
      p_game: c.key,
      p_title: p.meta ? p.meta.title || '' : null,
      p_summary: p.meta ? p.meta.summary || '' : null,
      p_state: p.state,
      p_status: p.status,
      p_frame: p.frame,
      p_live: true,
    };
    try {
      const id = await BG.api.rpc('bg_save_game', args);
      if (host.cur !== c) return;
      if (!c.sessionId && id) {
        c.sessionId = id;
        if (p.state) backupLocal(c, p.state, p.meta, p.status);
        onSessionCreated(c);
      }
      if (p.state) c.lastStateAt = Date.now();
      c.savedSomething = true;
      c.failures = 0;
      setSave('saved');
    } catch (e) {
      if (e.code === 'P0002' && c.sessionId) {
        // kayıt başka bir cihazdan silinmiş → yeni kayıt aç
        c.sessionId = null;
        c.dirtyState = c.dirtyFrame = true;
      } else {
        if (p.state) c.dirtyState = true;
        c.failures = (c.failures || 0) + 1;
        setSave('error');
      }
      throw e;
    }
  }

  function schedule(ms) {
    const c = host.cur;
    if (!c || c.pumpTimer) return;
    c.pumpTimer = setTimeout(pump, ms == null ? (BG.isAuthed() ? FRAME_MS : 700) : ms);
  }

  async function pump(force) {
    const c = host.cur;
    if (!c) return;
    clearTimeout(c.pumpTimer);
    c.pumpTimer = null;
    if (c.inflight) {
      if (force) await c.inflight.catch(() => {});
      else return schedule(150);
    }
    const br = bridge();
    if (!br) return;
    if (!BG.isAuthed()) {
      if (c.dirtyState && !c.lastInitial) saveLocal(c, br);
      c.dirtyState = c.dirtyFrame = false;
      return;
    }
    const now = Date.now();
    const wantState = c.dirtyState && (force || !c.sessionId || now - c.lastChangeAt >= STATE_QUIET_MS || now - c.lastStateAt >= STATE_MAX_MS);
    const wantFrame = c.dirtyFrame && (c.sessionId || wantState);
    if (!wantState && !wantFrame) {
      if (c.dirtyState) schedule(STATE_QUIET_MS);
      return;
    }
    let st = null;
    let meta = null;
    let status = null;
    let fr = null;
    if (wantState) {
      st = br.getState();
      meta = br.meta();
      status = br.isFinished() ? 'finished' : 'active';
      c.dirtyState = false;
      if (st) backupLocal(c, st, meta, status);
      if (!st) return;
    }
    if (wantFrame) {
      fr = br.snapshot();
      c.dirtyFrame = false;
    }
    if (wantState) setSave('saving');
    c.inflight = saveRemote(c, { state: st, meta, status, frame: fr });
    try {
      await c.inflight;
    } catch (e) {
      console.warn('[host] save', e.message);
    } finally {
      c.inflight = null;
    }
    if (host.cur === c && (c.dirtyState || c.dirtyFrame)) schedule(c.failures ? Math.min(15000, 1500 * c.failures) : null);
  }

  /** Oyun ekranında bir şey değişti */
  function onChange() {
    const c = host.cur;
    const br = bridge();
    if (!c || !br) return;
    const initial = br.isInitial();
    const finished = br.isFinished();
    // Aynı sayfada yeni bir oyuna geçildiyse önceki kaydı bırak
    if (c.sessionId && ((c.lastFinished && !finished) || (initial && !c.lastInitial))) detachSession(c);
    c.lastInitial = initial;
    c.lastFinished = finished;
    if (initial && !c.sessionId) return;
    c.dirtyState = true;
    c.dirtyFrame = true;
    c.lastChangeAt = Date.now();
    schedule();
  }

  function detachSession(c) {
    const id = c.sessionId;
    if (!id) return;
    BG.api.rpc('bg_end_live', { p_id: id }).catch(() => {});
    unwatchViewers();
    c.sessionId = null;
    c.viewersReady = false;
    BG.router.silentReplace('/oyun/' + c.key);
    BG.presence.set(c.key, null);
    BG.games.invalidate();
    BG.bus.emit('games-changed');
    paintLive();
  }

  /* ---------------- Oyun yüklendi ---------------- */
  function onFrameLoad() {
    const c = host.cur;
    if (!c || frame.getAttribute('src') === 'about:blank') return;
    c.loads++;
    lockFrame();
    // Aktif süre: oyun içindeki dokunuş / tuş da etkinlik sayılır (v3.1)
    try {
      const d = frame.contentDocument;
      if (d && !d.__bgAct) {
        d.__bgAct = 1;
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => d.addEventListener(ev, () => BG.activity && BG.activity(), { passive: true, capture: true }));
      }
    } catch (e) {}
    const br = bridge();
    if (!br) return;
    if (c.loads === 1 && c.resume && c.resume.state) {
      const ok = br.restore(c.resume.state);
      if (!ok) BG.toast({ type: 'error', text: 'Kayıt geri yüklenemedi, oyun baştan açıldı.' });
    } else if (c.loads > 1 && c.sessionId) {
      // Oyun kendi "Yeni oyun" düğmesiyle sayfayı yeniledi → yeni kayıt
      detachSession(c);
    }
    c.lastInitial = br.isInitial();
    c.lastFinished = br.isFinished();
    br.setTheme(BG.theme.get());
    if (c.sessionId) {
      c.dirtyFrame = true;
      schedule(60);
    }
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
      } catch (e) {}
    }, 50);
  }

  /* ---------------- Aç / kapat ---------------- */
  host.open = async function (key, opts) {
    opts = opts || {};
    const g = BG.GAMES[key];
    if (!g) return BG.router.go('/', true);
    ensureLayer();
    const wantResume = g.table ? null : opts.resume || null;
    const tq = g.table ? tableQuery(opts.query) : '';
    if (host.cur && host.cur.key === key && (!wantResume || wantResume === host.cur.sessionId || (wantResume === 'yerel' && !BG.isAuthed()))) {
      // Online masa: başka bir masa ya da mod istendiyse oyunu o adresle yeniden aç
      if (!g.table || tq === (host.cur.tq || '')) {
        layer.hidden = false;
        return;
      }
    }
    if (host.cur) await host.close({ silent: true, keepRoute: true });

    const c = (host.cur = {
      key,
      g,
      sessionId: null,
      loads: 0,
      resume: null,
      lastInitial: true,
      lastFinished: false,
      dirtyState: false,
      dirtyFrame: false,
      lastChangeAt: 0,
      lastStateAt: 0,
      inflight: null,
      pumpTimer: null,
      viewers: [],
      viewerCh: null,
      viewersReady: false,
      savedSomething: false,
      returnTo: opts.returnTo || null,
      masa: (opts.query && opts.query.masa) || null,
      tq,
    });

    bar.querySelector('.gb-tile').innerHTML = BG.gameTile(key, 'tile-xs');
    bar.querySelector('.gb-title strong').textContent = g.name;
    bar.querySelector('.gb-help').hidden = false;
    host.tableChat(false);
    setSave('idle');
    paintBadge();
    paintLive();
    layer.hidden = false;
    document.documentElement.classList.add('game-open');
    lockPage(true);
    document.title = g.name + ' · Bözer Gaming';

    if (wantResume && wantResume !== 'yerel' && BG.isAuthed()) {
      try {
        const s = await BG.api.rpc('bg_get_game', { p_id: wantResume });
        if (host.cur !== c) return;
        if (s.game !== key) throw new Error('Bu kayıt farklı bir oyuna ait.');
        let state = s.state;
        const b = BG.ls.get('bg.backup.' + s.id);
        if (b && b.state && b.ts > Date.parse(s.updated_at) + 1500) state = b.state; // çevrimdışıyken kalan son hamleler
        c.resume = { state, status: s.status };
        c.sessionId = s.id;
        c.lastInitial = false;
        c.lastFinished = s.status === 'finished';
        if (s.is_live && s.live_updated_at && Date.now() - Date.parse(s.live_updated_at) < 25000) {
          BG.toast({ type: 'info', title: 'Bu oyun başka bir pencerede de açık olabilir', text: 'Aynı anda iki yerden oynarsan son kaydedilen geçerli olur.' });
        }
        setSave('saved');
      } catch (e) {
        if (host.cur !== c) return;
        BG.toast({ type: 'error', title: 'Kayıt açılamadı', text: e.message });
        BG.router.silentReplace('/oyun/' + key);
      }
    } else if (wantResume === 'yerel' || (wantResume && !BG.isAuthed())) {
      const l = BG.ls.get('bg.local.' + key);
      if (l && l.state) {
        c.resume = { state: l.state, status: l.status };
        c.lastInitial = false;
        c.lastFinished = l.status === 'finished';
        setSave('local');
      }
    }
    if (host.cur !== c) return;
    BG.presence.set(key, c.sessionId);
    if (c.sessionId) {
      watchViewers();
      paintLive();
    }
    frame.setAttribute('src', g.file + '?v=' + encodeURIComponent(BG.config.version || '2') + (tq ? '&' + tq : ''));
  };

  /** Online masa oyunu adresi günceller (masa değişti, izleyici oldu…) */
  host.tableRoute = function (key, q) {
    const c = host.cur;
    if (!c || c.key !== key) return;
    const m = /(?:^|&)masa=([^&]+)/.exec(q || '');
    c.masa = m ? decodeURIComponent(m[1]) : null;
    c.tq = q || '';
    BG.router.silentReplace('/oyun/' + key + (q ? '?' + q : ''));
  };

  /** Kaydı hemen gönder (kapatırken) */
  async function flush(c) {
    if (!c) return;
    const br = bridge();
    if (!br) return;
    if (!BG.isAuthed()) {
      if (!br.isInitial()) saveLocal(c, br);
      return;
    }
    if (br.isInitial() && !c.sessionId) return;
    c.dirtyState = true;
    c.dirtyFrame = true;
    try {
      await pump(true);
    } catch (e) {}
  }

  host.close = async function (opts) {
    opts = opts || {};
    const c = host.cur;
    if (!c) return;
    await flush(c);
    clearTimeout(c.pumpTimer);
    const id = c.sessionId;
    if (id && BG.isAuthed()) BG.api.rpc('bg_end_live', { p_id: id }).catch(() => {});
    unwatchViewers();
    if (host.isFull()) await host.fullscreen(false);
    host.cur = null;
    host.tableChat(false);
    if (frame) frame.setAttribute('src', 'about:blank');
    if (layer) layer.hidden = true;
    document.documentElement.classList.remove('game-open');
    lockPage(false);
    BG.app.paintTitle();
    BG.presence.set(null, null);
    BG.games.invalidate();
    BG.bus.emit('games-changed');
    if (!opts.silent && c.savedSomething) {
      BG.toast({
        type: 'success',
        title: BG.isAuthed() ? 'Oyunun hesabına kaydedildi' : 'Oyunun bu cihaza kaydedildi',
        duration: 4000,
        action: { label: 'Devam et', onClick: () => BG.router.go('/oyun/' + c.key + '?devam=' + (id || 'yerel')) },
      });
    }
  };

  /** Geri düğmesi */
  host.exit = function () {
    if (BG.router.prevPath && !/^\/oyun\//.test(BG.router.prevPath)) history.back();
    else BG.router.go('/', true);
  };

  /** Sekme kapanırken: son durumu yanıt beklemeden gönder */
  host.flushOnHide = function () {
    const c = host.cur;
    const br = bridge();
    if (!c || !br) return;
    try {
      if (!BG.isAuthed()) {
        if (!br.isInitial()) saveLocal(c, br);
        return;
      }
      if (!c.sessionId) return;
      const st = br.getState();
      const meta = br.meta();
      const status = br.isFinished() ? 'finished' : 'active';
      backupLocal(c, st, meta, status);
      BG.api.rpcKeepalive('bg_save_game', {
        p_id: c.sessionId,
        p_title: meta.title || '',
        p_summary: meta.summary || '',
        p_state: st,
        p_status: status,
        p_live: false,
      });
    } catch (e) {}
  };
  /** Sekme gizlenince bekleyen kaydı hemen gönder */
  host.flushSoon = function () {
    const c = host.cur;
    if (c && (c.dirtyState || c.dirtyFrame)) pump(true);
  };
  host.onAuthChanged = function () {
    const c = host.cur;
    if (!c) return;
    setSave(BG.isAuthed() ? (c.sessionId ? 'saved' : 'idle') : 'idle');
    paintLive();
    if (BG.isAuthed()) {
      // misafirken açılan oyun: giriş yapılınca hesaba kaydetmeye başla
      const br = bridge();
      if (br && !br.isInitial()) {
        c.dirtyState = c.dirtyFrame = true;
        schedule(100);
      }
    }
  };
})();
