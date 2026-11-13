/* =====================================================================
   Bözer Gaming 3.1 — BP Mağazası, Görevler, Liderlik tablosu
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};
  const fmt = BG.n0;
  const V = () => encodeURIComponent((BG.config && BG.config.version) || '');

  /* ---------------- emoji ve hediye görselleri ---------------- */
  BG.EMOJI = {
    vip: ['hello_wave', 'applause', 'warm_smile', 'laughing_tears', 'crying', 'angry_tilt', 'shocked', 'cheeky', 'thumbs_up', 'fingers_crossed', 'cool_sunglasses', 'nervous_sweat', 'party_celebration', 'winner_chips', 'bad_beat', 'facepalm'],
    premium: ['hello_wave', 'applause', 'big_smile', 'laughing_tears', 'crying', 'tilt_angry', 'shocked', 'playful_wink', 'thumbs_up', 'fingers_crossed', 'cool_confident', 'nervous_sweat', 'party_celebration', 'champion_trophy', 'bad_luck', 'facepalm'],
    // v3.4: Çılgın Emoji Paketi (hareketli SVG)
    cilgin: ['cl_selam', 'cl_kahkaha', 'cl_kufur', 'cl_sok', 'cl_aglama', 'cl_ask', 'cl_havali', 'cl_para', 'cl_alev', 'cl_oldum', 'cl_palyaco', 'cl_uyku', 'cl_dusunce', 'cl_parti', 'cl_seytan', 'cl_bulanti'],
  };
  BG.EMOJI_NAMES = {
    hello_wave: 'Merhaba', applause: 'Alkış', warm_smile: 'Gülümseme', big_smile: 'Kocaman gülüş', laughing_tears: 'Kahkaha', crying: 'Ağlıyor',
    angry_tilt: 'Sinirli', tilt_angry: 'Sinirli', shocked: 'Şaşkın', cheeky: 'Muzip', playful_wink: 'Göz kırpma', thumbs_up: 'Süper',
    fingers_crossed: 'Şans dile', cool_sunglasses: 'Havalı', cool_confident: 'Havalı', nervous_sweat: 'Gergin', party_celebration: 'Kutlama',
    winner_chips: 'Kazandım', champion_trophy: 'Şampiyon', bad_beat: 'Kötü el', bad_luck: 'Şanssızlık', facepalm: 'Of ya',
    cl_selam: 'Selam', cl_kahkaha: 'Kahkaha', cl_kufur: 'Küfürbaz', cl_sok: 'Şok', cl_aglama: 'Hüngür hüngür', cl_ask: 'Aşık', cl_havali: 'Havalı',
    cl_para: 'Para babası', cl_alev: 'Alev alev', cl_oldum: 'Öldüm', cl_palyaco: 'Palyaço', cl_uyku: 'Uykum geldi', cl_dusunce: 'Hmm…', cl_parti: 'Parti',
    cl_seytan: 'Şeytan', cl_bulanti: 'Midem bulandı',
  };
  /** Hareketli paketler SVG'dir (tek dosya her çözünürlükte keskin) */
  BG.EMOJI_SVG = { cilgin: true, vip: true, premium: true }; // v3.4.1: VIP ve Premium da hareketli SVG
  BG.emojiSrc = (pack, code, x2) => (BG.EMOJI_SVG[pack] ? `assets/emoji/${pack}/${code}.svg?v=${V()}` : `assets/emoji/${pack}/${code}${x2 ? '@2x' : ''}.webp?v=${V()}`);
  BG.emojiImg = (pack, code, size) =>
    `<img class="emo" src="${BG.emojiSrc(pack, code)}"${BG.EMOJI_SVG[pack] ? '' : ` srcset="${BG.emojiSrc(pack, code, true)} 2x"`} alt="${esc(BG.EMOJI_NAMES[code] || code)}" width="${size || 40}" height="${size || 40}" loading="lazy" decoding="async">`;
  BG.GIFTS = ['beer', 'wine', 'whisky', 'raki', 'cocktail', 'poop', 'hotdog', 'hamburger', 'trophy', 'tea', 'coffee', 'flowers', 'baby_bottle', 'gift_box', 'nazar_boncugu', 'okey_token'];
  BG.giftImg = (code, size) =>
    `<img class="gft" src="assets/gifts/${code}.webp" srcset="assets/gifts/${code}@2x.webp 2x" alt="" width="${size || 40}" height="${size || 40}" loading="lazy" decoding="async">`;

  /* =====================================================================
     MAĞAZA
     ===================================================================== */
  const KIND_ORDER = [
    [['emoji'], 'Emoji paketleri', 'İki paketi de alabilirsin; masada kuşandığın paket kullanılır. Emojiler avatarının yanında kısa süre görünür.'],
    [['chat', 'gifter'], 'Sohbet ve hediye', 'Geveze Paketi masa sohbetine yazmayı açar (paketi olmayanlar sohbeti okuyabilir ama yazamaz; arkadaşlarınla özel mesajlaşma ücretsizdir). Gifter Pack ile masadaki herkese animasyonlu hediye gönderirsin; gönderim ücretsizdir, iki hediye arasında 5 saniye beklenir.'],
    [['frame'], 'Profil çerçeveleri', 'Avatarının çevresinde görünür: profilde, arkadaş listesinde ve üç online oyunun masalarında. İstediğin zaman değiştirebilir ya da kapatabilirsin.'],
    [['bg'], 'Profil arka planları', 'Profil kartının arkasında hareketli sahne. Profiline bakan herkes görür; istediğin zaman değiştirebilir ya da kaldırabilirsin.'],
    [['dealer'], 'Blackjack krupiyesi', 'Kuşandığında kurduğun Blackjack masalarında krupiye değişir ve masadaki herkes görür. Çıkarınca krupiye Neriman’a döner. İade edilmez.'],
    [['felt'], 'Blackjack keçeleri', 'Kuşandığın keçe kurduğun Blackjack masalarında herkese görünür. Çıkarınca varsayılan yeşil keçeye döner. İade edilmez.'],
  ];
  // kuşanılabilen ürünler ve çıkarma düğmesinin yazısı
  const EQUIP = { frame: ['frame', 'Çerçeveyi kapat'], emoji: ['emoji_pack', 'Paketi çıkar'], bg: ['bg', 'Arka planı kaldır'], dealer: ['dealer', 'Krupiyeyi çıkar'], felt: ['felt', 'Keçeyi çıkar'] };
  function previewHTML(p) {
    const me = BG.store.me || {};
    if (p.kind === 'emoji') {
      const pack = (p.meta && p.meta.pack) || 'vip';
      return `<div class="sp-emoji">${BG.EMOJI[pack].map((c) => BG.emojiImg(pack, c, 44)).join('')}</div>`;
    }
    if (p.kind === 'gifter') return `<div class="sp-gifts">${BG.GIFTS.map((c) => BG.giftImg(c, 44)).join('')}</div>`;
    if (p.kind === 'chat')
      return `<div class="sp-chat"><div class="sp-bub">${BG.avatar(me, { size: 34 })}<p>İyi oyunlar! 😄 <time>21:04</time></p></div><div class="sp-bub is-r"><p>Rövanş isterim <time>21:05</time></p></div></div>`;
    if (p.kind === 'frame') return `<div class="sp-frame">${BG.avatar(me, { size: 96, frame: p.meta && p.meta.frame })}</div>`;
    if (p.kind === 'bg')
      return `<div class="sp-bgprev">${BG.pbgHTML(p.meta && p.meta.bg)}<div class="sp-bgprev-in">${BG.avatar(me, { size: 58, frame: me.frame })}<span><b>${esc(me.full_name || me.username || 'Sen')}</b><small>${esc(BG.PBG[(p.meta && p.meta.bg) || ''] || '')}</small></span></div></div>`;
    if (p.kind === 'dealer') return `<div class="sp-dealer" style="background-image:url('assets/store/dealer_${esc((p.meta && p.meta.dealer) || 'alev')}.svg?v=${V()}')"><span class="sp-dealer-n">Krupiye ${esc(((p.meta && p.meta.dealer) || 'alev').replace(/^./, (c) => c.toLocaleUpperCase('tr')))}</span></div>`;
    if (p.kind === 'felt') return `<div class="sp-felt" style="background-image:url('assets/store/felt_${esc((p.meta && p.meta.felt) || '')}.svg?v=${V()}')"></div>`;
    return '';
  }
  function cardHTML(p, eq) {
    const eqk = EQUIP[p.kind];
    const equipped = !!(eqk && eq[eqk[0]] === p.id);
    const can = BG.bp.state && BG.bp.state.balance >= p.price;
    let act;
    if (!p.owned) act = `<button class="btn btn-primary sp-buy" type="button" data-buy="${esc(p.id)}" ${p.active ? '' : 'disabled'} aria-label="${fmt(p.price)} BP ile satın al"><span class="sp-buy-p">${icon('coin', 17)}${fmt(p.price)} BP</span><span class="sp-buy-t">Satın al</span></button>${!can ? `<small class="sp-need">${fmt(p.price - ((BG.bp.state && BG.bp.state.balance) || 0))} BP eksik</small>` : ''}`;
    else if (eqk)
      act = `<span class="sp-owned">${icon('check', 15)}SAHİP OLUNDU</span>${equipped ? `<button class="btn btn-soft btn-sm" type="button" data-unequip="${esc(p.kind)}">${eqk[1]}</button>` : `<button class="btn btn-soft btn-sm" type="button" data-equip="${esc(p.id)}" data-kind="${esc(p.kind)}">Kuşan</button>`}`;
    else act = `<span class="sp-owned">${icon('check', 15)}SAHİP OLUNDU</span><small class="muted">Üç online oyunda kalıcı olarak açık</small>`;
    return `<article class="sp-card k-${esc(p.kind)}${p.owned ? ' is-owned' : ''}${equipped ? ' is-equipped' : ''}" data-id="${esc(p.id)}">
        <div class="sp-prev">${previewHTML(p)}${equipped ? `<span class="sp-eq">${icon('check', 13)}Kuşanıldı</span>` : ''}</div>
        <div class="sp-body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <div class="sp-act">${act}</div>
        </div>
      </article>`;
  }
  BG.views.store = function () {
    const root = BG.frag(`<div class="page store">
        <header class="page-head store-head">
          <div><h1>${icon('bag', 26)}Mağaza</h1><p class="page-lead">Ürünler BP ile bir kez alınır ve hesabında kalıcıdır. BP bakiyen düşse de satın aldığın ürünler kaybolmaz.</p></div>
          <div class="store-bal" data-bp-wallet-mini></div>
        </header>
        <div class="store-body"><p class="loading-row">Yükleniyor…</p></div>
      </div>`);
    const box = root.querySelector('.store-body');
    let data = null;
    const paintBal = () => {
      const s = BG.bp.state;
      root.querySelector('[data-bp-wallet-mini]').innerHTML = s ? `<button class="bp-chip lg" type="button" data-bp-open>${BG.rankIcon(s.rank, 22)}<b>${fmt(s.balance)}</b><span class="bp-unit">BP</span></button>` : '';
    };
    function paint() {
      const eq = (data && data.equipped) || {};
      box.innerHTML = KIND_ORDER.map(([kinds, title, lead]) => {
        const list = (data.products || []).filter((p) => kinds.indexOf(p.kind) >= 0);
        if (!list.length) return '';
        return `<section class="sp-sec"><div class="sp-sec-head"><h2>${esc(title)}</h2><p>${esc(lead)}</p></div><div class="sp-grid k-${kinds[0]}">${list.map((p) => cardHTML(p, eq)).join('')}</div></section>`;
      }).join('');
    }
    async function load() {
      try {
        data = await BG.api.rpc('bg_store', {});
        if (!root.isConnected) return;
        paint();
      } catch (e) {
        box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      }
    }
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) {
        const p = data.products.find((x) => x.id === b.dataset.buy);
        if (!p) return;
        const bal = (BG.bp.state && BG.bp.state.balance) || 0;
        const ok = await BG.confirm({
          title: p.name,
          text: `${fmt(p.price)} BP karşılığında satın alınsın mı? Bakiyen ${fmt(bal)} BP → ${fmt(bal - p.price)} BP olur. Ürün hesabında kalıcıdır.`,
          okText: 'Satın al',
        });
        if (!ok) return;
        b.disabled = true;
        try {
          const r = await BG.api.rpc('bg_store_buy', { p_product: p.id });
          BG.bp.setBalance(r.balance);
          await BG.bp.refresh();
          await load();
          const card = box.querySelector(`.sp-card[data-id="${CSS.escape(p.id)}"]`);
          if (card) {
            card.classList.add('just-bought');
            BG.bp.burst(card.querySelector('.sp-prev'), 26);
          }
          const eqk = EQUIP[p.kind];
          const on = !!(eqk && data && data.equipped && data.equipped[eqk[0]] === p.id);
          BG.toast({ type: 'success', title: p.name, text: on ? 'Satın alındı ve kuşanıldı. İstediğin zaman çıkarabilirsin.' : eqk ? 'Satın alındı. Kullanmak için “Kuşan”a dokun.' : 'Satın alındı. Ürün artık hesabında.' });
        } catch (err) {
          BG.toastError(err);
          b.disabled = false;
        }
        return;
      }
      const q = e.target.closest('[data-equip]');
      const u = e.target.closest('[data-unequip]');
      if (q || u) {
        const kind = q ? q.dataset.kind : u.dataset.unequip;
        try {
          data.equipped = await BG.api.rpc('bg_store_equip', { p_kind: kind, p_product: q ? q.dataset.equip : null });
          BG.bp.refresh();
          paint();
          BG.bus.emit('cosmetics', data.equipped);
        } catch (err) {
          BG.toastError(err);
        }
      }
    });
    const off = BG.bus.on('bp', () => {
      paintBal();
    });
    paintBal();
    load();
    return { node: root, cleanup: off };
  };

  /* =====================================================================
     GÖREVLER
     ===================================================================== */
  const MG = [
    ['americano-online', 'Americano'],
    ['dostkazigi-online', 'Dost Kazığı'],
    ['pisti-online', 'Pişti'],
    ['tavla-online', 'Tavla'],
    ['blackjack', 'Blackjack'],
  ];
  BG.views.missions = function (params, query, loc, opts) {
    query = query || {};
    opts = opts || {};
    const root = BG.frag(`<div class="page missions">
        <header class="page-head">
          <div><h1>${icon('target', 26)}Görevler</h1><p class="page-lead">Her oyunun günlük görevleri (oyun başına günde en fazla 25 BP) Türkiye saatiyle 00:00’da yenilenir. Kariyer görevleri kalıcıdır, her basamak bir kez alınır. Görevler yalnızca sunucuda doğrulanmış online maç ve ellerle ilerler.</p></div>
          <button class="btn btn-primary" type="button" data-all hidden>${icon('trophy', 18)}Tümünü al</button>
        </header>
        <nav class="filters m-tabs" role="tablist">${MG.map(([k, n]) => `<button class="filter" role="tab" data-g="${k}">${BG.gameTile(k, 'tile-xs')}${esc(n)}<span class="m-n" data-n="${k}"></span></button>`).join('')}</nav>
        <div class="m-body"><p class="loading-row">Yükleniyor…</p></div>
      </div>`);
    const box = root.querySelector('.m-body');
    let game = MG.some((g) => g[0] === query.oyun) ? query.oyun : 'americano-online';
    let data = null;
    function readyOf(g) {
      if (!data) return 0;
      return (
        data.daily.filter((m) => m.game === g && m.claimable).length +
        data.backlog.filter((m) => m.game === g).length +
        data.career.filter((c) => c.game === g).reduce((a, c) => a + c.tiers.filter((t) => t.done && !t.claimed).length, 0)
      );
    }
    function bar(v, t) {
      const p = Math.max(0, Math.min(100, (v / t) * 100));
      return `<span class="m-bar"><i style="width:${p.toFixed(1)}%"></i></span>`;
    }
    function paint() {
      root.querySelectorAll('[data-g]').forEach((b) => {
        b.classList.toggle('is-on', b.dataset.g === game);
        b.setAttribute('aria-selected', String(b.dataset.g === game));
      });
      MG.forEach(([k]) => (root.querySelector(`[data-n="${k}"]`).innerHTML = BG.countBadge(readyOf(k))));
      root.querySelector('[data-all]').hidden = !(data && data.ready);
      const daily = data.daily.filter((m) => m.game === game);
      const back = data.backlog.filter((m) => m.game === game);
      const career = data.career.filter((c) => c.game === game);
      const reset = new Date(data.resets_at);
      const earnedToday = daily.filter((m) => m.claimed).reduce((a, m) => a + m.reward, 0);
      box.innerHTML = `
        <section class="panel m-sec">
          <div class="m-head"><h2>Günlük görevler</h2><span class="muted small">Bugün alınan: <b>${earnedToday}</b> / 25 BP · Yenilenme: ${esc(BG.fmt.clock(reset))}</span></div>
          <ul class="m-list">${daily
            .map(
              (m) => `<li class="m-it${m.claimed ? ' is-done' : m.claimable ? ' is-ready' : ''}">
                <span class="m-ic">${icon(m.claimed ? 'check' : 'target', 18)}</span>
                <span class="m-t"><b>${esc(m.title)}</b>${bar(m.progress, m.target)}<small>${m.progress} / ${m.target}</small></span>
                <span class="m-r">+${m.reward} BP</span>
                ${m.claimed ? '<span class="m-claimed">Alındı</span>' : `<button class="btn ${m.claimable ? 'btn-primary' : 'btn-soft'} btn-sm" type="button" data-claim="${esc(m.key)}" data-period="${esc(m.period)}" ${m.claimable ? '' : 'disabled'}>ÖDÜLÜ AL</button>`}
              </li>`
            )
            .join('')}</ul>
          ${
            back.length
              ? `<h3 class="m-sub">Önceki günlerden kalan ödüller</h3><ul class="m-list">${back
                  .map((m) => `<li class="m-it is-ready"><span class="m-ic">${icon('history', 18)}</span><span class="m-t"><b>${esc(m.title)}</b><small>${esc(BG.fmt.dateShort(m.period))}</small></span><span class="m-r">+${m.reward} BP</span><button class="btn btn-primary btn-sm" type="button" data-claim="${esc(m.key)}" data-period="${esc(m.period)}">ÖDÜLÜ AL</button></li>`)
                  .join('')}</ul>`
              : ''
          }
        </section>
        <section class="panel m-sec">
          <div class="m-head"><h2>Kariyer görevleri</h2><span class="muted small">Tek seferlik, uzun vadeli hedefler</span></div>
          <div class="m-career">${career
            .map((c) => {
              const next = c.tiers.find((t) => !t.done);
              const ready = c.tiers.filter((t) => t.done && !t.claimed);
              const doneN = c.tiers.filter((t) => t.claimed).length;
              const prev = c.tiers.filter((t) => t.done).slice(-1)[0];
              const lo = prev ? prev.target : 0;
              return `<article class="m-cc${ready.length ? ' is-ready' : ''}">
                  <div class="m-cc-h"><b>${esc(c.title)}</b><span class="muted small">${fmt(c.value)}${next ? ' / ' + fmt(next.target) : ''}</span></div>
                  ${next ? bar(c.value - lo, next.target - lo) : bar(1, 1)}
                  <div class="m-steps" aria-label="Basamaklar">${c.tiers.map((t) => `<span class="m-step${t.claimed ? ' is-claimed' : t.done ? ' is-done' : ''}" title="${fmt(t.target)} → +${t.reward} BP${t.claimed ? ' (alındı)' : ''}"></span>`).join('')}</div>
                  <div class="m-cc-f"><small class="muted">${doneN}/${c.tiers.length} basamak${next ? ` · sıradaki ödül +${next.reward} BP` : ' · hepsi tamam'}</small>
                  ${ready.map((t) => `<button class="btn btn-primary btn-sm" type="button" data-claim="${esc(t.key)}" data-period="career">${fmt(t.target)} · +${t.reward} BP al</button>`).join('')}</div>
                </article>`;
            })
            .join('')}</div>
        </section>`;
    }
    async function load() {
      try {
        data = await BG.api.rpc('bg_missions', {});
        if (!root.isConnected) return;
        paint();
      } catch (e) {
        box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      }
    }
    root.querySelector('.m-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      game = b.dataset.g;
      if (!opts.modal) BG.router.silentReplace('/gorevler?oyun=' + game);
      if (data) paint();
    });
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-claim]');
      if (!b || b.disabled) return;
      b.disabled = true;
      try {
        const r = await BG.api.rpc('bg_mission_claim', { p_key: b.dataset.claim, p_period: b.dataset.period });
        await BG.bp.flyCoins(b, Math.round(r.reward / 3));
        BG.bp.patch({ missions_ready: r.ready });
        BG.bp.setBalance(r.balance);
        BG.bp.toastGain('+' + r.reward + ' BP', 'Görev ödülü hesabına eklendi');
        load();
      } catch (err) {
        BG.toastError(err);
        b.disabled = false;
      }
    });
    root.querySelector('[data-all]').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        const r = await BG.api.rpc('bg_mission_claim_all', {});
        if (r.count) {
          await BG.bp.flyCoins(b, Math.round(r.reward / 3));
          BG.bp.patch({ missions_ready: r.ready });
          BG.bp.setBalance(r.balance);
          BG.bp.toastGain('+' + r.reward + ' BP', r.count + ' görev ödülü hesabına eklendi');
        }
        load();
      } catch (err) {
        BG.toastError(err);
      } finally {
        b.disabled = false;
      }
    });
    load();
    return { node: root };
  };

  /* =====================================================================
     LİDERLİK TABLOSU (ana sayfa)
     ===================================================================== */
  BG.leaderboardHTML = function () {
    return `<section class="hv-group lb" aria-labelledby="lbTitle">
        <div class="lb-head"><h2 class="hv-title" id="lbTitle">${icon('trophy', 20)}Liderlik</h2><span class="lb-me muted small"></span></div>
        <ol class="lb-list"><li class="muted small">Yükleniyor…</li></ol>
      </section>`;
  };
  BG.mountLeaderboard = async function (sec) {
    if (!sec || !BG.isAuthed()) {
      if (sec) sec.hidden = true;
      return;
    }
    let d;
    try {
      d = await BG.api.rpc('bg_leaderboard', { p_limit: 5 });
    } catch (e) {
      sec.hidden = true;
      return;
    }
    if (!sec.isConnected) return;
    const list = sec.querySelector('.lb-list');
    list.innerHTML = (d.top || [])
      .map(
        (x) => `<li class="lb-it${x.me ? ' is-me' : ''}">
          <button type="button" class="lb-btn" data-player="${esc(x.id)}">
            <span class="lb-pos p${x.pos}">${x.pos}</span>
            ${BG.avatar(x, { size: 44, frame: x.frame })}
            <span class="lb-who"><b>${esc(x.full_name || x.username)}</b><span>${BG.rankChip(x.rank)}${BG.prestigeChip(x.prestige, { short: true })}</span></span>
            <span class="lb-bp"><b>${fmt(x.balance)}</b> BP</span>
          </button>
        </li>`
      )
      .join('');
    const me = d.me || {};
    sec.querySelector('.lb-me').textContent = me.pos ? `Senin sıran: ${fmt(me.pos)}.` : '';
  };
})();

