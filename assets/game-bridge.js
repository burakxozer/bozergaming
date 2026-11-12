/* =====================================================================
   Bözer Gaming — oyun köprüsü
   Her oyun sayfasının en sonunda yüklenir. Oyunun kurallarına ve
   mantığına dokunmaz; yalnızca oyunun kendi değişkenlerini okuyup
   geri yükler (kaldığın yerden devam) ve ekranın anlık kopyasını
   (canlı izleme) ana sayfaya iletir.
   ===================================================================== */
(function () {
  'use strict';
  var FILES = {
    'americano.html': 'americano',
    'somali.html': 'somali',
    'kura-cek.html': 'kura',
    'lig.html': 'lig',
    'dart-mac.html': 'dart-mac',
    'dart-turnuva.html': 'dart-turnuva',
    'dartbot-v1.html': 'dartbot',
    'dart-lig.html': 'dart-lig'
  };
  var file = decodeURIComponent((location.pathname.split('/').pop() || '').toLowerCase());
  var KEY = FILES[file] || '';
  var root = document.documentElement;
  root.setAttribute('data-bg-game', KEY || 'unknown');

  function applyTheme() {
    var t = 'gece';
    try {
      t = JSON.parse(localStorage.getItem('bg.theme')) || 'gece';
    } catch (e) {}
    root.setAttribute('data-bg-theme', t);
  }
  applyTheme();
  window.addEventListener('storage', function (e) {
    if (e.key === 'bg.theme') applyTheme();
  });

  var embedded = false;
  try {
    embedded = window.parent !== window && !!window.parent.BG;
  } catch (e) {}
  if (embedded) root.setAttribute('data-bg-embedded', '1');

  /* ---------------- yardımcılar ---------------- */
  function $(id) {
    return document.getElementById(id);
  }
  function copy(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  function isHidden(id) {
    var el = $(id);
    return !el || el.classList.contains('hidden');
  }
  /** Kapsayıcının HTML'ini, içindeki form değerleriyle birlikte al */
  function htmlWithValues(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    syncForm(el, c);
    return c.innerHTML;
  }
  function syncForm(src, dst) {
    var a = src.querySelectorAll('input, textarea, select');
    var b = dst.querySelectorAll('input, textarea, select');
    for (var i = 0; i < a.length; i++) {
      var s = a[i];
      var d = b[i];
      if (!d) continue;
      if (s.tagName === 'INPUT') {
        var t = (s.type || '').toLowerCase();
        if (t === 'checkbox' || t === 'radio') {
          if (s.checked) d.setAttribute('checked', '');
          else d.removeAttribute('checked');
        } else if (t !== 'file' && t !== 'password') d.setAttribute('value', s.value);
      } else if (s.tagName === 'TEXTAREA') d.textContent = s.value;
      else if (s.tagName === 'SELECT') {
        for (var j = 0; j < s.options.length; j++) {
          if (s.options[j].selected) d.options[j].setAttribute('selected', '');
          else d.options[j].removeAttribute('selected');
        }
      }
    }
  }
  function names(list) {
    var out = list.filter(function (x) {
      return x && String(x).trim();
    });
    if (out.length > 5) return out.slice(0, 5).join(', ') + ' +' + (out.length - 5);
    return out.join(', ');
  }

  /* =================================================================
     OYUN UYARLAYICILARI
     (her biri yalnızca kendi oyununun değişkenlerine erişir)
     ================================================================= */
  var A = {};

  /* ---------------- AMERICANO ---------------- */
  A.americano = {
    getState: function () {
      var s = { v: 1, step: state.step, count: state.count, players: (state.players || []).slice(), active: state.active, joker: state.joker };
      if (state.step === 'names') {
        s.names = [];
        for (var i = 0; i < state.count; i++) {
          var el = $('p' + i);
          s.names.push(el ? el.value : '');
        }
      }
      if (state.step === 'board') {
        var t = $('board');
        if (t && t.rows.length) {
          var rows = t.rows;
          s.pen = [];
          for (var c = 1; c < rows[0].cells.length; c++) s.pen.push(rows[0].cells[c].textContent);
          s.cells = [];
          for (var r = 0; r < RULES.length; r++) {
            var row = rows[r + 2];
            var vals = [];
            if (row) {
              for (var k = 1; k < row.cells.length; k++) {
                var inp = row.cells[k].querySelector('input');
                vals.push(inp ? inp.value : null);
              }
            }
            s.cells.push(vals);
          }
        }
        var ji = $('jokerInfo');
        s.jokerInfo = ji ? ji.textContent : '';
        // ARA TOPLAM ekranda nasıl görünüyorsa öyle saklanır
        var araRow = t && t.rows[RULES.indexOf('ARA TOPLAM') + 2];
        if (araRow && !araRow.querySelector('input')) {
          s.ara = [];
          for (var a = 1; a < araRow.cells.length; a++) s.ara.push(araRow.cells[a].textContent);
        }
      }
      return s;
    },
    restore: function (s) {
      if (!s || !s.step) return false;
      if (s.step === 'count') {
        state = { step: 'count', count: 0, players: [], active: 0, joker: '' };
        render();
        return true;
      }
      if (s.step === 'names') {
        state = { step: 'names', count: s.count, players: [], active: 0, joker: '' };
        render();
        (s.names || []).forEach(function (v, i) {
          var el = $('p' + i);
          if (el) el.value = v;
        });
        return true;
      }
      state = { step: 'board', count: s.count, players: (s.players || []).slice(), active: 0, joker: s.joker || '' };
      render();
      var rows = $('board').rows;
      (s.pen || []).forEach(function (v, i) {
        var cell = rows[0].cells[i + 1];
        if (cell) cell.textContent = v;
      });
      (s.cells || []).forEach(function (vals, r) {
        var row = rows[r + 2];
        if (!row) return;
        vals.forEach(function (v, c) {
          var cell = row.cells[c + 1];
          var inp = cell && cell.querySelector('input');
          if (inp && v != null) inp.value = v;
        });
      });
      state.active = s.active || 0;
      if (state.active > 0) calcAra();
      update();
      if (s.ara) {
        var araRow = rows[RULES.indexOf('ARA TOPLAM') + 2];
        if (araRow && !araRow.querySelector('input')) {
          s.ara.forEach(function (v, i) {
            if (araRow.cells[i + 1]) araRow.cells[i + 1].textContent = v;
          });
        }
      }
      if (s.jokerInfo) $('jokerInfo').textContent = s.jokerInfo;
      if (state.active > RULES.indexOf('JOKER')) {
        $('chanceWrap').innerHTML = '<button class="glow-btn" onclick="showChances()">Kazanma Şansları</button>';
      }
      if (state.active > RULES.indexOf('ÇİFT') && !state.joker) $('jokerPopup').classList.remove('hidden');
      return true;
    },
    isInitial: function () {
      if (state.step === 'count') return true;
      if (state.step === 'names') {
        for (var i = 0; i < state.count; i++) {
          var el = $('p' + i);
          if (el && el.value.trim()) return false;
        }
        return true;
      }
      return false;
    },
    isFinished: function () {
      return state.step === 'board' && state.active > RULES.indexOf('KONKEN');
    },
    meta: function () {
      if (state.step !== 'board') {
        return { title: state.count ? state.count + ' oyuncu' : '', summary: 'Oyuncu isimleri giriliyor' };
      }
      var title = names(state.players);
      if (this.isFinished()) {
        try {
          var rows = $('board').rows;
          var best = null;
          for (var c = 1; c <= state.players.length; c++) {
            var total = parseInt(rows[RULES.indexOf('ARA TOPLAM') + 2].cells[c].textContent) || 0;
            total += val(rows[RULES.indexOf('KONKEN') + 2].cells[c].querySelector('input').value);
            if (!best || total < best.score) best = { name: state.players[c - 1], score: total };
          }
          return { title: title, summary: best ? 'Kazanan: ' + best.name + ' (' + best.score + ')' : 'Oyun bitti' };
        } catch (e) {
          return { title: title, summary: 'Oyun bitti' };
        }
      }
      return { title: title, summary: 'Sıradaki el: ' + RULES[state.active] + (state.joker ? ', joker eli: ' + state.joker : '') };
    }
  };

  /* ---------------- SOMALİ ---------------- */
  var SO_STARTED = ['game', 'action', 'pick', 'end', 'status'];
  A.somali = {
    getState: function () {
      var act = document.querySelector('.screen.active');
      return {
        v: 1,
        mode: mode,
        players: copy(players),
        bet: bet,
        startScore: startScore,
        round: round,
        action: action,
        history: copy(history),
        screen: act ? act.id : 'mode',
        names: [].map.call(document.querySelectorAll('#nameInputs input'), function (i) {
          return i.value;
        }),
        shuffle: $('shuffle').checked,
        startScoreInput: $('startScore').value,
        betInput: $('bet').value,
        winner: $('winner').innerText,
        endList: $('endList').innerHTML
      };
    },
    restore: function (s) {
      if (!s) return false;
      mode = s.mode || '';
      players = s.players || [];
      bet = +s.bet || 0;
      startScore = +s.startScore || 0;
      round = s.round || 1;
      action = s.action || '';
      history = s.history || [];
      var ni = $('nameInputs');
      ni.innerHTML = '';
      if (mode) {
        var n = mode === 'single' ? 4 : 2;
        for (var i = 0; i < n; i++) ni.innerHTML += '<input>';
        [].forEach.call(ni.querySelectorAll('input'), function (inp, i) {
          inp.value = (s.names || [])[i] || '';
        });
      }
      $('shuffle').checked = !!s.shuffle;
      $('startScore').value = s.startScoreInput || '';
      $('bet').value = s.betInput || '';
      var scr = s.screen || 'mode';
      if (SO_STARTED.indexOf(scr) >= 0) {
        updateMoney();
        $('roundText').innerText = round + '. Tur';
        render();
      }
      if (scr === 'pick' && action) pickAction(action);
      else if (scr === 'status') openStatus();
      else if (scr === 'end') {
        $('winner').innerText = s.winner || '';
        $('endList').innerHTML = s.endList || '';
        show('end');
      } else show(scr);
      return true;
    },
    isInitial: function () {
      var act = document.querySelector('.screen.active');
      var scr = act ? act.id : 'mode';
      if (scr === 'mode') return true;
      if (scr === 'names') {
        var any = [].some.call(document.querySelectorAll('#nameInputs input'), function (i) {
          return i.value.trim();
        });
        return !any && !players.length;
      }
      return false;
    },
    isFinished: function () {
      return false;
    },
    meta: function () {
      var title = names(
        (players || []).map(function (p) {
          return p.name;
        })
      );
      var act = document.querySelector('.screen.active');
      var scr = act ? act.id : 'mode';
      if (SO_STARTED.indexOf(scr) < 0) return { title: title, summary: (mode === 'team' ? 'Eşli' : 'Tekli') + ' oyun hazırlanıyor' };
      return { title: title, summary: round + '. tur, ' + (mode === 'team' ? 'eşli' : 'tekli') + (bet ? ', sayısı ' + bet + '₺' : '') };
    }
  };

  /* ---------------- KURA ÇEK ---------------- */
  A.kura = {
    getState: function () {
      return {
        v: 1,
        mode: mode,
        drawNames: copy(drawNames),
        drawWinnerCount: drawWinnerCount,
        groupNames: copy(groupNames),
        groupCount: groupCount,
        basePlayers: copy(basePlayers),
        teamCount: teamCount,
        teams: copy(teams),
        rounds: copy(rounds),
        currentRound: currentRound,
        winnersBuffer: copy(winnersBuffer),
        html: htmlWithValues($('screen')),
        overlayOpen: $('overlay').style.display === 'flex',
        overlayHtml: $('overlayBtns').innerHTML
      };
    },
    restore: function (s) {
      if (!s) return false;
      mode = s.mode || 'home';
      drawNames = s.drawNames || [];
      drawWinnerCount = s.drawWinnerCount || 1;
      groupNames = s.groupNames || [];
      groupCount = s.groupCount || 2;
      basePlayers = s.basePlayers || [];
      teamCount = s.teamCount || 0;
      teams = s.teams || [];
      rounds = s.rounds || [];
      currentRound = s.currentRound || 0;
      winnersBuffer = s.winnersBuffer || [];
      if (s.html) $('screen').innerHTML = s.html;
      else home();
      $('overlayBtns').innerHTML = s.overlayHtml || '';
      $('overlay').style.display = s.overlayOpen ? 'flex' : 'none';
      return true;
    },
    isInitial: function () {
      return mode === 'home';
    },
    isFinished: function () {
      return !!document.querySelector('#screen .winner');
    },
    meta: function () {
      var w = document.querySelector('#screen .winner');
      var wText = w ? w.textContent.replace(/[🎉🏆]/g, '').trim() : '';
      if (mode === 'draw') {
        return { title: 'Çekiliş' + (drawNames.length ? ', ' + drawNames.length + ' katılımcı' : ''), summary: w ? 'Kazanan: ' + wText : 'İsimler giriliyor' };
      }
      if (mode === 'group') {
        return { title: 'Grup kurası' + (groupNames.length ? ', ' + groupNames.length + ' kişi' : ''), summary: groupNames.length ? groupCount + ' grup' : 'İsimler giriliyor' };
      }
      return {
        title: 'Turnuva' + (teams.length ? ': ' + names(teams.map(function (t) { return t && t.name ? t.name : t; })) : ''),
        summary: w ? 'Şampiyon: ' + wText : rounds.length ? currentRound + 1 + '. tur' : 'Takımlar hazırlanıyor'
      };
    }
  };

  /* ---------------- LİG ---------------- */
  A.lig = {
    getState: function () {
      return {
        v: 1,
        playerCount: playerCount,
        teamCount: teamCount,
        players: copy(players),
        teams: copy(teams),
        rounds: copy(rounds),
        currentRound: currentRound,
        stats: copy(stats),
        playedMatches: playedMatches,
        results: copy(results),
        doubleRound: doubleRound,
        fromChampion: fromChampion,
        html: htmlWithValues($('screen')),
        overlayOpen: $('overlay').style.display === 'flex',
        overlayHtml: $('overlayBtns').innerHTML
      };
    },
    restore: function (s) {
      if (!s) return false;
      playerCount = s.playerCount || 0;
      teamCount = s.teamCount || 0;
      players = s.players || [];
      teams = s.teams || [];
      rounds = s.rounds || [];
      currentRound = s.currentRound || 0;
      stats = s.stats || {};
      playedMatches = s.playedMatches || 0;
      results = s.results || {};
      doubleRound = !!s.doubleRound;
      fromChampion = !!s.fromChampion;
      if (s.html) $('screen').innerHTML = s.html;
      else renderPlayerCount();
      $('overlayBtns').innerHTML = s.overlayHtml || '';
      $('overlay').style.display = s.overlayOpen ? 'flex' : 'none';
      return true;
    },
    isInitial: function () {
      return !playerCount && !teams.length && !rounds.length;
    },
    isFinished: function () {
      return rounds.length > 0 && currentRound >= rounds.length;
    },
    meta: function () {
      var title = names(teams);
      if (this.isFinished()) {
        var top = Object.entries(stats).sort(function (a, b) {
          return b[1].p - a[1].p;
        })[0];
        return { title: title, summary: top ? 'Şampiyon: ' + top[0] : 'Lig bitti' };
      }
      if (rounds.length) return { title: title, summary: currentRound + 1 + '. tur / ' + rounds.length + (doubleRound ? ', çift karşılaşma' : '') };
      return { title: title || playerCount + ' oyuncu', summary: 'Takımlar hazırlanıyor' };
    }
  };

  /* ---------------- DART MAÇ ---------------- */
  var DM_IDS = ['modeSelect', 'step1', 'step2', 'game'];
  A['dart-mac'] = {
    getState: function () {
      var disp = {};
      DM_IDS.forEach(function (id) {
        disp[id] = $(id).style.display;
      });
      return {
        v: 1,
        actions: copy(actions),
        gameMode: gameMode,
        numbers: copy(numbers),
        teamCount: teamCount,
        teams: copy(teams),
        scores: copy(scores),
        history: copy(history),
        points: copy(points),
        firstTo: firstTo,
        disp: disp,
        names: [].map.call(document.querySelectorAll('#inputs input'), function (i) {
          return i.value;
        }),
        firstToInput: $('firstToInput').value,
        popupOpen: $('popup').style.display === 'flex',
        popupHtml: $('popupContent').innerHTML
      };
    },
    restore: function (s) {
      if (!s) return false;
      actions = s.actions || [];
      gameMode = s.gameMode || 'karambol';
      numbers = s.numbers || [];
      teamCount = s.teamCount || 0;
      teams = s.teams || [];
      scores = s.scores || [];
      history = s.history || [];
      points = s.points || [];
      firstTo = s.firstTo || 1;
      DM_IDS.forEach(function (id) {
        var v = s.disp && s.disp[id];
        $(id).style.display = v == null ? (id === 'modeSelect' ? '' : 'none') : v;
      });
      var inp = $('inputs');
      inp.innerHTML = '';
      for (var i = 0; i < teamCount; i++) inp.innerHTML += '<input placeholder="Takım ' + (i + 1) + '">';
      [].forEach.call(inp.querySelectorAll('input'), function (el, i) {
        el.value = (s.names || [])[i] || '';
      });
      $('firstToInput').value = s.firstToInput || '';
      var gameOn = $('game').style.display !== 'none' && teams.length && scores.length;
      if (gameOn) render();
      $('popup').style.display = 'none';
      if (s.popupOpen && s.popupHtml && gameOn) {
        if (/rematch\(\)/.test(s.popupHtml)) {
          $('popupContent').innerHTML = s.popupHtml;
          $('popup').style.display = 'flex';
        } else if (/SETİ KAZANDI/.test(s.popupHtml)) {
          resetBoard(true); // set penceresi 2 sn sonra tahtayı sıfırlıyordu
        }
      }
      return true;
    },
    isInitial: function () {
      return $('game').style.display === 'none' || !teams.length;
    },
    isFinished: function () {
      return teams.length > 0 && points.some(function (p) {
        return p >= firstTo;
      });
    },
    meta: function () {
      return {
        title: teams.join(' – '),
        summary: (gameMode === 'kriket' ? 'Kriket' : 'Karambol Kriket') + ', first to ' + firstTo + ', set skoru ' + points.join('-')
      };
    }
  };

  /* ---------------- DART TURNUVA ---------------- */
  var DT_IDS = ['setup', 's1', 's2', 's3', 's4', 'info', 'bracketWrap', 'game', 'overlay', 'winner'];
  var DT_MARK = ['', '/', 'X', "<div class='mark circle'>X</div>"];
  A['dart-turnuva'] = {
    getState: function () {
      var vis = {};
      DT_IDS.forEach(function (id) {
        vis[id] = !isHidden(id);
      });
      var radio = document.querySelector('input[name="mode"]:checked');
      return {
        v: 1,
        teamCount: teamCount,
        teams: copy(teams),
        queue: copy(queue),
        baseTeams: copy(baseTeams),
        currentMatch: copy(currentMatch),
        mode: mode,
        matchWins: copy(matchWins),
        scores: copy(scores),
        vis: vis,
        playerCountInput: $('playerCount').value,
        players: [].map.call($('playerInputs').children, function (lab) {
          return { name: lab.children[0] ? lab.children[0].value : '', seed: !!(lab.children[1] && lab.children[1].checked) };
        }),
        teamListHtml: $('teamList').innerHTML,
        matchLabel: $('matchLabel').textContent,
        roundLabel: $('roundLabel').textContent,
        winnerName: $('winnerName').textContent,
        modeRadio: radio ? radio.value : '1'
      };
    },
    restore: function (s) {
      if (!s || !s.vis) return false;
      teamCount = s.teamCount;
      teams = s.teams || [];
      queue = s.queue || [];
      baseTeams = s.baseTeams || [];
      currentMatch = s.currentMatch || [];
      mode = s.mode || 1;
      matchWins = s.matchWins || [0, 0];
      DT_IDS.forEach(function (id) {
        if (id in s.vis) $(id).classList.toggle('hidden', !s.vis[id]);
      });
      $('playerCount').value = s.playerCountInput || '';
      var pi = $('playerInputs');
      pi.innerHTML = '';
      (s.players || []).forEach(function (p, i) {
        pi.innerHTML += '<label><input type="text" placeholder="Oyuncu ' + (i + 1) + '"><input type="checkbox"> Seribaşı</label>';
      });
      [].forEach.call(pi.children, function (lab, i) {
        lab.children[0].value = s.players[i].name;
        lab.children[1].checked = !!s.players[i].seed;
      });
      $('teamList').innerHTML = s.teamListHtml || '';
      var r = document.querySelector('input[name="mode"][value="' + (s.modeRadio || '1') + '"]');
      if (r) r.checked = true;
      $('matchLabel').textContent = s.matchLabel || '';
      $('roundLabel').textContent = s.roundLabel || '';
      $('winnerName').textContent = s.winnerName || '';
      if (s.vis.overlay) {
        // maç kazanıldı, sonraki maça geçiş sayacı sürüyordu
        $('overlay').classList.add('hidden');
        startNextMatch();
      } else if (s.vis.game && currentMatch.length === 2) {
        render(); // tahtayı kurar (puanları sıfırlar)
        scores = s.scores || scores;
        var rows = $('board').children;
        for (var ri = 0; ri < nums.length; ri++) {
          var row = rows[ri + 1];
          if (!row) continue;
          row.children[0].innerHTML = DT_MARK[scores[0][ri]] || '';
          row.children[2].innerHTML = DT_MARK[scores[1][ri]] || '';
        }
      }
      if (s.vis.bracketWrap) renderBracket();
      return true;
    },
    isInitial: function () {
      return !isHidden('setup') && !isHidden('s1');
    },
    isFinished: function () {
      return !isHidden('winner');
    },
    meta: function () {
      var title = names(
        (baseTeams || []).map(function (t) {
          return t.name;
        })
      );
      if (!isHidden('winner')) return { title: title, summary: 'Şampiyon: ' + $('winnerName').textContent };
      if (!isHidden('info')) return { title: title, summary: $('matchLabel').textContent + ', ' + $('roundLabel').textContent };
      return { title: title, summary: 'Turnuva hazırlanıyor' };
    }
  };

  /* ---------------- DARTBOT ---------------- */
  A.dartbot = {
    getState: function () {
      var act = document.querySelector('.screen.active');
      return {
        v: 1,
        scores: copy(scores),
        turn: turn,
        snapshot: copy(snapshot),
        botLevel: botLevel,
        matchScore: copy(matchScore),
        bestOf: bestOf,
        screen: act ? act.id : 'start',
        levelSelect: $('botLevel').value,
        levelInfo: $('levelInfo').textContent
      };
    },
    restore: function (s) {
      if (!s) return false;
      botLevel = s.botLevel || 5;
      $('botLevel').value = s.levelSelect || String(botLevel);
      $('levelInfo').textContent = s.levelInfo || '';
      if (s.matchScore) matchScore = s.matchScore;
      if (s.screen === 'game' && s.scores) {
        scores = s.scores;
        snapshot = s.snapshot || copy(scores);
        turn = s.turn || 'player';
        var p = scores[0].every(function (v) { return v >= 3; });
        var b = scores[1].every(function (v) { return v >= 3; });
        if (p || b) {
          show('start');
          return true;
        }
        show('game');
        render();
        updateTurn();
        if (turn === 'bot') botTurn(); // botun yarım kalan eli baştan atılır
      } else show('start');
      return true;
    },
    isInitial: function () {
      var act = document.querySelector('.screen.active');
      return !act || act.id !== 'game';
    },
    isFinished: function () {
      return false;
    },
    meta: function () {
      var closed = function (arr) {
        return (arr || []).filter(function (v) { return v >= 3; }).length;
      };
      return {
        title: 'Sen – Dartbot (seviye ' + (botLevel === 11 ? 'insanüstü' : botLevel) + ')',
        summary: scores ? 'Kapatılan: sen ' + closed(scores[0]) + '/13, bot ' + closed(scores[1]) + '/13' : ''
      };
    }
  };

  /* ---------------- DART LİG ---------------- */
  // Ekranlar oyunun kendi çizim işlevleriyle değişir; hangisinin açık olduğunu izle
  var DL_VIEW = 'renderPlayerCount';
  var DL_HTML_VIEWS = ['count', 'teamCount', 'players', 'renderScoring'];
  if (KEY === 'dart-lig') {
    ['renderPlayerCount', 'renderScoring', 'renderTeamsPreview', 'renderLeague', 'renderTable', 'renderDartMatch', 'renderChampion'].forEach(function (n) {
      var f = window[n];
      if (typeof f !== 'function') return;
      window[n] = function () {
        DL_VIEW = n;
        return f.apply(this, arguments);
      };
    });
  }
  function dlView() {
    if ($('count')) return 'count';
    if ($('teamCount')) return 'teamCount';
    if (document.querySelector('#screen .player-name')) return 'players';
    return DL_VIEW;
  }
  A['dart-lig'] = {
    getState: function () {
      var view = dlView();
      var md = $('modal');
      return {
        v: 1,
        view: view,
        playerCount: playerCount,
        teamCount: teamCount,
        players: copy(players),
        teams: copy(teams),
        rounds: copy(rounds),
        stats: copy(stats),
        results: copy(results),
        currentRound: currentRound,
        doubleRound: doubleRound,
        winPoints: winPoints,
        byePoints: byePoints,
        leagueFirstTo: leagueFirstTo,
        scoringMode: scoringMode,
        setRules: copy(setRules),
        byeAwarded: Array.from(byeAwarded),
        activeMatch: copy(activeMatch),
        dart: copy(dart),
        html: DL_HTML_VIEWS.indexOf(view) >= 0 ? htmlWithValues($('screen')) : '',
        modal: md && !md.classList.contains('hidden') ? $('modalBox').innerHTML : ''
      };
    },
    restore: function (s) {
      if (!s || !s.view) return false;
      playerCount = s.playerCount || 0;
      teamCount = s.teamCount || 0;
      players = s.players || [];
      teams = s.teams || [];
      rounds = s.rounds || [];
      stats = s.stats || {};
      results = s.results || {};
      currentRound = s.currentRound || 0;
      doubleRound = !!s.doubleRound;
      if (s.winPoints != null) winPoints = s.winPoints;
      if (s.byePoints != null) byePoints = s.byePoints;
      if (s.leagueFirstTo != null) leagueFirstTo = s.leagueFirstTo;
      scoringMode = s.scoringMode === 'sets' ? 'sets' : 'win';
      if (s.setRules && s.setRules.length) setRules = s.setRules;
      byeAwarded = new Set(s.byeAwarded || []);
      activeMatch = s.activeMatch || null;
      if (s.dart) dart = s.dart;
      if (DL_HTML_VIEWS.indexOf(s.view) >= 0 && s.html) {
        $('screen').innerHTML = s.html;
        if (s.view === 'renderScoring') DL_VIEW = 'renderScoring';
      } else if (typeof window[s.view] === 'function') window[s.view]();
      else renderLeague();
      var md = $('modal');
      md.classList.add('hidden');
      // maç sonucu penceresi açıksa geri gelsin (sonuç fikstüre işlenmeden kalmasın)
      if (s.modal && /recordDartWinner\(/.test(s.modal) && activeMatch) {
        $('modalBox').innerHTML = s.modal;
        md.classList.remove('hidden');
      }
      return true;
    },
    isInitial: function () {
      var c = $('count');
      return dlView() === 'count' && !!c && !c.value;
    },
    isFinished: function () {
      return DL_VIEW === 'renderChampion';
    },
    meta: function () {
      var total = 0;
      (rounds || []).forEach(function (r) {
        r.forEach(function (m) {
          if (m.indexOf('BAY') < 0) total++;
        });
      });
      var played = Object.keys(results || {}).length;
      return {
        title: teams && teams.length ? names(teams) : 'Lig kurulumu',
        summary: total ? played + '/' + total + ' maç oynandı' + (activeMatch && activeMatch.teams ? ', oynanan maç: ' + activeMatch.teams.join(' – ') : '') : ''
      };
    }
  };

  /* =================================================================
     ANLIK KOPYA (canlı izleme için)
     ================================================================= */
  function attrs(el) {
    var o = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (/^on/i.test(a.name)) continue;
      o[a.name] = a.value;
    }
    return o;
  }
  function takeSnapshot() {
    var body = document.body;
    var clone = body.cloneNode(true);
    syncForm(body, clone);
    var kill = clone.querySelectorAll('script, noscript, template, iframe, object, embed, [data-bg-ignore]');
    for (var k = 0; k < kill.length; k++) kill[k].parentNode.removeChild(kill[k]);
    return JSON.stringify({
      v: 1,
      game: KEY,
      html: attrs(document.documentElement),
      body: attrs(body),
      content: clone.innerHTML,
      w: window.innerWidth
    });
  }

  /* =================================================================
     DEĞİŞİKLİK BİLDİRİMİ
     ================================================================= */
  var pending = null;
  function notify() {
    if (!embedded || pending) return;
    pending = setTimeout(function () {
      pending = null;
      try {
        window.parent.postMessage({ bg: 'change', game: KEY }, '*');
      } catch (e) {}
    }, 70);
  }
  if (embedded) {
    try {
      new MutationObserver(notify).observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'value', 'checked', 'hidden']
      });
    } catch (e) {}
    document.addEventListener('input', notify, true);
    document.addEventListener('change', notify, true);
    document.addEventListener(
      'click',
      function () {
        setTimeout(notify, 40);
      },
      true
    );
  }

  var adapter = A[KEY];
  function safe(fn, fallback) {
    return function () {
      try {
        return fn.apply(adapter, arguments);
      } catch (e) {
        if (window.console) console.warn('[bozer-bridge]', KEY, e);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  window.__bgBridge = {
    key: KEY,
    version: 1,
    supported: !!adapter,
    getState: adapter ? safe(adapter.getState, null) : function () { return null; },
    restore: adapter ? safe(adapter.restore, false) : function () { return false; },
    isInitial: adapter ? safe(adapter.isInitial, true) : function () { return true; },
    isFinished: adapter ? safe(adapter.isFinished, false) : function () { return false; },
    meta: adapter ? safe(adapter.meta, function () { return { title: '', summary: '' }; }) : function () { return { title: '', summary: '' }; },
    snapshot: safe(takeSnapshot, null),
    setTheme: function (t) {
      root.setAttribute('data-bg-theme', t);
    }
  };
})();
