/* =====================================================================
   Bözer Gaming — giriş, kayıt, şifremi unuttum, iletişim
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};
  BG.auth = BG.auth || {};

  function benefitsAside() {
    return `<aside class="auth-aside" aria-label="Üyelik avantajları">
      <div class="aside-board" role="img" aria-label="Bözer Gaming">${BG.flapRow('BÖZER', 'ink', 'tile-s')}</div>
      <h2>Üyelikle gelenler</h2>
      <ul class="benefits">
        <li>${icon('cloudCheck')}<div><strong>Oyunun kaybolmaz</strong><span>Her hamle hesabına kaydedilir. Sekmeyi kapatsan da kaldığın yerden devam edersin.</span></div></li>
        <li>${icon('users')}<div><strong>Arkadaşlarını ekle</strong><span>Kimin çevrimiçi olduğunu ve hangi oyunda olduğunu gör.</span></div></li>
        <li>${icon('live')}<div><strong>Canlı izle</strong><span>Arkadaşının skor tablosunu o yazarken anında izle.</span></div></li>
        <li>${icon('message')}<div><strong>Mesajlaş</strong><span>Oyun sırasında gelen mesajlar ekranın üstünde belirir.</span></div></li>
      </ul>
    </aside>`;
  }

  function usernameField(id, label, autocomplete) {
    return `<div class="field">
      <label class="field-label" for="${id}">${label}</label>
      <div class="input-wrap has-prefix">
        <span class="input-prefix" aria-hidden="true">@</span>
        <input class="input" id="${id}" type="text" inputmode="text" autocomplete="${autocomplete}" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" required>
      </div>
      <p class="field-msg" aria-live="polite"></p>
    </div>`;
  }

  function offlineNotice() {
    return BG.api.ready
      ? ''
      : `<div class="callout callout-warn">${icon('cloudOff')}<p>Üyelik sunucusuna şu anda ulaşılamıyor. Oyunları üye olmadan oynayabilirsin.</p></div>`;
  }

  /* ---------------- Giriş ---------------- */
  BG.views.login = function (params, query) {
    if (BG.isAuthed()) {
      BG.router.go(query.r || '/', true);
      return null;
    }
    const root = BG.frag(`
      <div class="page auth-page">
        <section class="auth-card panel">
          <h1>Giriş yap</h1>
          <p class="page-lead">Kullanıcı adın ve şifrenle hesabına gir.</p>
          ${offlineNotice()}
          <form class="form" novalidate>
            ${usernameField('lgUser', 'Kullanıcı adı', 'username')}
            <div class="pw-slot"></div>
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Giriş yap</button>
          </form>
          <div class="auth-links">
            <a href="#/iletisim?konu=sifre" class="link" id="forgotLink">Şifremi unuttum</a>
            <span>Hesabın yok mu? <a class="link" href="#/kayit${query.r ? '?r=' + encodeURIComponent(query.r) : ''}">Kayıt ol</a></span>
          </div>
        </section>
        ${benefitsAside()}
      </div>`);
    const form = root.querySelector('form');
    const user = root.querySelector('#lgUser');
    const pwField = BG.passwordField({ id: 'lgPass', label: 'Şifre', autocomplete: 'current-password' });
    root.querySelector('.pw-slot').replaceWith(pwField);
    const pass = pwField.querySelector('input');
    const err = root.querySelector('.form-error');
    const btn = form.querySelector('button[type=submit]');

    user.addEventListener('input', () => {
      const n = BG.normalizeUsername(user.value);
      if (n !== user.value) user.value = n;
      BG.fieldMsg(user, '');
    });
    root.querySelector('#forgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      const u = BG.normalizeUsername(user.value);
      BG.router.go('/iletisim?konu=sifre' + (u ? '&k=' + encodeURIComponent(u) : ''));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const u = BG.normalizeUsername(user.value);
      if (!BG.validUsername(u)) {
        BG.fieldMsg(user, 'Kullanıcı adını kontrol et.', 'error');
        user.focus();
        return;
      }
      if (!pass.value) {
        BG.fieldMsg(pass, 'Şifreni gir.', 'error');
        pass.focus();
        return;
      }
      btn.disabled = true;
      btn.classList.add('is-busy');
      try {
        await BG.api.signIn(u, pass.value);
        const me = await BG.app.loadMe(true);
        if (!me) throw new Error('Profil bulunamadı. Lütfen yöneticiye ulaş.');
        BG.toast({ type: 'success', title: 'Hoş geldin, ' + String(me.full_name || me.username) });
        // Giriş sürerken başka bir sayfaya geçildiyse kullanıcıyı geri çekme
        if (BG.router.parse().path === '/giris') BG.router.go(query.r || '/', true);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-busy');
      }
    });
    setTimeout(() => user.focus({ preventScroll: true }), 50);
    return { node: root };
  };

  /* ---------------- Kayıt ---------------- */
  BG.views.register = function (params, query) {
    if (BG.isAuthed()) {
      BG.router.go('/', true);
      return null;
    }
    const root = BG.frag(`
      <div class="page auth-page">
        <section class="auth-card panel">
          <h1>Kayıt ol</h1>
          <p class="page-lead">Birkaç saniyede hesabını oluştur. Sana rastgele bir avatar vereceğiz; istersen sonra kendi fotoğrafını yüklersin.</p>
          ${offlineNotice()}
          <form class="form" novalidate>
            <div class="field">
              <label class="field-label" for="rgName">Nick</label>
              <input class="input" id="rgName" type="text" autocomplete="nickname" maxlength="24" required spellcheck="false">
              <p class="field-hint field-hint-tight">Oyunlarda, masalarda ve profilinde görünen adın. Sonra profilinden değiştirebilirsin.</p>
              <p class="field-msg" aria-live="polite"></p>
            </div>
            ${usernameField('rgUser', 'Kullanıcı adı', 'username')}
            <p class="field-hint field-hint-tight">3–20 karakter. Harf (a–z), rakam, nokta ve alt çizgi kullanabilirsin. Giriş yaparken bunu kullanacaksın.</p>
            <div class="pw-slot-1"></div>
            <div class="pw-slot-2"></div>
            <p class="form-error" role="alert" hidden></p>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Hesabımı oluştur</button>
          </form>
          <div class="auth-links">
            <span>Zaten üye misin? <a class="link" href="#/giris${query.r ? '?r=' + encodeURIComponent(query.r) : ''}">Giriş yap</a></span>
          </div>
        </section>
        ${benefitsAside()}
      </div>`);
    const form = root.querySelector('form');
    const name = root.querySelector('#rgName');
    const user = root.querySelector('#rgUser');
    const f1 = BG.passwordField({ id: 'rgPass', label: 'Şifre', autocomplete: 'new-password', hint: 'En az 6 karakter.' });
    const f2 = BG.passwordField({ id: 'rgPass2', label: 'Şifre tekrarı', autocomplete: 'new-password' });
    root.querySelector('.pw-slot-1').replaceWith(f1);
    root.querySelector('.pw-slot-2').replaceWith(f2);
    const p1 = f1.querySelector('input');
    const p2 = f2.querySelector('input');
    const err = root.querySelector('.form-error');
    const btn = form.querySelector('button[type=submit]');
    let availability = { u: '', status: '' };

    const checkUser = BG.debounce(async () => {
      const u = user.value;
      if (!u) return BG.fieldMsg(user, '');
      if (!BG.validUsername(u)) {
        BG.fieldMsg(user, u.length < 3 ? 'En az 3 karakter olmalı.' : 'Nokta ile bitemez ve iki nokta yan yana olamaz.', 'error');
        return;
      }
      if (!BG.api.ready) return;
      try {
        const st = await BG.api.rpc('bg_username_available', { p_username: u });
        if (user.value !== u) return;
        availability = { u, status: st };
        if (st === 'ok') BG.fieldMsg(user, '@' + u + ' kullanılabilir', 'ok');
        else if (st === 'taken') BG.fieldMsg(user, 'Bu kullanıcı adı alınmış.', 'error');
        else if (st === 'reserved') BG.fieldMsg(user, 'Bu kullanıcı adı kullanılamaz.', 'error');
        else BG.fieldMsg(user, 'Geçersiz kullanıcı adı.', 'error');
      } catch (e) {
        BG.fieldMsg(user, '');
      }
    }, 380);

    user.addEventListener('input', () => {
      const n = BG.normalizeUsername(user.value);
      if (n !== user.value) user.value = n;
      availability = { u: '', status: '' };
      BG.fieldMsg(user, n ? 'Kontrol ediliyor…' : '');
      checkUser();
    });

    function checkMatch() {
      if (!p2.value) return BG.fieldMsg(p2, '');
      if (p1.value !== p2.value) BG.fieldMsg(p2, 'Şifreler aynı değil.', 'error');
      else BG.fieldMsg(p2, 'Şifreler eşleşiyor.', 'ok');
    }
    p1.addEventListener('input', () => {
      BG.fieldMsg(p1, p1.value && p1.value.length < 6 ? 'En az 6 karakter olmalı.' : '', p1.value && p1.value.length < 6 ? 'error' : '');
      checkMatch();
    });
    p2.addEventListener('input', checkMatch);
    name.addEventListener('input', () => BG.fieldMsg(name, ''));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const fullName = name.value.replace(/\s+/g, ' ').trim();
      const u = BG.normalizeUsername(user.value);
      let bad = null;
      if (fullName.length < 2) {
        BG.fieldMsg(name, 'Bir nick yaz (en az 2 karakter).', 'error');
        bad = bad || name;
      }
      if (!BG.validUsername(u)) {
        BG.fieldMsg(user, 'Geçerli bir kullanıcı adı seç (3–20 karakter).', 'error');
        bad = bad || user;
      } else if (availability.u === u && availability.status && availability.status !== 'ok') {
        bad = bad || user;
      }
      if (p1.value.length < 6) {
        BG.fieldMsg(p1, 'Şifre en az 6 karakter olmalı.', 'error');
        bad = bad || p1;
      }
      if (p1.value !== p2.value) {
        BG.fieldMsg(p2, 'Şifreler aynı değil.', 'error');
        bad = bad || p2;
      }
      if (bad) {
        bad.focus();
        return;
      }
      btn.disabled = true;
      btn.classList.add('is-busy');
      try {
        await BG.api.signUp({ username: u, password: p1.value, fullName });
        const me = await BG.app.loadMe(true);
        if (!me) throw new Error('Hesap oluşturuldu ama profil yüklenemedi. Giriş yapmayı dene.');
        if (BG.router.parse().path === '/kayit') BG.router.go(query.r || '/', true);
        BG.auth.welcome(me);
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        if (/alınmış/.test(ex.message)) BG.fieldMsg(user, 'Bu kullanıcı adı alınmış.', 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-busy');
      }
    });
    setTimeout(() => name.focus({ preventScroll: true }), 50);
    return { node: root };
  };

  BG.auth.welcome = function (me) {
    BG.modal({
      title: 'Hesabın hazır',
      size: 's',
      body: `<div class="welcome">
        ${BG.avatar(me, { size: 112, ring: true })}
        <p class="welcome-name">${esc(me.full_name)}<span>@${esc(me.username)}</span></p>
        <p class="modal-text">Sana rastgele bir avatar verdik. Profilinden başka bir avatar seçebilir ya da kendi fotoğrafını yükleyebilirsin.</p>
      </div>`,
      actions: [
        { label: 'Avatarımı değiştir', kind: 'ghost', onClick: () => BG.router.go('/profil') },
        { label: 'Oyunlara başla', kind: 'primary' },
      ],
    });
  };

  /* ---------------- Yönetici geçici şifre verdiyse ---------------- */
  BG.auth.promptPasswordChange = function () {
    if (BG.auth._pwPromptOpen) return;
    BG.auth._pwPromptOpen = true;
    const body = BG.frag(`<div><p class="modal-text">Hesabına yöneticinin belirlediği geçici şifreyle giriş yaptın. Güvenliğin için şimdi kendi şifreni belirle.</p><div class="slot-a"></div><div class="slot-b"></div><p class="form-error" role="alert" hidden></p></div>`);
    const a = BG.passwordField({ id: 'npw1', label: 'Yeni şifre', autocomplete: 'new-password', hint: 'En az 6 karakter.' });
    const b = BG.passwordField({ id: 'npw2', label: 'Yeni şifre tekrarı', autocomplete: 'new-password' });
    body.querySelector('.slot-a').replaceWith(a);
    body.querySelector('.slot-b').replaceWith(b);
    const i1 = a.querySelector('input');
    const i2 = b.querySelector('input');
    const err = body.querySelector('.form-error');
    i2.addEventListener('input', () => {
      if (!i2.value) BG.fieldMsg(i2, '');
      else if (i1.value !== i2.value) BG.fieldMsg(i2, 'Şifreler aynı değil.', 'error');
      else BG.fieldMsg(i2, 'Şifreler eşleşiyor.', 'ok');
    });
    BG.modal({
      title: 'Yeni şifreni belirle',
      size: 's',
      body,
      dismissable: false,
      onClose: () => (BG.auth._pwPromptOpen = false),
      actions: [
        { label: 'Şimdilik geç', kind: 'ghost' },
        {
          label: 'Şifremi kaydet',
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
              await BG.api.rpc('bg_change_password', { p_current: null, p_new: i1.value });
              await BG.app.loadMe(true);
              BG.toast({ type: 'success', text: 'Yeni şifren kaydedildi.' });
            } catch (e) {
              err.textContent = e.message;
              err.hidden = false;
              return false;
            }
          },
        },
      ],
    });
  };

  /* ---------------- Çıkış ---------------- */
  BG.auth.logout = async function () {
    try {
      if (BG.host && BG.host.isOpen()) await BG.host.close({ silent: true });
    } catch (e) {}
    try {
      await BG.api.rpc('bg_offline', {});
    } catch (e) {}
    BG.app.stopSession();
    await BG.api.signOut();
    BG.app.clearSession();
    BG.router.go('/', true);
    BG.toast({ type: 'info', text: 'Çıkış yapıldı.' });
  };

  /* ---------------- İletişim ---------------- */
  let contactCache = null;
  BG.views.contact = function (params, query) {
    const forgot = query.konu === 'sifre';
    const who = BG.normalizeUsername(query.k || (BG.store.me && BG.store.me.username) || '');
    const root = BG.frag(`
      <div class="page contact">
        <header class="page-head"><div><h1>İletişim</h1><p class="page-lead">Bize WhatsApp üzerinden doğrudan yazabilirsin.</p></div></header>
        <div class="contact-layout">
          <section class="panel contact-card">
            <ul class="contact-points">
              <li>Şikayet, Öneri ve Talepleriniz için bize ulaşabilirsiniz.</li>
              <li class="${forgot ? 'is-focus' : ''}">Şifrenizi unuttuysanız bizimle iletişime geçebilirsiniz.</li>
            </ul>
            ${
              forgot
                ? `<div class="callout">${icon('key')}<p><strong>Şifreni mi unuttun?</strong> WhatsApp’tan kullanıcı adınla birlikte yaz. Yönetici hesabına geçici bir şifre tanımlar; o şifreyle giriş yaptıktan sonra kendi şifreni belirlersin.</p></div>`
                : ''
            }
            <div class="wa-block">
              <a class="btn btn-wa btn-lg" id="waLink" target="_blank" rel="noopener">${icon('phone')}WhatsApp’tan yaz</a>
              <p class="wa-handle">WhatsApp kullanıcı adı: <strong id="waName">@${esc(BG.config.whatsappUsername || 'bozerx')}</strong>
                <button class="link-btn" type="button" id="waCopy">${icon('copy', 16)}Kopyala</button></p>
              <p class="muted small">Bağlantı açılmazsa WhatsApp’ta yeni sohbet başlatıp kullanıcı adını aratabilirsin.</p>
              <a class="link small" id="waPhone" target="_blank" rel="noopener" hidden>Telefon numarasıyla aç</a>
            </div>
            <div class="mail-block" id="mailBlock" hidden></div>
          </section>
        </div>
        ${BG.footerHtml()}
      </div>`);

    function apply(info) {
      const wa = ((info && info.whatsapp_username) || BG.config.whatsappUsername || 'bozerx').replace(/^@/, '');
      const msg = forgot
        ? 'Merhaba, Bözer Gaming hesabımın şifresini unuttum.' + (who ? ' Kullanıcı adım: @' + who : '')
        : 'Merhaba, Bözer Gaming hakkında yazıyorum.';
      const link = root.querySelector('#waLink');
      link.href = 'https://wa.me/' + encodeURIComponent(wa) + '?text=' + encodeURIComponent(msg);
      root.querySelector('#waName').textContent = '@' + wa;
      root.querySelector('#waCopy').onclick = () => BG.copy('@' + wa, 'Kullanıcı adı kopyalandı');
      const phone = String(BG.config.whatsappPhone || '').replace(/\D/g, '');
      const pl = root.querySelector('#waPhone');
      if (phone) {
        pl.hidden = false;
        pl.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
      }
      const mb = root.querySelector('#mailBlock');
      if (info && info.email) {
        mb.hidden = false;
        mb.innerHTML = `${icon('mail')}<span>E-posta: <a class="link" href="mailto:${esc(info.email)}">${esc(info.email)}</a></span>`;
      }
    }
    apply(contactCache);
    if (BG.api.ready) {
      BG.api
        .rpc('bg_public_contact', {})
        .then((info) => {
          contactCache = info;
          if (root.isConnected) apply(info);
        })
        .catch(() => {});
    }
    return { node: root };
  };
})();
