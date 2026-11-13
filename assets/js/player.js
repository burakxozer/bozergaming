/* =====================================================================
   Bözer Gaming 3.1 — Oyuncu profili (Steam benzeri) ve profil önizlemesi
   Bağlantı: #/profil/<kullanıcı-id>  ya da  index.html?profile=<kullanıcı-id>
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const { esc, icon } = BG;
  BG.views = BG.views || {};
  const fmt = BG.n0;
  const player = (BG.player = {});
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const gname = (k) => (BG.GAMES[k] ? BG.GAMES[k].name : k);

  player.link = (id) => location.origin + location.pathname + '?profile=' + encodeURIComponent(id);

  /** Profili aç: oyun açıksa oyunun üstünde pencere olarak, değilse sayfa olarak */
  player.open = function (id) {
    if (!id || !UUID.test(id)) return;
    if (!BG.isAuthed()) return BG.router.go('/giris?r=' + encodeURIComponent('/profil/' + id));
    if (BG.host && BG.host.isOpen && BG.host.isOpen()) return player.sheet(id);
    BG.router.go('/profil/' + id);
  };

  /* ---------------- arkadaşlık eylemleri ---------------- */
  async function relAct(d, act, btn) {
    if (btn) btn.disabled = true;
    try {
      if (act === 'add') {
        const r = await BG.api.rpc('bg_send_friend_request', { p_username: d.user.username });
        BG.toast({ type: 'success', text: r === 'accepted' ? 'Artık arkadaşsınız.' : 'Arkadaşlık isteği gönderildi.' });
      } else if (act === 'accept' || act === 'decline') {
        await BG.api.rpc('bg_respond_friend_request', { p_id: d.request_id, p_accept: act === 'accept' });
        BG.toast({ type: 'success', text: act === 'accept' ? 'Arkadaşlık isteği kabul edildi.' : 'İstek reddedildi.' });
      } else if (act === 'msg') {
        BG.closeAllModals();
        if (BG.host && BG.host.isOpen && BG.host.isOpen() && BG.chat && BG.chat.openDrawer) BG.chat.openDrawer(d.user.username);
        else BG.router.go('/mesajlar/' + encodeURIComponent(d.user.username));
        return true;
      }
      if (BG.social && BG.social.refreshFriends) BG.social.refreshFriends();
      return true;
    } catch (e) {
      BG.toastError(e);
      if (btn) btn.disabled = false;
      return false;
    }
  }
  function relButtons(d) {
    switch (d.relation) {
      case 'self':
        return `<a class="btn btn-soft" href="#/profil/ayarlar">${icon('pen', 17)}Profili düzenle</a>`;
      case 'friend':
        return `<span class="pp-rel is-friend">${icon('users', 16)}Arkadaşsınız</span><button class="btn btn-primary" type="button" data-rel="msg">${icon('message', 17)}Mesaj gönder</button>`;
      case 'outgoing':
        return `<span class="pp-rel">${icon('clock', 16)}Arkadaşlık isteği gönderildi</span>`;
      case 'incoming':
        return `<button class="btn btn-primary" type="button" data-rel="accept">${icon('check', 17)}İsteği kabul et</button><button class="btn btn-ghost" type="button" data-rel="decline">Reddet</button>`;
      default:
        return `<button class="btn btn-primary" type="button" data-rel="add">${icon('userPlus', 17)}Arkadaş ekle</button>`;
    }
  }

  /* ---------------- kısa önizleme (masa, liderlik, liste) ---------------- */
  player.preview = async function (id, opts) {
    opts = opts || {};
    if (!id || !UUID.test(id)) return;
    if (!BG.isAuthed()) return BG.router.go('/giris');
    let d;
    try {
      d = await BG.api.rpc('bg_profile', { p_user: id });
    } catch (e) {
      return BG.toastError(e);
    }
    const r = BG.rankInfo(d.bp.rank);
    const st = d.stats || {};
    const am = st.americano || {};
    const dk = st.dostkazigi || {};
    const bj = st.blackjack || {};
    const body = BG.frag(`<div class="pp-mini g${r.grp}" style="${BG.rankStyle(r)}">
        <div class="pp-mini-top${d.bg && BG.PBG[d.bg] ? ' has-pbg' : ''}">${d.bg && BG.PBG[d.bg] ? BG.pbgHTML(d.bg) : ''}${BG.avatar(d.user, { size: 84, frame: d.user.frame })}
          <div><h3>${esc(d.user.full_name || d.user.username)}</h3><p class="muted">@${esc(d.user.username)}</p>
          <p class="pp-chips">${BG.rankChip(d.bp.rank)}${BG.prestigeChip(d.bp.prestige)}</p>${badgeRow(d.badges, 24)}</div>
          <div class="pp-mini-bp"><b>${fmt(d.bp.balance)}</b><span>BP</span></div>
        </div>
        <dl class="pp-mini-stats">
          <div><dt>Americano</dt><dd>${fmt(am.played || 0)} maç · ${fmt(am.wins || 0)} birincilik · ${BG.pct(am.wins || 0, am.played || 0)}</dd></div>
          <div><dt>Dost Kazığı</dt><dd>${fmt(dk.played || 0)} maç · ${fmt(dk.wins || 0)} galibiyet · ${BG.pct(dk.wins || 0, dk.played || 0)}</dd></div>
          <div><dt>Blackjack</dt><dd>${fmt(bj.played || 0)} ana el · ${fmt(bj.wins || 0)} kazanç · ${BG.pct(bj.wins || 0, bj.played || 0)}</dd></div>
          <div><dt>En yüksek rütbe</dt><dd>${esc(BG.rankInfo(d.bp.best_rank).name)}</dd></div>
        </dl>
        <div class="pp-mini-act">${relButtons(d)}<button class="btn btn-soft" type="button" data-full>${icon('user', 17)}Profili aç</button>
          ${opts.gift ? `<button class="btn btn-soft" type="button" data-gift>${icon('gift', 17)}Hediye gönder</button>` : ''}</div>
      </div>`);
    const m = BG.modal({ title: 'Oyuncu', body, size: 's', actions: [] });
    body.addEventListener('click', async (e) => {
      const rb = e.target.closest('[data-rel]');
      if (rb) {
        if (await relAct(d, rb.dataset.rel, rb)) {
          m.close();
          if (rb.dataset.rel !== 'msg') player.preview(id, opts);
        }
        return;
      }
      if (e.target.closest('[data-full]')) {
        m.close();
        player.open(id);
        return;
      }
      if (e.target.closest('[data-gift]') && opts.gift) {
        m.close();
        opts.gift();
      }
    });
  };

  /* ---------------- v3.4 rozetler ---------------- */
  const TIER_K = ['', 'bronze', 'silver', 'gold'];
  const TIER_N = ['', 'Bronz', 'Gümüş', 'Altın'];
  const badgeSrc = (code, tier, x2) => `assets/badges/${code === 'bozer' ? 'bozer' : code}_${TIER_K[tier] || 'bronze'}${x2 ? '@2x' : ''}.webp`;
  const badgeImg = (code, tier, size, alt) =>
    `<img class="bd-ic" src="${badgeSrc(code, tier)}" srcset="${badgeSrc(code, tier, true)} 2x" width="${size}" height="${size}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`;
  BG.badgeImg = badgeImg;
  /** Profil kartında basılmış rozetler: önce Bözer Gaming altın rozeti, sonra en yüksek kademeden */
  function badgeRow(b, size) {
    if (!b) return '';
    const items = (b.items || []).slice().sort((x, y) => y.tier - x.tier);
    if (!items.length && !b.master) return '';
    const max = 8;
    const shown = items.slice(0, b.master ? max - 1 : max);
    return `<p class="pp-badgerow" aria-label="Rozetler">${b.master ? `<span class="pp-bd is-master" title="Bözer Gaming Altın Rozeti">${badgeImg('bozer', 3, size + 6, 'Bözer Gaming Altın Rozeti')}</span>` : ''}${shown
      .map((x) => `<span class="pp-bd t${x.tier}" title="${esc(TIER_N[x.tier] + ' · ' + x.name)}">${badgeImg(x.code, x.tier, size, TIER_N[x.tier] + ' ' + x.name)}</span>`)
      .join('')}${items.length > shown.length ? `<span class="pp-bd-more">+${items.length - shown.length}</span>` : ''}</p>`;
  }
  /** Başkasının profili: basılmış rozetler vitrini */
  function badgesShowcase(d) {
    const b = d.badges || {};
    const items = (b.items || []).slice().sort((x, y) => y.tier - x.tier);
    if (!items.length && !b.master) return '';
    return `<section class="pp-sec pp-badges"><h2>${icon('award', 18)}Rozetler <span class="muted">${fmt(items.length + (b.master ? 1 : 0))}</span></h2>
        <ul class="bd-show">${b.master ? `<li class="is-master">${badgeImg('bozer', 3, 72, 'Bözer Gaming Altın Rozeti')}<b>Bözer Gaming</b><small>Altın</small></li>` : ''}${items
          .map((x) => `<li class="t${x.tier}">${badgeImg(x.code, x.tier, 64, x.name)}<b>${esc(x.name)}</b><small>${TIER_N[x.tier]}</small></li>`)
          .join('')}</ul></section>`;
  }
  /** Kendi profilim: bütün başarımlar, ilerleme ve basım */
  function badgeCard(it) {
    const next = it.minted + 1;
    const ready = it.earned > it.minted;
    const done = it.minted >= 3;
    const t = done ? it.tiers[2] : it.tiers[next - 1];
    const pct = done || ready ? 100 : Math.max(0, Math.min(100, (it.value / Math.max(1, t.n)) * 100));
    const pip = (k) => `<i class="p${k}${it.minted >= k ? ' on' : ready && next === k ? ' rdy' : ''}" title="${TIER_N[k]}: ${esc(it.tiers[k - 1].label)}"></i>`;
    const cost = (k) => (k === 1 ? `${fmt(it.tiers[0].cost)} BP` : `${TIER_N[k - 1]} rozet + ${fmt(it.tiers[k - 1].cost)} BP`);
    const act = done
      ? `<span class="bd-done">${icon('check', 14)}Altın rozet basıldı</span>`
      : ready
      ? `<button class="btn btn-primary btn-sm bd-mint" type="button" data-mint="${esc(it.code)}" data-tier="${next}">${icon('award', 15)}${TIER_N[next]} üret · ${cost(next)}</button>`
      : `<span class="muted small">${TIER_N[next]}: ${esc(t.label)}</span>`;
    return `<article class="bd-card t${it.minted}${ready ? ' is-ready' : ''}${done ? ' is-done' : ''}" data-code="${esc(it.code)}">
        <div class="bd-img">${badgeImg(it.code, Math.max(1, it.minted), 76, it.name)}${ready ? '<span class="bd-light" title="Basılmaya hazır"></span>' : ''}</div>
        <div class="bd-b">
          <h3>${esc(it.name)}</h3>
          <span class="bd-pips">${pip(1)}${pip(2)}${pip(3)}</span>
          <div class="bd-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${t.n}" aria-valuenow="${Math.min(it.value, t.n)}"><i style="width:${pct.toFixed(1)}%"></i></div>
          <small class="bd-cnt">${done ? esc(it.tiers[2].label) : ready ? `${TIER_N[next]} rozet hak edildi: ${esc(t.label)}` : `${fmt(Math.min(it.value, t.n))} / ${fmt(t.n)}`}</small>
          <div class="bd-act">${act}</div>
        </div>
      </article>`;
  }
  function badgesOwnHTML(b) {
    const items = b.items || [];
    const golds = items.filter((x) => x.minted >= 3).length;
    const minted = items.reduce((a, x) => a + x.minted, 0);
    return `<h2>${icon('award', 18)}Rozetler <span class="muted">${fmt(minted)} / ${fmt(items.length * 3)} kademe</span>${b.ready ? `<span class="bd-ready-n">${icon('award', 13)}${fmt(b.ready)} rozet basılmayı bekliyor</span>` : ''}</h2>
      <p class="muted small bd-lead">Başarımı tamamlayınca rozeti hak edersin; rozeti BP ile basınca profilinde herkese görünür. Bronz ${fmt(items[0] ? items[0].tiers[0].cost : 10)} BP · Gümüş: bronz rozetin + ${fmt(items[0] ? items[0].tiers[1].cost : 100)} BP · Altın: gümüş rozetin + ${fmt(items[0] ? items[0].tiers[2].cost : 1000)} BP. Gümüş, bronz basılmadan; altın, gümüş basılmadan hak edilmez.</p>
      <div class="bd-grid">${items.map(badgeCard).join('')}</div>
      <article class="bd-master${b.master ? ' is-done' : ''}${b.master_ready ? ' is-ready' : ''}">
        <div class="bd-img">${badgeImg('bozer', 3, 96, 'Bözer Gaming Altın Rozeti')}${b.master_ready ? '<span class="bd-light"></span>' : ''}</div>
        <div class="bd-b">
          <h3>Bözer Gaming Altın Rozeti</h3>
          <p class="muted small">Bütün başarımların altın rozetini bastıktan sonra ${fmt(b.master_cost || 10000)} BP ile basılır; başka rozet harcanmaz. En nadir rozettir.</p>
          <div class="bd-prog"><i style="width:${items.length ? ((golds / items.length) * 100).toFixed(1) : 0}%"></i></div>
          <small class="bd-cnt">${fmt(golds)} / ${fmt(items.length)} altın rozet</small>
          <div class="bd-act">${b.master ? `<span class="bd-done">${icon('check', 14)}Basıldı · ${esc(BG.fmt.date(b.master_at))}</span>` : b.master_ready ? `<button class="btn btn-primary btn-sm bd-mint" type="button" data-mint="bozer" data-tier="3">${icon('award', 15)}Üret · ${fmt(b.master_cost || 10000)} BP</button>` : ''}</div>
        </div>
      </article>`;
  }
  /** Rozet basımı: 2 saniyelik "rozet üretiliyor" gösterisi, ardından "başarıyla üretildi" */
  async function mintBadge(code, tier, name, cost, after) {
    if (cost >= 100) {
      const ok = await BG.confirm({
        title: code === 'bozer' ? 'Bözer Gaming Altın Rozeti' : `${TIER_N[tier]} rozet: ${name}`,
        text: code === 'bozer' ? `${fmt(cost)} BP harcanır. Rozet profilinde sergilenir.` : `${TIER_N[tier - 1]} rozetin ve ${fmt(cost)} BP harcanır; yerine ${TIER_N[tier]} rozet basılır ve profilinde sergilenir.`,
        okText: 'Üret',
      });
      if (!ok) return;
    }
    const src = badgeSrc(code, tier, true);
    const box = BG.frag(`<div class="bd-forge is-forging">
        <div class="bd-forge-stage"><span class="bd-rays"></span><span class="bd-ring"></span>
          <img class="bd-forge-img" src="${src}" alt="" width="150" height="150"><span class="bd-sparks">${'<i></i>'.repeat(14)}</span></div>
        <p class="bd-forge-t" aria-live="polite">Rozet üretiliyor…</p>
        <div class="bd-forge-bar"><i></i></div>
      </div>`);
    const m = BG.modal({ title: '', body: box, size: 's', dismissable: false, actions: [] });
    m.el.classList.add('bd-modal');
    const t0 = Date.now();
    let res = null;
    let err = null;
    try {
      res = await BG.api.rpc('bg_badge_mint', { p_code: code });
    } catch (e) {
      err = e;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, 2000 - (Date.now() - t0))));
    box.classList.remove('is-forging');
    const t = box.querySelector('.bd-forge-t');
    if (err) {
      box.classList.add('is-failed');
      t.textContent = err.message || 'Rozet üretilemedi.';
    } else {
      box.classList.add('is-done');
      t.innerHTML = `<b>Başarıyla üretildi!</b><span>${esc(code === 'bozer' ? 'Bözer Gaming Altın Rozeti' : TIER_N[tier] + ' · ' + name)} profilinde sergileniyor.</span>`;
      if (res && res.balance != null && BG.bp.setBalance) BG.bp.setBalance(res.balance);
      BG.bp.refresh();
    }
    const close = BG.h('button', { type: 'button', class: 'btn btn-primary' }, err ? 'Kapat' : 'Harika');
    close.addEventListener('click', () => {
      m.close();
      if (!err && after) after();
    });
    box.appendChild(close);
    close.focus({ preventScroll: true });
  }
  async function mountBadges(root, d, opts) {
    const sec = root.querySelector('.pp-badges[data-own]');
    if (!sec) return;
    let b;
    try {
      b = await BG.api.rpc('bg_badges', {});
    } catch (e) {
      sec.innerHTML = `<h2>${icon('award', 18)}Rozetler</h2><p class="muted small">${esc(e.message)}</p>`;
      return;
    }
    if (!sec.isConnected) return;
    sec.innerHTML = badgesOwnHTML(b);
    if (opts.focusBadges) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mint]');
      if (!btn) return;
      const code = btn.dataset.mint;
      const tier = +btn.dataset.tier;
      const it = (b.items || []).find((x) => x.code === code);
      const cost = code === 'bozer' ? b.master_cost || 10000 : it ? it.tiers[tier - 1].cost : 0;
      mintBadge(code, tier, it ? it.name : '', cost, () => opts.reload({ focusBadges: true }));
    });
  }

  /* ---------------- tam profil ---------------- */
  function heroHTML(d) {
    const r = BG.rankInfo(d.bp.rank);
    const span = r.next ? Math.max(1, r.next - r.min) : 1;
    const prog = r.next ? Math.max(0, Math.min(100, ((d.bp.balance - r.min) / span) * 100)) : 100;
    const pres = d.presence;
    const online = pres && pres.online;
    const now = online && pres.game ? `<span class="pp-now">${BG.gameTile(pres.game, 'tile-xs')}Şu an: ${esc(gname(pres.game))}${pres.session_id && d.relation !== 'self' ? ` · <a href="${esc(BG.watchHref(pres.game, pres.session_id, d.user.id))}">İzle</a>` : ''}</span>` : '';
    const lp = d.last_played;
    const pbg = d.bg && BG.PBG[d.bg] ? BG.pbgHTML(d.bg) : '';
    return `<header class="pp-hero g${r.grp}${pbg ? ' has-pbg' : ''}" style="${BG.rankStyle(r)}">
        ${pbg || '<div class="pp-hero-bg" aria-hidden="true"></div>'}
        <div class="pp-ava">${BG.avatar(d.user, { size: 148, frame: d.user.frame, online: pres ? !!online : undefined })}</div>
        <div class="pp-id">
          <h1>${esc(d.user.full_name || d.user.username)}</h1>
          <p class="pp-user">@${esc(d.user.username)} · ${fmt(d.friends_count)} arkadaş · Üye: ${esc(BG.fmt.date(d.user.member_since))}</p>
          <p class="pp-chips">${BG.rankChip(d.bp.rank, { size: 20 })}${BG.prestigeChip(d.bp.prestige)}${pres ? `<span class="pp-online${online ? ' is-on' : ''}">${online ? 'Çevrimiçi' : pres.last_seen_at ? 'Son görülme ' + esc(BG.fmt.ago(pres.last_seen_at)) : 'Çevrimdışı'}</span>` : ''}</p>
          ${badgeRow(d.badges, 30)}
          <p class="pp-last">${now || (lp ? `Son oynanan: <b>${esc(gname(lp.game))}</b> · ${esc(BG.fmt.ago(lp.at))}` : 'Henüz oyun süresi kaydı yok')}${d.favorite ? ` · Favori oyun: <b>${esc(gname(d.favorite))}</b>` : ''}</p>
          <div class="pp-actions">${relButtons(d)}<button class="btn btn-ghost" type="button" data-share>${icon('copy', 16)}Profil bağlantısı</button></div>
        </div>
        <div class="pp-bp">
          <span class="pp-bp-k" lang="en">Bözer Points</span>
          <span class="pp-bp-v">${BG.rankIcon(r.idx, 34)}<b>${fmt(d.bp.balance)}</b></span>
          <span class="bp-prog" aria-hidden="true"><i style="width:${prog.toFixed(1)}%"></i></span>
          <small>${r.next ? `${esc(r.nextName)}: ${fmt(r.next)} BP` : `${esc(r.name)} — en yüksek rütbe`}</small>
          <small>En yüksek rütbe: <b>${esc(BG.rankInfo(d.bp.best_rank).name)}</b></small>
          <a class="pp-ranks" href="#/rutbeler">${icon('trophy', 14)}Bütün rütbeler</a>
        </div>
      </header>`;
  }
  function prestigeHTML(d) {
    const pr = d.bp.prestige || 0;
    const next = d.bp.prestige_next;
    const prev = d.bp.prestige_prev || 0;
    const p = next ? Math.max(0, Math.min(100, ((d.bp.eligible - prev) / (next - prev)) * 100)) : 100;
    if (!pr && d.bp.rank < BG.PRESTIGE_MIN && d.relation !== 'self') return '';
    return `<section class="pp-sec pp-prestige">
        <h2>${icon('star', 18)}${pr ? 'GLOBAL · PRESTİJ ' + BG.roman(pr) : 'Prestij'}</h2>
        <div class="bp-prog pr" aria-hidden="true"><i style="width:${p.toFixed(1)}%"></i></div>
        <p class="muted small">Uygun kazanç: ${fmt(d.bp.eligible)}${next ? ' / ' + fmt(next) + ' (Prestij ' + BG.roman(pr + 1) + ')' : ' — en yüksek prestij'}. Prestij yalnızca rütbe ${esc(BG.rankInfo(BG.PRESTIGE_MIN).name)} ve üstüyken yükselir ve kalıcıdır.</p>
      </section>`;
  }
  function gameCard(key, title, rows, secs, accent) {
    return `<article class="pp-game" style="--ga:${accent}">
        <header>${BG.gameTile(key, 'tile-s')}<h3>${esc(title)}</h3><span class="pp-time">${icon('clock', 15)}${esc(BG.hours(secs))}</span></header>
        <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </article>`;
  }
  function gamesHTML(d) {
    const st = d.stats || {};
    const pt = {};
    (d.playtime || []).forEach((g) => (pt[g.game] = g));
    const secs = (k) => (pt[k] ? pt[k].secs : 0);
    const am = st.americano || {};
    const dk = st.dostkazigi || {};
    const bj = st.blackjack || {};
    const online = ['americano-online', 'dostkazigi-online', 'blackjack'];
    const others = (d.playtime || []).filter((g) => online.indexOf(g.game) < 0 && g.secs >= 60);
    return `<section class="pp-sec">
        <h2>${icon('gamepad', 18)}Oyunlar</h2>
        <div class="pp-games">
          ${gameCard('americano-online', 'Americano Online', [
            ['Toplam maç', fmt(am.played || 0)],
            ['Birincilik', fmt(am.wins || 0)],
            ['İkincilik', fmt(am.seconds || 0)],
            ['Kazanma oranı', BG.pct(am.wins || 0, am.played || 0)],
          ], secs('americano-online'), '#3fc272')}
          ${gameCard('dostkazigi-online', 'Dost Kazığı Online', [
            ['Toplam maç', fmt(dk.played || 0)],
            ['Takım galibiyeti', fmt(dk.wins || 0)],
            ['Takım mağlubiyeti', fmt(dk.losses || 0)],
            ['Kazanma oranı', BG.pct(dk.wins || 0, dk.played || 0)],
          ], secs('dostkazigi-online'), '#ff6fb3')}
          ${gameCard('blackjack', 'Blackjack Royale', [
            ['Toplam ana el', fmt(bj.played || 0)],
            ['Kazanılan', fmt(bj.wins || 0)],
            ['Kaybedilen', fmt(bj.losses || 0)],
            ['Berabere', fmt(bj.draws || 0)],
            ['Doğal Blackjack', fmt(bj.naturals || 0)],
            ['Jackpot', fmt(bj.jackpots || 0)],
            ['Kazanma oranı', BG.pct(bj.wins || 0, bj.played || 0)],
          ], secs('blackjack'), '#f4c430')}
        </div>
        <h3 class="pp-h3">Diğer oyunlar</h3>
        ${
          others.length
            ? `<ul class="pp-other">${others.map((g) => `<li>${BG.gameTile(g.game, 'tile-xs')}<span>${esc(gname(g.game))}</span><b>${esc(BG.hours(g.secs))}</b></li>`).join('')}</ul>`
            : '<p class="muted small">Diğer oyunlarda henüz süre kaydı yok.</p>'
        }
      </section>`;
  }
  function sideHTML(d) {
    const own = d.own;
    const prods = d.purchases || [];
    const gifts = d.gifts || {};
    let html = '';
    if (own) {
      const s = BG.bp.state || {};
      html += `<section class="pp-sec pp-own">
          <h2>${icon('gift', 18)}Günlük bonus</h2>
          <div>${BG.bp.dailyHTML(Object.assign({}, s, { daily_ready: own.daily_ready, daily_next: own.daily_next }), false) || '<span class="muted small">Kapalı</span>'}</div>
          <h2>${icon('target', 18)}Görevler</h2>
          <p class="small">${own.missions_ready ? `<b>${own.missions_ready}</b> ödül alınmayı bekliyor.` : 'Alınmayı bekleyen görev ödülü yok.'} <a href="#/gorevler">Görevlere git</a></p>
          <h2>${icon('users', 18)}Friend Coins</h2>
          <p class="small"><b>${fmt(own.fc)}</b> FC · <button class="link-btn" type="button" data-fc>BP’ye dönüştür</button></p>
        </section>`;
    }
    const frames = prods.filter((p) => p.kind === 'frame');
    const bgs = prods.filter((p) => p.kind === 'bg' && p.meta && BG.PBG[p.meta.bg]);
    const packs = prods.filter((p) => p.kind !== 'frame' && p.kind !== 'bg');
    const itemIc = (p) =>
      p.kind === 'emoji' ? BG.emojiImg(p.meta.pack, BG.EMOJI[p.meta.pack][0], 30)
        : p.kind === 'gifter' ? BG.giftImg('gift_box', 30)
        : p.kind === 'dealer' ? `<span class="pp-ic-dealer" aria-hidden="true"></span>`
        : p.kind === 'felt' ? `<span class="pp-ic-felt felt-${esc((p.meta && p.meta.felt) || '')}" aria-hidden="true"></span>`
        : icon('message', 22);
    html += `<section class="pp-sec">
        <h2>${icon('bag', 18)}Satın alınanlar</h2>
        ${
          prods.length
            ? `<ul class="pp-items">${packs.map((p) => `<li class="pp-item k-${esc(p.kind)}">${itemIc(p)}<span>${esc(p.name)}</span></li>`).join('')}
               ${frames.map((p) => `<li class="pp-item k-frame">${BG.avatar(d.user, { size: 30, frame: p.meta.frame })}<span>${esc(p.name)}</span></li>`).join('')}
               ${bgs.map((p) => `<li class="pp-item k-bg"><span class="pp-ic-bg">${BG.pbgHTML(p.meta.bg)}</span><span>${esc(p.name)}</span></li>`).join('')}</ul>`
            : `<p class="muted small">Henüz ürün yok.${own ? ' <a href="#/magaza">Mağazaya göz at</a>' : ''}</p>`
        }
        ${own && frames.length ? `<div class="pp-frames"><span class="muted small">Aktif çerçeve:</span><button type="button" class="pp-fr${!d.user.frame ? ' is-on' : ''}" data-frame="">Yok</button>${frames.map((p) => `<button type="button" class="pp-fr${d.user.frame === p.meta.frame ? ' is-on' : ''}" data-frame="${esc(p.id)}">${esc(BG.FRAMES[p.meta.frame] || p.name)}</button>`).join('')}</div>` : ''}
        ${own && bgs.length ? `<div class="pp-frames"><span class="muted small">Profil arka planı:</span><button type="button" class="pp-fr${!d.bg ? ' is-on' : ''}" data-pbg="">Yok</button>${bgs.map((p) => `<button type="button" class="pp-fr${d.bg === p.meta.bg ? ' is-on' : ''}" data-pbg="${esc(p.id)}">${esc(BG.PBG[p.meta.bg] || p.name)}</button>`).join('')}</div>` : ''}
      </section>
      <section class="pp-sec">
        <h2>${icon('gift', 18)}Hediye vitrini <span class="muted">${fmt(gifts.total || 0)}</span></h2>
        ${(gifts.items || []).length ? `<ul class="gs-grid">${gifts.items.map((g) => `<li title="${esc(g.name)}">${BG.giftImg(g.code, 44)}<b>×${g.n}</b></li>`).join('')}</ul>` : '<p class="muted small">Masada hediye aldığında burada görünür.</p>'}
        ${own && (gifts.items || []).length ? '<div class="pp-gift-recent" data-own-gifts><p class="muted small">Son gelenler yükleniyor…</p></div>' : ''}
      </section>`;
    return html;
  }
  function commentsHTML(d) {
    const c = d.comments || {};
    return `<section class="pp-sec pp-comments">
        <h2>${icon('message', 18)}PROFİL YORUMLARI <span class="muted">${fmt(c.count || 0)}</span></h2>
        ${
          c.can_post
            ? `<form class="pc-form" novalidate><textarea class="input" maxlength="500" rows="3" placeholder="${esc((d.user.full_name || d.user.username).split(' ')[0])} için bir yorum yaz…" aria-label="Yorum"></textarea>
               <div class="pc-form-f"><small class="muted"><span data-cnt>0</span>/500</small><button class="btn btn-primary btn-sm" type="submit">${icon('send', 16)}Gönder</button></div></form>`
            : `<p class="muted small pc-note">${d.relation === 'self' ? 'Arkadaşların profiline yorum bırakabilir. Yorumları silebilir ya da bir kişinin yorum yazmasını engelleyebilirsin.' : 'Yalnızca arkadaşlar bu profile yorum yazabilir.'}</p>`
        }
        <ul class="pc-list"><li class="muted small">Yükleniyor…</li></ul>
        <button class="btn btn-ghost btn-sm pc-more" type="button" hidden>Daha eski yorumlar</button>
        <div class="pc-blocked" hidden></div>
      </section>`;
  }
  function mountComments(root, d) {
    const sec = root.querySelector('.pp-comments');
    const list = sec.querySelector('.pc-list');
    const more = sec.querySelector('.pc-more');
    let before = null;
    async function load(reset) {
      if (reset) before = null;
      try {
        const r = await BG.api.rpc('bg_profile_comments', { p_user: d.user.id, p_before: before, p_limit: 20 });
        if (reset || before === null) list.innerHTML = '';
        const items = r.items || [];
        if (!items.length && !before) list.innerHTML = '<li class="pc-empty muted small">Henüz yorum yok.</li>';
        items.forEach((c) => {
          const dt = new Date(c.created_at);
          const li = BG.frag(`<li class="pc-it" data-id="${c.id}">
              <button type="button" class="pc-ava" data-player="${esc(c.author.id)}" aria-label="${esc(c.author.full_name || c.author.username)} profili">${BG.avatar(c.author, { size: 42, frame: c.author.badge && c.author.badge.frame })}</button>
              <div class="pc-b"><div class="pc-h"><button type="button" class="link-btn" data-player="${esc(c.author.id)}"><b></b></button>${c.author.badge ? BG.rankChip(c.author.badge.rank, { min: true }) : ''}<time>${esc(BG.fmt.dateShort(dt))} ${esc(BG.fmt.clock(dt))}</time>
                <span class="pc-tools">${c.can_report ? `<button type="button" class="icon-btn sm" data-report title="Bildir" aria-label="Yorumu bildir">${icon('flag', 15)}</button>` : ''}${c.can_block ? `<button type="button" class="icon-btn sm" data-block="${esc(c.author.id)}" title="Bu kişinin yorum yazmasını engelle" aria-label="Yorum yazmasını engelle">${icon('ban', 15)}</button>` : ''}${c.can_delete ? `<button type="button" class="icon-btn sm" data-del title="Yorumu sil" aria-label="Yorumu sil">${icon('trash', 15)}</button>` : ''}</span></div>
              <p class="pc-text"></p></div></li>`);
          li.querySelector('.pc-h b').textContent = c.author.full_name || c.author.username;
          li.querySelector('.pc-text').textContent = c.body;
          list.appendChild(li);
        });
        if (items.length) before = items[items.length - 1].id;
        more.hidden = items.length < 20;
        const bl = sec.querySelector('.pc-blocked');
        if (r.blocked && r.blocked.length) {
          bl.hidden = false;
          bl.innerHTML = `<span class="muted small">Yorum yazması engellenenler:</span> ${r.blocked.map((b) => `<button type="button" class="chip-btn" data-unblock="${esc(b.id)}">${esc(b.full_name || b.username)} ${icon('x', 13)}</button>`).join('')}`;
        } else bl.hidden = true;
      } catch (e) {
        list.innerHTML = `<li class="muted small">${esc(e.message)}</li>`;
      }
    }
    more.addEventListener('click', () => load(false));
    const form = sec.querySelector('.pc-form');
    if (form) {
      const ta = form.querySelector('textarea');
      ta.addEventListener('input', () => (form.querySelector('[data-cnt]').textContent = ta.value.length));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = ta.value.trim();
        if (!v) return;
        const b = form.querySelector('button');
        b.disabled = true;
        try {
          await BG.api.rpc('bg_profile_comment_add', { p_user: d.user.id, p_body: v });
          ta.value = '';
          form.querySelector('[data-cnt]').textContent = '0';
          load(true);
        } catch (err) {
          BG.toastError(err);
        } finally {
          b.disabled = false;
        }
      });
    }
    sec.addEventListener('click', async (e) => {
      const it = e.target.closest('.pc-it');
      if (e.target.closest('[data-del]') && it) {
        if (!(await BG.confirm({ title: 'Yorumu sil', text: 'Bu yorum profilden kaldırılsın mı?', okText: 'Sil', danger: true }))) return;
        try {
          await BG.api.rpc('bg_profile_comment_delete', { p_id: Number(it.dataset.id) });
          it.remove();
          if (!list.children.length) list.innerHTML = '<li class="pc-empty muted small">Henüz yorum yok.</li>';
        } catch (err) {
          BG.toastError(err);
        }
        return;
      }
      if (e.target.closest('[data-report]') && it) {
        if (!(await BG.confirm({ title: 'Yorumu bildir', text: 'Bu yorum kötüye kullanım olarak yöneticiye bildirilsin mi?', okText: 'Bildir' }))) return;
        try {
          await BG.api.rpc('bg_profile_comment_report', { p_id: Number(it.dataset.id), p_reason: null });
          BG.toast({ type: 'success', text: 'Yorum yöneticiye bildirildi.' });
        } catch (err) {
          BG.toastError(err);
        }
        return;
      }
      const bk = e.target.closest('[data-block]');
      if (bk) {
        if (!(await BG.confirm({ title: 'Yorum yazmasını engelle', text: 'Bu kişi artık profiline yorum yazamaz. Engeli istediğin zaman kaldırabilirsin.', okText: 'Engelle', danger: true }))) return;
        try {
          await BG.api.rpc('bg_profile_comment_block', { p_user: bk.dataset.block, p_block: true });
          load(true);
        } catch (err) {
          BG.toastError(err);
        }
        return;
      }
      const ub = e.target.closest('[data-unblock]');
      if (ub) {
        try {
          await BG.api.rpc('bg_profile_comment_block', { p_user: ub.dataset.unblock, p_block: false });
          load(true);
        } catch (err) {
          BG.toastError(err);
        }
      }
    });
    load(true);
  }

  function renderProfile(root, d, opts) {
    root.innerHTML = `
      ${heroHTML(d)}
      ${prestigeHTML(d)}
      <div class="pp-grid">
        <div class="pp-main">${d.relation === 'self' ? `<section class="pp-sec pp-badges" data-own id="rozetler"><h2>${icon('award', 18)}Rozetler</h2><p class="muted small">Yükleniyor…</p></section>` : badgesShowcase(d)}${gamesHTML(d)}${commentsHTML(d)}</div>
        <aside class="pp-side">${sideHTML(d)}</aside>
      </div>
      <footer class="pp-total"><span>BÖZER GAMING TOPLAM AKTİF SÜRE</span><b>${esc(BG.hours(d.total_active_secs))}</b></footer>`;
    mountComments(root, d);
    mountBadges(root, d, opts);
    // kendi profilinde: hediyeleri kimin gönderdiği (yalnızca sahibi görür)
    const og = root.querySelector('[data-own-gifts]');
    if (og)
      BG.api
        .rpc('bg_gifts_received', {})
        .then((r) => {
          const list = (r && r.recent) || [];
          og.innerHTML = list.length
            ? `<p class="muted small">Son gelenler (yalnızca sen görürsün)</p><ul>${list
                .map((g) => `<li>${BG.giftImg(g.code, 26)}<span><b>${esc(g.from_name)}</b> · ${esc(g.name)}</span><time>${esc(BG.fmt.ago(g.created_at))}</time></li>`)
                .join('')}</ul>`
            : '';
        })
        .catch(() => (og.innerHTML = ''));
    root.addEventListener('click', async (e) => {
      const rb = e.target.closest('.pp-actions [data-rel]');
      if (rb) {
        if (await relAct(d, rb.dataset.rel, rb)) opts.reload();
        return;
      }
      if (e.target.closest('[data-share]')) {
        BG.copy(player.link(d.user.id), 'Profil bağlantısı kopyalandı.');
        return;
      }
      if (e.target.closest('[data-fc]')) {
        BG.bp.openPanel('fc');
        return;
      }
      const fr = e.target.closest('[data-frame]');
      const pb = e.target.closest('[data-pbg]');
      if (fr || pb) {
        try {
          await BG.api.rpc('bg_store_equip', fr ? { p_kind: 'frame', p_product: fr.dataset.frame || null } : { p_kind: 'bg', p_product: pb.dataset.pbg || null });
          BG.bp.refresh();
          opts.reload();
        } catch (err) {
          BG.toastError(err);
        }
      }
    });
  }

  BG.views.player = function (params, query) {
    const id = params && params.id ? params.id : BG.store.me && BG.store.me.id;
    let focusBadges = !!(query && query.rozet);
    const root = BG.frag(`<div class="page player"><div class="pp-wrap"><p class="loading-row">Profil yükleniyor…</p></div></div>`);
    const wrap = root.querySelector('.pp-wrap');
    if (!id || !UUID.test(id)) {
      wrap.innerHTML = '<p class="loading-row">Profil bulunamadı.</p>';
      return { node: root };
    }
    async function load(o) {
      if (o && o.focusBadges) focusBadges = true;
      try {
        const d = await BG.api.rpc('bg_profile', { p_user: id });
        const inner = document.createElement('div');
        inner.className = 'pp-in';
        renderProfile(inner, d, { reload: load, focusBadges });
        focusBadges = false;
        wrap.replaceChildren(inner);
        document.title = (d.user.full_name || d.user.username) + ' · Bözer Gaming';
      } catch (e) {
        wrap.innerHTML = `<p class="loading-row">${esc(e.message)}</p>`;
      }
    }
    load();
    return { node: root };
  };

  /** Oyun açıkken profil: tam ekran pencere */
  player.sheet = async function (id) {
    let d;
    try {
      d = await BG.api.rpc('bg_profile', { p_user: id });
    } catch (e) {
      return BG.toastError(e);
    }
    const box = BG.frag('<div class="page player in-sheet"><div class="pp-wrap"></div></div>');
    const wrap = box.querySelector('.pp-wrap');
    const m = BG.modal({ title: d.user.full_name || d.user.username, body: box, size: 'l', actions: [{ label: 'Kapat', kind: 'ghost' }] });
    const paint = (x) => {
      const inner = document.createElement('div');
      inner.className = 'pp-in';
      renderProfile(inner, x, { reload });
      wrap.replaceChildren(inner);
    };
    const reload = async () => {
      try {
        paint(await BG.api.rpc('bg_profile', { p_user: id }));
      } catch (e) {
        BG.toastError(e);
      }
    };
    paint(d);
    return m;
  };

  /* ---------------- her yerden profil: data-player ---------------- */
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-player]');
    if (!p || p.closest('[data-no-player]')) return;
    e.preventDefault();
    const id = p.dataset.player;
    if (p.closest('.pp-wrap') || p.closest('.lb')) player.open(id);
    else player.preview(id);
  });
})();
