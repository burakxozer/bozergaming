/* =====================================================================
   Bözer Gaming 3.0 — Bözer Points (BP) cüzdanı
   Bakiye yalnızca sunucuda değişir; burada gösterilir ve anlık izlenir.
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  const bp = (BG.bp = { state: null, ch: null, busy: false });
  const fmt = (n) => (Math.round(Number(n) || 0)).toLocaleString('tr-TR');
  bp.fmt = fmt;
  const KIND = {
    welcome: 'Hoş geldin BP’si',
    daily: 'Günlük BP',
    admin: 'Yönetici düzenlemesi',
    gift: 'Hediye gönderdin',
    bj_bet: 'Blackjack bahsi',
    bj_extra: 'Blackjack ek bahis (double/split)',
    bj_win: 'Blackjack kazancı',
    bj_return: 'Blackjack bahis iadesi (berabere/teslim)',
    bj_refund: 'Blackjack iadesi (tur iptali)',
    bj_insurance: 'Blackjack sigorta',
    bj_bb: 'Bet Behind',
    bj_jackpot: 'Jackpot ödülü',
  };
  bp.kindLabel = (k) => KIND[k] || k;
  bp.tierText = (bal) => (bal >= 8000 ? 'Gold kademesi · 100 BP’ye kadar bahis' : bal >= 4000 ? 'Silver kademesi · 20 BP’ye kadar bahis' : 'Bronze kademesi · 10 BP bahis');

  bp.refresh = async function () {
    if (!BG.isAuthed()) {
      bp.state = null;
      bp.paint();
      return null;
    }
    try {
      bp.state = await BG.api.rpc('bg_bp_wallet', {});
    } catch (e) {
      bp.state = bp.state || null;
    }
    bp.paint();
    return bp.state;
  };
  bp.setBalance = function (b) {
    if (!bp.state) return;
    const old = bp.state.balance;
    bp.state.balance = Number(b) || 0;
    bp.state.max_bet = bp.state.balance >= 8000 ? 100 : bp.state.balance >= 4000 ? 20 : 10;
    bp.paint(old);
  };

  bp.claimDaily = async function (btn) {
    if (bp.busy) return;
    bp.busy = true;
    try {
      const r = await BG.api.rpc('bg_bp_daily', {});
      bp.state = Object.assign(bp.state || {}, { balance: r.balance, max_bet: r.max_bet, daily_ready: false });
      bp.paint();
      BG.toast({ type: 'success', text: `+${fmt(r.amount)} BP hesabına eklendi` });
      if (btn) bp.burst(btn);
    } catch (e) {
      BG.toastError(e);
      bp.refresh();
    } finally {
      bp.busy = false;
    }
  };

  /** Altın parçacık efekti (azaltılmış hareket tercihinde çalışmaz) */
  bp.burst = function (el) {
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('span');
      d.className = 'bp-spark';
      d.style.left = r.left + r.width / 2 + 'px';
      d.style.top = r.top + r.height / 2 + 'px';
      document.body.appendChild(d);
      const a = (Math.PI * 2 * i) / 14;
      const dist = 40 + Math.random() * 40;
      d.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 20}px)) scale(.4)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }
      ).onfinish = () => d.remove();
    }
  };

  /* ---------- Görünümler ---------- */
  function chipHTML() {
    const s = bp.state;
    if (!s) return '';
    return `<button class="bp-chip${s.daily_ready ? ' has-daily' : ''}" type="button" data-bp-open aria-label="BP bakiyen: ${fmt(s.balance)} BP${s.daily_ready ? ', günlük BP hazır' : ''}">
        <span class="bp-coin" aria-hidden="true">${icon('coin', 16)}</span><b data-bp-balance>${fmt(s.balance)}</b><span class="bp-unit">BP</span>
        ${s.daily_ready ? '<span class="bp-dot" aria-hidden="true"></span>' : ''}
      </button>`;
  }
  bp.walletHTML = function () {
    const s = bp.state;
    if (!s) return '<div class="bp-wallet is-loading"><span class="bp-coin">' + icon('coin', 20) + '</span><b>…</b></div>';
    return `<div class="bp-wallet">
        <button class="bp-wallet-main" type="button" data-bp-open>
          <span class="bp-coin" aria-hidden="true">${icon('coin', 22)}</span>
          <span class="bp-wallet-amt"><b data-bp-balance>${fmt(s.balance)}</b> BP</span>
        </button>
        ${
          s.daily_ready
            ? `<button class="btn btn-primary btn-sm bp-daily" type="button" data-bp-daily>${icon('gift', 16)}Günlük +${fmt(s.daily)}</button>`
            : s.daily > 0
            ? `<span class="bp-later">Günlük BP yarın yine</span>`
            : ''
        }
      </div>`;
  };
  bp.mountWallet = function (el) {
    el.innerHTML = bp.walletHTML();
    el.dataset.bpMounted = '1';
    if (!bp.state) bp.refresh();
  };

  bp.paint = function (oldBal) {
    // üst çubuk
    document.querySelectorAll('.bp-slot').forEach((slot) => (slot.innerHTML = BG.isAuthed() ? chipHTML() : ''));
    // ana sayfa cüzdanı
    document.querySelectorAll('[data-bp-wallet]').forEach((w) => (w.innerHTML = bp.walletHTML()));
    if (oldBal != null && bp.state && oldBal !== bp.state.balance) {
      document.querySelectorAll('[data-bp-balance]').forEach((b) => {
        b.classList.remove('bp-bump', 'bp-drop');
        void b.offsetWidth;
        b.classList.add(bp.state.balance > oldBal ? 'bp-bump' : 'bp-drop');
      });
    }
    BG.bus.emit('bp', bp.state);
  };

  /* ---------- BP penceresi: bakiye, kademe, günlük BP, hareketler ---------- */
  bp.openPanel = async function () {
    if (!BG.isAuthed()) return BG.router.go('/giris');
    const s = bp.state || (await bp.refresh()) || { balance: 0 };
    const body = BG.frag(`<div class="bp-panel">
        <div class="bp-panel-head">
          <span class="bp-coin lg" aria-hidden="true">${icon('coin', 30)}</span>
          <div><div class="bp-panel-amt"><b data-bp-balance>${fmt(s.balance)}</b> BP</div><div class="muted small">${esc(bp.tierText(s.balance))}</div></div>
        </div>
        <div class="bp-panel-daily"></div>
        <p class="bp-note">BP yalnızca Bözer Gaming içinde kullanılan sanal puandır. Satın alınamaz, satılamaz, paraya çevrilemez.</p>
        <h3 class="bp-h">Hareketler</h3>
        <ul class="bp-hist"><li class="muted">Yükleniyor…</li></ul>
        <button class="btn btn-ghost btn-sm bp-more" type="button" hidden>Daha fazla</button>
      </div>`);
    const daily = body.querySelector('.bp-panel-daily');
    const paintDaily = () => {
      const st = bp.state || s;
      daily.innerHTML = st.daily_ready
        ? `<button class="btn btn-primary" type="button" data-bp-daily>${icon('gift', 18)}Günlük ${fmt(st.daily)} BP’yi al</button>`
        : st.daily > 0
        ? `<span class="muted">${icon('clock', 16)} Bugünün BP’sini aldın, yarın yine gel.</span>`
        : '';
    };
    paintDaily();
    const off = BG.bus.on('bp', paintDaily);
    const list = body.querySelector('.bp-hist');
    const more = body.querySelector('.bp-more');
    let before = null;
    async function load() {
      try {
        const rows = (await BG.api.rpc('bg_bp_history', { p_before: before, p_limit: 40 })) || [];
        if (before === null) list.innerHTML = '';
        if (!rows.length && before === null) list.innerHTML = '<li class="muted">Henüz hareket yok.</li>';
        rows.forEach((r) => {
          list.appendChild(
            BG.frag(`<li class="bp-row"><span class="bp-row-k">${esc(r.note || bp.kindLabel(r.kind))}<small>${esc(BG.fmt.ago(r.created_at))}</small></span>
              <b class="${r.amount >= 0 ? 'pos' : 'neg'}">${r.amount >= 0 ? '+' : '−'}${fmt(Math.abs(r.amount))}</b></li>`)
          );
        });
        if (rows.length) before = rows[rows.length - 1].id;
        more.hidden = rows.length < 40;
      } catch (e) {
        list.innerHTML = `<li class="muted">${esc(e.message)}</li>`;
      }
    }
    more.addEventListener('click', load);
    load();
    BG.modal({ title: 'BP cüzdanım', body, size: 'm', actions: [{ label: 'Kapat', kind: 'ghost' }], onClose: off });
  };

  /* ---------- Olaylar ---------- */
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-bp-daily]');
    if (d) {
      e.preventDefault();
      bp.claimDaily(d);
      return;
    }
    const o = e.target.closest('[data-bp-open]');
    if (o) {
      e.preventDefault();
      bp.openPanel();
    }
  });

  function subscribe() {
    unsubscribe();
    const uid = BG.store.me && BG.store.me.id;
    if (!uid || !BG.api.ready) return;
    try {
      bp.ch = BG.api
        .channel('bg-bp-' + uid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bp_wallets', filter: 'user_id=eq.' + uid }, (p) => {
          if (p.new && p.new.balance != null) bp.setBalance(p.new.balance);
        })
        .subscribe();
    } catch (e) {
      bp.ch = null;
    }
  }
  function unsubscribe() {
    if (bp.ch) BG.api.removeChannel(bp.ch);
    bp.ch = null;
  }
  BG.bus.on('auth', (on) => {
    if (on) {
      bp.refresh();
      subscribe();
    } else {
      unsubscribe();
      bp.state = null;
      bp.paint();
    }
  });
  // Sekmeye dönünce bakiye tazelenir (gün değişmiş olabilir)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && BG.isAuthed()) bp.refresh();
  });
})();
