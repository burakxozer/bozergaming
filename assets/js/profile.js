/* =====================================================================
   Bözer Gaming — profil: avatar (hazır / yükle + yuvarlak kırpma),
   ad soyad, şifre, yönetici e-postası, tema, çıkış
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};

  /* ---------------- Tema seçici ---------------- */
  function themeSwatches(onPick) {
    const cur = BG.theme.get();
    const wrap = BG.frag(`<div class="theme-swatches" role="radiogroup" aria-label="Tema"></div>`);
    BG.THEMES.forEach(([key, name, desc]) => {
      const b = BG.frag(`<button type="button" class="swatch swatch-${key}${key === cur ? ' is-on' : ''}" role="radio" aria-checked="${key === cur}">
          <span class="swatch-preview"><i></i><i></i><i></i></span>
          <span class="swatch-text"><strong>${esc(name)}</strong><span>${esc(desc)}</span></span>
        </button>`);
      b.addEventListener('click', () => {
        BG.theme.set(key);
        wrap.querySelectorAll('.swatch').forEach((x) => {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
        if (onPick) onPick(key);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  BG.pickTheme = function () {
    BG.modal({ title: 'Tema', size: 's', body: themeSwatches(), actions: [{ label: 'Tamam', kind: 'primary' }] });
  };

  /* ---------------- Görsel çözme ---------------- */
  async function decodeImage(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        try {
          return await createImageBitmap(file);
        } catch (e2) {}
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }
  /** Çok büyük fotoğrafları bellek dostu boyuta indir */
  function downscale(src, max) {
    const w = src.width || src.naturalWidth;
    const hgt = src.height || src.naturalHeight;
    const k = Math.min(1, max / Math.max(w, hgt));
    if (k >= 1) return src;
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(hgt * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function canvasToBlob(canvas, type, q) {
    return new Promise((res) => canvas.toBlob(res, type, q));
  }

  /* ---------------- Yuvarlak kırpma penceresi ---------------- */
  BG.openCropper = function (file) {
    return new Promise(async (resolve) => {
      let img;
      try {
        img = downscale(await decodeImage(file), 2400);
      } catch (e) {
        BG.toast({ type: 'error', title: 'Fotoğraf açılamadı', text: 'JPG, PNG veya WebP biçiminde bir fotoğraf seç.' });
        resolve(null);
        return;
      }
      const W = img.width;
      const H = img.height;
      const S = Math.min(320, Math.max(220, window.innerWidth - 96));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const body = BG.frag(`
        <div class="cropper">
          <div class="crop-stage" style="width:${S}px;height:${S}px" tabindex="0" aria-label="Fotoğrafı konumlandır. Ok tuşlarıyla kaydır, artı ve eksi ile yakınlaştır.">
            <canvas width="${S * dpr}" height="${S * dpr}" style="width:${S}px;height:${S}px"></canvas>
            <div class="crop-mask"></div>
          </div>
          <div class="crop-zoom">
            <span aria-hidden="true">${icon('image', 16)}</span>
            <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Yakınlaştır">
            <span aria-hidden="true">${icon('image', 22)}</span>
          </div>
          <p class="muted small center">Sürükleyerek konumla, kaydırıcıyla yakınlaştır.</p>
        </div>`);
      const canvas = body.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const zoomEl = body.querySelector('input[type=range]');
      const stage = body.querySelector('.crop-stage');
      const base = Math.max(S / W, S / H);
      let z = 1;
      let ox = 0;
      let oy = 0;

      function clamp() {
        const sc = base * z;
        const mx = Math.max(0, (W * sc - S) / 2);
        const my = Math.max(0, (H * sc - S) / 2);
        ox = Math.min(mx, Math.max(-mx, ox));
        oy = Math.min(my, Math.max(-my, oy));
      }
      function draw(targetCtx, size) {
        const k = size / S;
        const sc = base * z * k;
        targetCtx.fillStyle = '#1a1733';
        targetCtx.fillRect(0, 0, size, size);
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.drawImage(img, size / 2 - (W * sc) / 2 + ox * k, size / 2 - (H * sc) / 2 + oy * k, W * sc, H * sc);
      }
      function render() {
        clamp();
        draw(ctx, S * dpr);
      }
      render();

      const pts = new Map();
      let pinch = null;
      stage.addEventListener('pointerdown', (e) => {
        stage.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z };
        }
      });
      stage.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId);
        const cur = { x: e.clientX, y: e.clientY };
        pts.set(e.pointerId, cur);
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          z = Math.min(4, Math.max(1, (pinch.z * d) / pinch.d));
          zoomEl.value = z;
        } else if (pts.size === 1) {
          ox += cur.x - prev.x;
          oy += cur.y - prev.y;
        }
        render();
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
      };
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
      stage.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          z = Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
          zoomEl.value = z;
          render();
        },
        { passive: false }
      );
      stage.addEventListener('keydown', (e) => {
        const step = 12;
        if (e.key === 'ArrowLeft') ox += step;
        else if (e.key === 'ArrowRight') ox -= step;
        else if (e.key === 'ArrowUp') oy += step;
        else if (e.key === 'ArrowDown') oy -= step;
        else if (e.key === '+' || e.key === '=') z = Math.min(4, z * 1.1);
        else if (e.key === '-') z = Math.max(1, z / 1.1);
        else return;
        e.preventDefault();
        zoomEl.value = z;
        render();
      });
      zoomEl.addEventListener('input', () => {
        z = parseFloat(zoomEl.value) || 1;
        render();
      });

      let done = false;
      BG.modal({
        title: 'Fotoğrafı kırp',
        size: 's',
        body,
        onClose: () => {
          if (!done) resolve(null);
        },
        actions: [
          { label: 'Vazgeç', kind: 'ghost' },
          {
            label: 'Kaydet',
            kind: 'primary',
            onClick: async () => {
              const out = document.createElement('canvas');
              out.width = out.height = 512;
              draw(out.getContext('2d'), 512);
              let blob = await canvasToBlob(out, 'image/webp', 0.9);
              if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(out, 'image/jpeg', 0.9);
              done = true;
              resolve(blob);
            },
          },
        ],
      });
    });
  };

  /* ---------------- Profil sayfası ---------------- */
  BG.views.profile = function () {
    const me = BG.store.me;
    const root = BG.frag(`
      <div class="page profile">
        <div class="profile-grid">
          <section class="panel profile-card">
            <div class="profile-avatar">
              <span class="pa-slot"></span>
              <label class="avatar-edit" title="Fotoğraf yükle">${icon('camera', 18)}<span class="sr-only">Fotoğraf yükle</span><input type="file" accept="image/*" class="sr-only file-in"></label>
            </div>
            <h1 class="profile-name"></h1>
            <p class="profile-user"></p>
            <p class="muted small">Üyelik tarihi: ${esc(BG.fmt.date(me.created_at))}</p>
            ${me.is_admin ? `<p class="admin-badge">${icon('shield', 16)}Yönetici</p>` : ''}
            <div class="profile-links">
              <a class="btn btn-soft btn-sm" href="#/oyunlarim">${icon('cloud', 16)}Kayıtlı oyunlarım</a>
              <a class="btn btn-soft btn-sm" href="#/arkadaslar">${icon('users', 16)}Arkadaşlarım</a>
            </div>
          </section>

          <div class="profile-forms">
            <section class="panel">
              <div class="panel-head"><h2>Profil fotoğrafı</h2></div>
              <p class="panel-lead">Hazır avatarlardan birini seç ya da kendi fotoğrafını yükle. Büyük fotoğraflar otomatik olarak küçültülür ve yuvarlak kırpılır.</p>
              <div class="avatar-actions">
                <label class="btn btn-soft">${icon('upload', 18)}Fotoğraf yükle<input type="file" accept="image/*" class="sr-only file-in"></label>
              </div>
              <div class="avatar-grid" role="radiogroup" aria-label="Hazır avatarlar"></div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Ad soyad</h2></div>
              <form class="form inline-form" id="nameForm" novalidate>
                <div class="field grow"><label class="field-label sr-only" for="pfName">Ad soyad</label><input class="input" id="pfName" maxlength="60" autocomplete="name"><p class="field-msg"></p></div>
                <button class="btn btn-soft" type="submit">Kaydet</button>
              </form>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Şifre değiştir</h2></div>
              <form class="form" id="pwForm" novalidate>
                <div class="slot-cur"></div><div class="two-col"><div class="slot-n1"></div><div class="slot-n2"></div></div>
                <p class="form-error" role="alert" hidden></p>
                <button class="btn btn-primary" type="submit">${icon('lock', 18)}Şifreyi güncelle</button>
              </form>
            </section>

            ${
              me.is_admin
                ? `<section class="panel" id="adminSec">
                  <div class="panel-head"><h2>Yönetici bilgileri</h2></div>
                  <form class="form" id="adminForm" novalidate>
                    <div class="field"><label class="field-label" for="adEmail">E-posta adresi</label><input class="input" id="adEmail" type="email" autocomplete="email" placeholder="ornek@mail.com"><p class="field-msg"></p></div>
                    <label class="check"><input type="checkbox" id="adShow"><span>E-posta adresimi İletişim sayfasında göster</span></label>
                    <div class="field"><label class="field-label" for="adWa">WhatsApp kullanıcı adı</label><div class="input-wrap has-prefix"><span class="input-prefix">@</span><input class="input" id="adWa" maxlength="40" autocapitalize="none" spellcheck="false"></div><p class="field-hint">İletişim sayfasındaki “WhatsApp’tan yaz” düğmesi bu hesaba yönlendirir.</p></div>
                    <button class="btn btn-soft" type="submit">Kaydet</button>
                  </form>
                </section>`
                : ''
            }

            <section class="panel">
              <div class="panel-head"><h2>Görünüm</h2></div>
              <div class="theme-slot"></div>
            </section>

            <section class="panel panel-plain">
              <button class="btn btn-ghost btn-danger-text" type="button" id="logoutBtn">${icon('logout', 18)}Çıkış yap</button>
            </section>
          </div>
        </div>
      </div>`);

    function paintHead() {
      const m = BG.store.me;
      root.querySelector('.pa-slot').innerHTML = BG.avatar(m, { size: 128, ring: true });
      root.querySelector('.profile-name').textContent = m.full_name;
      root.querySelector('.profile-user').textContent = '@' + m.username;
      root.querySelectorAll('.avatar-grid .av-opt').forEach((b) => {
        const on = m.avatar_url === 'preset:' + b.dataset.key;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
      });
    }

    // Hazır avatarlar
    const grid = root.querySelector('.avatar-grid');
    BG.AVATARS.forEach(([key, label]) => {
      const b = BG.frag(`<button type="button" class="av-opt" data-key="${key}" role="radio" aria-checked="false" title="${esc(label)}">
          <img src="assets/avatars/${key}.webp" alt="${esc(label)}" loading="lazy" width="72" height="72"></button>`);
      b.addEventListener('click', async () => {
        if (b.classList.contains('is-on') || grid.classList.contains('is-busy')) return;
        grid.classList.add('is-busy');
        const wasUpload = !String(BG.store.me.avatar_url || '').startsWith('preset:');
        try {
          const m = await BG.api.rpc('bg_update_profile', { p_avatar_url: 'preset:' + key });
          BG.app.setMe(m);
          paintHead();
          if (wasUpload) BG.api.cleanupAvatars(m.id, null);
          BG.toast({ type: 'success', text: 'Avatarın güncellendi.' });
        } catch (e) {
          BG.toastError(e);
        } finally {
          grid.classList.remove('is-busy');
        }
      });
      grid.appendChild(b);
    });

    // Fotoğraf yükle
    root.querySelectorAll('.file-in').forEach((inp) =>
      inp.addEventListener('change', async () => {
        const file = inp.files && inp.files[0];
        inp.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name)) {
          BG.toast({ type: 'error', text: 'Lütfen bir fotoğraf dosyası seç.' });
          return;
        }
        const blob = await BG.openCropper(file);
        if (!blob) return;
        const card = root.querySelector('.profile-card');
        card.classList.add('is-busy');
        const t = BG.toast({ type: 'info', text: 'Fotoğraf yükleniyor…', duration: 20000 });
        try {
          const { path, url } = await BG.api.uploadAvatar(BG.store.me.id, blob);
          const m = await BG.api.rpc('bg_update_profile', { p_avatar_url: url });
          BG.app.setMe(m);
          paintHead();
          BG.api.cleanupAvatars(m.id, path);
          t.close();
          BG.toast({ type: 'success', text: 'Profil fotoğrafın güncellendi.' });
        } catch (e) {
          t.close();
          BG.toastError(e, 'Fotoğraf yüklenemedi');
        } finally {
          card.classList.remove('is-busy');
        }
      })
    );

    // Ad soyad
    const nameIn = root.querySelector('#pfName');
    nameIn.value = me.full_name || '';
    root.querySelector('#nameForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = nameIn.value.replace(/\s+/g, ' ').trim();
      if (v.length < 2) return BG.fieldMsg(nameIn, 'En az 2 karakter olmalı.', 'error');
      try {
        const m = await BG.api.rpc('bg_update_profile', { p_full_name: v });
        BG.app.setMe(m);
        paintHead();
        BG.fieldMsg(nameIn, 'Kaydedildi.', 'ok');
      } catch (ex) {
        BG.fieldMsg(nameIn, ex.message, 'error');
      }
    });

    // Şifre
    const cur = BG.passwordField({ id: 'pwCur', label: 'Mevcut şifre', autocomplete: 'current-password', required: !me.must_change_password });
    const n1 = BG.passwordField({ id: 'pwNew1', label: 'Yeni şifre', autocomplete: 'new-password', hint: 'En az 6 karakter.' });
    const n2 = BG.passwordField({ id: 'pwNew2', label: 'Yeni şifre tekrarı', autocomplete: 'new-password' });
    root.querySelector('.slot-cur').replaceWith(cur);
    root.querySelector('.slot-n1').replaceWith(n1);
    root.querySelector('.slot-n2').replaceWith(n2);
    if (me.must_change_password) BG.fieldMsg(cur, 'Yönetici şifreni sıfırladı; mevcut şifre gerekmez.', 'ok');
    const ic = cur.querySelector('input');
    const i1 = n1.querySelector('input');
    const i2 = n2.querySelector('input');
    const pwErr = root.querySelector('#pwForm .form-error');
    i2.addEventListener('input', () => {
      if (!i2.value) BG.fieldMsg(i2, '');
      else if (i1.value !== i2.value) BG.fieldMsg(i2, 'Şifreler aynı değil.', 'error');
      else BG.fieldMsg(i2, 'Şifreler eşleşiyor.', 'ok');
    });
    root.querySelector('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      pwErr.hidden = true;
      const must = BG.store.me.must_change_password;
      if (!must && !ic.value) return BG.fieldMsg(ic, 'Mevcut şifreni gir.', 'error');
      if (i1.value.length < 6) return BG.fieldMsg(i1, 'En az 6 karakter olmalı.', 'error');
      if (i1.value !== i2.value) return BG.fieldMsg(i2, 'Şifreler aynı değil.', 'error');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await BG.api.rpc('bg_change_password', { p_current: ic.value || null, p_new: i1.value });
        ic.value = i1.value = i2.value = '';
        [ic, i1, i2].forEach((x) => BG.fieldMsg(x, ''));
        await BG.app.loadMe(true);
        BG.toast({ type: 'success', text: 'Şifren güncellendi.' });
      } catch (ex) {
        pwErr.textContent = ex.message;
        pwErr.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });

    // Yönetici bilgileri
    if (me.is_admin) {
      const em = root.querySelector('#adEmail');
      const sh = root.querySelector('#adShow');
      const wa = root.querySelector('#adWa');
      BG.api
        .rpc('bg_admin_settings', {})
        .then((s) => {
          em.value = (s && s.admin_email) || '';
          sh.checked = !!(s && s.show_email);
          wa.value = (s && s.whatsapp_username) || BG.config.whatsappUsername || '';
        })
        .catch(() => {});
      root.querySelector('#adminForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = em.value.trim();
        if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return BG.fieldMsg(em, 'Geçerli bir e-posta adresi gir.', 'error');
        try {
          await BG.api.rpc('bg_admin_save_settings', { p_admin_email: v || null, p_show_email: sh.checked, p_whatsapp: wa.value.trim() || null });
          BG.fieldMsg(em, '');
          BG.toast({ type: 'success', text: 'Yönetici bilgileri kaydedildi.' });
        } catch (ex) {
          BG.toastError(ex);
        }
      });
    }

    root.querySelector('.theme-slot').replaceWith(themeSwatches());
    root.querySelector('#logoutBtn').addEventListener('click', () => BG.auth.logout());

    paintHead();
    const off = BG.bus.on('me', () => root.isConnected && paintHead());
    return { node: root, cleanup: off };
  };
})();
