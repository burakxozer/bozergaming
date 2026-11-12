/* =====================================================================
   Bözer Gaming — ana sayfa, oyun listesi, kurallar, kayıtlı oyunlar
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { h, esc, icon } = BG;
  BG.views = BG.views || {};

  /* ---------- Kurallar / nasıl kullanılır pencereleri ---------- */
  BG.showDoc = function (tplId, title) {
    const tpl = document.getElementById(tplId);
    if (!tpl) return;
    const body = h('div.doc');
    body.appendChild(tpl.content.cloneNode(true));
    BG.modal({ title, body, size: 'l', actions: [{ label: 'Kapat', kind: 'primary' }] });
  };

  /* ---------- Kayıtlı oyunlar (bulut + bu cihaz) ---------- */
  BG.games = BG.games || {};
  BG.games.cache = null;
  BG.games.fetchMine = async function (force) {
    if (!BG.isAuthed()) return [];
    if (BG.games.cache && !force && Date.now() - BG.games.cache.at < 15000) return BG.games.cache.rows;
    const rows = (await BG.api.rpc('bg_my_games', { p_limit: 60 })) || [];
    BG.games.cache = { at: Date.now(), rows };
    return rows;
  };
  BG.games.invalidate = () => (BG.games.cache = null);
  /** Yarım kalan oyunu kapat: listeden kaldırır, kaldığı yerden devam edilemez */
  BG.games.close = async function (o) {
    const g = BG.GAMES[o.game] || {};
    const ok = await BG.confirm({
      title: 'Oyun kapatılsın mı?',
      text: `${g.name || 'Bu'} oyunu kapatınca kaldığın yerden devam edemezsin.`,
      okText: 'Oyunu kapat',
      danger: true,
    });
    if (!ok) return false;
    try {
      if (o.local) BG.ls.del('bg.local.' + o.game);
      else {
        await BG.api.rpc('bg_delete_game', { p_id: o.id });
        BG.ls.del('bg.backup.' + o.id);
      }
      BG.games.invalidate();
      BG.bus.emit('games-changed');
      BG.toast({ type: 'success', text: 'Oyun kapatıldı' });
      return true;
    } catch (e) {
      BG.toastError(e);
      return false;
    }
  };
  BG.games.localSaves = function () {
    return BG.ls
      .keys('bg.local.')
      .map((k) => Object.assign({ key: k.slice(9) }, BG.ls.get(k, {})))
      .filter((x) => x.state && BG.GAMES[x.key])
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  };

  function resumeItem(o) {
    const g = BG.GAMES[o.game] || {};
    const finished = o.status === 'finished';
    const li = BG.frag(`
      <li class="resume-item">
        <button class="icon-btn resume-close" type="button" aria-label="${esc(g.name || 'Oyunu')} oyununu kapat" title="Oyunu kapat">${icon('x', 18)}</button>
        <a class="resume-link" href="#/oyun/${esc(o.game)}?devam=${esc(o.id)}">
          ${BG.gameTile(o.game, 'tile-s')}
          <span class="resume-text">
            <strong>${esc(g.name || o.game)}${o.local ? '<em class="chip chip-quiet">Bu cihazda</em>' : ''}</strong>
            ${o.title ? `<span class="resume-title">${esc(o.title)}</span>` : ''}
            ${o.summary ? `<span class="resume-sum">${esc(o.summary)}</span>` : ''}
          </span>
          <span class="resume-meta">
            <time>${esc(BG.fmt.ago(o.updated_at))}</time>
            <span class="btn btn-soft btn-sm">${finished ? 'Aç' : 'Devam et'}</span>
          </span>
        </a>
      </li>`);
    li.querySelector('.resume-close').addEventListener('click', () => BG.games.close(o));
    return li;
  }

  /* ---------- Ana sayfa ---------- */
  BG.views.home = function () {
    const me = BG.store.me;
    const first = me ? String(me.full_name || me.username).split(' ')[0] : '';
    const root = BG.frag(`
      <div class="page home">
        <section class="hero ${me ? 'is-member' : ''}">
          <div class="board" role="img" aria-label="Bözer Gaming">
            <div class="board-row board-main">${BG.flapRow('BÖZER', 'ink')}</div>
            <div class="board-row board-sub">${BG.flapRow('GAMING', 'amber')}</div>
          </div>
          <div class="hero-copy">
            ${
              me
                ? `<h1 class="hero-title">Hoş geldin, ${esc(first)}</h1>
                   <p class="hero-lead">Kaldığın yerden devam et ya da yeni bir oyun aç. Oyunların hesabına kaydediliyor, arkadaşların canlı izleyebiliyor.</p>
                   <div class="hv-wallet" data-bp-wallet></div>`
                : `<h1 class="hero-title">Masadaki oyunun skor tablosu</h1>
                   <p class="hero-lead">Americano, Somali, dart ve daha fazlası için skor tut. Üye olursan oyunların hesabına kaydedilir, yarım kalan oyuna her cihazdan devam edersin, arkadaşların seni canlı izler.</p>
                   <div class="hero-cta">
                     <a class="btn btn-primary btn-lg" href="#/kayit">${icon('userPlus')}Kayıt ol</a>
                     <a class="btn btn-ghost btn-lg" href="#/giris">${icon('login')}Giriş yap</a>
                   </div>
                   <p class="hero-note">Üye olmadan da tüm oyunları oynayabilirsin.</p>`
            }
          </div>
        </section>

        ${me ? `<div class="section">${BG.leaderboardHTML()}</div>` : ''}

        <section class="section" id="liveNow" hidden>
          <div class="section-head"><h2>Şu an oyunda</h2><a class="link" href="#/arkadaslar">Arkadaşlar</a></div>
          <ul class="live-list"></ul>
        </section>

        <section class="section" id="resume" hidden>
          <div class="section-head"><h2>Kaldığın yerden devam et</h2><a class="link" href="#/oyunlarim">Tüm kayıtlı oyunlar</a></div>
          <ul class="resume-list"></ul>
        </section>

        <section class="section">
          <div class="section-head"><h2>Oyunlar</h2></div>
          <div class="games">
            <article class="game-row" data-game="americano">
              <div class="game-glyph">${BG.gameTile('americano', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Americano</h3>
                <p class="game-desc">Puan ve strateji oyunu. Kural elleri, cezalar, joker kurası ve kazanma şansları tek tabloda.</p>
                <div class="chips"><span class="chip">2–5 oyuncu</span><span class="chip">106 kağıt</span></div>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <a class="btn btn-primary" href="#/oyun/americano">${icon('play', 18)}Oyna</a>
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-rules-americano" data-title="Americano oyun kuralları">${icon('book', 18)}Kurallar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-info-americano" data-title="Americano skor tablosu nasıl kullanılır?">${icon('info', 18)}Nasıl kullanılır</button>
              </div>
            </article>

            <article class="game-row game-row-dart" data-game="dart">
              <div class="game-glyph">${BG.gameTile('dartbot', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Dart</h3>
                <p class="game-desc">Karambol Kriket için skor tablosu, turnuva ağacı ve seviyeli dart botu.</p>
                <ul class="modes">
                  <li class="mode">
                    <div><strong>Dartbot</strong><span>Bota karşı Karambol Kriket, 11 seviye</span></div>
                    <div class="mode-actions">
                      <button class="icon-btn" type="button" data-doc="tpl-info-dartbot" data-title="Dartbot nasıl oynanır?" aria-label="Dartbot nasıl oynanır">${icon('info')}</button>
                      <a class="btn btn-primary btn-sm" href="#/oyun/dartbot">${icon('play', 16)}Başla</a>
                    </div>
                  </li>
                  <li class="mode">
                    <div><strong>Turnuva</strong><span>Eleme sistemi, en fazla 8 takım, otomatik eşleşme</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/dart-turnuva">${icon('play', 16)}Başla</a></div>
                  </li>
                  <li class="mode">
                    <div><strong>Maç</strong><span>Hızlı skor takibi, en fazla 4 takım</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/dart-mac">${icon('play', 16)}Başla</a></div>
                  </li>
                  <li class="mode">
                    <div><strong>Lig</strong><span>Takımları kurayla eşle, fikstürdeki maçları dart tahtasında oyna</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/dart-lig">${icon('play', 16)}Başla</a></div>
                  </li>
                </ul>
                <a class="yt-card" href="https://www.youtube.com/watch?v=mSMOEP9QWJk" target="_blank" rel="noopener" aria-label="Karambol Kriket nasıl oynanır? Videoyu YouTube’da aç (yeni sekme)">
                  <span class="yt-thumb" aria-hidden="true"><span class="yt-play">${icon('play', 20)}</span></span>
                  <span class="yt-text">
                    <strong>Karambol Kriket nasıl oynanır?</strong>
                    <span class="yt-src">YouTube’da izle${icon('external', 14)}</span>
                  </span>
                </a>
                <p class="game-resume" hidden></p>
              </div>
            </article>

            <article class="game-row" data-game="blackjack">
              <div class="game-glyph">${BG.gameTile('blackjack', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Blackjack Royale</h3>
                <p class="game-desc">7 pozisyonlu canlı blackjack masası. Bözer Points ile bahis, izleyiciler için Bet Behind ve jackpot.</p>
                <ul class="modes">
                  <li class="mode">
                    <div><strong>Online</strong><span>Bronze, Silver ve Gold masalar; arkadaşlarınla otur ya da izle</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/blackjack">${icon('users', 16)}Masalar</a></div>
                  </li>
                </ul>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-rules-blackjack" data-title="Blackjack Royale oyun kuralları">${icon('book', 18)}Kurallar</button>
              </div>
            </article>

            <article class="game-row" data-game="americano-online">
              <div class="game-glyph">${BG.gameTile('americano-online', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Americano Online</h3>
                <p class="game-desc">Americano’yu kartlarla oyna: iki deste, iki Job, on dört el. Botlara karşı ya da arkadaşlarınla aynı masada.</p>
                <ul class="modes">
                  <li class="mode">
                    <div><strong>Botlara karşı</strong><span>2–5 kişilik masa, süreleri ve bot hızını sen seç</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/americano-online?mod=bot">${icon('play', 16)}Başla</a></div>
                  </li>
                  <li class="mode">
                    <div><strong>Online</strong><span>Masa kur ya da katıl, koltuğunu seç, herkes hazır olunca başla</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/americano-online?mod=online">${icon('users', 16)}Masalar</a></div>
                  </li>
                </ul>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-rules-americano" data-title="Americano oyun kuralları">${icon('book', 18)}Kurallar</button>
              </div>
            </article>

            <article class="game-row" data-game="dostkazigi-online">
              <div class="game-glyph">${BG.gameTile('dostkazigi-online', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Dost Kazığı Online</h3>
                <p class="game-desc">Eşli kart oyunu: kartlarını rakiplerin önüne kitle, kendi önünü boşalt. En az puanla kalan takım kazanır.</p>
                <ul class="modes">
                  <li class="mode">
                    <div><strong>Botlara karşı</strong><span>4, 6 ya da 8 kişilik masa, eşin ve rakiplerin bot</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/dostkazigi-online?mod=bot">${icon('play', 16)}Başla</a></div>
                  </li>
                  <li class="mode">
                    <div><strong>Online</strong><span>Masa kur ya da katıl, eşinin karşısına otur, hazır ol</span></div>
                    <div class="mode-actions"><a class="btn btn-primary btn-sm" href="#/oyun/dostkazigi-online?mod=online">${icon('users', 16)}Masalar</a></div>
                  </li>
                </ul>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-rules-dostkazigi" data-title="Dost Kazığı oyun kuralları">${icon('book', 18)}Kurallar</button>
              </div>
            </article>

            <article class="game-row" data-game="kura">
              <div class="game-glyph">${BG.gameTile('kura', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Kura Çek</h3>
                <p class="game-desc">Çekiliş yap, rastgele gruplar oluştur ya da eleme usulü turnuva kur.</p>
                <div class="chips"><span class="chip">Çekiliş</span><span class="chip">Grup kurası</span><span class="chip">Turnuva</span></div>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <a class="btn btn-primary" href="#/oyun/kura">${icon('play', 18)}Aç</a>
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-info-kura" data-title="Kura Çek nasıl kullanılır?">${icon('info', 18)}Nasıl kullanılır</button>
              </div>
            </article>

            <article class="game-row" data-game="lig">
              <div class="game-glyph">${BG.gameTile('lig', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Lig Oluştur</h3>
                <p class="game-desc">İstediğin sayıda takımla lig kur, fikstürü oyna, puan durumunu takip et.</p>
                <div class="chips"><span class="chip">Tek / çift karşılaşma</span><span class="chip">Puan durumu</span></div>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <a class="btn btn-primary" href="#/oyun/lig">${icon('play', 18)}Aç</a>
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-info-lig" data-title="Lig Oluştur nasıl kullanılır?">${icon('info', 18)}Nasıl kullanılır</button>
              </div>
            </article>

            <article class="game-row" data-game="somali">
              <div class="game-glyph">${BG.gameTile('somali', 'tile-l')}</div>
              <div class="game-main">
                <h3 class="game-name">Somali</h3>
                <p class="game-desc">Okey tabanlı bahis oyunu. Düz, okey ve gösterge işlemleri; tur tur hesap.</p>
                <div class="chips"><span class="chip">Tekli</span><span class="chip">Eşli</span></div>
                <p class="game-resume" hidden></p>
              </div>
              <div class="game-actions">
                <a class="btn btn-primary" href="#/oyun/somali">${icon('play', 18)}Oyna</a>
                <button class="btn btn-ghost btn-sm" type="button" data-doc="tpl-info-somali" data-title="Somali skor tablosu nasıl kullanılır?">${icon('info', 18)}Nasıl kullanılır</button>
              </div>
            </article>
          </div>
        </section>
        ${BG.footerHtml()}
      </div>`);

    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-doc]');
      if (d) BG.showDoc(d.dataset.doc, d.dataset.title);
    });

    const liveSec = root.querySelector('#liveNow');
    const resumeSec = root.querySelector('#resume');

    function renderLive() {
      const list = liveSec.querySelector('.live-list');
      const playing = (BG.store.friends || []).filter((f) => f.relation === 'friend' && f.online && f.game);
      liveSec.hidden = !playing.length;
      list.innerHTML = '';
      playing.forEach((f) => {
        const g = BG.GAMES[f.game] || {};
        list.appendChild(
          BG.frag(`<li class="live-item">
            ${BG.avatar(f, { size: 44, online: true })}
            <span class="live-text"><strong>${esc(f.full_name || f.username)}</strong><span>${esc(g.activity || 'Oyunda')}</span></span>
            ${
              f.live && f.session_id
                ? `<a class="btn btn-live btn-sm" href="${esc(BG.watchHref(f.game, f.session_id, f.user_id))}"><span class="live-dot"></span>İzle</a>`
                : `<span class="muted small">Hazırlanıyor</span>`
            }
          </li>`)
        );
      });
    }

    async function renderResume() {
      const list = resumeSec.querySelector('.resume-list');
      let items = [];
      if (BG.isAuthed()) {
        try {
          const rows = await BG.games.fetchMine();
          items = rows.filter((r) => r.status === 'active').slice(0, 3);
          // Oyun satırlarında "devam eden oyun" ipucu
          root.querySelectorAll('.game-row').forEach((row) => {
            const key = row.dataset.game;
            const hit = rows.find((r) => r.status === 'active' && (r.game === key || (key === 'dart' && BG.GAMES[r.game] && BG.GAMES[r.game].group === 'dart')));
            const p = row.querySelector('.game-resume');
            if (hit) {
              p.hidden = false;
              p.innerHTML = `${icon('cloudCheck', 16)}<a href="#/oyun/${esc(hit.game)}?devam=${esc(hit.id)}">Devam eden ${esc(BG.GAMES[hit.game].name)} oyunun var</a><time>${esc(BG.fmt.ago(hit.updated_at))}</time>`;
            } else p.hidden = true;
          });
        } catch (e) {
          items = [];
        }
      } else {
        items = BG.games.localSaves()
          .filter((x) => x.status !== 'finished')
          .slice(0, 3)
          .map((x) => ({ id: 'yerel', game: x.key, title: x.title, summary: x.summary, status: x.status, updated_at: x.updated_at, local: true }));
      }
      list.innerHTML = '';
      items.forEach((o) => list.appendChild(resumeItem(o)));
      resumeSec.hidden = !items.length;
    }

    if (!BG._boardFlipped) {
      BG._boardFlipped = true;
      requestAnimationFrame(() => BG.flipIn(root.querySelector ? root.querySelector('.board') : null));
    }
    renderLive();
    renderResume();
    if (me) {
      const w = root.querySelector('[data-bp-wallet]');
      if (w) BG.bp.mountWallet(w);
      BG.mountLeaderboard(root.querySelector('.lb'));
    }
    const offs = [BG.bus.on('friends', renderLive), BG.bus.on('games-changed', () => { BG.games.invalidate(); renderResume(); })];
    return { node: root, cleanup: () => offs.forEach((f) => f()) };
  };

  /* ---------- Kayıtlı oyunlarım ---------- */
  BG.views.saved = function () {
    const root = BG.frag(`
      <div class="page">
        <header class="page-head">
          <div><h1>Kayıtlı oyunlarım</h1><p class="page-lead">${
            BG.isAuthed()
              ? 'Oyunların her hamlede hesabına kaydedilir. Sekmeyi kapatsan da buradan kaldığın yerden devam edebilirsin.'
              : 'Bu liste sadece bu cihazda tutulur. Üye olursan oyunların hesabına kaydedilir ve her cihazdan devam edebilirsin.'
          }</p></div>
        </header>
        <div class="filters" role="tablist">
          <button class="filter is-on" data-f="all" role="tab" aria-selected="true">Tümü</button>
          <button class="filter" data-f="active" role="tab" aria-selected="false">Devam eden</button>
          <button class="filter" data-f="finished" role="tab" aria-selected="false">Biten</button>
        </div>
        <div class="panel"><ul class="saved-list"><li class="loading-row">Yükleniyor…</li></ul></div>
        ${BG.isAuthed() ? '' : `<div class="callout">${icon('cloud')}<p><strong>Oyunların kaybolmasın.</strong> Üye olduğunda oyunların hesabına kaydedilir.</p><a class="btn btn-primary btn-sm" href="#/kayit">Kayıt ol</a></div>`}
        ${BG.footerHtml()}
      </div>`);
    const list = root.querySelector('.saved-list');
    let filter = 'all';
    let rows = [];

    function draw() {
      const shown = rows.filter((r) => filter === 'all' || r.status === filter);
      list.innerHTML = '';
      if (!shown.length) {
        list.innerHTML = `<li class="empty">${BG.tile('?', 'ink', 'tile-s')}<p>${
          filter === 'finished' ? 'Henüz biten oyunun yok.' : 'Kayıtlı oyunun yok. Bir oyun açtığında otomatik kaydedilir.'
        }</p><a class="btn btn-soft btn-sm" href="#/">Oyunlara göz at</a></li>`;
        return;
      }
      shown.forEach((r) => {
        const g = BG.GAMES[r.game] || {};
        const li = BG.frag(`
          <li class="saved-row">
            ${BG.gameTile(r.game, 'tile-s')}
            <div class="saved-text">
              <strong>${esc(g.name || r.game)}
                ${r.status === 'finished' ? '<em class="chip chip-done">Bitti</em>' : '<em class="chip chip-active">Devam ediyor</em>'}
                ${r.is_live ? '<em class="chip chip-live"><span class="live-dot"></span>Canlı</em>' : ''}
              </strong>
              ${r.title ? `<span>${esc(r.title)}</span>` : ''}
              ${r.summary ? `<span class="muted">${esc(r.summary)}</span>` : ''}
            </div>
            <time class="muted small" title="${esc(new Date(r.updated_at).toLocaleString('tr-TR'))}">${esc(BG.fmt.ago(r.updated_at))}</time>
            <div class="saved-actions">
              <a class="btn btn-primary btn-sm" href="#/oyun/${esc(r.game)}?devam=${esc(r.id)}">${r.status === 'finished' ? 'Aç' : 'Devam et'}</a>
              <button class="icon-btn danger" type="button" aria-label="Kaydı sil">${icon('trash')}</button>
            </div>
          </li>`);
        li.querySelector('.danger').addEventListener('click', async () => {
          const ok = await BG.confirm({ title: 'Kayıt silinsin mi?', text: `${g.name || 'Oyun'} kaydı kalıcı olarak silinecek.`, okText: 'Sil', danger: true });
          if (!ok) return;
          try {
            if (r.local) BG.ls.del('bg.local.' + r.game);
            else {
              await BG.api.rpc('bg_delete_game', { p_id: r.id });
              BG.ls.del('bg.backup.' + r.id);
            }
            rows = rows.filter((x) => x !== r);
            BG.bus.emit('games-changed');
            draw();
            BG.toast({ type: 'success', text: 'Kayıt silindi' });
          } catch (e) {
            BG.toastError(e);
          }
        });
        list.appendChild(li);
      });
    }

    root.querySelectorAll('.filter').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.f;
        root.querySelectorAll('.filter').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-selected', String(x === b));
        });
        draw();
      })
    );

    (async () => {
      try {
        if (BG.isAuthed()) rows = await BG.games.fetchMine(true);
        else
          rows = BG.games.localSaves().map((x) => ({
            id: 'yerel', game: x.key, title: x.title, summary: x.summary, status: x.status || 'active', updated_at: x.updated_at, local: true,
          }));
        draw();
      } catch (e) {
        list.innerHTML = `<li class="empty"><p>${esc(e.message)}</p></li>`;
      }
    })();
    return { node: root };
  };

  /* ---------- Alt bilgi ---------- */
  BG.footerHtml = function () {
    return `<footer class="site-foot">
      <div class="foot-brand">${BG.tile('B', 'amber', 'tile-xs')}<span>Bözer Gaming</span></div>
      <nav class="foot-links">
        <a href="#/iletisim">İletişim</a>
        <button type="button" class="link-btn" data-theme-pick>${BG.icon('palette', 16)}Tema</button>
      </nav>
      <span class="foot-ver">v${esc(BG.config.version || '2.0.0')}</span>
    </footer>`;
  };
})();
