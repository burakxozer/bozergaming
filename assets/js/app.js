/* =====================================================================
   Bözer Gaming — uygulama kabuğu: başlatma, menüler, oturum, rotalar
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  const app = (BG.app = {});

  /* ---------------- Çevrimiçi durumu (kalp atışı) ---------------- */
  const presence = (BG.presence = { game: null, session: null, timer: null });
  presence.beat = function () {
    if (!BG.isAuthed()) return;
    BG.api.rpc('bg_heartbeat', { p_game: presence.game, p_session: presence.session }).catch(() => {});
  };
  presence.set = function (game, session) {
    presence.game = game || null;
    presence.session = session || null;
    presence.beat();
  };
  presence.start = function () {
    presence.stop();
    presence.beat();
    presence.timer = setInterval(presence.beat, 25000);
  };
  presence.stop = function () {
    clearInterval(presence.timer);
    presence.timer = null;
  };

  /* ---------------- Kabuk ---------------- */
  let view, topbar, tabbar, currentView = null;

  function navLink(href, ic, label, badge, extraClass) {
    return `<a class="nav-link${extraClass ? ' ' + extraClass : ''}" href="#${href}" data-path="${href}">${icon(ic, 20)}<span>${label}</span>${badge ? `<span class="nav-badge" data-badge="${badge}"></span>` : ''}</a>`;
  }

  app.renderShell = function () {
    const me = BG.store.me;
    const authed = BG.isAuthed();
    topbar.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="#/" aria-label="Bözer Gaming ana sayfa">${BG.tile('B', 'amber', 'tile-xs')}<span class="brand-name">Bözer Gaming</span></a>
        <nav class="nav" aria-label="Ana menü">
          ${navLink('/', 'tiles', 'Oyunlar')}
          ${authed ? navLink('/arkadaslar', 'users', 'Arkadaşlar', 'requests') : ''}
          ${authed ? navLink('/mesajlar', 'message', 'Mesajlar', 'unread') : ''}
          ${navLink('/iletisim', 'help', 'İletişim')}
          ${authed && me.is_admin ? navLink('/panel', 'shield', 'Panel', '', 'nav-admin') : ''}
        </nav>
        <div class="top-actions">
          ${
            authed
              ? `<button class="userbtn" type="button" aria-haspopup="menu" aria-expanded="false">${BG.avatar(me, { size: 34 })}<span class="userbtn-name">${esc(String(me.full_name || me.username).split(' ')[0])}</span></button>`
              : `<a class="btn btn-ghost btn-sm" href="#/giris">Giriş yap</a><a class="btn btn-primary btn-sm" href="#/kayit">Kayıt ol</a>`
          }
        </div>
      </div>`;
    tabbar.innerHTML = authed
      ? `${navLink('/', 'tiles', 'Oyunlar')}${navLink('/arkadaslar', 'users', 'Arkadaşlar', 'requests')}${navLink('/mesajlar', 'message', 'Mesajlar', 'unread')}${
          me.is_admin ? navLink('/panel', 'shield', 'Panel') : ''
        }${navLink('/profil', 'user', 'Profil')}`
      : `${navLink('/', 'tiles', 'Oyunlar')}${navLink('/oyunlarim', 'cloud', 'Kayıtlarım')}${navLink('/iletisim', 'help', 'İletişim')}${navLink('/giris', 'login', 'Giriş')}`;
    const ub = topbar.querySelector('.userbtn');
    if (ub) ub.addEventListener('click', userMenu);
    paintActive();
    app.paintBadges();
  };

  function userMenu(e) {
    const btn = e.currentTarget;
    const existing = document.querySelector('.user-menu');
    if (existing) {
      existing.remove();
      btn.setAttribute('aria-expanded', 'false');
      return;
    }
    const me = BG.store.me;
    const menu = BG.frag(`<div class="user-menu" role="menu">
        <div class="um-head">${BG.avatar(me, { size: 44 })}<div><strong>${esc(me.full_name)}</strong><span>@${esc(me.username)}</span></div></div>
        <a role="menuitem" href="#/profil">${icon('user', 18)}Profilim</a>
        <a role="menuitem" href="#/oyunlarim">${icon('cloud', 18)}Kayıtlı oyunlarım</a>
        ${me.is_admin ? `<a role="menuitem" href="#/panel">${icon('shield', 18)}Yönetim paneli</a>` : ''}
        <button role="menuitem" type="button" data-theme-pick>${icon('palette', 18)}Tema</button>
        <button role="menuitem" type="button" class="um-logout">${icon('logout', 18)}Çıkış yap</button>
      </div>`);
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 8 + 'px';
    menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const close = (ev) => {
      if (ev && ev.type === 'keydown' && ev.key !== 'Escape') return;
      if (ev && ev.type === 'pointerdown' && (menu.contains(ev.target) || btn.contains(ev.target))) return;
      menu.remove();
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close);
    };
    menu.addEventListener('click', (ev) => {
      if (ev.target.closest('.um-logout')) BG.auth.logout();
      if (ev.target.closest('a, button')) close();
    });
    setTimeout(() => {
      document.addEventListener('pointerdown', close, true);
      document.addEventListener('keydown', close);
    });
  }

  function paintActive() {
    const cur = BG.router.current ? BG.router.current.path : '/';
    document.querySelectorAll('.nav-link').forEach((a) => {
      const p = a.dataset.path;
      const on = p === '/' ? cur === '/' || cur === '/oyunlarim' : cur === p || cur.indexOf(p + '/') === 0;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  app.paintBadges = function () {
    document.querySelectorAll('[data-badge="unread"]').forEach((b) => (b.innerHTML = BG.countBadge(BG.store.unread)));
    document.querySelectorAll('[data-badge="requests"]').forEach((b) => (b.innerHTML = BG.countBadge(BG.store.requests)));
    app.paintTitle();
  };
  app.paintTitle = function () {
    if (document.documentElement.classList.contains('game-open') || document.documentElement.classList.contains('watch-open')) return;
    const n = (BG.store.unread || 0) + (BG.store.requests || 0);
    document.title = (n ? '(' + n + ') ' : '') + 'Bözer Gaming';
  };

  /* ---------------- Görünüm yerleştirme ---------------- */
  function mount(result) {
    if (currentView && currentView.cleanup) {
      try {
        currentView.cleanup();
      } catch (e) {
        console.error(e);
      }
    }
    currentView = result || null;
    if (!result || !result.node) return;
    view.replaceChildren(result.node);
    window.scrollTo(0, 0);
  }

  function requireAuth(loc) {
    if (BG.isAuthed()) return true;
    BG.router.go('/giris?r=' + encodeURIComponent(loc.raw), true);
    return false;
  }

  function closeLayers(toPath) {
    if (BG.host.isOpen() && !/^\/oyun\//.test(toPath)) BG.host.close();
    if (!/^\/izle\//.test(toPath)) document.documentElement.classList.remove('watch-open');
    BG.closeAllModals();
    const um = document.querySelector('.user-menu');
    if (um) um.remove();
  }

  function routes() {
    const R = BG.router;
    const page = (fn, guard) => (params, query, loc) => {
      closeLayers(loc.path);
      if (guard && !guard(loc)) return;
      mount(fn(params, query, loc));
      paintActive();
    };
    const authed = (loc) => requireAuth(loc);
    const admin = (loc) => {
      if (!requireAuth(loc)) return false;
      if (!BG.isAdmin()) {
        BG.router.go('/', true);
        return false;
      }
      return true;
    };
    R.add('/', page(BG.views.home));
    R.add('/giris', page(BG.views.login));
    R.add('/kayit', page(BG.views.register));
    R.add('/iletisim', page(BG.views.contact));
    R.add('/oyunlarim', page(BG.views.saved));
    R.add('/profil', page(BG.views.profile, authed));
    R.add('/arkadaslar', page(BG.views.friends, authed));
    R.add('/mesajlar', page(BG.views.messages, authed));
    R.add('/mesajlar/:username', page(BG.views.messages, authed));
    R.add('/panel', page(BG.views.admin, admin));
    R.add('/izle/:id', page(BG.views.watch, authed));
    R.add('/oyun/:key', (params, query, loc) => {
      BG.closeAllModals();
      if (!BG.GAMES[params.key]) return BG.router.go('/', true);
      // Arka planda ana sayfa dursun (doğrudan bağlantıyla gelindiyse)
      if (!currentView || !view.firstElementChild) mount(BG.views.home());
      BG.host.open(params.key, { resume: query.devam || null, query });
      paintActive();
    });
  }

  /* ---------------- Oturum ---------------- */
  let mePromise = null;
  app.setMe = function (me) {
    const changedUser = !BG.store.me || !me || BG.store.me.id !== me.id;
    const prevAdmin = BG.store.me && BG.store.me.is_admin;
    BG.store.me = me;
    if (me) {
      BG.store.unread = me.unread || 0;
      BG.store.requests = me.pending_requests || 0;
    }
    if (changedUser || prevAdmin !== (me && me.is_admin)) app.renderShell();
    else {
      const ub = topbar.querySelector('.userbtn');
      if (ub && me) {
        ub.querySelector('.avatar').outerHTML = BG.avatar(me, { size: 34 });
        ub.querySelector('.userbtn-name').textContent = String(me.full_name || me.username).split(' ')[0];
      }
      const tb = tabbar.querySelector('[data-path="/profil"]');
      if (tb) tb.dataset.v = Date.now();
    }
    app.paintBadges();
    BG.bus.emit('me', me);
  };

  /** Profili sunucudan yükle (aynı anda gelen çağrılar tek istekte birleşir) */
  app.loadMe = function (force) {
    if (mePromise && !force) return mePromise;
    mePromise = (async () => {
      const session = await BG.api.getSession();
      BG.store.session = session;
      if (!session) {
        app.clearSession();
        return null;
      }
      let me = null;
      try {
        me = await BG.api.rpc('bg_me', {});
      } catch (e) {
        if (/oturum|giriş/i.test(e.message)) {
          await BG.api.signOut();
          app.clearSession();
          return null;
        }
        throw e;
      }
      if (!me) {
        // Profil yok (hesap silinmiş olabilir)
        await BG.api.signOut();
        app.clearSession();
        BG.toast({ type: 'error', title: 'Hesap bulunamadı', text: 'Bu hesap silinmiş olabilir. Yeniden kayıt olabilirsin.' });
        return null;
      }
      const wasAuthed = BG.isAuthed();
      const sameUser = wasAuthed && BG.store.me.id === me.id;
      app.setMe(me);
      if (!sameUser) app.startSession();
      if (me.must_change_password) setTimeout(BG.auth.promptPasswordChange, 400);
      return me;
    })();
    mePromise.catch(() => {}).finally(() => setTimeout(() => (mePromise = null), 0));
    return mePromise;
  };

  app.startSession = function () {
    presence.start();
    BG.rt.start();
    BG.games.invalidate();
    BG.host.onAuthChanged();
    BG.bus.emit('auth', true);
  };
  app.stopSession = function () {
    presence.stop();
    BG.rt.stop();
    BG.chat.closeDrawer();
  };
  app.clearSession = function () {
    const had = !!BG.store.me;
    app.stopSession();
    BG.store.session = null;
    BG.store.me = null;
    BG.store.friends = [];
    BG.store.unread = 0;
    BG.store.requests = 0;
    BG.games.invalidate();
    if (had) {
      app.renderShell();
      BG.host.onAuthChanged();
      BG.bus.emit('auth', false);
      const cur = BG.router.current;
      if (cur && cur.route && /^\/(profil|arkadaslar|mesajlar|panel|izle)/.test(cur.path)) BG.router.go('/', true);
    }
  };

  /* ---------------- Başlat ---------------- */
  app.start = async function () {
    BG.theme.apply(BG.theme.get());
    view = document.getElementById('view');
    topbar = document.getElementById('topbar');
    tabbar = document.getElementById('tabbar');
    BG.api.init();
    app.renderShell();
    routes();

    BG.bus.on('counts', app.paintBadges);
    BG.bus.on('route', (r) => {
      BG.router.prevPath = r.from ? r.from.path : null;
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-theme-pick]')) BG.pickTheme();
    });

    if (BG.api.ready) {
      try {
        await app.loadMe();
      } catch (e) {
        console.warn('[app] oturum', e);
        BG.toast({ type: 'error', title: 'Sunucuya bağlanılamadı', text: 'Oyunları oynayabilirsin; üyelik özellikleri bağlantı gelince açılır.' });
      }
      BG.api.onAuth((event, session) => {
        // Supabase önerisi: dinleyici içinde başka istek beklenmez
        setTimeout(() => {
          if (event === 'SIGNED_OUT') {
            app.clearSession();
            return;
          }
          if (session) BG.store.session = session;
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && (!BG.store.me || BG.store.me.id !== session.user.id)) app.loadMe(true).catch(() => {});
        }, 0);
      });
    }
    document.documentElement.classList.remove('booting');
    BG.router.resolve();

    // Sekme görünür/gizli
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        presence.beat();
        if (BG.isAuthed()) BG.social.refreshFriends();
      } else {
        BG.host.flushSoon();
      }
    });
    window.addEventListener('pagehide', () => {
      BG.host.flushOnHide();
      if (BG.isAuthed()) BG.api.rpcKeepalive('bg_offline', {});
    });
    window.addEventListener('online', () => {
      BG.store.online = true;
      presence.beat();
    });
    window.addEventListener('offline', () => {
      BG.store.online = false;
      BG.toast({ type: 'error', title: 'İnternet bağlantısı yok', text: 'Oyunların bu cihazda tutuluyor, bağlantı gelince kaydedilecek.' });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.start);
  else app.start();
})();
