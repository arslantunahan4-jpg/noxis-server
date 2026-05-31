# Video Proxy Worker Kurulum Rehberi

Bu belge, **Noxis Player** için oluşturulan Cloudflare Worker proxy servisinin nasıl kurulacağını anlatır.

Bu proxy, farklı video kaynaklarından (Vidmody, Diziyou vb.) gelen videoları oynatırken karşılaşılan **CORS** ve **Referer/Origin** kısıtlamalarını aşmak için kullanılır.

## 1. Cloudflare Hesabına Giriş

1.  [Cloudflare Dashboard](https://dash.cloudflare.com/) adresine gidin ve giriş yapın.
2.  Sol menüden **Workers & Pages** bölümüne tıklayın.

## 2. Worker Oluşturma

1.  **Create Application** butonuna tıklayın.
2.  **Create Worker** butonuna tıklayın.
3.  Worker'a bir isim verin (Örneğin: `noxis-video-proxy`).
4.  **Deploy** butonuna tıklayarak varsayılan "Hello World" worker'ını oluşturun.

## 3. Kodu Yükleme

1.  Oluşturduğunuz Worker'ın detay sayfasına gidin.
2.  **Edit Code** butonuna tıklayın.
3.  Sol taraftaki `worker.js` dosyasının içeriğini tamamen silin.
4.  Projenizdeki `workers/stream-worker.js` dosyasının içeriğini kopyalayıp buraya yapıştırın.
5.  Sağ üstteki **Save and Deploy** butonuna tıklayın.

## 4. URL'yi Alma

Worker deploy edildikten sonra size bir URL verecektir. Bu URL şuna benzer:
`https://noxis-video-proxy.sizin-kullanici-adiniz.workers.dev`

Bu URL'yi kopyalayın.

## 5. Projeye Entegre Etme

Eğer bu URL'yi projede kullanmak istiyorsanız:

1.  Projenizin kök dizinindeki `.env` dosyasına (yoksa oluşturun) ekleyin:
    ```bash
    VITE_WORKER_URL=https://noxis-video-proxy.sizin-kullanici-adiniz.workers.dev
    ```

2.  `src/components/player/GlassPlayer.jsx` dosyasında, proxy URL'si oluşturulan satırı güncelleyin:

    ```javascript
    // src/components/player/GlassPlayer.jsx (Satır ~610 civarı)
    
    // Eski Kod:
    const proxyUrl = `${SERVER_URL}/api/video-proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent('https://google.com')}`;

    // Yeni Kod (Worker URL'sini kullanmak için):
    const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://noxis-video-proxy.sizin-kullanici-adiniz.workers.dev';
    const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
    ```

## 6. Test Etme

Kurulumu test etmek için tarayıcınızda şu adrese gidin:
`https://noxis-video-proxy.sizin-kullanici-adiniz.workers.dev?url=https://storage.diziyou.one/episodes/91303_tr/720p.m3u8`

Eğer bir dosya indirmeye başlarsa veya m3u8 içeriğini görürseniz, proxy başarıyla çalışıyor demektir.
