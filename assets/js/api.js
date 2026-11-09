/* =====================================================================
   Bözer Gaming — Supabase bağlantı katmanı
   Tüm sunucu işlemleri buradan geçer (RPC fonksiyonları: supabase/kurulum.sql)
   ===================================================================== */
(function () {
  'use strict';
  const BG = window.BG;
  const cfg = BG.config;

  const FRIENDLY = [
    [/invalid login credentials|invalid_credentials/i, 'Kullanıcı adı veya şifre hatalı.'],
    [/already registered|user_already_exists|already been registered/i, 'Bu kullanıcı adı zaten alınmış.'],
    [/email not confirmed|email_not_confirmed/i, 'Hesap doğrulanmamış görünüyor. (Yönetici: Supabase → Authentication → Sign In / Providers → Email → "Confirm email" kapalı olmalı.)'],
    [/email_address_not_authorized|not authorized/i, 'Kayıt tamamlanamadı: Supabase e-posta doğrulaması açık. (Yönetici: "Confirm email" seçeneğini kapatın.)'],
    [/email_address_invalid|email address .* is invalid|invalid format/i, 'Kayıt tamamlanamadı: üyelik e-posta alanı reddedildi. (Yönetici: kurulum rehberindeki "Confirm email" adımını kontrol edin.)'],
    [/signups? not allowed|signup_disabled/i, 'Yeni üyelik alımı şu anda kapalı.'],
    [/database error saving new user|unexpected_failure/i, 'Kayıt sırasında sorun oluştu. Bu kullanıcı adı alınmış olabilir; başka bir ad dene.'],
    [/password should be at least|password.*(short|length)/i, 'Şifre en az 6 karakter olmalı.'],
    [/weak_password|known to be weak|pwned/i, 'Bu şifre çok zayıf ya da sızdırılmış şifre listelerinde var. Daha güçlü bir şifre seç.'],
    [/failed to fetch|networkerror|load failed|network request failed/i, 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'],
    [/jwt expired|invalid jwt|jwt.*(malformed|invalid)|refresh token/i, 'Oturumun sona erdi. Lütfen yeniden giriş yap.'],
    [/rate limit|too many requests|over_request_rate_limit|over_email_send_rate_limit/i, 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.'],
    [/could not find the function|schema cache|pgrst202|function .* does not exist/i, 'Sunucu kurulumu tamamlanmamış. (Yönetici: supabase/kurulum.sql dosyası SQL Editor’de çalıştırılmalı.)'],
    [/permission denied|42501/i, 'Bu işlem için yetkin yok.'],
    [/legacy api keys are disabled|invalid api key|no api key/i, 'Sunucu anahtarı geçersiz. (Yönetici: config.js içindeki supabaseKey değerini kontrol edin.)'],
  ];

  function friendly(err) {
    if (!err) return new Error('Bilinmeyen hata');
    if (err.__friendly) return err;
    const raw = [err.message, err.msg, err.error_description, err.code, err.error, err.hint].filter(Boolean).join(' | ');
    let msg = err.message || err.msg || err.error_description || String(err);
    for (const [re, text] of FRIENDLY) {
      if (re.test(raw)) {
        msg = text;
        break;
      }
    }
    const e = new Error(msg);
    e.__friendly = true;
    e.code = err.code;
    e.raw = raw;
    return e;
  }

  function withTimeout(promise, ms) {
    let t;
    return Promise.race([
      promise,
      new Promise((_, rej) => {
        t = setTimeout(() => rej(new Error('Sunucu yanıt vermedi. Bağlantını kontrol edip tekrar dene.')), ms || 20000);
      }),
    ]).finally(() => clearTimeout(t));
  }

  const api = (BG.api = {
    ready: false,
    sb: null,
    friendly,

    init() {
      if (!window.supabase || !window.supabase.createClient || !cfg.supabaseUrl || !cfg.supabaseKey) {
        api.ready = false;
        return false;
      }
      try {
        api.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'bg-auth' },
          realtime: { params: { eventsPerSecond: 20 } },
        });
        api.ready = true;
      } catch (e) {
        console.error('[api] init', e);
        api.ready = false;
      }
      return api.ready;
    },

    emailFor(username) {
      return BG.normalizeUsername(username) + '@' + (cfg.authEmailDomain || 'burakxozer.github.io');
    },

    requireReady() {
      if (!api.ready) throw friendly({ message: 'Failed to fetch' });
    },

    /** Sunucu fonksiyonu çağır; hata olursa anlaşılır Error fırlatır */
    async rpc(name, args) {
      api.requireReady();
      let res;
      try {
        res = await withTimeout(api.sb.rpc(name, args || {}));
      } catch (e) {
        throw friendly(e);
      }
      if (res.error) throw friendly(res.error);
      return res.data;
    },

    /** Sekme kapanırken bile gönderilen istek (yanıt beklenmez) */
    rpcKeepalive(name, args) {
      const token = BG.store.session && BG.store.session.access_token;
      if (!api.ready || !token) return false;
      try {
        fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + name, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseKey, Authorization: 'Bearer ' + token },
          body: JSON.stringify(args || {}),
        }).catch(() => {});
        return true;
      } catch (e) {
        return false;
      }
    },

    /* ---------- Oturum ---------- */
    async signUp({ username, password, fullName }) {
      api.requireReady();
      const u = BG.normalizeUsername(username);
      let res;
      try {
        res = await withTimeout(
          api.sb.auth.signUp({ email: api.emailFor(u), password, options: { data: { username: u, full_name: fullName } } })
        );
      } catch (e) {
        throw friendly(e);
      }
      if (res.error) throw friendly(res.error);
      if (!res.data || !res.data.session) {
        // E-posta doğrulaması açıksa oturum gelmez → girişi deneyelim
        const s = await api.signIn(u, password).catch((e) => {
          throw e;
        });
        return s;
      }
      return res.data.session;
    },

    async signIn(username, password) {
      api.requireReady();
      let res;
      try {
        res = await withTimeout(api.sb.auth.signInWithPassword({ email: api.emailFor(username), password }));
      } catch (e) {
        throw friendly(e);
      }
      if (res.error) throw friendly(res.error);
      return res.data.session;
    },

    async signOut() {
      if (!api.ready) return;
      try {
        await withTimeout(api.sb.auth.signOut(), 8000);
      } catch (e) {
        try {
          await api.sb.auth.signOut({ scope: 'local' });
        } catch (e2) {}
      }
    },

    async getSession() {
      if (!api.ready) return null;
      try {
        const { data } = await api.sb.auth.getSession();
        return (data && data.session) || null;
      } catch (e) {
        return null;
      }
    },

    onAuth(cb) {
      if (!api.ready) return () => {};
      const { data } = api.sb.auth.onAuthStateChange((event, session) => cb(event, session));
      return () => data && data.subscription && data.subscription.unsubscribe();
    },

    /* ---------- Profil fotoğrafı (Storage) ---------- */
    async uploadAvatar(uid, blob) {
      api.requireReady();
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const path = uid + '/' + Date.now() + '.' + ext;
      const bucket = api.sb.storage.from('avatars');
      let res;
      try {
        res = await withTimeout(bucket.upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }), 45000);
      } catch (e) {
        throw friendly(e);
      }
      if (res.error) throw friendly(res.error);
      const { data } = bucket.getPublicUrl(path);
      return { path, url: data.publicUrl };
    },

    /** Kullanıcının klasöründeki eski fotoğrafları sil (keepPath hariç) */
    async cleanupAvatars(uid, keepPath) {
      if (!api.ready) return;
      try {
        const bucket = api.sb.storage.from('avatars');
        const { data, error } = await bucket.list(uid, { limit: 100 });
        if (error || !data) return;
        const paths = data.map((f) => uid + '/' + f.name).filter((p) => p !== keepPath && !p.endsWith('/.emptyFolderPlaceholder'));
        if (paths.length) await bucket.remove(paths);
      } catch (e) {
        console.warn('[api] cleanupAvatars', e);
      }
    },

    /* ---------- Gerçek zamanlı ---------- */
    channel(name, opts) {
      api.requireReady();
      return api.sb.channel(name, opts);
    },
    removeChannel(ch) {
      if (!ch || !api.ready) return;
      try {
        api.sb.removeChannel(ch);
      } catch (e) {}
    },
  });
})();
