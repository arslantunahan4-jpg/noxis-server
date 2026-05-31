# 🛡️ Noxis Server Güvenlik Denetim Raporu

## 🚨 Kritik Bulgular (Acil Müdahale Gerektirir)

### 1. Hassas Veri İfşası (.env)
- **Durum:** `.env` dosyasında **gerçek production** verileri (MongoDB URI, TMDB API Key, Telegram Token, LiveKit Keys) tespit edildi.
- **Risk:** Bu dosya git geçmişine dahil edilirse veya sunucuya erişen biri tarafından okunursa tüm sistem ele geçirilebilir.
- **Öneri:** `.env` dosyasını hemen temizleyin ve sadece yerel development değerleri veya boş şablonlar bırakın. Production ortamında environment variable'ları sunucu panelinden (Railway, Heroku, vb.) ayarlayın.

### 2. CORS Politikası (server.js)
- **Durum:** `app.use(cors({ origin: '*' }));` satırı ile tüm domainlerden gelen isteklere izin veriliyor.
- **Risk:** Kötü niyetli siteler kullanıcıların oturumlarını kullanarak API istekleri yapabilir (CSRF benzeri durumlar).
- **Öneri:** Production ortamında sadece kendi frontend domaininize izin verin:
  ```javascript
  const allowedOrigins = ['https://noxis.tech', 'https://www.noxis.tech'];
  app.use(cors({
      origin: function (origin, callback) {
          if (!origin || allowedOrigins.indexOf(origin) !== -1) {
              callback(null, true);
          } else {
              callback(new Error('Not allowed by CORS'));
          }
      }
  }));
  ```

## ⚠️ Önemli Bulgular (High/Medium Risk)

### 1. Content Security Policy (CSP) Devre Dışı
- **Konum:** `server.js` -> `app.use(helmet({ contentSecurityPolicy: false }));`
- **Risk:** XSS saldırılarına karşı tarayıcı korumasını zayıflatır.
- **Öneri:** Mümkünse CSP'yi yapılandırın ve sadece güvenilen kaynaklara (CDN'ler, scriptler) izin verin.

### 2. SSRF Potansiyeli (Scraper Servisleri)
- **Konum:** `/api/scrape-iframe` endpoint'inde `site`, `slug` gibi parametreler doğrudan URL yapımında kullanılıyor.
- **Risk:** Her ne kadar `createSlug` kullanılsa da, bazı durumlarda (örn. `yabancidizibox`) parametreler filtrelenmeden kullanılıyor olabilir.
- **Öneri:** Tüm dış parametreleri `createSlug` gibi sıkı bir validasyon fonksiyonundan geçirin.

## ✅ Pozitif Güvenlik Önlemleri (Korunan Alanlar)

1. **Güçlü Şifreleme:** Kullanıcı şifreleri **PBKDF2** (600,000 iterasyon, SHA512) ile modern standartlarda saklanıyor.
2. **Rate Limiting:** Global (1000/15dk), Auth (20/15dk) ve Admin (50/15dk) limitleri aktif ve doğru yapılandırılmış.
3. **Admin Yetkilendirmesi:** `adminMiddleware.js` ve `requireAdmin` fonksiyonları role-based access control (RBAC) uyguluyor.
4. **SSRF Koruması (Proxy):** `isValidProxyUrl` fonksiyonu whitelist ve private IP engelleme (Blacklist) ile çift katmanlı koruma sağlıyor.
5. **MongoDB Güvenliği:** Query Injection'a karşı Mongoose kullanımı standart koruma sağlıyor.

## 📋 Özet ve Eylem Planı

1. **[ACİL]** `.env` dosyasındaki gerçek şifreleri silin ve environment variable olarak sunucuya ekleyin.
2. **[ACİL]** `server.js` içindeki CORS ayarını production için kısıtlayın.
3. **[ÖNERİ]** `package.json` içindeki `express` ve diğer kritik paketlerin güncellemelerini düzenli takip edin.

Güvenlik durumu genel olarak **iyi**, ancak yukarıdaki kritik yapılandırma hataları (Secret ifşası ve CORS) giderilmelidir.
