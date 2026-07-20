# ATEŞBÖCEKLERİ — Canvas'ta Falling Game ve Juice

"Oyununuz Çalışıyor. Peki Neden Eğlenceli Değil? Canvas'ta Falling Game ve Juice"
makalesinin çalışan kodu. Gece yarısı bir bahçede yukarıdan süzülen ateşböceklerini
kavanozla yakalarsınız; araya karışan eşek arıları ışığınızı çalar. İki katman:

- **Dört direk** (`src/logic.ts` + `src/main.ts`): accumulator'lı rastgele spawner,
  `y += hız * dt` + sinüs salınımı, klavye **ve** dokunmatik girdi, iki clamp'lik
  daire-dikdörtgen çarpışması
- **Beş tutam juice**: sönümlü ekran sarsıntısı, `lighter` parçacık patlaması,
  tabandan squash & stretch, 60 sn'de doyuma ulaşan zorluk eğrisi, skoru dünyaya
  yazan dolan kavanoz
- Sıfır asset, ses yok, network isteği yok. Üretim build'i: **JS 2.83 KB gzip**
  (`npm run build` ile doğrula)

## Kurulum ve çalıştırma

```bash
npm install
npm run dev     # http://localhost:5173 (veya Vite'ın verdiği port)
```

**Nasıl oynanır:** Ok tuşları **ya da** parmak/fare sürüklemesi kavanozu oynatır
(son dokunan girdi kazanır). Ateşböceği **+1** — sarı patlama, kavanoz esner;
eşek arısı **−1** — ekran sarsılır, kavanozun ışığı azalır. Süre geçtikçe spawn
sıklaşır ve düşüş hızlanır (60. saniyede doyum). Kavanozun içi yakaladıkça parlar;
**6** ateşböceğinde kazanırsınız: süreniz ekrana yazılır, dokunuş ya da Enter
`resetGame()` ile yeni tur başlatır — sayfa yenilenmez.

## Test

```bash
npm test        # 18 birim testi
```

Testler saf mantığı doğrular: enjekte edilen `rand` ile deterministik `tickSpawn`
(artık taşıma dahil — makaledeki test birebir), `sway` sınırları ve tepe noktası,
`hitCircleRect` (içeride / kenar teması / 3-4-5 köşe teması / uzak),
`difficulty` (0'da taban, 60+'da doyum, monotonluk), sarsıntı üçlüsü
(tavan 24, doğrusal sönüm, sıfırda tam sıfır ofset).

## Dosya yapısı

```
src/
  logic.ts    # saf mantık: tickSpawn, sway, hitCircleRect, shake üçlüsü, difficulty
  main.ts     # durum, girdi (klavye+pointer), juice, çizim, tam ekran canvas
tests/
  logic.test.ts
```

## Alınan dersler (makalede de anlatılır)

- Sabit aralıklı spawner metronomdur; accumulator + rastgele aralık yağmurdur.
  `acc -= next` ile artığı taşıyın, uzun karede ritim kaymasın.
- Rastgele faz (`t: Math.random() * 10`) olmadan sürü asker gibi senkron salınır.
- `pointermove`/`pointerup` **window'dan** dinlenir; canvas'tan dinlerseniz parmak
  bir piksel dışarı kayınca kavanoz donar.
- Parmak modunda kavanoz hedefe ışınlanmaz, sınırlı hızla koşar — ağırlık hissi
  o kısacık gecikmede saklıdır.
- Sarsıntıya tavan ve sönüm koyun: sönümsüz sarsıntı titremedir, sönümlü sarsıntı
  darbedir.
- Squash & stretch merkezi kavanozun **tabanına** alın; merkezden ölçeklerseniz
  kavanoz havada asılı ezilir.
- "Tekrar oyna" bir `location.reload()` değil, bir `resetGame()` fonksiyonudur.
- Rastgelelik fonksiyona gömülmez, kapıdan (`rand` parametresi) verilir —
  rastgele görünen sistemler deterministik test edilir.

## Lisans

MIT
