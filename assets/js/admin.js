/* =====================================================================
   Bözer Gaming — yönetim paneli (sadece "bozer" yönetici hesabı)
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};

  function genPassword() {
    const words = ['masa', 'okey', 'joker', 'seri', 'dart', 'tavla', 'kart', 'zar', 'lig', 'kupa'];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    return w + n;
  }

  function statusOf(u) {
    if (u.online) {
      const g = u.game && BG.GAMES[u.game];
      return { cls: g ? 'is-playing' : 'is-on', text: g ? g.activity : 'Çevrimiçi, sitede' };
    }
    return { cls: '', text: u.last_seen_at ? 'Çevrimdışı, ' + BG.fmt.ago(u.last_seen_at) : 'Henüz giriş yapmadı' };
  }

  function setPasswordModal(u, onDone) {
    const body = BG.frag(`<div>
        <p class="modal-text">Kullanıcı bu şifreyle giriş yaptığında kendi şifresini belirlemesi istenecek.</p>
        <div class="slot-1"></div><div class="slot-2"></div>
        <button class="link-btn" type="button" data-gen>${icon('dice', 16)}Rastgele şifre oluştur</button>
        <p class="form-error" role="alert" hidden></p>
      </div>`);
    const f1 = BG.passwordField({ id: 'admPw1', label: 'Yeni şifre', autocomplete: 'new-password', hint: 'En az 6 karakter.' });
    const f2 = BG.passwordField({ id: 'admPw2', label: 'Şifre tekrarı', autocomplete: 'new-password' });
    body.querySelector('.slot-1').replaceWith(f1);
    body.querySelector('.slot-2').replaceWith(f2);
    const i1 = f1.querySelector('input');
    const i2 = f2.querySelector('input');
    const err = body.querySelector('.form-error');
    body.querySelector('[data-gen]').addEventListener('click', () => {
      const p = genPassword();
      i1.value = i2.value = p;
      i1.type = i2.type = 'text';
      BG.fieldMsg(i2, 'Şifreler eşleşiyor.', 'ok');
    });
    i2.addEventListener('input', () => {
      if (!i2.value) BG.fieldMsg(i2, '');
      else if (i1.value !== i2.value) BG.fieldMsg(i2, 'Şifreler aynı değil.', 'error');
      else BG.fieldMsg(i2, 'Şifreler eşleşiyor.', 'ok');
    });
    BG.modal({
      title: '@' + u.username + ' için şifre belirle',
      size: 's',
      body,
      actions: [
        { label: 'Vazgeç', kind: 'ghost' },
        {
          label: 'Şifreyi belirle',
          kind: 'primary',
          onClick: async () => {
            err.hidden = true;
            if (i1.value.length < 6) {
              BG.fieldMsg(i1, 'En az 6 karakter olmalı.', 'error');
              return false;
            }
            if (i1.value !== i2.value) {
              BG.fieldMsg(i2, 'Şifreler aynı değil.', 'error');
              return false;
            }
            try {
              await BG.api.rpc('bg_admin_set_password', { p_user: u.id, p_password: i1.value });
            } catch (e) {
              err.textContent = e.message;
              err.hidden = false;
              return false;
            }
            const pw = i1.value;
            setTimeout(() => passwordResult(u, pw), 220);
            if (onDone) onDone();
          },
        },
      ],
    });
  }

  function passwordResult(u, pw) {
    const msg = `Merhaba ${String(u.full_name || u.username).split(' ')[0]}, Bözer Gaming hesabın için geçici şifren: ${pw}\nKullanıcı adın (@${u.username}) ve bu şifreyle giriş yaptıktan sonra kendi şifreni belirleyebilirsin.`;
    const body = BG.frag(`<div class="pw-result">
        <p class="modal-text">@${esc(u.username)} artık bu şifreyle giriş yapabilir.</p>
        <div class="pw-box"><code>${esc(pw)}</code><button class="btn btn-soft btn-sm" type="button" data-c1>${icon('copy', 16)}Kopyala</button></div>
        <button class="btn btn-ghost btn-block" type="button" data-c2>${icon('message', 18)}Kullanıcıya gönderilecek mesajı kopyala</button>
      </div>`);
    body.querySelector('[data-c1]').addEventListener('click', () => BG.copy(pw, 'Şifre kopyalandı'));
    body.querySelector('[data-c2]').addEventListener('click', () => BG.copy(msg, 'Mesaj kopyalandı'));
    BG.modal({ title: 'Şifre belirlendi', size: 's', body, actions: [{ label: 'Tamam', kind: 'primary' }] });
  }

  async function deleteUser(u) {
    const ok = await BG.confirm({
      title: 'Hesap silinsin mi?',
      html: `<strong>${esc(u.full_name)} (@${esc(u.username)})</strong> hesabı; mesajları, arkadaşlıkları, kayıtlı oyunları ve profil fotoğrafıyla birlikte kalıcı olarak silinecek. Kullanıcı isterse aynı kullanıcı adıyla yeniden üye olabilir.`,
      okText: 'Hesabı sil',
      danger: true,
    });
    if (!ok) return false;
    try {
      await BG.api.cleanupAvatars(u.id, null);
      await BG.api.rpc('bg_admin_delete_user', { p_user: u.id });
      BG.toast({ type: 'success', text: '@' + u.username + ' silindi.' });
      return true;
    } catch (e) {
      BG.toastError(e, 'Hesap silinemedi');
      return false;
    }
  }

  /* ---------------- BP ver / al ---------------- */
  const n0 = BG.n0;

  /* ---------------- BP düzenleme: BP EKLE / BP AZALT / BAKİYE AYARLA ---------------- */
  function adjustModal(u, onDone) {
    let mode = 'add';
    const body = BG.frag(`<div>
        <div class="adj-who">${BG.avatar(u, { size: 44, frame: u.frame })}<div><b>${esc(u.full_name || u.username)}</b><span class="muted"> @${esc(u.username)}</span><div>${BG.rankChip(u.rank)}${BG.prestigeChip(u.prestige, { short: true })}</div></div></div>
        <div class="adj-modes" role="radiogroup" aria-label="İşlem türü">
          <button type="button" data-m="add" aria-pressed="true">+ BP ekle</button>
          <button type="button" data-m="reduce" aria-pressed="false">− BP azalt</button>
          <button type="button" data-m="set" aria-pressed="false">= Bakiye ayarla</button>
        </div>
        <div class="field"><label class="field-label" for="adjAmt" data-lab>Eklenecek BP</label><input class="input" id="adjAmt" type="number" min="0" step="1" inputmode="numeric" placeholder="Örn. 500"></div>
        <div class="field"><label class="field-label" for="adjNote">Açıklama (isteğe bağlı, kullanıcıya bildirimde görünür)</label><input class="input" id="adjNote" maxlength="200" placeholder="Örn. turnuva ödülü"></div>
        <div class="adj-prev" aria-live="polite"><div><span>Mevcut bakiye</span><b>${n0(u.balance)}</b></div><div class="adj-ch">—</div><div><span>Yeni bakiye</span><b data-new>—</b></div></div>
        <p class="muted small adj-rank">&nbsp;</p>
        <p class="form-error" role="alert" hidden></p>
      </div>`);
    const amt = body.querySelector('#adjAmt');
    const err = body.querySelector('.form-error');
    const lab = body.querySelector('[data-lab]');
    let last = null;
    const LAB = { add: 'Eklenecek BP', reduce: 'Düşülecek BP', set: 'Yeni bakiye (BP)' };
    async function preview() {
      err.hidden = true;
      last = null;
      const v = parseInt(amt.value, 10);
      const ch = body.querySelector('.adj-ch');
      if (!(v >= 0) || (mode !== 'set' && v === 0)) {
        ch.textContent = '—';
        ch.className = 'adj-ch';
        body.querySelector('[data-new]').textContent = '—';
        body.querySelector('.adj-rank').innerHTML = '&nbsp;';
        return;
      }
      try {
        const r = await BG.api.rpc('bg_admin_bp_adjust', { p_user: u.id, p_mode: mode, p_amount: v, p_note: null, p_preview: true });
        if (parseInt(amt.value, 10) !== v) return;
        last = r;
        ch.textContent = (r.change >= 0 ? '+' : '−') + n0(Math.abs(r.change));
        ch.className = 'adj-ch ' + (r.change >= 0 ? 'pos' : 'neg');
        body.querySelector('[data-new]').textContent = n0(r.new);
        body.querySelector('.adj-rank').innerHTML =
          r.rank_old === r.rank_new ? `Rütbe değişmez: ${BG.rankChip(r.rank_new)}` : `Rütbe: ${BG.rankChip(r.rank_old)} → ${BG.rankChip(r.rank_new)}`;
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
        body.querySelector('[data-new]').textContent = '—';
      }
    }
    const pv = BG.debounce(preview, 220);
    amt.addEventListener('input', pv);
    body.querySelector('.adj-modes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      mode = b.dataset.m;
      body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      lab.textContent = LAB[mode];
      if (mode === 'set' && !amt.value) amt.value = u.balance;
      preview();
    });
    BG.modal({
      title: 'BP düzenle',
      body,
      size: 's',
      actions: [
        { label: 'Vazgeç', kind: 'ghost' },
        {
          label: 'Onayla ve uygula',
          kind: 'primary',
          close: false,
          onClick: async (m, btn) => {
            if (!last) {
              await preview();
              if (!last) return;
            }
            const ok = await BG.confirm({
              title: 'Onaylıyor musun?',
              text: `${u.full_name || u.username}: ${n0(last.old)} BP → ${n0(last.new)} BP (${last.change >= 0 ? '+' : '−'}${n0(Math.abs(last.change))}). Kullanıcıya bildirim gider ve işlem kayda geçer.`,
              okText: 'Uygula',
            });
            if (!ok) return;
            if (btn) btn.disabled = true;
            try {
              const r = await BG.api.rpc('bg_admin_bp_adjust', { p_user: u.id, p_mode: mode, p_amount: parseInt(amt.value, 10), p_note: body.querySelector('#adjNote').value.trim() || null, p_preview: false });
              BG.toast({ type: 'success', title: 'BP güncellendi', text: `${u.username}: ${n0(r.old)} → ${n0(r.new)} BP` });
              m.close();
              if (onDone) onDone();
            } catch (e) {
              err.textContent = e.message;
              err.hidden = false;
              if (btn) btn.disabled = false;
            }
          },
        },
      ],
    });
    setTimeout(() => amt.focus(), 60);
  }

  /* ---------------- bir üyenin BP hareketleri + yönetici kayıtları ---------------- */
  async function ledgerModal(u) {
    const body = BG.frag(`<div class="bpx"><div class="bpx-hist"><div class="bpx-row bpx-head"><span>İşlem</span><span>Değişim</span><span>Önce → Sonra</span></div><div class="bpx-rows"><p class="muted small">Yükleniyor…</p></div></div>
      <button class="btn btn-ghost btn-sm bpx-more" type="button" hidden>Daha fazla</button></div>`);
    const rows = body.querySelector('.bpx-rows');
    const more = body.querySelector('.bpx-more');
    let before = null;
    async function load() {
      try {
        const list = (await BG.api.rpc('bg_admin_user_ledger', { p_user: u.id, p_before: before })) || [];
        if (before === null) rows.innerHTML = list.length ? '' : '<p class="muted small">Hareket yok.</p>';
        list.forEach((r) => {
          const d = new Date(r.created_at);
          rows.appendChild(BG.frag(`<div class="bpx-row"><span class="bpx-k"><b>${esc(r.note || BG.bp.kindLabel(r.kind))}</b><small>${esc(BG.fmt.dateShort(d))} ${esc(BG.fmt.clock(d))} · ${esc(BG.bp.gameLabel(r.game))} · ${esc(BG.bp.kindLabel(r.kind))}</small></span>
            <b class="bpx-d ${r.amount >= 0 ? 'pos' : 'neg'}">${r.amount >= 0 ? '+' : '−'}${n0(Math.abs(r.amount))}</b><span class="bpx-ba muted">${n0(r.balance_before)} → <b>${n0(r.balance_after)}</b></span></div>`));
        });
        if (list.length) before = list[list.length - 1].id;
        more.hidden = list.length < 60;
      } catch (e) {
        rows.innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
      }
    }
    more.addEventListener('click', load);
    load();
    BG.modal({ title: `${u.full_name || u.username} · BP hareketleri`, body, size: 'm', actions: [{ label: 'Kapat', kind: 'ghost' }] });
  }

  const PROD_SHORT = { emoji_vip: 'VIP Emoji', emoji_premium: 'Premium Emoji', geveze: 'Geveze', gifter_pack: 'Gifter', frame_bronz: 'Bronz', frame_gumus: 'Gümüş', frame_altin: 'Altın', frame_neon: 'Neon', frame_ates: 'Ateş', frame_buz: 'Buz', frame_kraliyet: 'Kraliyet' };

  /* ---------------- BP yönetimi: ayarlar + yönetici kayıtları ---------------- */
  async function bpPane(root) {
    const box = root.querySelector('[data-pane="bp"]');
    box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d, aud;
    try {
      [d, aud] = await Promise.all([BG.api.rpc('bg_admin_bp_overview', {}), BG.api.rpc('bg_admin_bp_audit', { p_user: null, p_limit: 80 })]);
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    const s = d.settings || {};
    const MODE = { add: 'BP ekledi', reduce: 'BP düşürdü', set: 'Bakiye ayarladı' };
    box.innerHTML = `
      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head"><h2>Ayarlar</h2></div>
          <form class="form" id="bpForm" novalidate>
            <div class="field"><label class="field-label" for="bpWelcome">Başlangıç BP’si</label><input class="input" id="bpWelcome" type="number" min="0" max="1000000" value="${s.bp_welcome ?? 2000}"><p class="field-hint">Yeni üyenin hesabına bir kez verilir (şartname: 2.000).</p></div>
            <div class="field"><label class="field-label" for="bpDaily">Günlük bonus</label><input class="input" id="bpDaily" type="number" min="0" max="100000" value="${s.bp_daily ?? 50}"><p class="field-hint">Üye günde bir kez tıklayarak alır (Türkiye saati, şartname: 50). 0 yaparsan kapanır.</p></div>
            <div class="field"><span class="field-label">Ana sayfa görünümü</span>
              <div class="filters" role="radiogroup" aria-label="Ana sayfa görünümü">
                <button type="button" class="filter${s.home_style !== 'klasik' ? ' is-on' : ''}" data-hs="yeni" role="radio" aria-checked="${s.home_style !== 'klasik'}">Yeni (görselli)</button>
                <button type="button" class="filter${s.home_style === 'klasik' ? ' is-on' : ''}" data-hs="klasik" role="radio" aria-checked="${s.home_style === 'klasik'}">Klasik</button>
              </div><p class="field-hint">Bütün ziyaretçiler ana sayfayı bu görünümle açar.</p></div>
            <button class="btn btn-primary" type="submit">Kaydet</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Yönetici BP kayıtları</h2></div>
          <p class="panel-lead">Her ekleme, azaltma ve bakiye ayarı burada kalıcı olarak tutulur; değiştirilemez, silinemez.</p>
          <ul class="aud-list">${(aud || []).length ? aud.map((a) => `<li><span><b>${esc(a.admin_username || 'yönetici')}</b> ${esc(MODE[a.mode] || a.mode)} → <button class="link-btn" type="button" data-player="${esc(a.target_id)}">${esc(a.target_name || a.target_username)}</button></span>
              <span class="${a.change >= 0 ? 'pos' : 'neg'}">${a.change >= 0 ? '+' : '−'}${n0(Math.abs(a.change))}</span>
              <small>${esc(BG.fmt.dateShort(a.created_at))} ${esc(BG.fmt.clock(a.created_at))} · ${n0(a.old_balance)} → ${n0(a.new_balance)} BP${a.note ? ' · ' + esc(a.note) : ''} · #${esc(String(a.id).slice(0, 8))}</small></li>`).join('') : '<li class="muted small">Henüz yönetici işlemi yok.</li>'}</ul>
        </section>
      </div>`;
    let hs = s.home_style === 'klasik' ? 'klasik' : 'yeni';
    box.querySelectorAll('[data-hs]').forEach((b) =>
      b.addEventListener('click', () => {
        hs = b.dataset.hs;
        box.querySelectorAll('[data-hs]').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
      }),
    );
    box.querySelector('#bpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const r = await BG.api.rpc('bg_admin_bp_settings', {
          p_welcome: parseInt(box.querySelector('#bpWelcome').value, 10),
          p_daily: parseInt(box.querySelector('#bpDaily').value, 10),
          p_home_style: hs,
        });
        if (r && r.home_style && BG.setHomeStyle) BG.setHomeStyle(r.home_style);
        BG.toast({ type: 'success', text: 'BP ayarları kaydedildi.' });
      } catch (ex) {
        BG.toastError(ex);
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------------- Ekonomi ekranı ---------------- */
  async function ecoPane(root, days) {
    const box = root.querySelector('[data-pane="eco"]');
    days = days == null ? (box.dataset.days != null ? Number(box.dataset.days) : 1) : days;
    box.dataset.days = days;
    if (!box.firstElementChild) box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d;
    try {
      d = await BG.api.rpc('bg_admin_economy', { p_days: days });
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    const card = (v, l, cls) => `<div class="eco-card"><span>${esc(l)}</span><b class="${cls || ''}">${v}</b></div>`;
    const sg = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
    const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + n0(Math.abs(v));
    const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
    const am = d.americano || {};
    const dk = d.dostkazigi || {};
    const bj = d.blackjack || {};
    box.innerHTML = `
      <div class="filters eco-range" role="tablist">${[[1, 'Bugün'], [7, 'Son 7 gün'], [30, 'Son 30 gün'], [0, 'Bütün zamanlar']].map(([v, l]) => `<button class="filter${v === days ? ' is-on' : ''}" data-days="${v}" role="tab" aria-selected="${v === days}">${l}</button>`).join('')}</div>
      <h3 class="eco-h">Genel</h3>
      <div class="eco-grid">
        ${card(n0(d.users_total), 'Kayıtlı kullanıcı')}${card(n0(d.dau), 'Bugün aktif kullanıcı')}${card(n0(d.active_range), 'Bu aralıkta aktif')}
        ${card(n0(d.circulation), 'Toplam BP dolaşımı')}${card(n0(d.pending_bp), 'Toplanmamış maç ödülü (BP)')}${card(n0(d.fc_circulation), 'Friend Coins dolaşımı')}
        ${card(n0(d.daily), 'Günlük bonus BP')}${card(n0(d.missions), 'Görev ödülü BP')}${card(n0(d.welcome), 'Başlangıç BP’si')}
        ${card(n0(d.game_in), 'Oyunlardan üretilen BP', 'pos')}${card(n0(d.game_out), 'Oyunlardan eksilen BP', 'neg')}${card(n0(d.store), 'Mağazada harcanan BP')}
        ${card(n0(d.admin_add), 'Yöneticinin eklediği BP', 'pos')}${card(n0(d.admin_remove), 'Yöneticinin düşürdüğü BP', 'neg')}${card(n0(d.fc_convert), 'FC dönüşümünden BP')}
        ${card(sgn(d.net), 'Net BP değişimi', sg(d.net))}
      </div>
      <div class="eco-games">
        <section class="eco-game"><h3>${BG.gameTile('americano-online', 'tile-xs')}Americano Online</h3><dl>
          ${row('Tamamlanan ücretli maç', n0(am.matches))}${row('Giriş ücretleri', n0(am.fees))}${row('Maç ödülleri (toplanan)', n0(am.prizes))}${row('Ücret iadeleri', n0(am.refunds))}${row('Görev ödülleri', n0(am.missions))}
          <div class="net"><dt>Net BP farkı (oyuncular)</dt><dd class="${sg(am.net)}">${sgn(am.net)}</dd></div></dl></section>
        <section class="eco-game"><h3>${BG.gameTile('dostkazigi-online', 'tile-xs')}Dost Kazığı Online</h3><dl>
          ${row('Tamamlanan ücretli maç', n0(dk.matches))}${row('Giriş ücretleri', n0(dk.fees))}${row('Maç ödülleri (toplanan)', n0(dk.prizes))}${row('Ücret iadeleri', n0(dk.refunds))}${row('Görev ödülleri', n0(dk.missions))}
          <div class="net"><dt>Net BP farkı (oyuncular)</dt><dd class="${sg(dk.net)}">${sgn(dk.net)}</dd></div></dl></section>
        <section class="eco-game"><h3>${BG.gameTile('blackjack', 'tile-xs')}Blackjack Royale</h3><dl>
          ${row('Toplam bahis (ana + ek + sigorta)', n0(bj.bets))}${row('Bet Behind bahisleri', n0(bj.bb_bets))}${row('Normal kazanç ödemeleri', n0(bj.wins))}${row('Blackjack (3:2) ödemeleri', n0(bj.naturals))}
          ${row('Bet Behind ödemeleri', n0(bj.bb_pay))}${row('Sigorta ödemeleri', n0(bj.insurance_pay))}${row('Berabere / teslim iadeleri', n0(bj.returns))}${row('İptal iadeleri', n0(bj.refunds))}${row('Jackpot ödülleri', n0(bj.jackpots))}${row('Görev ödülleri', n0(bj.missions))}
          <div class="net"><dt>Net BP farkı (oyuncular)</dt><dd class="${sg(bj.net)}">${sgn(bj.net)}</dd></div></dl></section>
        <section class="eco-game"><h3>${icon('bag', 18)}Mağaza satışları</h3><dl>
          ${(d.store_sales || []).length ? d.store_sales.map((x) => row(x.name + ' × ' + x.n, n0(x.bp) + ' BP')).join('') : '<p class="muted small">Bu aralıkta satış yok.</p>'}</dl></section>
      </div>
      <p class="muted small">Net BP farkı oyuncuların toplam kazanç − kayıp farkıdır; eksi değer oyunların BP’yi dolaşımdan çektiğini gösterir. Yönetici düzeltmeleri oyun ödülü sayılmaz, ayrı gösterilir.</p>`;
    box.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => ecoPane(root, Number(b.dataset.days))));
  }

  /* ---------------- Mağaza fiyatları ---------------- */
  async function storePane(root) {
    const box = root.querySelector('[data-pane="store"]');
    box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d;
    try {
      d = await BG.api.rpc('bg_admin_economy', { p_days: 0 });
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    box.innerHTML = `<section class="panel"><div class="panel-head"><h2>Mağaza ürünleri</h2></div>
      <p class="panel-lead">Fiyat değişikliği yalnızca yeni satın alımları etkiler; satın alınmış ürünler kalıcıdır. Pasif ürün mağazada satılmaz (sahipleri kullanmaya devam eder).</p>
      ${(d.products || []).map((p) => `<div class="price-row" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b><small class="muted"> · ${n0(p.owners)} sahibi</small></span>
        <input class="input" type="number" min="0" max="1000000" value="${p.price}" aria-label="${esc(p.name)} fiyatı"><label class="check"><input type="checkbox" ${p.active ? 'checked' : ''}><span>Satışta</span></label>
        <button class="btn btn-soft btn-sm" type="button" data-save>Kaydet</button></div>`).join('')}</section>`;
    box.querySelectorAll('[data-save]').forEach((b) =>
      b.addEventListener('click', async () => {
        const r = b.closest('.price-row');
        b.disabled = true;
        try {
          await BG.api.rpc('bg_admin_store_price', { p_product: r.dataset.id, p_price: parseInt(r.querySelector('input[type=number]').value, 10), p_active: r.querySelector('input[type=checkbox]').checked });
          BG.toast({ type: 'success', text: 'Ürün güncellendi.' });
        } catch (e) {
          BG.toastError(e);
        } finally {
          b.disabled = false;
        }
      })
    );
  }

  /* ---------------- Profil yorumu bildirimleri ---------------- */
  async function reportsPane(root) {
    const box = root.querySelector('[data-pane="reports"]');
    box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let list;
    try {
      list = (await BG.api.rpc('bg_admin_comment_reports', {})) || [];
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    box.innerHTML = `<section class="panel"><div class="panel-head"><h2>Bildirilen profil yorumları</h2></div>
      ${list.length ? '' : '<p class="muted">Bekleyen bildirim yok.</p>'}<div class="rep-list"></div></section>`;
    const wrap = box.querySelector('.rep-list');
    list.forEach((r) => {
      const it = BG.frag(`<div class="rep-it"><div class="muted small"><b>@${esc(r.author_username)}</b> → @${esc(r.profile_username)} profiline · bildiren @${esc(r.reporter_username)} · ${esc(BG.fmt.ago(r.created_at))}${r.reason ? ' · ' + esc(r.reason) : ''}</div><p></p>
        <div class="acts"><button class="btn btn-danger btn-sm" type="button" data-del>${icon('trash', 15)}Yorumu kaldır</button><button class="btn btn-ghost btn-sm" type="button" data-keep>Yoksay</button></div></div>`);
      it.querySelector('p').textContent = r.body;
      it.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            await BG.api.rpc('bg_admin_comment_resolve', { p_report: r.id, p_delete: b.hasAttribute('data-del') });
            reportsPane(root);
          } catch (e) {
            BG.toastError(e);
          }
        })
      );
      wrap.appendChild(it);
    });
  }

  /* ---------------- Blackjack masaları ---------------- */
  const BJ_STATE = {
    WAITING_FOR_PLAYERS: 'Oyuncu bekliyor', BETTING_OPEN: 'Bahis açık', BETTING_LOCKED: 'Bahis kilitli', INITIAL_DEAL: 'Dağıtım', DEALER_PEEK: 'Krupiye kontrolü',
    INSURANCE_WINDOW: 'Sigorta', PLAYER_TURNS: 'Oyuncu sırası', DEALER_TURN: 'Krupiye sırası', SETTLEMENT: 'Sonuçlandırma', RESULT_DISPLAY: 'Sonuç',
    SHOE_RESHUFFLE: 'Karıştırma', NEXT_ROUND: 'Yeni tur', PAUSED: 'Duraklatıldı', CLOSED: 'Kapandı',
  };
  const CANCELLABLE = ['BETTING_OPEN', 'INITIAL_DEAL', 'INSURANCE_WINDOW', 'DEALER_PEEK', 'PLAYER_TURNS', 'DEALER_TURN'];
  const ACT = { pause: 'duraklatıldı', resume: 'sürdürüldü', close: 'kapatıldı', cancel_round: 'tur iptal edildi' };
  const WHY = { admin: 'yönetici', shoe_empty: 'kart bitti', min_pots: 'yetersiz pot', paused: 'masa duraklatıldı', closing: 'masa kapandı', closed: 'masa kapandı', owner: 'sahibi kapattı', idle: 'uzun süre boş kaldı' };
  const SRC = { seat: 'ana bahis + sigorta', extra: 'ek bahis (double/split)', bet_behind: 'Bet Behind' };
  const EV = { created: 'Masa açıldı', closed: 'Masa kapandı', closing: 'Kapanış istendi', cancel: 'Tur iptal edildi', jackpot: 'JACKPOT', admin: 'Yönetici işlemi', shoe: 'Yeni sabot', cut: 'Kesme kartı çıktı', pre_invalid: 'Geçersiz ön hamle', bb_refund: 'Bet Behind iadesi (BP yetersiz)', bet_dropped: 'Bahis tahsil edilemedi', tick_error: 'Zamanlayıcı hatası', disconnect: 'Bağlantı koptu' };
  async function bjPane(root, quiet) {
    const box = root.querySelector('[data-pane="bj"]');
    if (!quiet) box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d;
    try {
      d = await BG.api.rpc('bg_bj_admin_overview', {});
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    const t = d.today || {};
    const when = (x) => (x ? new Date(x).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
    box.innerHTML = `
      <div class="stat-strip">
        ${[[n0(t.wagered), 'bugün yatırılan bahis (BP)'], [n0(t.won), 'kazanç ödemesi (BP)'], [n0(t.returned), 'berabere/teslim iadesi'], [n0(t.refunded), 'iptal iadesi'], [n0(t.jackpot), 'jackpot (BP)'], [n0(t.rounds), 'tamamlanan tur']]
          .map(([v, l]) => `<span class="stat"><b class="stat-v">${v}</b><span>${esc(l)}</span></span>`)
          .join('')}
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Masalar</h2></div>
        <p class="panel-lead">Duraklat ve kapat devam eden turu bozmaz, tur bitince uygulanır. Hiçbir işlem kartları ya da sonuçları değiştirmez.</p>
        <div class="bja-list">${(d.tables || [])
          .map(
            (x) => `<article class="bja-t${x.closed ? ' is-closed' : ''}">
              <header><b>${esc(x.name)}</b><span class="chip">${esc({ bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }[x.tier] || x.tier)}</span><span class="chip chip-quiet">${esc(x.status === 'open' ? BJ_STATE[x.state] || x.state : x.status === 'paused' ? 'Duraklatıldı' : x.status === 'closing' ? 'Kapanıyor' : 'Kapandı')}</span></header>
              <p class="muted">Sahibi ${esc(x.owner || '—')} · Tur ${x.round_number} · ${x.pots}/7 pot · ${x.viewers} izleyici · Jackpot serisi ${x.streak}/5${x.shoe ? ` · Sabot ${x.shoe.no}: ${x.shoe.dealt} kart dağıtıldı, ${x.shoe.left} kaldı${x.shoe.cut ? ' (kesme kartı çıktı)' : ''}` : ''}</p>
              <p class="bja-seats">${(x.seats || []).map((s) => `<span class="${s.conn === 'disconnected' ? 'off' : ''}">P${s.no} ${esc(s.name)}${s.leaving ? ' (kalkıyor)' : ''}</span>`).join('') || '<span class="muted">Oturan yok</span>'}</p>
              ${x.closed ? '' : `<div class="bja-act">
                ${x.status === 'paused' ? '<button class="btn btn-soft btn-sm" type="button" data-bj="resume">Sürdür</button>' : '<button class="btn btn-soft btn-sm" type="button" data-bj="pause">Duraklat</button>'}
                ${CANCELLABLE.includes(x.state) ? '<button class="btn btn-soft btn-sm" type="button" data-bj="cancel_round">Turu iptal et (iade)</button>' : ''}
                <button class="btn btn-danger btn-sm" type="button" data-bj="close">Kapat</button></div>`}
              <input type="hidden" value="${esc(x.id)}">
            </article>`,
          )
          .join('') || '<p class="loading-row">Açık masa yok.</p>'}</div>
      </section>
      <div class="admin-grid">
        <section class="panel"><div class="panel-head"><h2>Jackpotlar</h2></div>
          <ul class="bja-log">${(d.jackpots || []).map((j) => `<li><b>${esc(j.table_name)}</b> · ${esc(j.table_tier)} · ${n0(j.total_awarded_bp)} BP · ${j.awards} ödül<time>${when(j.created_at)}</time></li>`).join('') || '<li class="muted">Henüz jackpot yok.</li>'}</ul></section>
        <section class="panel"><div class="panel-head"><h2>İptal edilen turlar</h2></div>
          <ul class="bja-log">${(d.cancelled || []).map((r) => `<li><b>${esc(r.table_name)}</b> · Tur ${r.round_number} · ${esc(WHY[r.cancel_reason] || r.cancel_reason || '')}<time>${when(r.settled_at)}</time></li>`).join('') || '<li class="muted">İptal edilen tur yok.</li>'}</ul></section>
      </div>
      <div class="admin-grid">
        <section class="panel"><div class="panel-head"><h2>İade denetim kaydı</h2></div>
          <ul class="bja-log">${(d.refunds || []).map((r) => `<li><b>${esc(r.name)}</b> · ${n0(r.amount)} BP · ${esc(SRC[r.source] || r.source)} · ${esc(WHY[r.reason] || r.reason)} · ${esc(r.table_name)}<time>${when(r.created_at)}</time></li>`).join('') || '<li class="muted">İade yok.</li>'}</ul></section>
        <section class="panel"><div class="panel-head"><h2>Sistem günlüğü</h2></div>
          <ul class="bja-log">${(d.events || []).map((e) => `<li><b>${esc(EV[e.type] || e.type)}</b> · ${esc(e.table_name)}${e.payload && e.payload.reason ? ' · ' + esc(WHY[e.payload.reason] || e.payload.reason) : ''}${e.payload && e.payload.action ? ' · ' + esc(ACT[e.payload.action] || e.payload.action) : ''}<time>${when(e.created_at)}</time></li>`).join('') || '<li class="muted">Kayıt yok.</li>'}</ul></section>
      </div>`;
    box.querySelectorAll('[data-bj]').forEach((b) =>
      b.addEventListener('click', async () => {
        const card = b.closest('.bja-t');
        const id = card.querySelector('input[type=hidden]').value;
        const a = b.dataset.bj;
        const label = { pause: 'Masa duraklatılsın mı?', resume: 'Masa sürdürülsün mü?', cancel_round: 'Devam eden tur iptal edilsin mi?', close: 'Masa kapatılsın mı?' }[a];
        const text = {
          pause: 'Devam eden tur tamamlanır, yeni tur başlamaz.',
          resume: 'Masa yeniden oyuncu ve bahis kabul eder.',
          cancel_round: 'Turdaki bütün bahisler (ana, ek, sigorta, Bet Behind) iade edilir ve iade kaydına yazılır.',
          close: 'Devam eden tur varsa tamamlanır, sonra masa kapanır ve oyuncular kalkar.',
        }[a];
        const ok = await BG.confirm({ title: label, text, okText: { pause: 'Duraklat', resume: 'Sürdür', cancel_round: 'Turu iptal et', close: 'Masayı kapat' }[a], danger: a === 'close' || a === 'cancel_round' });
        if (!ok) return;
        b.disabled = true;
        try {
          await BG.api.rpc('bg_bj_admin_table', { p_table: id, p_action: a });
          BG.toast({ type: 'success', text: 'İşlem uygulandı.' });
          bjPane(root, true);
        } catch (e) {
          BG.toastError(e);
          b.disabled = false;
        }
      }),
    );
  }

  BG.views.admin = function () {
    const root = BG.frag(`
      <div class="page admin">
        <header class="page-head">
          <div><h1>Yönetim paneli</h1><p class="page-lead">Üyeler ve BP bakiyeleri, BP yönetimi, ekonomi, mağaza ve Blackjack masaları. Şifreler hiçbir zaman görüntülenmez.</p></div>
          <button class="btn btn-soft" type="button" data-refresh>${icon('refresh', 18)}Yenile</button>
        </header>
        <nav class="admin-tabs filters" role="tablist" aria-label="Yönetim bölümleri">
          <button class="filter is-on" data-tab="users" role="tab" aria-selected="true">${icon('users', 16)}Üyeler</button>
          <button class="filter" data-tab="bp" role="tab" aria-selected="false">${icon('coin', 16)}BP yönetimi</button>
          <button class="filter" data-tab="eco" role="tab" aria-selected="false">${icon('chart', 16)}Ekonomi</button>
          <button class="filter" data-tab="store" role="tab" aria-selected="false">${icon('bag', 16)}Mağaza</button>
          <button class="filter" data-tab="reports" role="tab" aria-selected="false">${icon('flag', 16)}Yorum bildirimleri</button>
          <button class="filter" data-tab="bj" role="tab" aria-selected="false">Blackjack</button>
        </nav>
        <div class="admin-pane" data-pane="bp" hidden></div>
        <div class="admin-pane" data-pane="eco" hidden></div>
        <div class="admin-pane" data-pane="store" hidden></div>
        <div class="admin-pane" data-pane="reports" hidden></div>
        <div class="admin-pane" data-pane="bj" hidden></div>
        <div class="stat-strip" aria-live="polite" data-pane-users></div>
        <section class="panel" data-pane-users>
          <div class="table-tools">
            <div class="input-wrap has-icon grow">${icon('search', 18)}<input class="input" type="search" placeholder="Kullanıcı adı ya da isim ara" aria-label="Üye ara"></div>
            <div class="filters" role="tablist">
              <button class="filter is-on" data-f="all" role="tab" aria-selected="true">Tümü</button>
              <button class="filter" data-f="online" role="tab" aria-selected="false">Çevrimiçi</button>
              <button class="filter" data-f="playing" role="tab" aria-selected="false">Oyunda</button>
            </div>
          </div>
          <div class="am-scroll">
            <table class="am-table" aria-label="Üyeler">
              <thead><tr>
                <th><button type="button" data-sort="name">Üye</button></th>
                <th><button type="button" data-sort="balance">BP</button></th>
                <th><button type="button" data-sort="rank">Rütbe</button></th>
                <th><button type="button" data-sort="prestige">Prestij</button></th>
                <th>Paketler</th>
                <th><button type="button" data-sort="active">Son aktiflik</button></th>
                <th><button type="button" data-sort="created">Kayıt</button></th>
                <th><span class="sr-only">İşlemler</span></th>
              </tr></thead>
              <tbody><tr><td colspan="8" class="loading-row">Yükleniyor…</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>`);

    let users = [];
    let tab = 'users';
    let filter = 'all';
    let q = '';
    let sort = { key: 'balance', dir: -1 };
    const body = root.querySelector('.am-table tbody');

    function stats() {
      const weekAgo = Date.now() - 7 * 86400000;
      const total = users.length;
      const on = users.filter((u) => u.online).length;
      const playing = users.filter((u) => u.online && u.game).length;
      const fresh = users.filter((u) => new Date(u.created_at).getTime() > weekAgo).length;
      const bp = users.reduce((a, u) => a + (u.balance || 0), 0);
      root.querySelector('.stat-strip[data-pane-users]').innerHTML = [
        [total, 'üye', 'ink'],
        [on, 'çevrimiçi', 'mint'],
        [playing, 'oyunda', 'amber'],
        [fresh, 'son 7 günde katıldı', 'sky'],
      ]
        .map(([n, l, c]) => `<span class="stat"><span class="flap-num">${BG.flapRow(String(n), c, 'tile-s')}</span><span>${esc(l)}</span></span>`)
        .join('') + `<span class="stat"><b class="stat-v">${n0(bp)}</b><span>toplam BP</span></span>`;
    }
    const lastActive = (u) => (u.online ? Date.now() : u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0);
    function sorted(list) {
      const k = sort.key;
      const val = (u) =>
        k === 'balance' ? u.balance : k === 'rank' ? u.rank * 1e9 + u.balance : k === 'prestige' ? u.prestige * 1e9 + u.balance : k === 'active' ? lastActive(u) : k === 'created' ? new Date(u.created_at).getTime() : String(u.full_name || u.username).toLocaleLowerCase('tr-TR');
      return list.slice().sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
    function draw() {
      root.querySelectorAll('[data-sort]').forEach((b) => {
        const on = b.dataset.sort === sort.key;
        b.closest('th').classList.toggle('is-sort', on);
        b.closest('th').setAttribute('aria-sort', on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
        b.innerHTML = b.textContent.replace(/[▲▼]\s*$/, '').trim() + (on ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
      });
      const ql = q.toLocaleLowerCase('tr-TR').replace(/^@/, '');
      const shown = sorted(
        users.filter(
          (u) =>
            (filter === 'all' || (filter === 'online' && u.online) || (filter === 'playing' && u.online && u.game)) &&
            (!ql || (u.username + ' ' + (u.full_name || '')).toLocaleLowerCase('tr-TR').includes(ql))
        )
      );
      if (!shown.length) {
        body.innerHTML = '<tr><td colspan="8" class="loading-row">Bu filtreye uyan üye yok.</td></tr>';
        return;
      }
      body.innerHTML = '';
      shown.forEach((u) => {
        const st = statusOf(u);
        const tr = BG.frag(`<table><tbody><tr data-id="${esc(u.id)}">
            <td><span class="am-person"><button class="avatar-btn" type="button" data-player="${esc(u.id)}" aria-label="Profili aç">${BG.avatar(u, { size: 40, online: !!u.online, frame: u.frame })}</button>
              <span class="u-names"><strong>${esc(u.full_name || u.username)}</strong><span>@${esc(u.username)}</span>
              ${u.is_admin ? `<em class="chip chip-admin">${icon('shield', 13)}Yönetici</em>` : ''}${u.must_change_password ? '<em class="chip chip-quiet">Geçici şifre</em>' : ''}</span></span></td>
            <td><span class="am-bp">${n0(u.balance)}</span> <span class="muted small">BP</span>${u.pending ? `<div class="muted small">${u.pending} bekleyen ödül</div>` : ''}</td>
            <td>${BG.rankChip(u.rank)}<div class="muted small">En yüksek: ${esc(BG.rankInfo(u.best_rank).name)}</div></td>
            <td>${u.prestige ? BG.prestigeChip(u.prestige) : '<span class="muted">—</span>'}</td>
            <td><span class="am-prods">${(u.products || []).map((p) => `<span class="am-prod">${esc(PROD_SHORT[p] || p)}</span>`).join('') || '<span class="muted">—</span>'}</span></td>
            <td><span class="person-status ${st.cls}">${esc(st.text)}</span>${u.active_secs ? `<div class="muted small">Toplam ${esc(BG.hours(u.active_secs))}</div>` : ''}
              <div class="muted small am-counts">${n0(u.games_count)} oyun · ${n0(u.friends_count)} arkadaş · ${n0(u.messages_count)} mesaj</div></td>
            <td class="muted small">${esc(BG.fmt.dateShort(u.created_at))}</td>
            <td><span class="am-acts">
              <button class="btn btn-primary btn-sm" type="button" data-act="bp">${icon('coin', 15)}BP düzenle</button>
              <button class="btn btn-soft btn-sm" type="button" data-act="ledger" title="BP hareketleri">${icon('history', 15)}</button>
              <button class="btn btn-soft btn-sm" type="button" data-act="pw" title="Şifre belirle">${icon('key', 15)}</button>
              <button class="btn btn-danger btn-sm" type="button" data-act="del" ${u.is_admin ? 'disabled title="Yönetici hesabı silinemez"' : 'title="Hesabı sil"'}>${icon('trash', 15)}</button>
            </span></td></tr></tbody></table>`).querySelector('tr');
        tr.querySelector('[data-act="pw"]').addEventListener('click', () => setPasswordModal(u, load));
        tr.querySelector('[data-act="bp"]').addEventListener('click', () => adjustModal(u, load));
        tr.querySelector('[data-act="ledger"]').addEventListener('click', () => ledgerModal(u));
        tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
          if (await deleteUser(u)) {
            users = users.filter((x) => x.id !== u.id);
            stats();
            draw();
          }
        });
        body.appendChild(tr);
      });
    }

    async function load() {
      try {
        const [m, old] = await Promise.all([BG.api.rpc('bg_admin_members', {}), BG.api.rpc('bg_admin_users', {}).catch(() => [])]);
        const extra = new Map((old || []).map((x) => [x.id, x]));
        users = (m || []).map((u) => {
          const o = extra.get(u.id) || {};
          return Object.assign({}, u, { must_change_password: o.must_change_password, games_count: o.games_count || 0, friends_count: o.friends_count || 0, messages_count: o.messages_count || 0, frame: null }, u.frame ? { frame: u.frame } : {});
        });
        // çerçeveler rozetlerden
        try {
          const b = await BG.api.rpc('bg_user_badges', { p_ids: users.map((u) => u.id) });
          users.forEach((u) => (u.frame = b && b[u.id] ? b[u.id].frame : null));
        } catch (e) {}
        if (!root.isConnected) return;
        stats();
        draw();
      } catch (e) {
        body.innerHTML = `<tr><td colspan="8" class="loading-row">${esc(e.message)}</td></tr>`;
      }
    }

    root.querySelector('input[type=search]').addEventListener(
      'input',
      BG.debounce((e) => {
        q = e.target.value.trim();
        draw();
      }, 150)
    );
    root.querySelectorAll('.filter[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.f;
        root.querySelectorAll('.filter[data-f]').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-selected', String(x === b));
        });
        draw();
      })
    );
    root.querySelectorAll('[data-sort]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.sort;
        sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 };
        draw();
      })
    );
    const refreshTab = () => (tab === 'bp' ? bpPane(root) : tab === 'eco' ? ecoPane(root) : tab === 'store' ? storePane(root) : tab === 'reports' ? reportsPane(root) : tab === 'bj' ? bjPane(root) : load());
    root.querySelector('[data-refresh]').addEventListener('click', refreshTab);
    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-selected', String(x === b));
        });
        root.querySelectorAll('[data-pane-users]').forEach((x) => (x.hidden = tab !== 'users'));
        root.querySelectorAll('.admin-pane').forEach((x) => (x.hidden = x.dataset.pane !== tab));
        if (tab !== 'users') refreshTab();
      })
    );

    // Anlık durum güncellemeleri
    let ch = null;
    try {
      ch = BG.api
        .channel('bg-admin-presence-' + Date.now().toString(36))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, (p) => {
          const r = p.new;
          const u = r && users.find((x) => x.id === r.user_id);
          if (!u) return;
          u.online = r.status === 'online' && Date.now() - new Date(r.last_seen_at).getTime() < 75000;
          u.game = u.online ? r.game : null;
          u.last_seen_at = r.last_seen_at;
          if (tab === 'users') {
            stats();
            draw();
          }
        })
        .subscribe();
    } catch (e) {}
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (tab === 'users') load();
      else if (tab === 'bj') bjPane(root, true);
      else if (tab === 'eco') ecoPane(root);
    }, 30000);
    load();
    return {
      node: root,
      cleanup: () => {
        clearInterval(timer);
        BG.api.removeChannel(ch);
      },
    };
  };
})();
