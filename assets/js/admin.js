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

  BG.views.admin = function () {
    const root = BG.frag(`
      <div class="page admin">
        <header class="page-head">
          <div><h1>Yönetim paneli</h1><p class="page-lead">Üyeleri ve o an ne yaptıklarını gör, şifre belirle ya da hesap sil. Şifreler hiçbir zaman görüntülenmez.</p></div>
          <button class="btn btn-soft" type="button" data-refresh>${icon('refresh', 18)}Yenile</button>
        </header>
        <div class="stat-strip" aria-live="polite"></div>
        <section class="panel">
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
    let filter = 'all';
    let q = '';
    const body = root.querySelector('.u-body');

    function stats() {
      const weekAgo = Date.now() - 7 * 86400000;
      const total = users.length;
      const on = users.filter((u) => u.online).length;
      const playing = users.filter((u) => u.online && u.game).length;
      const fresh = users.filter((u) => new Date(u.created_at).getTime() > weekAgo).length;
      root.querySelector('.stat-strip').innerHTML = [
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
            <span class="u-stats muted" role="cell">${u.games_count} oyun, ${u.friends_count} arkadaş, ${u.messages_count} mesaj</span>
            <span class="u-actions" role="cell">
              <button class="btn btn-soft btn-sm" type="button" data-act="pw">${icon('key', 16)}Şifre belirle</button>
              <button class="btn btn-danger btn-sm" type="button" data-act="del" ${u.is_admin ? 'disabled title="Yönetici hesabı silinemez"' : ''}>${icon('trash', 16)}Hesabı sil</button>
            </span>
          </div>`);
        row.querySelector('[data-act="pw"]').addEventListener('click', () => setPasswordModal(u, load));
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
        users = (await BG.api.rpc('bg_admin_users', {})) || [];
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
    root.querySelector('[data-refresh]').addEventListener('click', load);

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
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 30000);
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
