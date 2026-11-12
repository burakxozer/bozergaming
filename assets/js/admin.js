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
  function grantModal(u, onDone) {
    const m = BG.modal({
      title: 'BP ver ya da al',
      size: 's',
      body: `<p class="modal-text"><b>${esc(u.full_name || u.username)}</b> · @${esc(u.username)}</p>
        <div class="form">
          <div class="field"><label class="field-label" for="grAmt">Miktar (BP)</label><input class="input" id="grAmt" type="number" inputmode="numeric" step="1" placeholder="Örn. 500 ya da -200"><p class="field-hint">Artı değer ekler, eksi değer bakiyeden düşer (bakiyeden fazlası alınamaz). Her hareket üyenin BP geçmişine yazılır.</p><p class="field-msg"></p></div>
          <div class="field"><label class="field-label" for="grNote">Açıklama (isteğe bağlı)</label><input class="input" id="grNote" maxlength="80" placeholder="Örn. turnuva ödülü"></div>
        </div>`,
      actions: [
        { label: 'Vazgeç', kind: 'ghost' },
        {
          label: 'Uygula',
          kind: 'primary',
          onClick: async (api) => {
            const amt = parseInt(api.body.querySelector('#grAmt').value, 10);
            if (!amt) {
              BG.fieldMsg(api.body.querySelector('#grAmt'), 'Sıfırdan farklı bir miktar gir.', 'error');
              return false;
            }
            try {
              const r = await BG.api.rpc('bg_admin_bp_grant', { p_user: u.id, p_amount: amt, p_note: api.body.querySelector('#grNote').value.trim() || null });
              BG.toast({ type: 'success', text: `${u.full_name || u.username}: yeni bakiye ${Number(r.balance).toLocaleString('tr-TR')} BP` });
              if (onDone) onDone();
            } catch (e) {
              BG.fieldMsg(api.body.querySelector('#grAmt'), e.message, 'error');
              return false;
            }
          },
        },
      ],
    });
    return m;
  }

  const n0 = (x) => Number(x || 0).toLocaleString('tr-TR');

  /* ---------------- BP ve hediyeler ---------------- */
  async function bpPane(root) {
    const box = root.querySelector('[data-pane="bp"]');
    box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d;
    try {
      d = await BG.api.rpc('bg_admin_bp_overview', {});
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    const s = d.settings || {};
    box.innerHTML = `
      <div class="stat-strip">
        ${[[n0(d.total_bp), 'BP dolaşımda'], [n0(d.wallets), 'cüzdan'], [n0(d.today.given), 'bugün verilen BP'], [n0(d.today.gifts), 'bugün hediyeye harcanan BP']]
          .map(([v, l]) => `<span class="stat"><b class="stat-v">${v}</b><span>${esc(l)}</span></span>`)
          .join('')}
      </div>
      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head"><h2>Ayarlar</h2></div>
          <form class="form" id="bpForm" novalidate>
            <div class="field"><label class="field-label" for="bpWelcome">Hoş geldin BP’si</label><input class="input" id="bpWelcome" type="number" min="0" max="1000000" value="${s.bp_welcome ?? 1000}"><p class="field-hint">Yeni üyenin cüzdanı ilk açıldığında bir kez verilir.</p></div>
            <div class="field"><label class="field-label" for="bpDaily">Günlük BP</label><input class="input" id="bpDaily" type="number" min="0" max="100000" value="${s.bp_daily ?? 100}"><p class="field-hint">Üye günde bir kez alır (İstanbul saatine göre). 0 yaparsan kapanır.</p></div>
            <div class="field"><span class="field-label">Ana sayfa görünümü</span>
              <div class="filters" role="radiogroup" aria-label="Ana sayfa görünümü">
                <button type="button" class="filter${s.home_style !== 'klasik' ? ' is-on' : ''}" data-hs="yeni" role="radio" aria-checked="${s.home_style !== 'klasik'}">Yeni (görselli)</button>
                <button type="button" class="filter${s.home_style === 'klasik' ? ' is-on' : ''}" data-hs="klasik" role="radio" aria-checked="${s.home_style === 'klasik'}">Klasik</button>
              </div><p class="field-hint">Bütün ziyaretçiler ana sayfayı bu görünümle açar.</p></div>
            <button class="btn btn-primary" type="submit">Kaydet</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>En yüksek bakiyeler</h2></div>
          <ol class="bp-top">${(d.top || []).map((u) => `<li><span>${esc(u.full_name || u.username)} <small class="muted">@${esc(u.username)}</small></span><b>${n0(u.balance)} BP</b></li>`).join('') || '<li class="muted">Henüz cüzdan yok.</li>'}</ol>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Hediye fiyatları</h2></div>
        <p class="panel-lead">Pasif hediye, masadaki hediye seçicide görünmez. Fiyat 0–100.000 BP arasında olabilir.</p>
        <div class="gift-admin">${(d.gifts || [])
          .map(
            (g) => `<div class="ga-row" data-code="${esc(g.code)}"><img src="assets/gifts/${esc(g.code)}.webp" alt="" width="40" height="40" loading="lazy"><span><b>${esc(g.name)}</b><small class="muted">${esc({ standart: 'Standart', ozel: 'Özel', premium: 'Premium', saka: 'Şaka' }[g.tier] || g.tier)}</small></span>
              <input class="input ga-price" type="number" min="0" max="100000" value="${g.price}" aria-label="${esc(g.name)} fiyatı"><label class="check"><input type="checkbox" class="ga-on" ${g.active ? 'checked' : ''}><span>Aktif</span></label><button class="btn btn-soft btn-sm" type="button" data-save>Kaydet</button></div>`,
          )
          .join('')}</div>
      </section>`;
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
    box.querySelectorAll('.ga-row [data-save]').forEach((b) =>
      b.addEventListener('click', async () => {
        const row = b.closest('.ga-row');
        b.disabled = true;
        try {
          await BG.api.rpc('bg_admin_gift_price', { p_code: row.dataset.code, p_price: parseInt(row.querySelector('.ga-price').value, 10), p_active: row.querySelector('.ga-on').checked });
          BG.toast({ type: 'success', text: 'Hediye güncellendi.' });
        } catch (ex) {
          BG.toastError(ex);
        } finally {
          b.disabled = false;
        }
      }),
    );
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
          <div><h1>Yönetim paneli</h1><p class="page-lead">Üyeler, Bözer Points ve Blackjack masaları. Şifreler hiçbir zaman görüntülenmez.</p></div>
          <button class="btn btn-soft" type="button" data-refresh>${icon('refresh', 18)}Yenile</button>
        </header>
        <nav class="admin-tabs filters" role="tablist" aria-label="Yönetim bölümleri">
          <button class="filter is-on" data-tab="users" role="tab" aria-selected="true">Üyeler</button>
          <button class="filter" data-tab="bp" role="tab" aria-selected="false">${icon('coin', 16)}BP ve hediyeler</button>
          <button class="filter" data-tab="bj" role="tab" aria-selected="false">Blackjack</button>
        </nav>
        <div class="admin-pane" data-pane="bp" hidden></div>
        <div class="admin-pane" data-pane="bj" hidden></div>
        <div class="stat-strip" aria-live="polite" data-pane-users></div>
        <section class="panel" data-pane-users>
          <div class="table-tools">
            <div class="input-wrap has-icon grow">${icon('search', 18)}<input class="input" type="search" placeholder="İsim veya kullanıcı adı ara" aria-label="Üye ara"></div>
            <div class="filters" role="tablist">
              <button class="filter is-on" data-f="all" role="tab" aria-selected="true">Tümü</button>
              <button class="filter" data-f="online" role="tab" aria-selected="false">Çevrimiçi</button>
              <button class="filter" data-f="playing" role="tab" aria-selected="false">Oyunda</button>
            </div>
          </div>
          <div class="users" role="table" aria-label="Üyeler">
            <div class="u-row u-head" role="row"><span role="columnheader">Üye</span><span role="columnheader">Durum</span><span role="columnheader">Kayıt</span><span role="columnheader">Etkinlik</span><span role="columnheader"><span class="sr-only">İşlemler</span></span></div>
            <div class="u-body"><p class="loading-row">Yükleniyor…</p></div>
          </div>
        </section>
      </div>`);

    let users = [];
    let balances = {};
    let tab = 'users';
    let filter = 'all';
    let q = '';
    const body = root.querySelector('.u-body');

    function stats() {
      const weekAgo = Date.now() - 7 * 86400000;
      const total = users.length;
      const on = users.filter((u) => u.online).length;
      const playing = users.filter((u) => u.online && u.game).length;
      const fresh = users.filter((u) => new Date(u.created_at).getTime() > weekAgo).length;
      root.querySelector('.stat-strip[data-pane-users]').innerHTML = [
        [total, 'üye', 'ink'],
        [on, 'çevrimiçi', 'mint'],
        [playing, 'oyunda', 'amber'],
        [fresh, 'son 7 günde katıldı', 'sky'],
      ]
        .map(([n, l, c]) => `<span class="stat"><span class="flap-num">${BG.flapRow(String(n), c, 'tile-s')}</span><span>${esc(l)}</span></span>`)
        .join('');
    }

    function draw() {
      const ql = q.toLocaleLowerCase('tr-TR');
      const shown = users.filter(
        (u) =>
          (filter === 'all' || (filter === 'online' && u.online) || (filter === 'playing' && u.online && u.game)) &&
          (!ql || (u.username + ' ' + (u.full_name || '')).toLocaleLowerCase('tr-TR').includes(ql))
      );
      if (!shown.length) {
        body.innerHTML = '<p class="loading-row">Bu filtreye uyan üye yok.</p>';
        return;
      }
      body.innerHTML = '';
      shown.forEach((u) => {
        const st = statusOf(u);
        const row = BG.frag(`<div class="u-row" role="row" data-id="${esc(u.id)}">
            <span class="u-person" role="cell">${BG.avatar(u, { size: 42, online: !!u.online })}
              <span class="u-names"><strong>${esc(u.full_name || u.username)}</strong><span>@${esc(u.username)}</span>
              ${u.is_admin ? `<em class="chip chip-admin">${icon('shield', 13)}Yönetici</em>` : ''}${u.must_change_password ? '<em class="chip chip-quiet">Geçici şifre</em>' : ''}</span></span>
            <span class="u-status person-status ${st.cls}" role="cell">${esc(st.text)}</span>
            <span class="u-date muted" role="cell"><span class="u-label">Kayıt: </span>${esc(BG.fmt.dateShort(u.created_at))}</span>
            <span class="u-stats muted" role="cell">${u.games_count} oyun, ${u.friends_count} arkadaş, ${u.messages_count} mesaj${balances[u.id] != null ? ` · <b class="u-bp">${n0(balances[u.id])} BP</b>` : ''}</span>
            <span class="u-actions" role="cell">
              <button class="btn btn-soft btn-sm" type="button" data-act="bp">${icon('coin', 16)}BP</button>
              <button class="btn btn-soft btn-sm" type="button" data-act="pw">${icon('key', 16)}Şifre belirle</button>
              <button class="btn btn-danger btn-sm" type="button" data-act="del" ${u.is_admin ? 'disabled title="Yönetici hesabı silinemez"' : ''}>${icon('trash', 16)}Hesabı sil</button>
            </span>
          </div>`);
        row.querySelector('[data-act="pw"]').addEventListener('click', () => setPasswordModal(u, load));
        row.querySelector('[data-act="bp"]').addEventListener('click', () => grantModal(u, load));
        row.querySelector('[data-act="del"]').addEventListener('click', async () => {
          if (await deleteUser(u)) {
            users = users.filter((x) => x.id !== u.id);
            stats();
            draw();
          }
        });
        body.appendChild(row);
      });
    }

    async function load() {
      try {
        const [u, b] = await Promise.all([BG.api.rpc('bg_admin_users', {}), BG.api.rpc('bg_admin_bp_balances', {}).catch(() => ({}))]);
        users = u || [];
        balances = b || {};
        if (!root.isConnected) return;
        stats();
        draw();
      } catch (e) {
        body.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
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
    root.querySelector('[data-refresh]').addEventListener('click', () => (tab === 'bp' ? bpPane(root) : tab === 'bj' ? bjPane(root) : load()));
    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-selected', String(x === b));
        });
        root.querySelectorAll('[data-pane-users]').forEach((x) => (x.hidden = tab !== 'users'));
        root.querySelectorAll('.admin-pane').forEach((x) => (x.hidden = x.dataset.pane !== tab));
        if (tab === 'bp') bpPane(root);
        if (tab === 'bj') bjPane(root);
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
          stats();
          draw();
        })
        .subscribe();
    } catch (e) {}
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (tab === 'users') load();
      else if (tab === 'bj') bjPane(root, true);
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
