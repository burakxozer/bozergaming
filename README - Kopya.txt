# Bozer Gaming — kurulum dosyası

Bu klasörde mevcut oyun kuralları ve oyun ekranları değiştirilmeden korunmuştur. `index.html` ana sayfadır; her oyun ayrı HTML dosyasına çıkarılmıştır. Bulut üyelik katmanı `bozer-cloud.js` içindedir.

## Supabase kurulumu

1. [supabase.com](https://supabase.com) üzerinde ücretsiz hesap açın ve **New project** seçin.
2. **Project Settings → API** bölümünden Project URL ile `anon public` anahtarını `bozer-config.js` dosyasına yazın.
3. **SQL Editor** bölümünde `supabase/schema.sql` içeriğinin tamamını çalıştırın.
4. **Authentication → Providers** altında Email'i etkinleştirin. `Confirm email` açık kalsın.
5. Alan adınızı aldıktan sonra **Authentication → URL Configuration** ekranına sitenizin tam adresini ekleyin.
6. Google girişi için Google Cloud Console'da OAuth Web Client oluşturun, Supabase'in verdiği callback adresini Authorized redirect URI olarak ekleyin; ardından Supabase'de Google sağlayıcısına Client ID ve Secret'ı girin.
7. İlk olarak normal üye ekranından `bozer` kullanıcı adıyla kayıt olun ve e-postayı doğrulayın. Ardından SQL Editor'da şu komutu çalıştırın: `update public.profiles set role='admin' where username='bozer';`
8. Supabase CLI yüklüyse iki fonksiyonu yayınlayın: `supabase functions deploy admin-delete-user` ve `supabase functions deploy login-with-username`. Bu fonksiyonların ortamında `SUPABASE_SERVICE_ROLE_KEY` yalnızca Supabase tarafında kalır; asla site dosyalarına eklenmez.

## Yayına alma

Bu klasörün **içeriğini** hostinginizde `public_html` ya da sitenizin kök dizinine yükleyin. PHP/Node gerekmez. HTTPS açık olmalıdır; Google girişinin çalışması için zorunludur.

## Bilinen sonraki entegrasyon adımı

Üyelik, profil, avatar, mesajlar, arkadaşlık/veri şeması, yönetici görünümü ve canlı bildirim istemcisi hazırdır. Mevcut oyunların oyun kuralları aynen korunmuştur. Oyun içi bulut kaydı ve canlı izleme, her oyun için durum dönüştürücüsü eklenerek ilerletilmelidir; Americano ile başlanması önerilir çünkü durumu tek `state` nesnesi etrafında toplanmıştır.
