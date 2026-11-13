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

  const PROD_SHORT = { emoji_vip: 'VIP Emoji', emoji_premium: 'Premium Emoji', emoji_cilgin: 'Çılgın Emoji', geveze: 'Geveze', gifter_pack: 'Gifter', frame_bronz: 'Bronz', frame_gumus: 'Gümüş', frame_altin: 'Altın', frame_neon: 'Neon', frame_ates: 'Ateş', frame_buz: 'Buz', frame_kraliyet: 'Kraliyet',
    frame_zumrut: 'Zümrüt', frame_yildirim: 'Yıldırım', frame_rgb: 'RGB', frame_galaksi: 'Galaksi', frame_elmas: 'Elmas', dealer_alev: 'Alev Pack',
    felt_kraliyet: 'Kraliyet keçe', felt_bordo: 'Bordo keçe', felt_oniks: 'Oniks keçe', felt_ametist: 'Ametist keçe', felt_neon: 'Neon keçe',
    bg_aurora: 'Kuzey Işıkları', bg_galaksi: 'Galaksi arka plan', bg_volkan: 'Volkan', bg_neon: 'Neon Şehir', bg_saray: 'Altın Saray' };
  // mağaza sekmesinde ürünler türe göre gruplanır
  const KIND_N = [['emoji', 'Emoji paketleri'], ['chat', 'Sohbet'], ['gifter', 'Hediye'], ['frame', 'Profil çerçeveleri'], ['bg', 'Profil arka planları'], ['dealer', 'Blackjack krupiyesi'], ['felt', 'Blackjack keçeleri']];

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

  /* ---------------- v3.2: Ekonomi ayarları (rütbeler, Blackjack seviyeleri, masa seviyeleri, haftalık destek) ---------------- */
  const TIER_N = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  const AUDIT_KEY = { ranks: 'Rütbeler', prestige: 'Prestij', bj_tiers: 'Blackjack seviyeleri', table_levels: 'Americano / Dost Kazığı masaları', weekly_support: 'Haftalık destek', am_rank_lock: 'Americano rütbe şartı', dk_rank_lock: 'Dost Kazığı rütbe şartı', fc_rules: 'Friend Coins kuralları' };
  /* v3.3: sitenin beklediği veritabanı sürümü (kurulum.sql). Eski veritabanında ekonomi ayarları kaydedilemez. */
  const DB_WANT = '3.4.0';
  const verLess = (a, b) => {
    const p = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
    const x = p(a);
    const y = p(b);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
    return false;
  };
  const dbOldHTML = (have) => `<section class="panel ec-dbold" role="alert">
      <div class="panel-head"><h2>${icon('alert', 20)}Veritabanı güncel değil</h2></div>
      <p>Site ${DB_WANT} sürümünde, veritabanı ${have ? esc(have) : '3.2 ya da daha eski'}. Ekonomi ayarlarını (Blackjack seviyeleri, Americano / Dost Kazığı masaları, rütbeler) panelden yönetebilmek için <b>kurulum.sql</b> dosyasını Supabase → SQL Editor’da baştan sona bir kez çalıştır. Mevcut üyeler, bakiyeler ve kayıtlar korunur.</p>
      <p class="muted small">Çalışınca sonuç satırında “Kurulum tamamlandı · ${DB_WANT}” görünür. Sonra bu sayfayı yenile.</p></section>`;
  async function econSetPane(root) {
    const box = root.querySelector('[data-pane="econset"]');
    if (!box.firstElementChild) box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let d;
    try {
      d = await BG.api.rpc('bg_admin_econ_get', {});
    } catch (e) {
      // v3.2 kurulumu yoksa fonksiyon bulunamaz: ham hata yerine ne yapılacağı yazılır
      const missing = /bg_admin_econ_get|could not find|schema cache|does not exist|PGRST202/i.test(String((e && (e.message || e.code)) || ''));
      box.innerHTML = missing ? dbOldHTML(null) : `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    if (BG.applyEconSettings) BG.applyEconSettings(d.settings);
    const ranks = d.ranks || [];
    const rankOpts = (sel) => ranks.map((r) => `<option value="${r.idx}"${r.idx === sel ? ' selected' : ''}>${r.idx}. ${esc(r.name)}</option>`).join('');
    const iconOpts = (sel) => Object.keys(BG.RANK_ICONS).map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(BG.RANK_ICONS[k])}</option>`).join('');
    const num = (v, a) => `<input class="input input-sm" type="number" inputmode="numeric" min="0" step="1" value="${v == null ? '' : v}" ${a || ''}>`;
    const rankRow = (r, i) => `<tr data-rank>
        <td class="ec-idx">${i + 1}</td>
        <td class="ec-prev"><span data-prev>${BG.rankIcon(i + 1, 26)}</span></td>
        <td><input class="input input-sm" data-k="name" maxlength="24" value="${esc(r.name)}" aria-label="Rütbe adı"></td>
        <td>${num(r.min_bp, `data-k="min_bp" aria-label="Alt sınır (BP)"${i === 0 ? ' readonly' : ''}`)}</td>
        <td><input type="color" class="ec-color" data-k="color" value="${esc(r.color)}" aria-label="Renk"></td>
        <td><select class="input input-sm" data-k="icon" aria-label="Simge">${iconOpts(r.icon)}</select></td>
        <td class="muted small">${r.users != null ? n0(r.users) + ' üye' : '—'}</td>
        <td>${i === 0 ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-del-rank title="Rütbeyi sil">${icon('trash', 15)}</button>`}</td>
      </tr>`;
    const lv = d.table_levels || [];
    const g = (o, k, i) => (o && o[k] && o[k][i] != null ? o[k][i] : 0);
    const levelRow = (l) => `<tr data-level>
        <td>${num(l.fee, 'data-k="fee" aria-label="Masa ücreti"')}</td>
        <td><select class="input input-sm" data-k="min_rank" aria-label="En düşük rütbe">${rankOpts(l.min_rank)}</select></td>
        <td>${num(g(l.am, '2', 0), 'data-am="2" data-i="0"')}</td>
        <td>${num(g(l.am, '3', 0), 'data-am="3" data-i="0"')}${num(g(l.am, '3', 1), 'data-am="3" data-i="1"')}</td>
        <td>${num(g(l.am, '4', 0), 'data-am="4" data-i="0"')}${num(g(l.am, '4', 1), 'data-am="4" data-i="1"')}</td>
        <td>${num(g(l.am, '5', 0), 'data-am="5" data-i="0"')}${num(g(l.am, '5', 1), 'data-am="5" data-i="1"')}</td>
        <td>${num(l.dk && l.dk['4'], 'data-dk="4"')}</td>
        <td>${num(l.dk && l.dk['6'], 'data-dk="6"')}</td>
        <td>${num(l.dk && l.dk['8'], 'data-dk="8"')}</td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-del-level title="Seviyeyi sil">${icon('trash', 15)}</button></td>
      </tr>`;
    const bj = d.bj_tiers || {};
    const w = d.weekly_support || {};
    const ws = d.weekly_stats || {};
    const custom = new Set(d.custom || []);
    const tag = (k) => (custom.has(k) ? '<span class="chip chip-quiet">Panelden değiştirildi</span>' : '<span class="chip chip-quiet">Varsayılan</span>');
    const amLock = !!d.am_rank_lock;
    const dkLock = d.dk_rank_lock !== false;
    const fr = d.fc_rules || { am: 10, dk: 10, bj_hands: 10, bj: 1, pair_daily: 0 };
    box.innerHTML = `${!d.db_version || verLess(d.db_version, DB_WANT) ? dbOldHTML(d.db_version) : ''}
      <nav class="ec-jump" aria-label="Ekonomi ayarları bölümleri"><a href="#ec-bj" data-jump="bj">Blackjack</a><a href="#ec-levels" data-jump="levels">Americano ve Dost Kazığı</a><a href="#ec-ranks" data-jump="ranks">Rütbeler</a><a href="#ec-weekly" data-jump="weekly">Haftalık destek</a><a href="#ec-fc" data-jump="fc">Friend Coins</a></nav>
      <section class="panel ec-sec" data-sec="ranks" id="ec-ranks">
        <div class="panel-head"><h2>Rütbeler</h2>${tag('ranks')}</div>
        <p class="panel-lead">Rütbe adı, başladığı BP, rengi ve simgesi. Alt sınırlar yukarıdan aşağı artmalı; ilk rütbe 0 BP’den başlar. Kaydedince bütün üyelerin rütbesi yeni tabloya göre hesaplanır.</p>
        <div class="am-scroll"><table class="ec-table ec-ranks"><thead><tr><th>#</th><th>Simge</th><th>Ad</th><th>Alt sınır (BP)</th><th>Renk</th><th>Simge türü</th><th>Şu an</th><th></th></tr></thead>
          <tbody>${ranks.map(rankRow).join('')}</tbody></table></div>
        <div class="ec-row">
          <label class="ec-inline">Prestij şu rütbeden itibaren: <select class="input input-sm" data-prestige>${rankOpts((d.prestige || {}).min_rank || 26)}</select></label>
        </div>
        <div class="ec-acts"><button class="btn btn-soft" type="button" data-add-rank>${icon('plus', 16)}Rütbe ekle</button>
          <span class="grow"></span><button class="btn btn-ghost" type="button" data-reset="ranks">Varsayılana dön</button><button class="btn btn-primary" type="button" data-save="ranks">Rütbeleri kaydet</button></div>
      </section>
      <section class="panel ec-sec" data-sec="bj" id="ec-bj">
        <div class="panel-head"><h2>Blackjack seviyeleri</h2>${tag('bj_tiers')}</div>
        <p class="panel-lead">Her seviyenin fiş değeri, en düşük ve en yüksek bahsi (bahis fiş katlarıyla kurulur; sınırlar fiş değerinin katı olmalı, fiş çift sayı), yan bahislerin (Perfect Pairs, 21+3) üst sınırı, oturmak için gereken güncel bakiye (0 = şart yok) ve jackpot ödülleri. Kaydedince açık masalar yeni değerlere hemen geçer.</p>
        <div class="ec-tiers">${['bronze', 'silver', 'gold'].map((k) => {
          const t = bj[k] || {};
          const b = (t.bets || []).slice().sort((x, y) => x - y);
          const chip = t.chip != null ? t.chip : b[0];
          const lo = t.min_bet != null ? t.min_bet : b[0];
          const hi = t.max_bet != null ? t.max_bet : b[b.length - 1];
          return `<div class="ec-tier ${k}" data-tier="${k}"><h3>${TIER_N[k]}</h3>
            <label>Fiş değeri (BP)${num(chip, 'data-k="chip" step="2"')}</label>
            <div class="ec-pair"><label>En düşük bahis${num(lo, 'data-k="min_bet"')}</label><label>En yüksek bahis${num(hi, 'data-k="max_bet"')}</label></div>
            <label>Yan bahis en fazla (her biri, BP)${num(t.side_max != null ? t.side_max : chip * 2, 'data-k="side_max"')}</label>
            <label>Oturmak için en az bakiye (BP)${num(t.min_balance, 'data-k="min_balance"')}</label>
            <label>Jackpot, pot başına (BP)${num(t.jp_seat, 'data-k="jp_seat"')}</label>
            <label>Jackpot, Bet Behind izleyicisine (BP)${num(t.jp_spec, 'data-k="jp_spec"')}</label>
            <p class="muted small ec-tier-sum" data-sum></p></div>`;
        }).join('')}</div>
        <div class="ec-acts"><span class="grow"></span><button class="btn btn-ghost" type="button" data-reset="bj_tiers">Varsayılana dön</button><button class="btn btn-primary" type="button" data-save="bj_tiers">Blackjack ayarlarını kaydet</button></div>
      </section>
      <section class="panel ec-sec" data-sec="levels" id="ec-levels">
        <div class="panel-head"><h2>Americano ve Dost Kazığı masaları</h2>${tag('table_levels')}</div>
        <p class="panel-lead">Masa ücreti seçenekleri, o ücreti açabilen en düşük rütbe ve ödüller (BP). Americano: oyuncu sayısına göre 1. ve 2. olanın aldığı toplam BP. Dost Kazığı: kazanan takımın her oyuncusuna. Maç başlarken geçerli değerler o maç bitene kadar kullanılır.</p>
        <label class="ec-switch"><input type="checkbox" data-amlock ${amLock ? 'checked' : ''}><span><b>Americano’da rütbe şartı uygula</b><small>${amLock ? 'Açık: Americano masa ücretleri rütbe şartına bağlı.' : 'Kapalı: Americano’da herkes bakiyesi yettiği sürece her ücretle masa açabilir.'}</small></span></label>
        <label class="ec-switch"><input type="checkbox" data-dklock ${dkLock ? 'checked' : ''}><span><b>Dost Kazığı’nda rütbe şartı uygula</b><small>${dkLock ? 'Açık: Dost Kazığı masa ücretleri rütbe şartına bağlı.' : 'Kapalı: Dost Kazığı’nda herkes bakiyesi yettiği sürece her ücretle masa açabilir.'}</small></span></label>
        <div class="am-scroll"><table class="ec-table ec-levels"><thead><tr><th>Ücret</th><th>En düşük rütbe${amLock && dkLock ? '' : amLock ? '<br><small>Americano</small>' : dkLock ? '<br><small>Dost Kazığı</small>' : '<br><small>şu an kullanılmıyor</small>'}</th><th>AM 2 kişi<br><small>1.</small></th><th>AM 3 kişi<br><small>1. · 2.</small></th><th>AM 4 kişi<br><small>1. · 2.</small></th><th>AM 5 kişi<br><small>1. · 2.</small></th><th>DK 4 kişi</th><th>DK 6 kişi</th><th>DK 8 kişi</th><th></th></tr></thead>
          <tbody>${lv.map(levelRow).join('')}</tbody></table></div>
        <div class="ec-acts"><button class="btn btn-soft" type="button" data-add-level>${icon('plus', 16)}Seviye ekle</button>
          <span class="grow"></span><button class="btn btn-ghost" type="button" data-reset="table_levels">Varsayılana dön</button><button class="btn btn-primary" type="button" data-save="table_levels">Masa seviyelerini kaydet</button></div>
      </section>
      <section class="panel ec-sec" data-sec="weekly" id="ec-weekly">
        <div class="panel-head"><h2>Haftalık BP desteği</h2>${tag('weekly_support')}</div>
        <p class="panel-lead">Bakiyesi hafta içinde eşiğe ya da altına inen üye, Pazartesi 00:00 – Pazar 23:59 (Türkiye saati) arasında bir kez talep eder. Bu hafta: ${n0(ws.claims)} talep · ${n0(ws.bp)} BP · ${n0(ws.eligible)} üye hak kazandı ama henüz almadı.</p>
        <div class="ec-weekly">
          <label class="ec-inline"><input type="checkbox" data-k="enabled" ${w.enabled !== false ? 'checked' : ''}> Açık</label>
          <label>Destek miktarı (BP)${num(w.amount, 'data-k="amount"')}</label>
          <label>Bakiye eşiği (BP, bu ve altı)${num(w.threshold, 'data-k="threshold"')}</label>
        </div>
        <div class="ec-acts"><span class="grow"></span><button class="btn btn-ghost" type="button" data-reset="weekly_support">Varsayılana dön</button><button class="btn btn-primary" type="button" data-save="weekly_support">Haftalık desteği kaydet</button></div>
      </section>
      <section class="panel ec-sec" data-sec="fc" id="ec-fc">
        <div class="panel-head"><h2>Friend Coins</h2>${tag('fc_rules')}</div>
        <p class="panel-lead">Arkadaşlarla oynayınca kazanılan Friend Coins (10 FC = 1 BP). Maç sonu ödülü, maçı birlikte bitiren her arkadaş için verilir; Blackjack’te aynı turda eli hesaplanan arkadaşlarla sayılır ve sayaç masa değişse de sürer.</p>
        <div class="ec-weekly ec-fc">
          <label>Americano maç sonu, arkadaş başına (FC)${num(fr.am, 'data-k="am"')}</label>
          <label>Dost Kazığı maç sonu, arkadaş başına (FC)${num(fr.dk, 'data-k="dk"')}</label>
          <label>Blackjack: her kaç ortak elde${num(fr.bj_hands, 'data-k="bj_hands"')}</label>
          <label>Blackjack: arkadaş başına (FC)${num(fr.bj, 'data-k="bj"')}</label>
          <label>Aynı iki arkadaşın günlük FC sınırı (0 = sınırsız)${num(fr.pair_daily, 'data-k="pair_daily"')}</label>
        </div>
        <div class="ec-acts"><span class="grow"></span><button class="btn btn-ghost" type="button" data-reset="fc_rules">Varsayılana dön</button><button class="btn btn-primary" type="button" data-save="fc_rules">Friend Coins kurallarını kaydet</button></div>
      </section>
      <div class="admin-grid">
        <section class="panel"><div class="panel-head"><h2>Son ayar değişiklikleri</h2></div>
          <ul class="bja-log">${(d.audit || []).map((a) => `<li><b>${esc(AUDIT_KEY[a.key] || a.key)}</b> · ${esc(a.by || 'yönetici')}<time>${esc(BG.fmt.dateShort(a.at))} ${esc(BG.fmt.clock(a.at))}</time></li>`).join('') || '<li class="muted">Henüz değişiklik yok.</li>'}</ul></section>
        <section class="panel"><div class="panel-head"><h2>Ekonomi kayıt hataları</h2></div>
          <p class="panel-lead">Görev, istatistik ve Friend Coins kayıtlarında bir hata olursa oyun durmaz, burada görünür.</p>
          <ul class="bja-log">${(d.errors || []).map((e) => `<li><b>${esc(e.ctx)}</b> · ${esc(e.err)}<time>${esc(BG.fmt.dateShort(e.at))} ${esc(BG.fmt.clock(e.at))}</time></li>`).join('') || '<li class="muted">Hata yok.</li>'}</ul></section>
      </div>`;
    const $$ = (s, el) => Array.from((el || box).querySelectorAll(s));
    const intOf = (inp) => {
      const v = String(inp.value).trim();
      return /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
    };
    const rankTbody = box.querySelector('.ec-ranks tbody');
    const renumber = () => $$('tr[data-rank]', rankTbody).forEach((tr, i) => (tr.querySelector('.ec-idx').textContent = i + 1));
    // canlı önizleme: renk ve simge değişince satırdaki rütbe simgesi güncellenir
    rankTbody.addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-rank]');
      if (!tr || !e.target.matches('[data-k="color"], [data-k="icon"]')) return;
      const color = tr.querySelector('[data-k="color"]').value;
      const ic = tr.querySelector('[data-k="icon"]').value;
      const saved = BG.RANKS;
      BG.RANKS = [[tr.querySelector('[data-k="name"]').value, 0, color, ic]];
      tr.querySelector('[data-prev]').innerHTML = BG.rankIcon(1, 26);
      BG.RANKS = saved;
    });
    rankTbody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-del-rank]');
      if (!b) return;
      b.closest('tr').remove();
      renumber();
    });
    box.querySelector('[data-add-rank]').addEventListener('click', () => {
      const rows = $$('tr[data-rank]', rankTbody);
      const last = rows[rows.length - 1];
      const lastMin = last ? intOf(last.querySelector('[data-k="min_bp"]')) || 0 : 0;
      const tr = BG.frag(`<table><tbody>${rankRow({ name: 'Yeni rütbe', min_bp: lastMin ? lastMin * 2 : 1000, color: '#ffffff', icon: 'galaxy', users: null }, rows.length)}</tbody></table>`).querySelector('tr');
      rankTbody.appendChild(tr);
      tr.querySelector('[data-k="name"]').select();
    });
    const lvTbody = box.querySelector('.ec-levels tbody');
    lvTbody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-del-level]');
      if (b) b.closest('tr').remove();
    });
    box.querySelector('[data-add-level]').addEventListener('click', () => {
      const rows = $$('tr[data-level]', lvTbody);
      const lastFee = rows.length ? intOf(rows[rows.length - 1].querySelector('[data-k="fee"]')) || 0 : 0;
      const fee = lastFee + 10;
      const tr = BG.frag(`<table><tbody>${levelRow({ fee, min_rank: ranks.length, am: { 2: [Math.round(fee * 1.5)], 3: [Math.round(fee * 1.5), fee], 4: [Math.round(fee * 2), Math.round(fee * 1.5)], 5: [Math.round(fee * 3), Math.round(fee * 1.5)] }, dk: { 4: Math.round(fee * 1.5), 6: Math.round(fee * 2.25), 8: fee * 3 } })}</tbody></table>`).querySelector('tr');
      lvTbody.appendChild(tr);
    });
    function collect(key) {
      if (key === 'ranks') {
        return $$('tr[data-rank]', rankTbody).map((tr, i) => ({
          name: tr.querySelector('[data-k="name"]').value.trim(),
          min_bp: i === 0 ? 0 : intOf(tr.querySelector('[data-k="min_bp"]')),
          color: tr.querySelector('[data-k="color"]').value.toLowerCase(),
          icon: tr.querySelector('[data-k="icon"]').value,
        }));
      }
      if (key === 'bj_tiers') {
        const o = {};
        $$('[data-tier]').forEach((el) => {
          const v = (k) => intOf(el.querySelector(`[data-k="${k}"]`));
          o[el.dataset.tier] = { chip: v('chip'), min_bet: v('min_bet'), max_bet: v('max_bet'), side_max: v('side_max'), min_balance: v('min_balance'), jp_seat: v('jp_seat'), jp_spec: v('jp_spec') };
        });
        return o;
      }
      if (key === 'table_levels') {
        return $$('tr[data-level]', lvTbody).map((tr) => {
          const am = {};
          $$('[data-am]', tr).forEach((inp) => {
            (am[inp.dataset.am] = am[inp.dataset.am] || [])[+inp.dataset.i] = intOf(inp);
          });
          const dk = {};
          $$('[data-dk]', tr).forEach((inp) => (dk[inp.dataset.dk] = intOf(inp)));
          return { fee: intOf(tr.querySelector('[data-k="fee"]')), min_rank: +tr.querySelector('[data-k="min_rank"]').value, am, dk };
        });
      }
      if (key === 'fc_rules') {
        const sec = box.querySelector('[data-sec="fc"]');
        const v = (k) => intOf(sec.querySelector(`[data-k="${k}"]`));
        return { am: v('am'), dk: v('dk'), bj_hands: v('bj_hands'), bj: v('bj'), pair_daily: v('pair_daily') };
      }
      if (key === 'weekly_support') {
        const sec = box.querySelector('[data-sec="weekly"]');
        return { enabled: sec.querySelector('[data-k="enabled"]').checked, amount: intOf(sec.querySelector('[data-k="amount"]')), threshold: intOf(sec.querySelector('[data-k="threshold"]')) };
      }
      return null;
    }
    // Blackjack seviye özeti: "10–50 BP · 5 adım: 10, 20, 30, 40, 50"
    const tierSum = (el) => {
      const v = (k) => intOf(el.querySelector(`[data-k="${k}"]`));
      const chip = v('chip');
      const lo = v('min_bet');
      const hi = v('max_bet');
      const out = el.querySelector('[data-sum]');
      if (!(chip > 0) || !(lo > 0) || !(hi >= lo)) {
        out.textContent = 'Fiş, en düşük ve en yüksek bahsi gir.';
        return;
      }
      if (chip % 2 || lo % chip || hi % chip) {
        out.textContent = 'Fiş çift sayı, sınırlar fiş değerinin katı olmalı.';
        return;
      }
      const sm = v('side_max');
      if (!(sm >= chip) || sm % chip || sm > hi) {
        out.textContent = 'Yan bahis üst sınırı fiş değerinin katı olmalı ve en yüksek bahsi geçmemeli.';
        return;
      }
      const steps = [];
      for (let x = lo; x <= hi && steps.length < 9; x += chip) steps.push(x);
      const n = Math.floor((hi - lo) / chip) + 1;
      out.textContent = `Masada bahisler: ${steps.map(n0).join(', ')}${n > steps.length ? ' …' : ''} BP (${n} adım) · yan bahis ${n0(chip)}–${n0(sm)} BP${v('min_balance') > 0 ? ` · oturmak için ${n0(v('min_balance'))} BP` : ' · giriş şartı yok'}`;
    };
    $$('[data-tier]').forEach((el) => {
      tierSum(el);
      el.addEventListener('input', () => tierSum(el));
    });
    const lockSwitch = (sel, key, on, off) => {
      const el = box.querySelector(sel);
      el.addEventListener('change', async () => {
        el.disabled = true;
        try {
          await BG.api.rpc('bg_admin_econ_set', { p_key: key, p_value: el.checked });
          const s2 = await BG.api.rpc('bg_public_settings', {});
          if (BG.applyEconSettings) BG.applyEconSettings(s2);
          BG.toast({ type: 'success', text: el.checked ? on : off });
          econSetPane(root);
        } catch (e) {
          BG.toastError(e);
          el.checked = !el.checked;
          el.disabled = false;
        }
      });
    };
    lockSwitch('[data-amlock]', 'am_rank_lock', 'Americano’da rütbe şartı açıldı.', 'Americano’da bütün masa ücretleri herkese açık.');
    lockSwitch('[data-dklock]', 'dk_rank_lock', 'Dost Kazığı’nda rütbe şartı açıldı.', 'Dost Kazığı’nda bütün masa ücretleri herkese açık.');
    box.querySelector('.ec-jump').addEventListener('click', (e) => {
      const a = e.target.closest('[data-jump]');
      if (!a) return;
      e.preventDefault();
      const sec = box.querySelector(`[data-sec="${a.dataset.jump}"]`);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // sayı olmayan alanlar NaN → JSON'da null olur; sunucu alan adıyla hata verir
    const save = async (key, value, btn, msg) => {
      btn.disabled = true;
      try {
        await BG.api.rpc('bg_admin_econ_set', { p_key: key, p_value: value });
        if (key === 'ranks') {
          await BG.api.rpc('bg_admin_econ_set', { p_key: 'prestige', p_value: { min_rank: +box.querySelector('[data-prestige]').value } });
        }
        const s = await BG.api.rpc('bg_public_settings', {});
        if (BG.applyEconSettings) BG.applyEconSettings(s);
        if (BG.bp) BG.bp.refresh();
        BG.toast({ type: 'success', text: msg });
        econSetPane(root);
      } catch (e) {
        BG.toastError(e);
        btn.disabled = false;
      }
    };
    $$('[data-save]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.save;
        save(key, collect(key), b, { ranks: 'Rütbeler kaydedildi.', bj_tiers: 'Blackjack seviyeleri kaydedildi.', table_levels: 'Masa seviyeleri kaydedildi.', weekly_support: 'Haftalık destek kaydedildi.', fc_rules: 'Friend Coins kuralları kaydedildi.' }[key]);
      }),
    );
    $$('[data-reset]').forEach((b) =>
      b.addEventListener('click', async () => {
        const key = b.dataset.reset;
        const ok = await BG.confirm({ title: 'Varsayılana dönülsün mü?', text: `${AUDIT_KEY[key]} şartnamedeki varsayılan değerlere döner.`, okText: 'Varsayılana dön', danger: true });
        if (!ok) return;
        save(key, null, b, 'Varsayılan değerlere dönüldü.');
      }),
    );
  }

  /* ---------------- v3.2: açık Americano / Dost Kazığı masaları ---------------- */
  const GAME_N = { 'americano-online': 'Americano Online', 'dostkazigi-online': 'Dost Kazığı Online' };
  async function tablesPane(root) {
    const box = root.querySelector('[data-pane="tables"]');
    if (!box.firstElementChild) box.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    let list;
    try {
      list = (await BG.api.rpc('bg_admin_tables', {})) || [];
    } catch (e) {
      box.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      return;
    }
    box.innerHTML = `<section class="panel">
        <div class="panel-head"><h2>Açık online masalar</h2></div>
        <p class="panel-lead">Lobide bekleyen ve oynanan Americano / Dost Kazığı masaları. Kapatılan masada ücret alınmış ve sonuçlanmamış maç varsa masada kalan oyunculara ücretleri iade edilir. Blackjack masaları Blackjack sekmesinde.</p>
        <div class="bja-list">${list.map((t) => `<article class="bja-t" data-tid="${esc(t.id)}">
            <header><b>${esc(t.title || GAME_N[t.game] || t.game)}</b><span class="chip">${esc(GAME_N[t.game] || t.game)}</span><span class="chip chip-quiet">${t.status === 'playing' ? 'Oynanıyor' : 'Lobide'}</span>${t.fee ? `<span class="chip chip-quiet">${n0(t.fee)} BP ücret</span>` : ''}</header>
            <p class="muted">Kuran ${esc(t.host || '—')} · ${t.seats_n} koltuk · son hareket ${esc(BG.fmt.ago(t.updated_at))}</p>
            <p class="bja-seats">${(t.players || []).map((p) => `<span class="${p.left ? 'off' : ''}">${p.kind === 'bot' ? '🤖 ' : ''}${esc(p.name || 'Boş')}${p.left ? ' (ayrıldı)' : ''}</span>`).join('') || '<span class="muted">Oturan yok</span>'}</p>
            <div class="bja-act"><button class="btn btn-danger btn-sm" type="button" data-close-table>Masayı kapat</button></div>
          </article>`).join('') || '<p class="loading-row">Açık masa yok.</p>'}</div>
      </section>`;
    box.querySelectorAll('[data-close-table]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.closest('[data-tid]').dataset.tid;
        const ok = await BG.confirm({ title: 'Masa kapatılsın mı?', text: 'Masadaki oyuncular çıkarılır. Ücret alınmış ve sonuçlanmamış maçta ücretler iade edilir.', okText: 'Masayı kapat', danger: true });
        if (!ok) return;
        b.disabled = true;
        try {
          await BG.api.rpc('bg_admin_table_close', { p_table: id });
          BG.toast({ type: 'success', text: 'Masa kapatıldı.' });
          tablesPane(root);
        } catch (e) {
          BG.toastError(e);
          b.disabled = false;
        }
      }),
    );
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
      ${KIND_N.concat([[null, 'Diğer']]).map(([k, title]) => {
        const list = (d.products || []).filter((p) => (k ? p.kind === k : !KIND_N.some((x) => x[0] === p.kind)));
        return list.length
          ? `<h3 class="price-h">${esc(title)}</h3>` + list.map((p) => `<div class="price-row" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b><small class="muted"> · ${n0(p.owners)} sahibi${p.active ? '' : ' · satışta değil'}</small></span>
        <input class="input" type="number" min="0" max="1000000" value="${p.price}" aria-label="${esc(p.name)} fiyatı"><label class="check"><input type="checkbox" ${p.active ? 'checked' : ''}><span>Satışta</span></label>
        <button class="btn btn-soft btn-sm" type="button" data-save>Kaydet</button></div>`).join('')
          : '';
      }).join('')}</section>`;
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
  const ACT = { pause: 'duraklatıldı', resume: 'sürdürüldü', close: 'kapatıldı', cancel_round: 'tur iptal edildi', force_close: 'hemen kapatıldı (iade)' };
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
                <button class="btn btn-danger btn-sm" type="button" data-bj="close">Kapat</button>
                <button class="btn btn-danger btn-sm" type="button" data-bj="force_close" title="Takılan masa için: tur iade edilir, masa hemen kapanır">Hemen kapat (iade)</button></div>`}
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
        const label = { pause: 'Masa duraklatılsın mı?', resume: 'Masa sürdürülsün mü?', cancel_round: 'Devam eden tur iptal edilsin mi?', close: 'Masa kapatılsın mı?', force_close: 'Masa hemen kapatılsın mı?' }[a];
        const text = {
          pause: 'Devam eden tur tamamlanır, yeni tur başlamaz.',
          resume: 'Masa yeniden oyuncu ve bahis kabul eder.',
          cancel_round: 'Turdaki bütün bahisler (ana, ek, sigorta, Bet Behind) iade edilir ve iade kaydına yazılır.',
          close: 'Devam eden tur varsa tamamlanır, sonra masa kapanır ve oyuncular kalkar.',
          force_close: 'Devam eden turun bütün bahisleri (ana, ek, sigorta, Bet Behind) iade edilir, masa beklemeden kapanır ve oyuncular kalkar. Takılan masalar için.',
        }[a];
        const ok = await BG.confirm({ title: label, text, okText: { pause: 'Duraklat', resume: 'Sürdür', cancel_round: 'Turu iptal et', close: 'Masayı kapat', force_close: 'Hemen kapat' }[a], danger: a === 'close' || a === 'cancel_round' || a === 'force_close' });
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
          <div><h1>Yönetim paneli</h1><p class="page-lead">Üyeler ve BP bakiyeleri, oyun ekonomisi ayarları (Blackjack seviyeleri, Americano ve Dost Kazığı masa ücretleri ve ödülleri, rütbeler), BP yönetimi, mağaza, Blackjack ve online masalar. Şifreler hiçbir zaman görüntülenmez.</p></div>
          <button class="btn btn-soft" type="button" data-refresh>${icon('refresh', 18)}Yenile</button>
        </header>
        <div class="admin-dbwarn" hidden></div>
        <nav class="admin-tabs filters" role="tablist" aria-label="Yönetim bölümleri">
          <button class="filter is-on" data-tab="users" role="tab" aria-selected="true">${icon('users', 16)}Üyeler</button>
          <button class="filter" data-tab="econset" role="tab" aria-selected="false">${icon('settings', 16)}Ekonomi ayarları</button>
          <button class="filter" data-tab="bp" role="tab" aria-selected="false">${icon('coin', 16)}BP yönetimi</button>
          <button class="filter" data-tab="eco" role="tab" aria-selected="false">${icon('chart', 16)}Ekonomi</button>
          <button class="filter" data-tab="store" role="tab" aria-selected="false">${icon('bag', 16)}Mağaza</button>
          <button class="filter" data-tab="reports" role="tab" aria-selected="false">${icon('flag', 16)}Yorum bildirimleri</button>
          <button class="filter" data-tab="bj" role="tab" aria-selected="false">Blackjack</button>
          <button class="filter" data-tab="tables" role="tab" aria-selected="false">${icon('tiles', 16)}Online masalar</button>
        </nav>
        <div class="admin-pane" data-pane="bp" hidden></div>
        <div class="admin-pane" data-pane="eco" hidden></div>
        <div class="admin-pane" data-pane="store" hidden></div>
        <div class="admin-pane" data-pane="reports" hidden></div>
        <div class="admin-pane" data-pane="bj" hidden></div>
        <div class="admin-pane" data-pane="econset" hidden></div>
        <div class="admin-pane" data-pane="tables" hidden></div>
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
    const refreshTab = () => (tab === 'bp' ? bpPane(root) : tab === 'eco' ? ecoPane(root) : tab === 'store' ? storePane(root) : tab === 'reports' ? reportsPane(root) : tab === 'bj' ? bjPane(root) : tab === 'econset' ? econSetPane(root) : tab === 'tables' ? tablesPane(root) : load());
    root.querySelector('[data-refresh]').addEventListener('click', refreshTab);
    // v3.3: veritabanı sürümü siteden eskiyse panelin en üstünde ne yapılacağı yazılır
    BG.api
      .rpc('bg_public_settings', {})
      .then((ps) => {
        const have = ps && ps.db_version;
        const w = root.querySelector('.admin-dbwarn');
        if (w && (!have || verLess(have, DB_WANT))) {
          w.innerHTML = dbOldHTML(have);
          w.hidden = false;
        }
      })
      .catch(() => {});
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
      else if (tab === 'tables') tablesPane(root);
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
