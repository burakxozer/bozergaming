/* =====================================================================
   Bözer Gaming 3.0 — görsel ana sayfa
   Eski (yazılı) ana sayfa BG.views.homeClassic olarak korunur; yönetici
   panelinden "Klasik" seçilirse o gösterilir.
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views.homeClassic = BG.views.home;

  /** Ana sayfa görünümü: yönetici ayarı (sunucu) > bu cihazdaki son bilinen değer */
  BG.homeStyle = function () {
    return BG.ls.get('bg.homeStyle', 'yeni') === 'klasik' ? 'klasik' : 'yeni';
  };
  BG.setHomeStyle = function (s) {
    const v = s === 'klasik' ? 'klasik' : 'yeni';
    const was = BG.homeStyle();
    BG.ls.set('bg.homeStyle', v);
    if (was !== v && (location.hash === '' || location.hash === '#/' || location.hash === '#')) BG.bus.emit('home-style');
  };

  /* ---------- Küçük görseller (SVG) ---------- */
  function dartboard() {
    const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const seg = (r0, r1, a0, a1, fill) => {
      const p = (r, a) => [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
      const [x0, y0] = p(r1, a0);
      const [x1, y1] = p(r1, a1);
      const [x2, y2] = p(r0, a1);
      const [x3, y3] = p(r0, a0);
      return `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z" fill="${fill}"/>`;
    };
    let s = '';
    let nums = '';
    order.forEach((n, i) => {
      const a0 = ((i - 0.5) * Math.PI) / 10;
      const a1 = ((i + 0.5) * Math.PI) / 10;
      const dark = i % 2 === 0;
      s += seg(62, 77, a0, a1, dark ? '#1b1b1d' : '#efe3c6');
      s += seg(58, 62, a0, a1, dark ? '#c8202f' : '#1f8a4c');
      s += seg(9, 58, a0, a1, dark ? '#1b1b1d' : '#efe3c6');
      s += seg(36, 40, a0, a1, dark ? '#c8202f' : '#1f8a4c');
      s += seg(73, 77, a0, a1, dark ? '#c8202f' : '#1f8a4c');
      const am = (i * Math.PI) / 10;
      nums += `<text x="${(100 + 88 * Math.sin(am)).toFixed(1)}" y="${(100 - 88 * Math.cos(am) + 4).toFixed(1)}" text-anchor="middle">${n}</text>`;
    });
    return `<svg class="hv-dart" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="99" fill="#141416"/><circle cx="100" cy="100" r="80" fill="#0d0d0f"/>
      ${s}<circle cx="100" cy="100" r="9" fill="#1f8a4c"/><circle cx="100" cy="100" r="4" fill="#c8202f"/>
      <g fill="#e9e3d2" font-size="11" font-weight="700" font-family="inherit">${nums}</g>
      <g transform="translate(118 64) rotate(32)"><rect x="-2" y="-34" width="4" height="30" rx="2" fill="#c9c9cf"/><path d="M-7 -40 L0 -30 L7 -40 L0 -56 Z" fill="var(--accent)"/><rect x="-1" y="-4" width="2" height="10" fill="#e9e9ee"/></g>
    </svg>`;
  }
  const MINI = {
    americano: () => `<svg viewBox="0 0 120 80" aria-hidden="true"><g font-size="8" font-weight="800" text-anchor="middle">
        <rect x="4" y="6" width="112" height="12" rx="3" fill="var(--surface-3)"/>
        ${['Burak', 'Elif', 'Can'].map((n, i) => `<text x="${45 + i * 30}" y="15" fill="var(--muted)">${n}</text>`).join('')}
        ${[['KÜT', '10', '25', '-'], ['SERİ', '35', 'X', '5'], ['ÇİFT', '20', '-', '15']].map((r, j) => `<rect x="4" y="${22 + j * 15}" width="112" height="12" rx="3" fill="var(--surface-2)"/><text x="16" y="${31 + j * 15}" fill="#ff6b6b" font-size="7">${r[0]}</text>${r.slice(1).map((v, i) => `<text x="${45 + i * 30}" y="${31 + j * 15}" fill="var(--text)">${v}</text>`).join('')}`).join('')}
        <rect x="4" y="67" width="112" height="11" rx="3" fill="var(--accent)" opacity=".85"/><text x="45" y="75.5" fill="var(--accent-ink)">65</text><text x="75" y="75.5" fill="var(--accent-ink)">-50</text><text x="105" y="75.5" fill="var(--accent-ink)">-5</text>
      </g></svg>`,
    somali: () => `<svg viewBox="0 0 120 80" aria-hidden="true"><g font-size="22" font-weight="900" text-anchor="middle">
        ${[['#d23a3a', 0], ['#1d1d22', 1], ['#2f6fe0', 2], ['#e0a21d', 3]].map(([c, i]) => `<g transform="translate(${10 + i * 26} ${14 + (i % 2) * 4}) rotate(${(i - 1.5) * 4} 12 20)"><rect x="0" y="0" width="25" height="40" rx="4" fill="#f6efdc" stroke="#cdbf9c"/><text x="12.5" y="26" fill="${c}">7</text><circle cx="12.5" cy="33" r="2.2" fill="${c}"/></g>`).join('')}
        <rect x="10" y="64" width="100" height="6" rx="3" fill="var(--surface-3)"/></g></svg>`,
    lig: () => `<svg viewBox="0 0 120 80" aria-hidden="true">
        <path d="M44 10 H76 V30 A16 16 0 0 1 44 30 Z" fill="var(--accent)"/><path d="M44 14 H34 A10 10 0 0 0 44 30 M76 14 H86 A10 10 0 0 1 76 30" fill="none" stroke="var(--accent)" stroke-width="4"/>
        <rect x="56" y="44" width="8" height="10" fill="var(--accent-shade)"/><rect x="46" y="54" width="28" height="7" rx="2" fill="var(--accent)"/>
        <g fill="var(--surface-3)"><rect x="8" y="66" width="104" height="5" rx="2.5"/><rect x="8" y="74" width="74" height="5" rx="2.5"/></g></svg>`,
    kura: () => `<svg viewBox="0 0 120 80" aria-hidden="true"><g font-size="11" font-weight="900" text-anchor="middle">
        <ellipse cx="60" cy="58" rx="44" ry="16" fill="var(--surface-3)"/>
        ${[['#f5b62a', 34, 46, 7], ['#ec4a43', 58, 38, 3], ['#4a7ff5', 82, 46, 12], ['#3ccf86', 48, 58, 1], ['#b07cf5', 72, 60, 9]].map(([c, x, y, n]) => `<circle cx="${x}" cy="${y}" r="12" fill="${c}"/><circle cx="${x - 4}" cy="${y - 4}" r="3" fill="#fff" opacity=".5"/><text x="${x}" y="${y + 4}" fill="#1a1530">${n}</text>`).join('')}
      </g></svg>`,
  };

  function docBtn(tpl, title) {
    return `<button class="hv-doc" type="button" data-doc="${tpl}" data-title="${esc(title)}" aria-label="${esc(title)}" title="${esc(title)}">${icon('book', 18)}</button>`;
  }

  /* ---------- Görsel ana sayfa ---------- */
  function homeNew() {
    const me = BG.store.me;
    const first = me ? String(me.full_name || me.username).split(' ')[0] : '';
    const root = BG.frag(`
      <div class="page home hv">
        <section class="hv-hero">
          <div class="board" role="img" aria-label="Bözer Gaming">
            <div class="board-row board-main">${BG.flapRow('BÖZER', 'ink')}</div>
            <div class="board-row board-sub">${BG.flapRow('GAMING', 'amber')}</div>
          </div>
          <div class="hv-hello">
            ${
              me
                ? `<h1>Hoş geldin, ${esc(first)}</h1><div class="hv-wallet" data-bp-wallet></div>`
                : `<h1>Oyun masası hazır</h1>
                   <div class="hv-cta"><a class="btn btn-primary" href="#/kayit">${icon('userPlus', 18)}Kayıt ol</a><a class="btn btn-ghost" href="#/giris">${icon('login', 18)}Giriş yap</a></div>`
            }
          </div>
        </section>

        <section class="hv-strip" id="hvLive" hidden>
          <h2 class="hv-label"><span class="live-dot"></span>Şu an oyunda</h2>
          <ul class="hv-live"></ul>
        </section>
        <section class="hv-strip" id="hvResume" hidden>
          <h2 class="hv-label">${icon('play', 16)}Kaldığın yerden</h2>
          <ul class="hv-resume"></ul>
        </section>

        ${me ? BG.leaderboardHTML() : ''}

        <a class="hv-feature" href="#/oyun/blackjack" aria-label="Blackjack Royale masalarına git">
          <img src="assets/shots/blackjack.webp?v=${esc(BG.config.version)}" alt="" loading="eager" decoding="async">
          <span class="hv-feature-shade"></span>
          <span class="hv-feature-copy">
            <span class="hv-new">Yeni</span>
            <span class="hv-feature-title">Blackjack Royale</span>
            <span class="hv-feature-tags"><span>7 koltuk</span><span>Bet Behind</span><span>Jackpot</span></span>
          </span>
          <span class="hv-feature-go btn btn-primary">${icon('users', 18)}Masalar</span>
        </a>

        <section class="hv-group">
          <h2 class="hv-title">Kart masaları</h2>
          <div class="hv-pair">
            <article class="hv-card" data-game="americano-online">
              <a class="hv-shot" href="#/oyun/americano-online?mod=online" tabindex="-1" aria-hidden="true"><img src="assets/shots/americano-online.webp?v=${esc(BG.config.version)}" alt="" loading="lazy" decoding="async"></a>
              ${docBtn('tpl-rules-americano', 'Americano oyun kuralları')}
              <div class="hv-card-body">
                <div class="hv-name">${BG.gameTile('americano-online', 'tile-s')}<h3>Americano Online</h3></div>
                <div class="hv-acts">
                  <a class="btn btn-soft btn-sm" href="#/oyun/americano-online?mod=bot">${icon('play', 16)}Botlara karşı</a>
                  <a class="btn btn-primary btn-sm" href="#/oyun/americano-online?mod=online">${icon('users', 16)}Online</a>
                </div>
              </div>
            </article>
            <article class="hv-card" data-game="dostkazigi-online">
              <a class="hv-shot" href="#/oyun/dostkazigi-online?mod=online" tabindex="-1" aria-hidden="true"><img src="assets/shots/dostkazigi-online.webp?v=${esc(BG.config.version)}" alt="" loading="lazy" decoding="async"></a>
              ${docBtn('tpl-rules-dostkazigi', 'Dost Kazığı oyun kuralları')}
              <div class="hv-card-body">
                <div class="hv-name">${BG.gameTile('dostkazigi-online', 'tile-s')}<h3>Dost Kazığı Online</h3></div>
                <div class="hv-acts">
                  <a class="btn btn-soft btn-sm" href="#/oyun/dostkazigi-online?mod=bot">${icon('play', 16)}Botlara karşı</a>
                  <a class="btn btn-primary btn-sm" href="#/oyun/dostkazigi-online?mod=online">${icon('users', 16)}Online</a>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="hv-group">
          <h2 class="hv-title">Dart</h2>
          <article class="hv-dartcard" data-game="dart">
            <div class="hv-dart-art">${dartboard()}</div>
            <div class="hv-dart-body">
              <div class="hv-dart-head"><h3>Karambol Kriket</h3>
                <a class="hv-yt" href="https://www.youtube.com/watch?v=mSMOEP9QWJk" target="_blank" rel="noopener" title="Nasıl oynanır? (YouTube)" aria-label="Karambol Kriket nasıl oynanır? YouTube’da aç">${icon('play', 14)}Nasıl oynanır</a>
              </div>
              <div class="hv-modes">
                <a class="hv-mode" href="#/oyun/dartbot"><b>Dartbot</b><span>Bota karşı</span></a>
                <a class="hv-mode" href="#/oyun/dart-mac"><b>Maç</b><span>2–4 takım</span></a>
                <a class="hv-mode" href="#/oyun/dart-turnuva"><b>Turnuva</b><span>Eleme</span></a>
                <a class="hv-mode" href="#/oyun/dart-lig"><b>Lig</b><span>Fikstür</span></a>
              </div>
            </div>
          </article>
        </section>

        <section class="hv-group">
          <h2 class="hv-title">Skor tabloları</h2>
          <div class="hv-tools">
            ${[
              ['americano', 'Americano', 'Skor tablosu', 'tpl-info-americano'],
              ['somali', 'Somali', 'Okey hesabı', 'tpl-info-somali'],
              ['lig', 'Lig Oluştur', 'Fikstür, puan durumu', 'tpl-info-lig'],
              ['kura', 'Kura Çek', 'Çekiliş, grup, turnuva', 'tpl-info-kura'],
            ]
              .map(
                ([k, n, t, doc]) => `<article class="hv-tool" data-game="${k}">
                  <a class="hv-tool-link" href="#/oyun/${k}">
                    <span class="hv-tool-art">${MINI[k]()}</span>
                    <span class="hv-tool-name">${esc(n)}</span><span class="hv-tool-tag">${esc(t)}</span>
                  </a>
                  <button class="hv-doc sm" type="button" data-doc="${doc}" data-title="${esc(n)} nasıl kullanılır?" aria-label="${esc(n)} nasıl kullanılır?">${icon('info', 16)}</button>
                </article>`
              )
              .join('')}
          </div>
        </section>
        ${BG.footerHtml()}
      </div>`);

    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-doc]');
      if (d) {
        e.preventDefault();
        BG.showDoc(d.dataset.doc, d.dataset.title);
      }
    });

    const liveSec = root.querySelector('#hvLive');
    const resumeSec = root.querySelector('#hvResume');
    function renderLive() {
      const list = liveSec.querySelector('.hv-live');
      const playing = (BG.store.friends || []).filter((f) => f.relation === 'friend' && f.online && f.game);
      liveSec.hidden = !playing.length;
      list.innerHTML = playing
        .map((f) => {
          const g = BG.GAMES[f.game] || {};
          const watch = f.live && f.session_id ? BG.watchHref(f.game, f.session_id, f.user_id) : '';
          return `<li><${watch ? `a href="${esc(watch)}"` : 'span'} class="hv-live-item" title="${esc((f.full_name || f.username) + ' — ' + (g.activity || 'Oyunda'))}">
              ${BG.avatar(f, { size: 52, online: true })}
              <span class="hv-live-name">${esc(String(f.full_name || f.username).split(' ')[0])}</span>
              <span class="hv-live-game">${watch ? '<span class="live-dot"></span>İzle' : esc(g.name || '')}</span>
            </${watch ? 'a' : 'span'}></li>`;
        })
        .join('');
    }
    async function renderResume() {
      const list = resumeSec.querySelector('.hv-resume');
      let items = [];
      try {
        if (BG.isAuthed()) items = (await BG.games.fetchMine()).filter((r) => r.status === 'active').slice(0, 4);
        else
          items = BG.games
            .localSaves()
            .filter((x) => x.status !== 'finished')
            .slice(0, 4)
            .map((x) => ({ id: 'yerel', game: x.key, title: x.title, status: x.status, updated_at: x.updated_at, local: true }));
      } catch (e) {
        items = [];
      }
      resumeSec.hidden = !items.length;
      list.innerHTML = items
        .map((o) => {
          const g = BG.GAMES[o.game] || {};
          return `<li><a class="hv-resume-item" href="#/oyun/${esc(o.game)}?devam=${esc(o.id)}">${BG.gameTile(o.game, 'tile-s')}
              <span><b>${esc(g.name || o.game)}</b><small>${esc(o.title || BG.fmt.ago(o.updated_at))}</small></span>${icon('next', 18)}</a></li>`;
        })
        .join('');
    }
    function renderWallet() {
      const w = root.querySelector('[data-bp-wallet]');
      if (w && BG.bp && BG.bp.walletHTML) BG.bp.mountWallet(w);
    }

    if (!BG._boardFlipped) {
      BG._boardFlipped = true;
      requestAnimationFrame(() => BG.flipIn(root.querySelector('.board')));
    }
    renderLive();
    renderResume();
    renderWallet();
    if (me) BG.mountLeaderboard(root.querySelector('.lb'));
    const offs = [
      BG.bus.on('friends', renderLive),
      BG.bus.on('games-changed', () => {
        BG.games.invalidate();
        renderResume();
      }),
    ];
    return { node: root, cleanup: () => offs.forEach((f) => f()) };
  }

  /* Yönetici ayarı: ana sayfa görünümü (herkese açık ayar, açılışta bir kez okunur) */
  function syncStyle(tries) {
    if (!BG.api || !BG.api.ready) {
      if ((tries || 0) < 40) setTimeout(() => syncStyle((tries || 0) + 1), 250);
      return;
    }
    BG.api
      .rpc('bg_public_settings', {})
      .then((r) => {
        if (!r) return;
        // v3.2: rütbe tablosu ve masa seviyeleri panelden değişebilir
        if (BG.applyEconSettings) BG.applyEconSettings(r);
        if (r.home_style) BG.setHomeStyle(r.home_style);
        if (BG.bp && BG.bp.state) BG.bp.paint();
      })
      .catch(() => {});
  }
  setTimeout(syncStyle, 0);

  BG.views.home = function () {
    return BG.homeStyle() === 'klasik' ? BG.views.homeClassic() : homeNew();
  };
})();