/* Oyun açıkken görevler ve liderlik: oyunun üstünde pencere */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.missionsModal = function (game) {
    const v = BG.views.missions({}, { oyun: game }, null, { modal: true });
    v.node.classList.add('in-modal');
    BG.modal({ title: 'Görevler', body: v.node, size: 'l', actions: [{ label: 'Kapat', kind: 'ghost' }] });
  };
  BG.leaderModal = async function () {
    let d;
    try {
      d = await BG.api.rpc('bg_leaderboard', { p_limit: 10 });
    } catch (e) {
      return BG.toastError(e);
    }
    const sec = BG.frag(`<section class="lb in-modal"><ol class="lb-list">${(d.top || [])
      .map(
        (x) => `<li class="lb-it${x.me ? ' is-me' : ''}"><button type="button" class="lb-btn" data-player="${esc(x.id)}">
          <span class="lb-pos p${x.pos}">${x.pos}</span>${BG.avatar(x, { size: 40, frame: x.frame })}
          <span class="lb-who"><b>${esc(x.full_name || x.username)}</b><span>${BG.rankChip(x.rank)}${BG.prestigeChip(x.prestige, { short: true })}</span></span>
          <span class="lb-bp"><b>${BG.n0(x.balance)}</b> BP</span></button></li>`
      )
      .join('')}</ol><p class="muted small">${d.me && d.me.pos ? 'Senin sıran: ' + BG.n0(d.me.pos) + '.' : ''}</p></section>`);
    BG.modal({ title: 'Liderlik · BP', body: sec, size: 'm', actions: [{ label: 'Kapat', kind: 'ghost' }] });
  };
})();
