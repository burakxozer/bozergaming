/* =====================================================================
   Bözer Gaming — arkadaşlar, mesajlar, sohbet çekmecesi, anlık bildirimler
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};
  const social = (BG.social = {});
  const isCoarse = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /* ================= Arkadaş önbelleği ================= */
  social.friendById = (id) => (BG.store.friends || []).find((f) => f.user_id === id);
  social.friendByName = (u) => (BG.store.friends || []).find((f) => f.username === u);
  social.isFriend = (id) => {
    const f = social.friendById(id);
    return !!(f && f.relation === 'friend');
  };

  let refreshing = null;
  social.refreshFriends = function () {
    if (!BG.isAuthed()) return Promise.resolve([]);
    if (refreshing) return refreshing;
    refreshing = BG.api
      .rpc('bg_friends', {})
      .then((rows) => {
        BG.store.friends = rows || [];
        BG.store.requests = BG.store.friends.filter((f) => f.relation === 'incoming').length;
        BG.bus.emit('friends', BG.store.friends);
        BG.bus.emit('counts');
        BG.rt.syncPresence();
        return BG.store.friends;
      })
      .catch((e) => {
        console.warn('[social] friends', e);
        return BG.store.friends;
      })
      .finally(() => (refreshing = null));
    return refreshing;
  };

  /* ================= Arkadaş istatistikleri ================= */
  social.stats = new Map();
  social.statsLoaded = false;
  social.refreshStats = async function () {
    if (!BG.isAuthed()) return;
    try {
      const rows = (await BG.api.rpc('bg_friends_stats', {})) || [];
      social.stats = new Map(rows.map((r) => [r.user_id, r]));
      social.statsLoaded = true;
      BG.bus.emit('friend-stats');
    } catch (e) {
      console.warn('[social] stats', e);
    }
  };
  function statsLine(f) {
    if (f.relation !== 'friend' || !social.statsLoaded) return '';
    const st = social.stats.get(f.user_id);
    if (!st || !st.games_played) return '<span class="person-stats">Henüz oyun oynamadı</span>';
    const fav = st.favorite_game && BG.GAMES[st.favorite_game];
    return `<span class="person-stats"><span><b>${st.games_played}</b> oyun</span>${
      fav ? `<span>En çok ${esc(fav.name)}</span>` : ''
    }${st.last_played_at ? `<span>Son oyun ${esc(BG.fmt.ago(st.last_played_at))}</span>` : ''}</span>`;
  }

  const monthYear = (d) => {
    try {
      return new Date(d).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  /** Arkadaşın profil kartı: oyun sayıları, en çok oynadıkları, son oyunları */
  social.openProfile = function (f) {
    const body = BG.h('div.fp');
    body.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
    const m = BG.modal({ title: f.full_name || f.username, body, size: 'm' });
    body.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) m.close();
    });
    BG.api
      .rpc('bg_friend_profile', { p_user: f.user_id })
      .then((p) => {
        const g = p.game && BG.GAMES[p.game];
        const status = p.online ? (g ? g.activity : 'Çevrimiçi') : p.last_seen_at ? 'Son görülme ' + BG.fmt.ago(p.last_seen_at) : 'Çevrimdışı';
        const per = Object.entries(p.per_game || {})
          .filter(([k, n]) => BG.GAMES[k] && n > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const max = per.length ? per[0][1] : 1;
        const recent = (p.recent || []).filter((r) => BG.GAMES[r.game]);
        body.innerHTML = `
          <div class="fp-head">
            ${BG.avatar(p, { size: 64, online: !!p.online })}
            <div class="fp-id">
              <span class="muted">@${esc(p.username)}</span>
              <span class="fp-status ${p.online ? (p.game ? 'is-playing' : 'is-on') : ''}">${esc(status)}</span>
            </div>
            ${p.live && p.session_id ? `<a class="btn btn-live btn-sm" href="#/izle/${esc(p.session_id)}" data-close><span class="live-dot"></span>İzle</a>` : ''}
          </div>
          <div class="fp-stats">
            <div class="fp-stat"><span class="flap-num">${BG.flapRow(String(p.games_played || 0), 'amber', 'tile-s')}</span><span>oyun oynadı</span></div>
            <div class="fp-stat"><span class="flap-num">${BG.flapRow(String(p.games_finished || 0), 'ink', 'tile-s')}</span><span>oyunu bitirdi</span></div>
            <div class="fp-stat"><span class="flap-num">${BG.flapRow(String(p.friends_count || 0), 'ink', 'tile-s')}</span><span>arkadaşı var</span></div>
          </div>
          ${
            per.length
              ? `<section class="fp-sec"><h3>En çok oynadıkları</h3><ul class="fp-bars">${per
                  .map(
                    ([k, n]) => `<li>${BG.gameTile(k, 'tile-xs')}<span class="fp-bar-name">${esc(BG.GAMES[k].name)}</span>
                      <span class="fp-bar"><i style="width:${Math.max(8, Math.round((n / max) * 100))}%"></i></span><b>${n}</b></li>`
                  )
                  .join('')}</ul></section>`
              : '<p class="fp-empty">Henüz oyun oynamadı.</p>'
          }
          ${
            recent.length
              ? `<section class="fp-sec"><h3>Son oyunları</h3><ul class="fp-recent">${recent
                  .map(
                    (r) => `<li>${BG.gameTile(r.game, 'tile-xs')}
                      <span class="fp-r-text"><strong>${esc(BG.GAMES[r.game].name)}</strong>${r.title ? `<span>${esc(r.title)}</span>` : ''}</span>
                      <span class="fp-r-meta">${
                        r.is_live
                          ? `<a class="chip chip-live" href="#/izle/${esc(r.id)}" data-close><span class="live-dot"></span>Canlı</a>`
                          : r.status === 'finished'
                          ? '<em class="chip chip-done">Bitti</em>'
                          : '<em class="chip chip-active">Devam ediyor</em>'
                      }<time>${esc(BG.fmt.ago(r.updated_at))}</time></span></li>`
                  )
                  .join('')}</ul></section>`
              : ''
          }
          <p class="fp-meta"><span>Üyelik: ${esc(monthYear(p.member_since))}</span>${
            p.friends_since ? `<span>Arkadaşlığınız: ${esc(monthYear(p.friends_since))}</span>` : ''
          }</p>
          <div class="fp-actions"><a class="btn btn-primary" href="#/mesajlar/${esc(p.username)}" data-close>${icon('message', 18)}Mesaj gönder</a></div>`;
      })
      .catch((e) => {
        body.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      });
    return m;
  };

  social.statusText = function (f) {
    if (!f || f.relation !== 'friend') return '';
    if (f.online) {
      const g = f.game && BG.GAMES[f.game];
      return g ? g.activity : 'Çevrimiçi';
    }
    return f.last_seen_at ? 'Son görülme ' + BG.fmt.ago(f.last_seen_at) : 'Çevrimdışı';
  };

  /* ================= Gerçek zamanlı ================= */
  const rt = (BG.rt = { inbox: null, presence: null, presenceKey: '', timer: null });

  rt.start = function () {
    rt.stop();
    const uid = BG.store.me && BG.store.me.id;
    if (!uid || !BG.api.ready) return;
    try {
      rt.inbox = BG.api
        .channel('bg-inbox-' + uid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient_id=eq.' + uid }, (p) => onIncoming(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'sender_id=eq.' + uid }, (p) => BG.bus.emit('message:update', p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: 'addressee_id=eq.' + uid }, (p) => onFriendRequest(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: 'requester_id=eq.' + uid }, (p) => onFriendUpdate(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: 'addressee_id=eq.' + uid }, () => social.refreshFriends())
        .subscribe();
    } catch (e) {
      console.warn('[rt] inbox', e);
    }
    social.refreshFriends();
    rt.timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      social.refreshFriends();
      BG.api
        .rpc('bg_unread_count', {})
        .then((n) => {
          if (typeof n === 'number' && n !== BG.store.unread) {
            BG.store.unread = n;
            BG.bus.emit('counts');
          }
        })
        .catch(() => {});
    }, 40000);
  };

  rt.stop = function () {
    clearInterval(rt.timer);
    BG.api.removeChannel(rt.inbox);
    BG.api.removeChannel(rt.presence);
    rt.inbox = rt.presence = null;
    rt.presenceKey = '';
  };

  /** Arkadaşların çevrimiçi durumunu dinle (arkadaş listesi değişince yeniden kur) */
  rt.syncPresence = function () {
    if (!BG.isAuthed() || !BG.api.ready) return;
    const ids = (BG.store.friends || []).filter((f) => f.relation === 'friend').map((f) => f.user_id).sort().slice(0, 100);
    const key = ids.join(',');
    if (key === rt.presenceKey) return;
    BG.api.removeChannel(rt.presence);
    rt.presence = null;
    rt.presenceKey = key;
    if (!ids.length) return;
    try {
      rt.presence = BG.api
        .channel('bg-presence-' + BG.store.me.id + '-' + Date.now().toString(36))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'presence', filter: 'user_id=in.(' + key + ')' }, (p) => onPresence(p.new))
        .subscribe();
    } catch (e) {
      console.warn('[rt] presence', e);
    }
  };

  function onPresence(row) {
    if (!row || !row.user_id) return;
    const f = social.friendById(row.user_id);
    if (!f) return;
    const online = row.status === 'online' && Date.now() - new Date(row.last_seen_at).getTime() < 75000;
    const before = f.online + '|' + f.game + '|' + f.session_id;
    f.online = online;
    f.last_seen_at = row.last_seen_at;
    f.game = online ? row.game : null;
    f.session_id = online ? row.session_id : null;
    f.live = !!(online && row.session_id);
    if (before !== f.online + '|' + f.game + '|' + f.session_id) BG.bus.emit('friends', BG.store.friends);
  }

  async function personFor(id) {
    let f = social.friendById(id);
    if (!f) {
      await social.refreshFriends();
      f = social.friendById(id);
    }
    return f || { user_id: id, username: '', full_name: 'Yeni mesaj' };
  }

  async function onIncoming(row) {
    if (!row || !row.sender_id) return;
    BG.bus.emit('message:new', row);
    if (chat.isViewing(row.sender_id)) return; // açık sohbet zaten okuyor
    BG.store.unread = (BG.store.unread || 0) + 1;
    BG.bus.emit('counts');
    const p = await personFor(row.sender_id);
    BG.toast({
      type: 'message',
      person: p,
      title: p.full_name || '@' + p.username,
      text: row.body.length > 140 ? row.body.slice(0, 140) + '…' : row.body,
      duration: 3000,
      onClick: () => chat.openDrawer(p.username),
    });
  }

  async function onFriendRequest(row) {
    await social.refreshFriends();
    const f = (BG.store.friends || []).find((x) => x.request_id === row.id);
    if (!f) return;
    BG.toast({
      type: 'info',
      title: (f.full_name || '@' + f.username) + ' arkadaşlık isteği gönderdi',
      duration: 5000,
      action: { label: 'Gör', onClick: () => BG.router.go('/arkadaslar') },
    });
  }

  async function onFriendUpdate(row) {
    await social.refreshFriends();
    if (row.status !== 'accepted') return;
    const f = (BG.store.friends || []).find((x) => x.request_id === row.id);
    if (f) BG.toast({ type: 'success', title: (f.full_name || '@' + f.username) + ' arkadaşlık isteğini kabul etti' });
  }

  /* ================= Arkadaşlar sayfası ================= */
  async function act(promise, okText) {
    try {
      const r = await promise;
      if (okText) BG.toast({ type: 'success', text: okText });
      await social.refreshFriends();
      return r;
    } catch (e) {
      BG.toastError(e);
      return null;
    }
  }
  social.sendRequest = async (username) => {
    const r = await act(BG.api.rpc('bg_send_friend_request', { p_username: username }));
    if (r === 'sent') BG.toast({ type: 'success', text: 'Arkadaşlık isteği gönderildi.' });
    else if (r === 'accepted') BG.toast({ type: 'success', text: 'Artık arkadaşsınız.' });
    else if (r === 'already_sent') BG.toast({ type: 'info', text: 'Bu kişiye zaten istek gönderdin.' });
    else if (r === 'already_friends') BG.toast({ type: 'info', text: 'Zaten arkadaşsınız.' });
    return r;
  };
  social.respond = (id, accept) => act(BG.api.rpc('bg_respond_friend_request', { p_id: id, p_accept: accept }), accept ? 'Arkadaşlık isteği kabul edildi.' : 'İstek reddedildi.');
  social.remove = async (f, text) => {
    const ok = await BG.confirm({
      title: text || 'Arkadaşlıktan çıkarılsın mı?',
      text: (f.full_name || '@' + f.username) + (f.relation === 'outgoing' ? ' için gönderdiğin istek geri alınacak.' : ' arkadaş listenden çıkarılacak.'),
      okText: f.relation === 'outgoing' ? 'Geri al' : 'Çıkar',
      danger: true,
    });
    if (ok) await act(BG.api.rpc('bg_remove_friend', { p_user: f.user_id }), f.relation === 'outgoing' ? 'İstek geri alındı.' : 'Arkadaşlıktan çıkarıldı.');
  };

  function friendRow(f) {
    const li = BG.frag(`<li class="person-row" data-id="${esc(f.user_id)}"></li>`);
    let actions = '';
    if (f.relation === 'friend') {
      actions = `${f.live && f.session_id ? `<a class="btn btn-live btn-sm" href="#/izle/${esc(f.session_id)}"><span class="live-dot"></span>İzle</a>` : ''}
        <button class="btn btn-ghost btn-sm" type="button" data-act="profile" title="Etkinlik">${icon('chart', 16)}<span class="hide-s">Etkinlik</span></button>
        <a class="btn btn-soft btn-sm" href="#/mesajlar/${esc(f.username)}">${icon('message', 16)}<span class="hide-s">Mesaj</span></a>
        <button class="icon-btn" type="button" data-act="remove" aria-label="Arkadaşlıktan çıkar" title="Arkadaşlıktan çıkar">${icon('userX')}</button>`;
    } else if (f.relation === 'incoming') {
      actions = `<button class="btn btn-primary btn-sm" type="button" data-act="accept">${icon('check', 16)}Kabul et</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="decline">Reddet</button>`;
    } else {
      actions = `<span class="muted small hide-s">Yanıt bekleniyor</span><button class="btn btn-ghost btn-sm" type="button" data-act="cancel">Geri al</button>`;
    }
    const statusCls = f.relation === 'friend' && f.online ? (f.game ? 'is-playing' : 'is-on') : '';
    const name = esc(f.full_name || f.username);
    li.innerHTML = `${
      f.relation === 'friend'
        ? `<button class="avatar-btn" type="button" data-act="profile" aria-label="${name} profilini aç">${BG.avatar(f, { size: 46, online: !!f.online })}</button>`
        : BG.avatar(f, { size: 46 })
    }
      <div class="person-text">${
        f.relation === 'friend' ? `<button class="name-btn" type="button" data-act="profile">${name}</button>` : `<strong>${name}</strong>`
      }<span>@${esc(f.username)}</span>
      ${f.relation === 'friend' ? `<span class="person-status ${statusCls}">${esc(social.statusText(f))}</span>` : ''}${statsLine(f)}</div>
      <div class="person-actions">${actions}</div>`;
    li.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'accept') social.respond(f.request_id, true);
      else if (a === 'decline') social.respond(f.request_id, false);
      else if (a === 'cancel') social.remove(f, 'İstek geri alınsın mı?');
      else if (a === 'remove') social.remove(f);
      else if (a === 'profile') social.openProfile(f);
    });
    return li;
  }

  BG.views.friends = function () {
    const me = BG.store.me;
    const root = BG.frag(`
      <div class="page friends">
        <header class="page-head"><div><h1>Arkadaşlar</h1><p class="page-lead">Arkadaşlarını ekle; kimin çevrimiçi olduğunu, hangi oyunda olduğunu gör ve canlı izle.</p></div></header>
        <div class="split">
          <section class="panel add-friend">
            <div class="panel-head"><h2>Arkadaş ekle</h2></div>
            <div class="input-wrap has-icon">${icon('search', 18)}<input class="input" id="frSearch" type="search" placeholder="Kullanıcı adı ya da isim" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Üye ara"></div>
            <ul class="search-results" aria-live="polite"></ul>
            <p class="my-handle">Senin kullanıcı adın <strong>@${esc(me.username)}</strong><button class="link-btn" type="button" id="copyMe">${icon('copy', 16)}Kopyala</button></p>
          </section>
          <div class="stack">
            <section class="panel" id="secIncoming" hidden><div class="panel-head"><h2>Gelen istekler</h2><span class="count-slot"></span></div><ul class="person-list"></ul></section>
            <section class="panel" id="secFriends"><div class="panel-head"><h2>Arkadaşlarım</h2><span class="muted small count-text"></span></div><ul class="person-list"><li class="loading-row">Yükleniyor…</li></ul></section>
            <section class="panel" id="secOutgoing" hidden><div class="panel-head"><h2>Gönderilen istekler</h2></div><ul class="person-list"></ul></section>
          </div>
        </div>
      </div>`);
    root.querySelector('#copyMe').addEventListener('click', () => BG.copy('@' + me.username, 'Kullanıcı adın kopyalandı'));

    function render() {
      const all = BG.store.friends || [];
      const inc = all.filter((f) => f.relation === 'incoming');
      const fr = all.filter((f) => f.relation === 'friend');
      const out = all.filter((f) => f.relation === 'outgoing');
      const si = root.querySelector('#secIncoming');
      si.hidden = !inc.length;
      si.querySelector('.count-slot').innerHTML = BG.countBadge(inc.length);
      si.querySelector('ul').replaceChildren(...inc.map(friendRow));
      const sf = root.querySelector('#secFriends');
      sf.querySelector('.count-text').textContent = fr.length ? fr.filter((f) => f.online).length + ' çevrimiçi, ' + fr.length + ' arkadaş' : '';
      const ul = sf.querySelector('ul');
      if (!fr.length) ul.innerHTML = `<li class="empty">${BG.tile('?', 'ink', 'tile-s')}<p>Henüz arkadaşın yok. Kullanıcı adını yazarak arkadaş ekleyebilirsin.</p></li>`;
      else ul.replaceChildren(...fr.map(friendRow));
      const so = root.querySelector('#secOutgoing');
      so.hidden = !out.length;
      so.querySelector('ul').replaceChildren(...out.map(friendRow));
    }

    // Arama
    const input = root.querySelector('#frSearch');
    const results = root.querySelector('.search-results');
    let lastQ = '';
    const search = BG.debounce(async () => {
      const q = input.value.trim();
      lastQ = q;
      if (q.replace(/^@/, '').length < 2) {
        results.innerHTML = q ? '<li class="hint-row">En az 2 harf yaz.</li>' : '';
        return;
      }
      results.innerHTML = '<li class="hint-row">Aranıyor…</li>';
      try {
        const rows = await BG.api.rpc('bg_search_users', { p_query: q });
        if (q !== lastQ) return;
        if (!rows.length) {
          results.innerHTML = '<li class="hint-row">Bu isimde bir üye bulunamadı.</li>';
          return;
        }
        results.innerHTML = '';
        rows.forEach((r) => {
          const li = BG.frag(`<li class="person-row compact">${BG.avatar(r, { size: 38 })}
            <div class="person-text"><strong>${esc(r.full_name || r.username)}</strong><span>@${esc(r.username)}</span></div>
            <div class="person-actions"></div></li>`);
          const box = li.querySelector('.person-actions');
          const paint = (rel) => {
            if (rel === 'friend') box.innerHTML = `<a class="btn btn-soft btn-sm" href="#/mesajlar/${esc(r.username)}">${icon('message', 16)}Mesaj</a>`;
            else if (rel === 'outgoing') box.innerHTML = `<span class="chip chip-quiet">${icon('check', 14)}İstek gönderildi</span>`;
            else if (rel === 'incoming') box.innerHTML = `<button class="btn btn-primary btn-sm" type="button">${icon('check', 16)}Kabul et</button>`;
            else box.innerHTML = `<button class="btn btn-primary btn-sm" type="button">${icon('userPlus', 16)}Ekle</button>`;
            const b = box.querySelector('button');
            if (b)
              b.addEventListener('click', async () => {
                b.disabled = true;
                const res = await social.sendRequest(r.username);
                if (res === 'sent' || res === 'already_sent') paint('outgoing');
                else if (res === 'accepted' || res === 'already_friends') paint('friend');
                else b.disabled = false;
              });
          };
          paint(r.relation);
          results.appendChild(li);
        });
      } catch (e) {
        results.innerHTML = `<li class="hint-row">${esc(e.message)}</li>`;
      }
    }, 320);
    input.addEventListener('input', search);

    render();
    social.refreshFriends();
    social.refreshStats();
    // İstatistikler sayfa açıkken de tazelensin (en fazla 30 saniyede bir)
    let statsAt = Date.now();
    const onFriends = () => {
      render();
      if (Date.now() - statsAt > 30000) {
        statsAt = Date.now();
        social.refreshStats();
      }
    };
    const offs = [BG.bus.on('friends', onFriends), BG.bus.on('friend-stats', render)];
    return { node: root, cleanup: () => offs.forEach((f) => f()) };
  };

  /* ================= Sohbet ================= */
  const chat = (BG.chat = { views: new Set() });
  chat.isViewing = (otherId) => {
    if (document.visibilityState !== 'visible') return false;
    for (const v of chat.views) if (v.otherId === otherId && v.el.isConnected && v.visible()) return true;
    return false;
  };

  async function resolvePerson(username) {
    let p = social.friendByName(username);
    if (p) return p;
    await social.refreshFriends();
    p = social.friendByName(username);
    if (p) return p;
    try {
      const rows = await BG.api.rpc('bg_conversations', {});
      const c = (rows || []).find((r) => r.username === username);
      if (c) return { user_id: c.user_id, username: c.username, full_name: c.full_name, avatar_url: c.avatar_url, relation: c.is_friend ? 'friend' : 'none' };
      const s = await BG.api.rpc('bg_search_users', { p_query: username });
      const u = (s || []).find((r) => r.username === username);
      if (u) return { user_id: u.user_id, username: u.username, full_name: u.full_name, avatar_url: u.avatar_url, relation: u.relation };
    } catch (e) {}
    return null;
  }

  /** Bir sohbet dizisini verilen kapsayıcıya yerleştirir */
  chat.mountThread = function (container, person, opts) {
    opts = opts || {};
    const me = BG.store.me;
    const el = BG.frag(`
      <div class="thread">
        <header class="thread-head">
          ${opts.onBack ? `<button class="icon-btn" type="button" data-back aria-label="Geri">${icon('back')}</button>` : ''}
          <span class="th-avatar"></span>
          <div class="th-text"><strong>${esc(person.full_name || person.username)}</strong><span class="th-status"></span></div>
          <span class="th-actions"></span>
        </header>
        <div class="msgs" role="log" aria-live="polite" aria-label="Mesajlar"><div class="msgs-inner"><p class="loading-row">Yükleniyor…</p></div></div>
        <form class="composer" novalidate>
          <textarea class="input" rows="1" maxlength="2000" placeholder="Mesaj yaz" aria-label="Mesaj"></textarea>
          <button class="btn btn-primary send-btn" type="submit" aria-label="Gönder">${icon('send')}</button>
        </form>
        <p class="composer-note" hidden>Sadece arkadaşlarına mesaj gönderebilirsin.</p>
      </div>`);
    container.replaceChildren(el);
    const msgsBox = el.querySelector('.msgs');
    const inner = el.querySelector('.msgs-inner');
    const form = el.querySelector('.composer');
    const ta = el.querySelector('textarea');
    const note = el.querySelector('.composer-note');
    let msgs = [];
    let loadingOlder = false;
    let noMore = false;

    function paintHead() {
      const f = social.friendById(person.user_id) || person;
      el.querySelector('.th-avatar').innerHTML = BG.avatar(f, { size: 40, online: f.relation === 'friend' ? !!f.online : undefined });
      el.querySelector('.th-status').textContent = f.relation === 'friend' ? social.statusText(f) : '@' + f.username;
      el.querySelector('.th-actions').innerHTML =
        (f.relation === 'friend' && f.live && f.session_id
          ? `<a class="btn btn-live btn-sm" href="#/izle/${esc(f.session_id)}"><span class="live-dot"></span>İzle</a>`
          : '') +
        `<button class="icon-btn" type="button" data-clear aria-label="Sohbeti temizle" title="Sohbeti temizle">${icon('eraser')}</button>`;
      const can = f.relation === 'friend';
      form.hidden = !can;
      note.hidden = can;
    }

    function bubble(m) {
      const mine = m.sender_id === me.id;
      const b = BG.frag(`<div class="bubble ${mine ? 'mine' : 'theirs'}${m._pending ? ' is-pending' : ''}${m._failed ? ' is-failed' : ''}" data-id="${m.id || ''}">
          <p></p><span class="b-meta"><time>${esc(BG.fmt.clock(m.created_at))}</time>${mine ? `<span class="ticks${m.read_at ? ' is-read' : ''}" title="${m.read_at ? 'Görüldü' : 'Gönderildi'}">${icon(m.read_at ? 'checks' : 'check', 14)}</span>` : ''}</span></div>`);
      b.querySelector('p').textContent = m.body;
      if (m._failed) {
        const r = BG.h('button.link-btn.retry', { type: 'button' }, 'Gönderilemedi, tekrar dene');
        r.addEventListener('click', () => {
          msgs = msgs.filter((x) => x !== m);
          send(m.body);
        });
        b.appendChild(r);
      }
      return b;
    }

    function render(keepScroll) {
      const atBottom = msgsBox.scrollHeight - msgsBox.scrollTop - msgsBox.clientHeight < 80;
      const prevH = msgsBox.scrollHeight;
      const prevTop = msgsBox.scrollTop;
      inner.innerHTML = '';
      if (!msgs.length) {
        inner.innerHTML = `<div class="empty thread-empty">${BG.avatar(person, { size: 64 })}<p>${esc(person.full_name || person.username)} ile sohbetiniz burada görünecek. İlk mesajı sen yaz.</p></div>`;
        return;
      }
      if (noMore) inner.appendChild(BG.h('p.thread-start', 'Sohbetin başlangıcı'));
      let lastDay = '';
      let lastSender = null;
      let lastTime = 0;
      msgs.forEach((m) => {
        const day = new Date(m.created_at).toDateString();
        if (day !== lastDay) {
          inner.appendChild(BG.h('div.day-sep', BG.h('span', BG.fmt.dayLabel(m.created_at))));
          lastDay = day;
          lastSender = null;
        }
        const t = new Date(m.created_at).getTime();
        const b = bubble(m);
        if (lastSender === m.sender_id && t - lastTime < 180000) b.classList.add('is-cont');
        lastSender = m.sender_id;
        lastTime = t;
        inner.appendChild(b);
      });
      if (keepScroll === 'older') msgsBox.scrollTop = msgsBox.scrollHeight - prevH + prevTop;
      else if (keepScroll !== 'stay' || atBottom) msgsBox.scrollTop = msgsBox.scrollHeight;
    }

    async function clearThread() {
      if (!msgs.some((m) => m.id)) {
        BG.toast({ type: 'info', text: 'Temizlenecek mesaj yok.' });
        return;
      }
      const name = person.full_name || person.username;
      const ok = await BG.confirm({
        title: 'Sohbet temizlensin mi?',
        text: `Bu sohbetteki mesajlar senin için silinecek. ${name} kendi mesajlarını görmeye devam eder.`,
        okText: 'Sohbeti temizle',
        danger: true,
      });
      if (!ok) return;
      try {
        await BG.api.rpc('bg_clear_thread', { p_other: person.user_id });
        msgs = [];
        noMore = true;
        render();
        BG.bus.emit('conversations');
        BG.api
          .rpc('bg_unread_count', {})
          .then((n) => {
            if (typeof n === 'number') {
              BG.store.unread = n;
              BG.bus.emit('counts');
            }
          })
          .catch(() => {});
        BG.toast({ type: 'success', text: 'Sohbet temizlendi' });
      } catch (e) {
        BG.toastError(e);
      }
    }
    el.querySelector('.thread-head').addEventListener('click', (e) => {
      if (e.target.closest('[data-clear]')) clearThread();
    });

    async function markRead() {
      try {
        const n = await BG.api.rpc('bg_mark_read', { p_other: person.user_id });
        if (n > 0) {
          BG.store.unread = Math.max(0, (BG.store.unread || 0) - n);
          BG.bus.emit('counts');
          BG.bus.emit('conversations');
        }
      } catch (e) {}
    }

    async function load() {
      try {
        msgs = (await BG.api.rpc('bg_thread', { p_other: person.user_id, p_before: null, p_limit: 60 })) || [];
        noMore = msgs.length < 60;
        render();
        markRead();
      } catch (e) {
        inner.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      }
    }

    msgsBox.addEventListener('scroll', async () => {
      if (msgsBox.scrollTop > 60 || loadingOlder || noMore || !msgs.length || !msgs[0].id) return;
      loadingOlder = true;
      try {
        const older = (await BG.api.rpc('bg_thread', { p_other: person.user_id, p_before: msgs[0].id, p_limit: 60 })) || [];
        noMore = older.length < 60;
        msgs = older.concat(msgs);
        render('older');
      } catch (e) {
      } finally {
        loadingOlder = false;
      }
    });

    async function send(text) {
      const body = String(text || '').trim();
      if (!body) return;
      const temp = { id: null, sender_id: me.id, recipient_id: person.user_id, body, created_at: new Date().toISOString(), _pending: true };
      msgs.push(temp);
      render();
      try {
        const row = await BG.api.rpc('bg_send_message', { p_to: person.user_id, p_body: body });
        const i = msgs.indexOf(temp);
        if (i >= 0) msgs[i] = row;
        BG.bus.emit('conversations');
      } catch (e) {
        temp._pending = false;
        temp._failed = true;
        BG.toastError(e, 'Mesaj gönderilemedi');
      }
      render('stay');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ta.value;
      ta.value = '';
      autosize();
      send(v);
      ta.focus();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isCoarse()) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
    function autosize() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 132) + 'px';
    }
    ta.addEventListener('input', autosize);
    if (opts.onBack) el.querySelector('[data-back]').addEventListener('click', opts.onBack);

    const view = {
      otherId: person.user_id,
      el,
      visible: () => (opts.visible ? opts.visible() : true),
    };
    chat.views.add(view);
    const offs = [
      BG.bus.on('message:new', (m) => {
        if (m.sender_id !== person.user_id || !el.isConnected) return;
        if (msgs.some((x) => x.id === m.id)) return;
        msgs.push(m);
        render('stay');
        if (view.visible() && document.visibilityState === 'visible') markRead();
      }),
      BG.bus.on('message:update', (m) => {
        const x = msgs.find((y) => y.id === m.id);
        if (x && x.read_at !== m.read_at) {
          x.read_at = m.read_at;
          render('stay');
        }
      }),
      BG.bus.on('friends', paintHead),
    ];
    const onVis = () => {
      if (document.visibilityState === 'visible' && el.isConnected && view.visible()) markRead();
    };
    document.addEventListener('visibilitychange', onVis);

    paintHead();
    load();
    if (!isCoarse()) setTimeout(() => ta.focus({ preventScroll: true }), 60);
    return function destroy() {
      chat.views.delete(view);
      offs.forEach((f) => f());
      document.removeEventListener('visibilitychange', onVis);
    };
  };

  /** Sohbet listesi */
  chat.mountList = function (container, opts) {
    opts = opts || {};
    const el = BG.frag(`<div class="conv-pane-inner">
        <header class="conv-head"><h1 class="${opts.compact ? 'h2' : ''}">Mesajlar</h1>
          <button class="btn btn-soft btn-sm" type="button" data-new>${icon('plus', 16)}Yeni</button></header>
        <ul class="conv-list"><li class="loading-row">Yükleniyor…</li></ul>
      </div>`);
    container.replaceChildren(el);
    const list = el.querySelector('.conv-list');
    async function load() {
      try {
        const rows = (await BG.api.rpc('bg_conversations', {})) || [];
        if (!el.isConnected) return;
        if (!rows.length) {
          list.innerHTML = `<li class="empty">${BG.tile('?', 'ink', 'tile-s')}<p>Henüz mesajın yok. “Yeni” ile bir arkadaşına yaz.</p></li>`;
          return;
        }
        list.innerHTML = '';
        rows.forEach((c) => {
          const f = social.friendById(c.user_id);
          const online = f ? !!f.online : !!c.online;
          const li = BG.frag(`<li><button type="button" class="conv${opts.active === c.username ? ' is-active' : ''}${c.unread ? ' has-unread' : ''}">
              ${BG.avatar(c, { size: 46, online: c.is_friend ? online : undefined })}
              <span class="conv-text"><strong>${esc(c.full_name || c.username)}</strong>
              <span class="conv-last">${c.last_from_me ? 'Sen: ' : ''}${esc(c.last_body)}</span></span>
              <span class="conv-meta"><time>${esc(BG.fmt.short(c.last_at))}</time>${BG.countBadge(c.unread)}${!c.unread && c.last_from_me && c.last_read ? `<span class="ticks is-read">${icon('checks', 14)}</span>` : ''}</span>
            </button></li>`);
          li.querySelector('button').addEventListener('click', () => opts.onOpen(c.username));
          list.appendChild(li);
        });
      } catch (e) {
        list.innerHTML = `<li class="loading-row">${esc(e.message)}</li>`;
      }
    }
    el.querySelector('[data-new]').addEventListener('click', () => chat.pickFriend(opts.onOpen));
    const reload = BG.debounce(load, 250);
    const offs = [BG.bus.on('message:new', reload), BG.bus.on('conversations', reload), BG.bus.on('friends', reload)];
    load();
    return () => offs.forEach((f) => f());
  };

  chat.pickFriend = function (onPick) {
    const friends = (BG.store.friends || []).filter((f) => f.relation === 'friend');
    const body = BG.frag(`<div class="picker">
        ${friends.length ? `<div class="input-wrap has-icon">${icon('search', 18)}<input class="input" placeholder="Arkadaş ara" aria-label="Arkadaş ara"></div>` : ''}
        <ul class="person-list picker-list"></ul></div>`);
    const ul = body.querySelector('ul');
    let m;
    function draw(q) {
      ul.innerHTML = '';
      const list = friends.filter((f) => !q || (f.username + ' ' + (f.full_name || '')).toLocaleLowerCase('tr-TR').includes(q));
      if (!list.length) {
        ul.innerHTML = friends.length
          ? '<li class="hint-row">Eşleşen arkadaş yok.</li>'
          : `<li class="empty"><p>Mesaj göndermek için önce arkadaş eklemelisin.</p><a class="btn btn-soft btn-sm" href="#/arkadaslar">Arkadaş ekle</a></li>`;
        return;
      }
      list.forEach((f) => {
        const li = BG.frag(`<li><button type="button" class="person-row as-btn">${BG.avatar(f, { size: 40, online: !!f.online })}<div class="person-text"><strong>${esc(f.full_name || f.username)}</strong><span>@${esc(f.username)}</span></div></button></li>`);
        li.querySelector('button').addEventListener('click', () => {
          m.close();
          onPick(f.username);
        });
        ul.appendChild(li);
      });
    }
    const inp = body.querySelector('input');
    if (inp) inp.addEventListener('input', () => draw(inp.value.trim().toLocaleLowerCase('tr-TR')));
    draw('');
    m = BG.modal({ title: 'Kime yazmak istersin?', size: 's', body });
    ul.addEventListener('click', (e) => {
      if (e.target.closest('a')) m.close();
    });
  };

  /* ---------------- Mesajlar sayfası ---------------- */
  BG.views.messages = function (params) {
    const username = params.username ? BG.normalizeUsername(params.username) : '';
    const root = BG.frag(`
      <div class="page page-wide messages-page">
        <div class="chat panel ${username ? 'has-thread' : ''}">
          <aside class="conv-pane"></aside>
          <section class="thread-pane"></section>
        </div>
      </div>`);
    const convPane = root.querySelector('.conv-pane');
    const threadPane = root.querySelector('.thread-pane');
    const destroyers = [];
    const narrow = () => window.matchMedia('(max-width: 820px)').matches;
    destroyers.push(chat.mountList(convPane, { active: username, onOpen: (u) => BG.router.go('/mesajlar/' + u) }));
    if (!username) {
      threadPane.innerHTML = `<div class="empty thread-placeholder">${BG.tile('B', 'amber')}<p>Bir sohbet seç ya da yeni bir mesaj başlat.</p></div>`;
    } else {
      threadPane.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
      resolvePerson(username).then((p) => {
        if (!root.isConnected) return;
        if (!p) {
          threadPane.innerHTML = `<div class="empty thread-placeholder"><p>@${esc(username)} bulunamadı.</p></div>`;
          return;
        }
        destroyers.push(
          chat.mountThread(threadPane, p, {
            onBack: narrow() ? () => BG.router.go('/mesajlar') : null,
            visible: () => root.isConnected && !document.querySelector('.chat-drawer.is-open'),
          })
        );
      });
    }
    return { node: root, cleanup: () => destroyers.forEach((d) => d && d()) };
  };

  /* ---------------- Sohbet çekmecesi (oyun sırasında) ---------------- */
  let drawer = null;
  chat.openDrawer = function (username) {
    if (!BG.isAuthed()) return BG.router.go('/giris');
    if (!drawer) {
      drawer = BG.frag(`<div class="chat-drawer" role="dialog" aria-modal="false" aria-label="Mesajlar">
          <div class="drawer-scrim"></div>
          <div class="drawer-panel"><button class="icon-btn drawer-x" type="button" aria-label="Kapat">${icon('x')}</button><div class="drawer-body"></div></div>
        </div>`);
      document.body.appendChild(drawer);
      drawer.querySelector('.drawer-x').addEventListener('click', chat.closeDrawer);
      drawer.querySelector('.drawer-scrim').addEventListener('click', chat.closeDrawer);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open') && !document.querySelector('.modal-wrap')) chat.closeDrawer();
      });
    }
    const body = drawer.querySelector('.drawer-body');
    if (drawer._destroy) drawer._destroy();
    drawer._destroy = null;
    const showList = () => {
      if (drawer._destroy) drawer._destroy();
      drawer._destroy = chat.mountList(body, { compact: true, onOpen: showThread });
    };
    const showThread = async (u) => {
      if (drawer._destroy) drawer._destroy();
      drawer._destroy = null;
      body.innerHTML = '<p class="loading-row">Yükleniyor…</p>';
      const p = await resolvePerson(u);
      if (!p) return showList();
      drawer._destroy = chat.mountThread(body, p, { onBack: showList, visible: () => drawer.classList.contains('is-open') });
    };
    if (username) showThread(username);
    else showList();
    drawer.classList.add('is-open');
    document.documentElement.classList.add('drawer-open');
  };
  chat.closeDrawer = function () {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.documentElement.classList.remove('drawer-open');
    if (drawer._destroy) drawer._destroy();
    drawer._destroy = null;
  };
})();
