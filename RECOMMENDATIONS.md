# Proje İyileştirme Önerileri

Projeyi incelediğimde, genel yapı itibariyle modern bir React/Vite ve Express kurulumu olduğunu görüyorum. Ancak, projenin ölçeklenebilirliği, bakımı ve performansı için aşağıdaki alanlarda iyileştirmeler yapılmasını öneririm.

## 1. Mimari ve Kod Organizasyonu (Architecture)

### Backend (`server.js`) Refactoring
Mevcut `server.js` dosyası (~400 satır) "Monolitik" bir yapıdadır. Tüm API rotaları, `DebridService` mantığı ve proxy ayarları tek bir dosyada toplanmıştır.
*   **Öneri:** Backend mantığını modüler hale getirin.
    *   `server/services/debridService.js` (Debrid mantığı buraya)
    *   `server/routes/stream.js` (Stream endpoint'leri buraya)
    *   `server/middlewares/` (Rate limit, security middlewar'leri buraya)

### TypeScript'e Geçiş
Proje şu anda JavaScript kullanıyor. Özellikle `useTVNavigation` gibi karmaşık mantıklar ve API veri yapıları (Film/Dizi objeleri) için tip güvenliği eksik.
*   **Öneri:** Projeyi kademeli olarak **TypeScript**'e taşıyın. Bu, `any` tipi hataların önüne geçecek ve IDE desteğini artıracaktır.

## 2. Güvenlik (Security)

### Hassas Verilerin Saklanması
İncelemem sırasında bazı dosyalarda API anahtarlarının kod içine (hardcoded) yazıldığını tespit ettim:
*   `src/services/tmdb.js`: `TMDB_API_KEY`
*   `src/lib/supabase.js`: `supabaseAnonKey`
*   `src/components/Shared.jsx`: Base URL'ler

**Öneri:** Bu değerleri `.env` dosyasına taşıyın ve kod içinde `import.meta.env.VITE_TMDB_KEY` şeklinde kullanın. Bu, kodun GitHub gibi yerlerde paylaşılması durumunda güvenlik riski oluşturmasını engeller.

## 3. Performans ve Veri Yönetimi

### React Query (TanStack Query) Kullanımı
Şu anda veri çekme işlemleri `useEffect` ve `useState` ile manuel olarak yönetiliyor. Önbellekleme (caching) için `Shared.jsx` içinde `loadedImageUrls` gibi manuel çözümler kullanılmış.
*   **Öneri:** Veri yönetimi için **TanStack Query** kütüphanesini projeye dahil edin.
    *   Otomatik önbellekleme, yeniden deneme (retry) ve arka planda güncelleme özelliklerini bedavaya getirir.
    *   `src/pages/CategoryPage.jsx` içindeki karmaşık state mantığını (loading, pagination) %50 oranında basitleştirir.

### Liste Sanallaştırma (Virtualization)
TV uygulamalarında bellek yönetimi kritiktir. `SmartImage` bileşeni güzel bir optimizasyon yapıyor, ancak uzun listeler (Homepage rows) DOM boyutunu şişirebilir.
*   **Öneri:** `react-window` veya `virtuoso` kullanarak sadece ekranda görünen kartların render edilmesini sağlayın.

## 4. Kullanıcı Deneyimi ve Genişletilebilirlik

### Çoklu Dil Desteği (i18n)
Uygulama metinleri (örn: "Popüler Filmler", "Gündemdekiler") kod içine gömülü.
*   **Öneri:** `react-i18next` kullanarak metinleri bir dil dosyasından yönetin. Bu, gelecekte İngilizce veya diğer dilleri eklemeyi çok kolaylaştırır.

### Hata Yönetimi (Error Boundaries)
Uygulamanın genelini kapsayan bir hata yakalayıcı (Error Boundary) göremedim.
*   **Öneri:** React Error Boundary ekleyerek, bir bileşen çöktüğünde tüm uygulamanın beyaz ekrana düşmesini engelleyin ve kullanıcıya şık bir "Hata oluştu" ekranı gösterin.

---

Bu önerilerden öncelikli olarak **Güvenlik (API Key)** ve **Backend Refactoring** maddelerine odaklanmanızı tavsiye ederim.
