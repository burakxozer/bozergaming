/* =====================================================================
   Bözer Gaming 3.1 — BP Economy (istemci)
   Bakiye, rütbe, prestij, günlük bonus, bekleyen ödüller, Friend Coins,
   bildirim merkezi ve BP hareketleri. Bütün değerler sunucudan gelir;
   burada yalnızca gösterilir ve Realtime ile anlık izlenir.
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  const econ = (BG.econ = BG.bp = { state: null, ch: null, busy: false, unread: 0 });
  const fmt = BG.n0;
  econ.fmt = fmt;

  const KIND = {
    welcome: 'Başlangıç BP’si',
    daily: 'Günlük bonus',
    admin: 'Yönetici işlemi',
    store: 'Mağaza satın alma',
    gift: 'Hediye (eski sistem)',
    fc_convert: 'Friend Coins → BP',
    am_fee: 'Americano masa ücreti',
    am_prize: 'Americano maç ödülü',
    am_refund: 'Americano ücret iadesi',
    am_mission: 'Americano görev ödülü',
    dk_fee: 'Dost Kazığı masa ücreti',
    dk_prize: 'Dost Kazığı maç ödülü',
    dk_refund: 'Dost Kazığı ücret iadesi',
    dk_mission: 'Dost Kazığı görev ödülü',
    bj_bet: 'Blackjack bahsi',
    bj_extra: 'Blackjack ek bahis (double/split)',
    bj_win: 'Blackjack kazancı',
    bj_return: 'Blackjack bahis iadesi (berabere/teslim)',
    bj_refund: 'Blackjack iadesi (tur iptali)',
    bj_insurance: 'Blackjack sigorta',
    bj_bb: 'Bet Behind',
    bj_jackpot: 'Jackpot ödülü',
    bj_mission: 'Blackjack görev ödülü',
  };
  const GAME = { 'americano-online': 'Americano', 'dostkazigi-online': 'Dost Kazığı', blackjack: 'Blackjack' };
  econ.kindLabel = (k) => KIND[k] || k;
  econ.gameLabel = (g) => GAME[g] || 'Site';
  // v3.2: Blackjack seviyeleri panelden gelir (bakiye eşiği ve bahis değerleri)
  const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  // v3.3: fiş değeri + en düşük / en yüksek bahis (eski kayıt biçimi — bahis listesi — da okunur)
  const tiers = () =>
    (BG.publicSettings && BG.publicSettings.bj_tiers) || {
      bronze: { min_balance: 0, chip: 10, min_bet: 10, max_bet: 50 },
      silver: { min_balance: 0, chip: 20, min_bet: 20, max_bet: 100 },
      gold: { min_balance: 4000, chip: 50, min_bet: 50, max_bet: 300 },
    };
  const tierMax = (t) => (t.max_bet != null ? +t.max_bet : Math.max(0, ...(t.bets || [0])));
  /** Bakiyenin yettiği en yüksek bahis (oturabildiği seviyeler içinde) */
  econ.maxBetFor = (bal) => {
    let m = 0;
    Object.values(tiers()).forEach((t) => {
      if ((t.min_balance || 0) <= bal) m = Math.max(m, tierMax(t));
    });
    return m || 10;
  };
  econ.tierText = (bal) => {
    let best = 'bronze';
    ['bronze', 'silver', 'gold'].forEach((k) => {
      if ((tiers()[k] || {}).min_balance <= bal) best = k;
    });
    return `Blackjack: ${TIER_NAME[best]} kademesi · ${fmt(econ.maxBetFor(bal))} BP’ye kadar bahis`;
  };
  econ.owns = (id) => !!(econ.state && (econ.state.owned || []).indexOf(id) >= 0);
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- durum ---------------- */
  econ.refresh = async function () {
    if (!BG.isAuthed()) {
      econ.state = null;
      econ.paint();
      return null;
    }
    const before = econ.state;
    try {
      econ.state = await BG.api.rpc('bg_bp_wallet', {});
    } catch (e) {
      econ.state = econ.state || null;
    }
    if (econ.state) econ.unread = econ.state.unread || 0;
    econ.paint(before ? before.balance : null);
    if (before && econ.state && econ.state.best_rank > before.best_rank) econ.rankUp(econ.state.best_rank);
    return econ.state;
  };
  econ.setBalance = function (b) {
    if (!econ.state) return;
    const old = econ.state.balance;
    econ.state.balance = Number(b) || 0;
    econ.state.max_bet = econ.maxBetFor(econ.state.balance);
    econ.state.rank = BG.rankOf(econ.state.balance);
    econ.state.max_fee = BG.rankInfo(econ.state.rank).maxFee;
    const best = econ.state.best_rank || 1;
    if (econ.state.rank > best) {
      econ.state.best_rank = econ.state.rank;
      econ.rankUp(econ.state.rank);
    }
    econ.paint(old);
  };
  econ.patch = function (o) {
    if (!econ.state) return;
    Object.assign(econ.state, o || {});
    econ.paint();
  };

  econ.claimDaily = async function (btn) {
    if (econ.busy) return;
    econ.busy = true;
    try {
      const r = await BG.api.rpc('bg_bp_daily', {});
      if (btn) econ.burst(btn);
      econ.patch({ daily_ready: false, daily_next: r.daily_next });
      econ.setBalance(r.balance);
      econ.toastGain('+' + fmt(r.amount) + ' BP', 'Günlük bonus hesabına eklendi');
    } catch (e) {
      BG.toastError(e);
      econ.refresh();
    } finally {
      econ.busy = false;
    }
  };

  /* ---------------- efektler ---------------- */
  /** Altın parçacık efekti (azaltılmış hareket tercihinde çalışmaz) */
  econ.burst = function (el, n) {
    if (!el || reduce()) return;
    const r = el.getBoundingClientRect();
    const count = n || 16;
    for (let i = 0; i < count; i++) {
      const d = document.createElement('span');
      d.className = 'bp-spark';
      d.style.left = r.left + r.width / 2 + 'px';
      d.style.top = r.top + r.height / 2 + 'px';
      document.body.appendChild(d);
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const dist = 40 + Math.random() * 50;
      d.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 20}px)) scale(.4)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }
      ).onfinish = () => d.remove();
    }
  };
  /** Bir öğeden üst menüdeki BP rozetine uçan jetonlar */
  econ.flyCoins = function (fromEl, count) {
    const to = document.querySelector('.topbar .bp-chip') || document.querySelector('[data-bp-wallet]');
    if (!fromEl || !to || reduce()) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const n = Math.max(4, Math.min(14, count || 8));
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'bp-fly';
      c.innerHTML = icon('coin', 18);
      document.body.appendChild(c);
      const sx = a.left + a.width / 2 + (Math.random() - 0.5) * a.width * 0.5;
      const sy = a.top + a.height / 2 + (Math.random() - 0.5) * 20;
      const ex = b.left + b.width / 2;
      const ey = b.top + b.height / 2;
      const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 160;
      const my = Math.min(sy, ey) - 80 - Math.random() * 60;
      const anim = c.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) scale(.6)`, opacity: 0 },
          { transform: `translate(${mx}px, ${my}px) scale(1.15)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${ex}px, ${ey}px) scale(.5)`, opacity: 0.9 },
        ],
        { duration: 760 + i * 55, delay: i * 45, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' }
      );
      jobs.push(new Promise((res) => (anim.onfinish = () => (c.remove(), res()))));
    }
    return Promise.all(jobs).then(() => {
      to.classList.remove('bp-pop');
      void to.offsetWidth;
      to.classList.add('bp-pop');
    });
  };
  econ.toastGain = function (big, text) {
    BG.toast({ type: 'success', title: big, text });
  };
  /** Yeni rütbe kutlaması (her rütbe için bir kez) */
  econ.rankUp = function (rank) {
    const me = BG.store.me;
    if (!me || !rank) return;
    const key = 'bg.rankfx.' + me.id;
    const shown = Number(BG.ls.get(key, 0)) || 0;
    if (rank <= shown) return;
    BG.ls.set(key, rank);
    if (rank <= 1) return;
    const r = BG.rankInfo(rank);
    const ov = BG.frag(`<div class="rankup g${r.grp}" style="${BG.rankStyle(r)}" role="dialog" aria-label="Yeni rütbe: ${esc(r.name)}">
        <div class="rankup-card">
          <div class="rankup-rays" aria-hidden="true"></div>
          <div class="rankup-ic">${BG.rankIcon(rank, 120)}</div>
          <p class="rankup-k">Yeni rütbe</p>
          <h2 class="rankup-name">${esc(r.name)}</h2>
          <p class="rankup-sub">${r.group ? esc(r.group) + ' · ' : ''}${BG.publicSettings && BG.publicSettings.am_rank_lock ? '' : 'Dost Kazığı’nda '}${r.maxFee} BP’ye kadar masa açabilirsin</p>
          <div class="rankup-acts"><a class="btn btn-ghost" href="#/rutbeler">Rütbeleri gör</a><button class="btn btn-primary" type="button">Harika</button></div>
        </div>
      </div>`);
    document.body.appendChild(ov);
    const close = () => {
      ov.classList.add('is-out');
      setTimeout(() => ov.remove(), 400);
    };
    ov.addEventListener('click', close);
    setTimeout(close, 5200);
    requestAnimationFrame(() => {
      ov.classList.add('is-in');
      econ.burst(ov.querySelector('.rankup-ic'), 28);
    });
  };

  /* ---------------- v3.2: haftalık BP desteği ----------------
     Bakiye hafta içinde eşiğe (100) indiyse Pazartesi 00:00 – Pazar 23:59 arasında bir kez talep edilir.
     Talep et → 2 sn yükleme animasyonu → BP hesaba yüklenir. */
  econ.weeklyHTML = function (where) {
    const s = econ.state;
    const w = s && s.weekly;
    if (!w || !w.enabled || !w.eligible) return '';
    const end = w.week_end ? new Date(w.week_end) : null;
    return `<div class="bp-weekly${where ? ' is-' + where : ''}" data-weekly role="region" aria-label="Haftalık BP desteği">
        <span class="bpw-ic" aria-hidden="true">${icon('coin', 26)}</span>
        <div class="bpw-t"><b>Haftalık ${fmt(w.amount)} BP desteği</b>
          <span>BP bakiyen bu hafta ${fmt(w.threshold)} ve altına indi. Bu hafta bir kez ${fmt(w.amount)} BP talep edebilirsin${end ? ` · ${esc(BG.fmt.dateShort(new Date(end.getTime() - 60000)))} 23:59’a kadar` : ''}.</span></div>
        <button class="btn btn-primary bpw-go" type="button" data-weekly-claim>${icon('gift', 17)}Talep et</button>
        <div class="bpw-load" aria-hidden="true"><i></i></div>
      </div>`;
  };
  econ.claimWeekly = async function (btn) {
    if (econ.busy) return;
    const card = btn.closest('[data-weekly]');
    const w = (econ.state && econ.state.weekly) || {};
    econ.busy = true;
    btn.disabled = true;
    if (card) {
      card.classList.add('is-loading');
      card.querySelector('.bpw-t').innerHTML = `<b>${fmt(w.amount || 0)} BP yükleniyor…</b><span>Bakiyen hazırlanıyor, birkaç saniye sür.</span>`;
      btn.innerHTML = '<span class="bpw-spin" aria-hidden="true"></span>Yükleniyor';
    }
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const r = await BG.api.rpc('bg_bp_weekly_claim', {});
      if (card) {
        card.classList.remove('is-loading');
        card.classList.add('is-done');
        card.querySelector('.bpw-t').innerHTML = `<b>+${fmt(r.amount)} BP hesabına yüklendi</b><span>İyi oyunlar! Yeni destek hakkı gelecek hafta.</span>`;
        btn.remove();
        econ.burst(card, 22);
        await econ.flyCoins(card, 12);
      }
      econ.state.weekly = r.weekly;
      econ.setBalance(r.balance);
      econ.toastGain('+' + fmt(r.amount) + ' BP', 'Haftalık destek hesabına yüklendi');
      if (card)
        setTimeout(() => {
          card.classList.add('is-out');
          setTimeout(() => card.remove(), 400);
        }, 2600);
    } catch (e) {
      BG.toastError(e);
      econ.refresh();
    } finally {
      econ.busy = false;
    }
  };
  /* ---------------- görünümler ---------------- */
  function chipHTML() {
    const s = econ.state;
    if (!s) return '';
    const r = BG.rankInfo(s.rank || BG.rankOf(s.balance));
    const dot = s.daily_ready || s.missions_ready || s.rewards_ready || (s.weekly && s.weekly.eligible);
    return `<button class="bp-chip${dot ? ' has-daily' : ''}" type="button" data-bp-open aria-label="BP bakiyen: ${fmt(s.balance)} BP, rütbe ${esc(r.name)}${s.prestige ? ', Prestij ' + BG.roman(s.prestige) : ''}">
        ${BG.rankIcon(r.idx, 20)}<b data-bp-balance>${fmt(s.balance)}</b><span class="bp-unit">BP</span>${s.prestige ? `<span class="bp-pr" title="Prestij ${BG.roman(s.prestige)}">${icon('star', 11)}${BG.roman(s.prestige)}</span>` : ''}
        ${dot ? '<span class="bp-dot" aria-hidden="true"></span>' : ''}
      </button>`;
  }
  function bellHTML() {
    if (!BG.isAuthed()) return '';
    const n = econ.unread || 0;
    return `<button class="bell-btn" type="button" data-notif-open aria-label="Bildirimler${n ? ', ' + n + ' okunmamış' : ''}">${icon('bell', 21)}${n ? `<span class="bell-n">${n > 99 ? '99+' : n}</span>` : ''}</button>`;
  }
  function nextDailyText(s) {
    if (!s || !s.daily_next) return 'Yeni bonus gece 00:00’da';
    const ms = new Date(s.daily_next).getTime() - Date.now();
    if (ms <= 0) return 'Yeni bonus hazır';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `Sonraki bonus ${BG.fmt.clock(s.daily_next)}’da · ${h ? h + ' sa ' : ''}${m} dk sonra`;
  }
  econ.nextDailyText = nextDailyText;
  function dailyHTML(s, big) {
    if (!s || !(s.daily > 0)) return '';
    return s.daily_ready
      ? `<button class="btn btn-primary${big ? '' : ' btn-sm'} bp-daily" type="button" data-bp-daily>${icon('gift', big ? 18 : 16)}Günlük bonus · +${fmt(s.daily)} BP</button>`
      : `<span class="bp-taken"><b>${icon('check', 15)}Bugünün bonusu alındı</b><small>${esc(nextDailyText(s))}</small></span>`;
  }
  econ.dailyHTML = dailyHTML;

  /** Ana sayfa cüzdan kartı */
  econ.walletHTML = function () {
    const s = econ.state;
    if (!s) return '<div class="bp-wallet is-loading"><span class="bp-coin">' + icon('coin', 20) + '</span><b>…</b></div>';
    const r = BG.rankInfo(s.rank);
    const span = r.next ? Math.max(1, r.next - r.min) : 1;
    const prog = r.next ? Math.max(0, Math.min(100, ((s.balance - r.min) / span) * 100)) : 100;
    return `${econ.weeklyHTML('home')}<div class="bp-wallet g${r.grp}" style="${BG.rankStyle(r)}">
        <button class="bp-wallet-main" type="button" data-bp-open aria-label="BP cüzdanını aç">
          <span class="bp-wallet-rank">${BG.rankIcon(r.idx, 46)}</span>
          <span class="bp-wallet-txt">
            <span class="bp-wallet-amt"><b data-bp-balance>${fmt(s.balance)}</b> BP</span>
            <span class="bp-wallet-rk">${esc(r.name)}${s.prestige ? ` · ${BG.prestigeChip(s.prestige, { short: true })}` : ''}</span>
            <span class="bp-prog" aria-hidden="true"><i style="width:${prog.toFixed(1)}%"></i></span>
            <small class="muted">${r.next ? `${esc(r.nextName)} için ${fmt(r.next - s.balance)} BP` : 'En yüksek rütbe · prestij yolunda'}</small>
          </span>
        </button>
        <div class="bp-wallet-side">
          ${dailyHTML(s)}
          <div class="bp-quick">
            <a class="bp-q" href="#/magaza">${icon('bag', 16)}Mağaza</a>
            <a class="bp-q" href="#/gorevler">${icon('target', 16)}Görevler${s.missions_ready ? `<span class="bp-q-n">${s.missions_ready}</span>` : ''}</a>
            ${s.rewards_ready ? `<button class="bp-q is-hot" type="button" data-rewards>${icon('trophy', 16)}Ödüller<span class="bp-q-n">${s.rewards_ready}</span></button>` : ''}
          </div>
        </div>
      </div>`;
  };
  econ.mountWallet = function (el) {
    el.innerHTML = econ.walletHTML();
    el.dataset.bpMounted = '1';
    if (!econ.state) econ.refresh();
  };

  econ.paint = function (oldBal) {
    document.querySelectorAll('.bp-slot').forEach((slot) => (slot.innerHTML = BG.isAuthed() ? chipHTML() : ''));
    document.querySelectorAll('.bell-slot').forEach((slot) => (slot.innerHTML = bellHTML()));
    document.querySelectorAll('[data-bp-wallet]').forEach((w) => {
      // haftalık destek talebi sürerken (yükleniyor / yüklendi) kart yeniden çizimde kaybolmasın
      const live = w.querySelector('[data-weekly].is-loading, [data-weekly].is-done');
      w.innerHTML = econ.walletHTML();
      if (live) {
        const fresh = w.querySelector('[data-weekly]');
        if (fresh) fresh.replaceWith(live);
        else w.prepend(live);
      }
    });
    if (oldBal != null && econ.state && oldBal !== econ.state.balance) {
      document.querySelectorAll('[data-bp-balance]').forEach((b) => {
        b.classList.remove('bp-bump', 'bp-drop');
        void b.offsetWidth;
        b.classList.add(econ.state.balance > oldBal ? 'bp-bump' : 'bp-drop');
      });
    }
    document.querySelectorAll('[data-missions-badge]').forEach((b) => (b.innerHTML = BG.countBadge(econ.state && econ.state.missions_ready)));
    BG.bus.emit('bp', econ.state);
  };

  /* ---------------- BP penceresi ---------------- */
  econ.openPanel = async function (tab) {
    if (!BG.isAuthed()) return BG.router.go('/giris');
    const s = econ.state || (await econ.refresh()) || { balance: 0, rank: 1 };
    const body = BG.frag(`<div class="bpx">
        <nav class="filters bpx-tabs" role="tablist">
          <button class="filter" role="tab" data-t="wallet">${icon('coin', 16)}Cüzdan</button>
          <button class="filter" role="tab" data-t="history">${icon('history', 16)}Hareketler</button>
          <button class="filter" role="tab" data-t="fc">${icon('users', 16)}Friend Coins</button>
        </nav>
        <div class="bpx-pane" data-p="wallet"></div>
        <div class="bpx-pane" data-p="history" hidden>
          <div class="bpx-filters">
            <label class="bpx-f"><span>Oyun</span><select class="input" data-f="game">
              <option value="">Tümü</option><option value="site">Site (bonus, mağaza, yönetici)</option>
              <option value="americano-online">Americano</option><option value="dostkazigi-online">Dost Kazığı</option><option value="blackjack">Blackjack</option>
            </select></label>
            <label class="bpx-f"><span>Başlangıç</span><input class="input" type="date" data-f="from"></label>
            <label class="bpx-f"><span>Bitiş</span><input class="input" type="date" data-f="to"></label>
          </div>
          <div class="bpx-hist" role="table" aria-label="BP hareketleri">
            <div class="bpx-row bpx-head" role="row"><span role="columnheader">İşlem</span><span role="columnheader">Değişim</span><span role="columnheader">Önce → Sonra</span></div>
            <div class="bpx-rows"><p class="muted small">Yükleniyor…</p></div>
          </div>
          <button class="btn btn-ghost btn-sm bpx-more" type="button" hidden>Daha fazla</button>
        </div>
        <div class="bpx-pane" data-p="fc" hidden></div>
      </div>`);
    const panes = {};
    body.querySelectorAll('.bpx-pane').forEach((p) => (panes[p.dataset.p] = p));
    let cur = null;
    function show(t) {
      cur = t;
      body.querySelectorAll('[data-t]').forEach((b) => {
        b.classList.toggle('is-on', b.dataset.t === t);
        b.setAttribute('aria-selected', String(b.dataset.t === t));
      });
      Object.keys(panes).forEach((k) => (panes[k].hidden = k !== t));
      if (t === 'wallet') paintWallet();
      if (t === 'history' && !hist.loaded) hist.load(true);
      if (t === 'fc') paintFc();
    }
    body.querySelector('.bpx-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (b) show(b.dataset.t);
    });

    async function paintWallet() {
      const st = econ.state || s;
      const r = BG.rankInfo(st.rank);
      const span = r.next ? Math.max(1, r.next - r.min) : 1;
      const prog = r.next ? Math.max(0, Math.min(100, ((st.balance - r.min) / span) * 100)) : 100;
      const pr = st.prestige || 0;
      const pNext = BG.PRESTIGE_STEPS[pr];
      const pPrev = pr ? BG.PRESTIGE_STEPS[pr - 1] : 0;
      const pProg = pNext ? Math.max(0, Math.min(100, (((st.eligible || 0) - pPrev) / (pNext - pPrev)) * 100)) : 100;
      panes.wallet.innerHTML = `${econ.weeklyHTML('panel')}
        <div class="bpx-hero g${r.grp}" style="${BG.rankStyle(r)}">
          <div class="bpx-rank">${BG.rankIcon(r.idx, 64)}</div>
          <div class="bpx-amt"><b data-bp-balance>${fmt(st.balance)}</b> <span>BP</span></div>
          <div class="bpx-rkname">${esc(r.name)} <small>· ${esc(r.group)}</small>${pr ? ' ' + BG.prestigeChip(pr) : ''}</div>
          <div class="bp-prog lg" aria-hidden="true"><i style="width:${prog.toFixed(1)}%"></i></div>
          <p class="muted small">${r.next ? `Sonraki rütbe ${esc(r.nextName)}: ${fmt(r.next)} BP (${fmt(r.next - st.balance)} BP kaldı)` : `En yüksek rütbe: ${esc(r.name)}. Prestij ilerlemesi aşağıda.`}
            · En yüksek rütben: <b>${esc(BG.rankInfo(st.best_rank).name)}</b> · ${BG.publicSettings && BG.publicSettings.am_rank_lock ? 'Masa' : 'Dost Kazığı masa'} ücreti sınırın: <b>${r.maxFee} BP</b></p>
          <a class="btn btn-soft btn-sm bpx-ranks" href="#/rutbeler">${icon('trophy', 16)}Bütün rütbeler</a>
        </div>
        <section class="bpx-sec">
          <h3>${icon('gift', 17)}Günlük bonus</h3>
          <div class="bpx-daily">${dailyHTML(st, true) || '<span class="muted">Günlük bonus şu an kapalı.</span>'}</div>
        </section>
        <section class="bpx-sec">
          <h3>${icon('trophy', 17)}Bekleyen ödüller</h3>
          <div class="bpx-rewards"><p class="muted small">Yükleniyor…</p></div>
        </section>
        <section class="bpx-sec">
          <h3>${icon('star', 17)}Prestij</h3>
          <p class="small">${pr ? `Prestij <b>${BG.roman(pr)}</b>.` : 'Henüz prestij yok.'} Uygun kazanç sayacı: <b>${fmt(st.eligible || 0)}</b>${pNext ? ` / ${fmt(pNext)} (Prestij ${BG.roman(pr + 1)})` : ' — en yüksek prestij'}</p>
          <div class="bp-prog pr" aria-hidden="true"><i style="width:${pProg.toFixed(1)}%"></i></div>
          <p class="muted small">Prestij yalnızca rütben ${esc(BG.rankInfo(BG.PRESTIGE_MIN).name)} ve üstüyken yükselir ve kalıcıdır. Sayaca yalnızca oyunlardaki net kazançlar, günlük bonus ve görev ödülleri girer; başlangıç BP’si, yönetici eklemeleri, iadeler ve Friend Coins dönüşümleri girmez.</p>
        </section>
        <section class="bpx-sec bpx-links">
          <a class="btn btn-soft" href="#/magaza">${icon('bag', 18)}Mağaza</a>
          <a class="btn btn-soft" href="#/gorevler">${icon('target', 18)}Görevler${st.missions_ready ? ` <span class="bp-q-n">${st.missions_ready}</span>` : ''}</a>
          <a class="btn btn-soft" href="#/profil">${icon('user', 18)}Profilim</a>
        </section>
        <p class="bp-note">BP yalnızca Bözer Gaming içinde kullanılan sanal puandır. Satın alınamaz, satılamaz, paraya çevrilemez.</p>`;
      paintRewards(panes.wallet.querySelector('.bpx-rewards'));
    }
    async function paintRewards(box) {
      let list = [];
      try {
        list = (await BG.api.rpc('bg_rewards', {})) || [];
      } catch (e) {
        box.innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
        return;
      }
      if (!box.isConnected) return;
      if (!list.length) {
        box.innerHTML = '<p class="muted small">Toplanmayı bekleyen maç ödülün yok. Americano ve Dost Kazığı online maçlarında kazandıkların burada da görünür.</p>';
        return;
      }
      const tb = list.reduce((a, x) => a + x.bp, 0);
      const tf = list.reduce((a, x) => a + x.fc, 0);
      box.innerHTML = `<ul class="bpx-rw">${list
        .map((x) => `<li><span>${esc(GAME[x.game] || x.game)} · ${x.kind === 'refund' ? 'iade' : x.place + '.'}<small>${esc(BG.fmt.ago(x.created_at))}</small></span><b>${x.bp ? '+' + fmt(x.bp) + ' BP' : ''}${x.fc ? ` <em>+${x.fc} FC</em>` : ''}</b></li>`)
        .join('')}</ul>
        <button class="btn btn-primary bpx-collect" type="button">${icon('trophy', 18)}Ödülleri topla · +${fmt(tb)} BP${tf ? ' · +' + tf + ' FC' : ''}</button>`;
      box.querySelector('.bpx-collect').addEventListener('click', (e) => econ.collect(e.currentTarget).then(() => paintRewards(box)));
    }

    const hist = { before: null, loaded: false, busy: false };
    const rows = body.querySelector('.bpx-rows');
    const more = body.querySelector('.bpx-more');
    const fGame = body.querySelector('[data-f="game"]');
    const fFrom = body.querySelector('[data-f="from"]');
    const fTo = body.querySelector('[data-f="to"]');
    hist.load = async function (reset) {
      if (hist.busy) return;
      hist.busy = true;
      if (reset) {
        hist.before = null;
        rows.innerHTML = '<p class="muted small">Yükleniyor…</p>';
      }
      try {
        const list =
          (await BG.api.rpc('bg_bp_history', {
            p_before: hist.before,
            p_limit: 40,
            p_game: fGame.value || null,
            p_from: fFrom.value || null,
            p_to: fTo.value || null,
          })) || [];
        hist.loaded = true;
        if (reset) rows.innerHTML = '';
        if (!list.length && reset) rows.innerHTML = '<p class="muted small">Bu filtreye uyan hareket yok.</p>';
        list.forEach((r) => {
          const d = new Date(r.created_at);
          rows.appendChild(
            BG.frag(`<div class="bpx-row" role="row">
              <span class="bpx-k" role="cell"><b>${esc(r.note || econ.kindLabel(r.kind))}</b><small>${esc(BG.fmt.dateShort(d))} ${esc(BG.fmt.clock(d))} · ${esc(econ.gameLabel(r.game))} · ${esc(econ.kindLabel(r.kind))} · ${esc(r.status || 'tamamlandı')}</small></span>
              <b class="bpx-d ${r.amount >= 0 ? 'pos' : 'neg'}" role="cell">${r.amount >= 0 ? '+' : '−'}${fmt(Math.abs(r.amount))}</b>
              <span class="bpx-ba muted" role="cell">${fmt(r.balance_before)} → <b>${fmt(r.balance_after)}</b></span>
            </div>`)
          );
        });
        if (list.length) hist.before = list[list.length - 1].id;
        more.hidden = list.length < 40;
      } catch (e) {
        rows.innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
      } finally {
        hist.busy = false;
      }
    };
    [fGame, fFrom, fTo].forEach((f) => f.addEventListener('change', () => hist.load(true)));
    more.addEventListener('click', () => hist.load(false));

    async function paintFc() {
      panes.fc.innerHTML = '<p class="muted small">Yükleniyor…</p>';
      let d;
      try {
        d = await BG.api.rpc('bg_fc_wallet', {});
      } catch (e) {
        panes.fc.innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
        return;
      }
      const bal = d.balance || 0;
      const max = Math.floor(bal / 10) * 10;
      panes.fc.innerHTML = `
        <div class="fc-hero"><span class="fc-coin" aria-hidden="true">FC</span><div><b>${fmt(bal)}</b> Friend Coins<p class="muted small">Arkadaşlarınla oynadıkça kazanırsın: Americano ve Dost Kazığı online maçında masadaki her arkadaşın için 1 FC; Blackjack’te aynı masada birlikte oynadığın her 10 turda 1 FC. Aynı arkadaşla günde en fazla 10 FC.</p></div></div>
        <form class="fc-conv" novalidate>
          <h3>${icon('swap', 17)}Coin → Points</h3>
          <p class="small">10 Friend Coins = 1 BP. 10’un katları dönüştürülür; dönüşüm geri alınamaz.</p>
          <div class="fc-row"><input class="input" type="number" min="10" step="10" max="${max}" value="${max || ''}" placeholder="10" aria-label="Dönüştürülecek Friend Coins" ${max ? '' : 'disabled'}>
            <span class="fc-eq">= <b data-fc-bp>${fmt(max / 10)}</b> BP</span>
            <button class="btn btn-primary" type="submit" ${max ? '' : 'disabled'}>Dönüştür</button></div>
        </form>
        <h3 class="bpx-h3">Son hareketler</h3>
        <ul class="fc-hist">${(d.items || []).length ? d.items.map((x) => `<li><span>${esc(x.note || x.kind)}<small>${esc(econ.gameLabel(x.game))} · ${esc(BG.fmt.ago(x.created_at))}</small></span><b class="${x.amount >= 0 ? 'pos' : 'neg'}">${x.amount >= 0 ? '+' : '−'}${fmt(Math.abs(x.amount))} FC</b></li>`).join('') : '<li class="muted small">Henüz Friend Coins hareketi yok.</li>'}</ul>`;
      const form = panes.fc.querySelector('form');
      const inp = form.querySelector('input');
      inp.addEventListener('input', () => (form.querySelector('[data-fc-bp]').textContent = fmt(Math.floor((Number(inp.value) || 0) / 10))));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = Math.floor((Number(inp.value) || 0) / 10) * 10;
        if (v < 10) return BG.toast({ type: 'error', text: 'En az 10 Friend Coins dönüştürülür.' });
        if (v > bal) return BG.toast({ type: 'error', text: 'Friend Coins bakiyen yetmiyor.' });
        const btn = form.querySelector('button');
        btn.disabled = true;
        try {
          const r = await BG.api.rpc('bg_fc_convert', { p_amount: v, p_req: Math.random().toString(36).slice(2) + Date.now() });
          econ.patch({ fc: r.fc });
          econ.setBalance(r.balance);
          econ.burst(btn);
          econ.toastGain('+' + fmt(r.bp) + ' BP', v + ' Friend Coins dönüştürüldü');
          paintFc();
        } catch (err) {
          BG.toastError(err);
          btn.disabled = false;
        }
      });
    }

    const off = BG.bus.on('bp', () => {
      if (cur === 'wallet' && body.isConnected) {
        const amt = panes.wallet.querySelector('[data-bp-balance]');
        if (amt && econ.state) amt.textContent = fmt(econ.state.balance);
        const dly = panes.wallet.querySelector('.bpx-daily');
        if (dly && econ.state) dly.innerHTML = dailyHTML(econ.state, true);
      }
    });
    BG.modal({ title: 'BP cüzdanım', body, size: 'm', actions: [{ label: 'Kapat', kind: 'ghost' }], onClose: off });
    show(tab || 'wallet');
  };

  /** ÖDÜLLERİ TOPLA (bekleyen bütün maç ödülleri ya da yalnız bir masanınki) */
  econ.collect = async function (btn, tableId) {
    if (btn) btn.disabled = true;
    try {
      const r = await BG.api.rpc('bg_rewards_claim', { p_table: tableId || null });
      if (!r.count) {
        BG.toast({ type: 'info', text: 'Toplanacak ödül kalmadı.' });
        return r;
      }
      await econ.flyCoins(btn, Math.round((r.bp || 0) / 5));
      econ.patch({ fc: r.fc_balance, rewards_ready: 0 });
      econ.setBalance(r.balance);
      econ.toastGain((r.bp ? '+' + fmt(r.bp) + ' BP' : '') + (r.fc ? '  +' + r.fc + ' FC' : ''), 'Ödüllerin hesabına eklendi');
      econ.refresh();
      return r;
    } catch (e) {
      BG.toastError(e);
      return null;
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  };

  /* ---------------- bildirim merkezi ---------------- */
  const NIC = { admin_bp: 'shield', rank: 'award', prestige: 'star', reward: 'trophy', refund: 'coin', comment: 'message', gift: 'gift', weekly: 'coin', table: 'flag' };
  econ.openNotifications = async function () {
    const body = BG.frag(`<div class="notif"><ul class="notif-list"><li class="muted small">Yükleniyor…</li></ul><button class="btn btn-ghost btn-sm notif-more" type="button" hidden>Daha eski</button></div>`);
    const list = body.querySelector('.notif-list');
    const more = body.querySelector('.notif-more');
    let before = null;
    async function load() {
      try {
        const d = await BG.api.rpc('bg_notifications', { p_before: before, p_limit: 30 });
        if (before === null) list.innerHTML = '';
        const items = d.items || [];
        if (!items.length && before === null) list.innerHTML = '<li class="notif-empty">Bildirim yok. BP, rütbe, ödül ve profil yorumu gelişmeleri burada görünür.</li>';
        items.forEach((n) => {
          const li = BG.frag(`<li class="notif-it${n.read_at ? '' : ' is-new'}" data-kind="${esc(n.kind)}"><span class="notif-ic">${icon(NIC[n.kind] || 'bell', 18)}</span>
            <span class="notif-b"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${esc(BG.fmt.ago(n.created_at))}</small></span></li>`);
          li.firstElementChild.addEventListener('click', () => {
            BG.closeAllModals();
            if (n.kind === 'reward' || n.kind === 'admin_bp' || n.kind === 'refund' || n.kind === 'weekly') econ.openPanel(n.kind === 'admin_bp' ? 'history' : 'wallet');
            else if (n.kind === 'comment' || n.kind === 'rank' || n.kind === 'prestige') BG.router.go('/profil');
          });
          list.appendChild(li);
        });
        if (items.length) before = items[items.length - 1].id;
        more.hidden = items.length < 30;
      } catch (e) {
        list.innerHTML = `<li class="muted small">${esc(e.message)}</li>`;
      }
    }
    more.addEventListener('click', load);
    await load();
    BG.modal({
      title: 'Bildirimler',
      body,
      size: 'm',
      actions: [
        {
          label: 'Tümünü okundu say',
          kind: 'soft',
          close: false,
          onClick: async () => {
            try {
              await BG.api.rpc('bg_notifications_read', { p_ids: null });
              econ.unread = 0;
              econ.paint();
              list.querySelectorAll('.is-new').forEach((x) => x.classList.remove('is-new'));
            } catch (e) {
              BG.toastError(e);
            }
          },
        },
        { label: 'Kapat', kind: 'ghost' },
      ],
    });
    // pencere açıldığında okunmuş sayılır
    BG.api.rpc('bg_notifications_read', { p_ids: null }).then(() => {
      econ.unread = 0;
      econ.paint();
    }).catch(() => {});
  };
  function onNotification(n) {
    econ.unread = (econ.unread || 0) + 1;
    econ.paint();
    if (n.kind === 'rank') {
      econ.refresh();
      return;
    }
    if (n.kind === 'admin_bp' || n.kind === 'reward' || n.kind === 'refund' || n.kind === 'prestige') econ.refresh();
    BG.toast({
      type: n.kind === 'admin_bp' && n.data && n.data.change < 0 ? 'info' : 'success',
      title: n.title,
      text: n.body,
      duration: 6000,
      onClick: () => econ.openNotifications(),
    });
  }

  /* ---------------- olaylar ---------------- */
  document.addEventListener('click', (e) => {
    const wk = e.target.closest('[data-weekly-claim]');
    if (wk) {
      e.preventDefault();
      econ.claimWeekly(wk);
      return;
    }
    const d = e.target.closest('[data-bp-daily]');
    if (d) {
      e.preventDefault();
      econ.claimDaily(d);
      return;
    }
    const rw = e.target.closest('[data-rewards]');
    if (rw) {
      e.preventDefault();
      econ.openPanel('wallet');
      return;
    }
    const o = e.target.closest('[data-bp-open]');
    if (o) {
      e.preventDefault();
      econ.openPanel();
      return;
    }
    const nb = e.target.closest('[data-notif-open]');
    if (nb) {
      e.preventDefault();
      econ.openNotifications();
    }
  });

  function subscribe() {
    unsubscribe();
    const uid = BG.store.me && BG.store.me.id;
    if (!uid || !BG.api.ready) return;
    try {
      econ.ch = BG.api
        .channel('bg-econ-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bp_wallets', filter: 'user_id=eq.' + uid }, (p) => {
          const w = p.new;
          if (!w || w.balance == null) return;
          if (econ.state) {
            if (w.prestige != null && w.prestige > (econ.state.prestige || 0)) econ.state.prestige = w.prestige;
            if (w.eligible_total != null) econ.state.eligible = w.eligible_total;
            if (w.daily_on) econ.state.daily_ready = false;
          }
          econ.setBalance(w.balance);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: 'user_id=eq.' + uid }, (p) => {
          if (p.new) onNotification(p.new);
        })
        .subscribe();
    } catch (e) {
      econ.ch = null;
    }
  }
  function unsubscribe() {
    if (econ.ch) BG.api.removeChannel(econ.ch);
    econ.ch = null;
  }
  /* =====================================================================
     v3.3 RÜTBELER — bütün rütbeler ve BP aralıkları; bakan üyenin rütbesi
     halka içinde (halka, sonraki rütbeye ilerlemeyi de gösterir)
     ===================================================================== */
  /** Rütbe tablosunun aralığı: "2.500 – 2.999 BP" / son rütbe "200.000+ BP" */
  const rankRange = (r) => (r.next != null ? `${fmt(r.min)} – ${fmt(r.next - 1)} BP` : `${fmt(r.min)}+ BP`);
  /** Rütbelerin renk grupları; tek rütbelik ardışık gruplar "Üst rütbeler" altında toplanır */
  function rankGroups() {
    const out = [];
    BG.RANKS.forEach((x, i) => {
      const r = BG.rankInfo(i + 1);
      const last = out[out.length - 1];
      if (last && last.color === r.color) last.items.push(r);
      else out.push({ color: r.color, name: r.group || '', items: [r] });
    });
    const merged = [];
    out.forEach((g) => {
      const prev = merged[merged.length - 1];
      if (g.items.length === 1 && prev && prev.top) prev.items.push(g.items[0]);
      else if (g.items.length === 1) merged.push({ top: true, name: 'Üst rütbeler', items: [g.items[0]] });
      else merged.push(g);
    });
    return merged;
  }
  econ.rankRange = rankRange;
  BG.views = BG.views || {};
  BG.views.ranks = function () {
    const root = BG.frag(`<div class="page ranks">
        <header class="page-head">
          <div><h1>${icon('trophy', 26)}Rütbeler</h1><p class="page-lead">Rütben güncel BP bakiyene göre belirlenir: bakiyen arttıkça yükselir, azalınca iner. Ulaştığın en yüksek rütbe profilinde kalır.</p></div>
        </header>
        <section class="rk-hero" aria-live="polite"></section>
        <div class="rk-groups"></div>
      </div>`);
    const hero = root.querySelector('.rk-hero');
    const box = root.querySelector('.rk-groups');
    let scrolled = false;
    function paint() {
      const st = BG.isAuthed() ? econ.state : null;
      const cur = st ? st.rank || BG.rankOf(st.balance) : 0;
      const best = st ? st.best_rank || cur : 0;
      const total = BG.RANKS.length;
      if (st) {
        const r = BG.rankInfo(cur);
        const span = r.next ? Math.max(1, r.next - r.min) : 1;
        const prog = r.next ? Math.max(0, Math.min(100, ((st.balance - r.min) / span) * 100)) : 100;
        hero.className = `rk-hero g${r.grp}`;
        hero.setAttribute('style', BG.rankStyle(r));
        hero.innerHTML = `<div class="rk-ring" style="--p:${prog.toFixed(1)}" role="img" aria-label="Rütben ${esc(r.name)}, sonraki rütbeye %${Math.round(prog)}">
            <span class="rk-ring-in">${BG.rankIcon(cur, 74)}</span></div>
          <div class="rk-hero-t">
            <span class="rk-k">Rütben · ${cur}/${total}</span>
            <h2>${esc(r.name)}</h2>
            <p class="rk-sub">${r.group ? esc(r.group) + ' · ' : ''}${esc(rankRange(r))}</p>
            <p class="rk-bal"><b>${fmt(st.balance)}</b> BP</p>
            <p class="muted small">${r.next ? `Sonraki rütbe <b>${esc(r.nextName)}</b>: ${fmt(r.next)} BP · ${fmt(r.next - st.balance)} BP kaldı` : 'En yüksek rütbedesin.'}${best > cur ? ` · En yüksek rütben: <b>${esc(BG.rankInfo(best).name)}</b>` : ''}</p>
          </div>`;
      } else {
        hero.className = 'rk-hero is-guest';
        hero.removeAttribute('style');
        hero.innerHTML = `<div class="rk-hero-t"><h2>Rütbeni gör</h2><p class="muted">Giriş yapınca rütben bu listede halka içinde görünür.</p><a class="btn btn-primary" href="#/giris">Giriş yap</a></div>`;
      }
      const lv = BG.LEVELS || [];
      const amFree = !(BG.publicSettings && BG.publicSettings.am_rank_lock);
      box.innerHTML = rankGroups()
        .map((g) => {
          const lo = g.items[0];
          const hi = g.items[g.items.length - 1];
          const head = g.top ? `${esc(g.name)}` : `${esc(g.name)} rütbeler`;
          return `<section class="rk-group${g.top ? ' is-top' : ''}" style="${g.top ? '' : BG.rankStyle(lo)}">
            <header class="rk-gh"><h2>${head}</h2><span class="muted small">${fmt(lo.min)}${hi.next != null ? ' – ' + fmt(hi.next - 1) : '+'} BP</span></header>
            <ol class="rk-list" start="${lo.idx}">${g.items
              .map((r) => {
                const tags = [];
                lv.filter((l) => l[1] === r.idx && l[1] > 1).forEach((l) => tags.push(`${amFree ? 'Dost Kazığı ' : ''}${l[0]} BP masası`));
                if (r.idx === BG.PRESTIGE_MIN) tags.push('Prestij başlar');
                if (best && r.idx === best && best !== cur) tags.push('En yüksek rütben');
                const state = !cur ? '' : r.idx === cur ? ' is-cur' : r.idx < cur ? ' is-done' : ' is-up';
                return `<li class="rk-row${state}" style="${BG.rankStyle(r)}" data-rk="${r.idx}"${r.idx === cur ? ' aria-current="true"' : ''}>
                  <span class="rk-ic">${BG.rankIcon(r.idx, 36)}</span>
                  <span class="rk-nm"><b>${esc(r.name)}</b><small>${r.idx}. rütbe${tags.length ? ' · ' + tags.map(esc).join(' · ') : ''}</small></span>
                  <span class="rk-bp">${esc(rankRange(r))}</span>
                  ${r.idx === cur ? '<em class="rk-you">Sen</em>' : ''}
                </li>`;
              })
              .join('')}</ol></section>`;
        })
        .join('');
      if (cur && !scrolled) {
        scrolled = true;
        requestAnimationFrame(() => {
          const el = box.querySelector('.rk-row.is-cur');
          if (el && el.getBoundingClientRect().top > window.innerHeight * 0.75) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
      }
    }
    paint();
    if (BG.isAuthed() && !econ.state) econ.refresh();
    const offs = [BG.bus.on('bp', paint), BG.bus.on('econ-settings', paint)];
    return { node: root, cleanup: () => offs.forEach((f) => f()) };
  };

  BG.bus.on('auth', (on) => {
    if (on) {
      econ.refresh();
      subscribe();
    } else {
      unsubscribe();
      econ.state = null;
      econ.unread = 0;
      econ.paint();
    }
  });
  // Sekmeye dönünce bakiye tazelenir (gün değişmiş olabilir); açık kalan sayfada her 5 dakikada bir
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && BG.isAuthed()) econ.refresh();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && BG.isAuthed()) econ.refresh();
  }, 300000);
})();
