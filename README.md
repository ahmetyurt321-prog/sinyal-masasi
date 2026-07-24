# Sinyal Masası — Kurulum Rehberi

Bu proje Claude/LLM kullanmaz. Tamamen kural tabanlı: RSI, SMA20/50 ve MACD
göstergelerinden 0-100 arası bir skor hesaplar, AL / TUT / SAT sinyali üretir.
Gerçek emir vermez, sadece analiz gösterir.

## Mimari
- **Twelve Data**: geçmiş fiyat verisi (ücretsiz API key)
- **Upstash Redis**: hesaplanan sonuçları önbelleğe alır (ücretsiz)
- **Vercel**: siteyi barındırır (ücretsiz)
- **cron-job.org**: her 15-30 dakikada bir yenileme tetikler (ücretsiz, dışarıdan)

## 1) Twelve Data API key al
1. https://twelvedata.com/ adresine git, ücretsiz kayıt ol.
2. Dashboard'da API key'ini kopyala.
3. Ücretsiz plan limitini kontrol et (genelde dakikada ~8 istek, günlük ~800 istek
   civarı — zamanla değişebilir, kendi hesabındaki "Usage" sayfasından gör).

## 2) Upstash Redis oluştur
1. https://upstash.com/ adresine git, ücretsiz kayıt ol.
2. "Create Database" -> Redis seç, bölge seç (Vercel'in bölgesine yakın olsun).
3. Database sayfasında "REST API" bölümünden `UPSTASH_REDIS_REST_URL` ve
   `UPSTASH_REDIS_REST_TOKEN` değerlerini kopyala.

## 3) Kodu GitHub'a koy
1. Bu klasörü kendi bilgisayarına indir (aşağıdaki dosya linkinden).
2. GitHub'da yeni bir repo oluştur, bu klasörü push et:
   ```
   git init
   git add .
   git commit -m "ilk yükleme"
   git branch -M main
   git remote add origin <repo-url>
   git push -u origin main
   ```

## 4) Vercel'e deploy et
1. https://vercel.com/ adresine git, GitHub hesabınla giriş yap.
2. "Add New Project" -> az önce oluşturduğun repoyu seç.
3. "Environment Variables" bölümüne `.env.example` dosyasındaki 4 değişkeni
   kendi gerçek değerlerinle ekle:
   - `TWELVE_DATA_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `REFRESH_SECRET` (kendi uydurduğun, uzun ve rastgele bir metin — kimse tahmin edemesin)
4. "Deploy" butonuna bas. Birkaç dakika içinde `https://senin-projen.vercel.app`
   adresinde yayında olacak.

## 5) İlk veri dolumunu yap
Tarayıcıdan şu adresi bir kere ziyaret et (kendi domain ve secret'ını yaz):
```
https://senin-projen.vercel.app/api/refresh?secret=REFRESH_SECRET_DEGERIN
```
`{"ok":true,"updated":60,...}` gibi bir cevap görmelisin. Bu, Redis'e ilk veriyi
doldurur. Sonra ana sayfaya (`https://senin-projen.vercel.app/`) girdiğinde
tablo dolu gelecektir.

## 6) Otomatik yenileme kur (cron-job.org)
1. https://cron-job.org/ adresine git, ücretsiz kayıt ol.
2. "Create cronjob" -> URL kısmına yukarıdaki `/api/refresh?secret=...` adresini yaz.
3. Sıklığı 15 veya 30 dakikada bir olacak şekilde ayarla.
4. Kaydet. Artık site otomatik olarak periyodik güncellenecek.

## Notlar / sınırlar
- Twelve Data ücretsiz planın istek limitini aşarsan bazı semboller o turda
  güncellenmez, bir sonraki turda tekrar denenir (`errors` listesinde görürsün).
- Site tamamen bilgilendirme amaçlıdır, gerçek emir göndermez. Kullanıcılarına
  bunu açıkça belirtmeye devam et (footer'da zaten var).
- İzleme listesini genişletmek istersen `api/_lib.js` içindeki `WATCHLIST`
  dizisine yeni `[SEMBOL, "Şirket Adı", "Sektör"]` satırları ekle.
