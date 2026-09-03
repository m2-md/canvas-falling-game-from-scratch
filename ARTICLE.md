# Oyununuz Çalışıyor. Peki Neden Eğlenceli Değil? Canvas'ta Falling Game ve Juice

*Bir falling game'in mekaniğini dört direkle sıfırdan kuruyoruz — sonra tutorial'ların hep atladığı soruya geçiyoruz: oyun neden ölü hissettiriyor? Ortaya ATEŞBÖCEKLERİ çıkıyor.*

*Tahmini okuma süresi: 18 dakika*

---

Bir oyun projesinin en tehlikeli anı, kodun çalışmaya başladığı andır.

Çünkü o anda durmak serbesttir. Döngü dönüyor, nesneler düşüyor, çarpışma sayılıyor, skor artıyor — her tutorial'ın tarifine göre oyun "bitti". Geçenlerde bu tuzağın ders kitabı örneğine denk geldim: Dr Abstract'ın ZIM framework'üyle yazdığı Falling Game Tutorial'ı (Passion Pods). Yukarıdan nesneler süzülüyor, siz alttaki karakteri sağa sola sürüp onları yakalıyorsunuz. Tutorial temiz, adım adım ilerliyor ve sonunda çalışan bir oyun veriyor.

Ama satır satır okuyunca üç şey gözüme battı:

- Oyunun her organı bir ZIM çağrısı: `interval` üretiyor, `animate` düşürüyor, `wiggle` salındırıyor, `hitTestCircleRect` çarpışmayı, `MotionController` klavyeyi, `Indicator` skoru yönetiyor. Serinin ilk yazısındaki dertle aynı dert: kara kutu (black box) üstüne kara kutu. Bu fonksiyonların *içinde* ne olduğunu tutorial'dan öğrenemiyorsunuz.
- Girdi sadece klavye. Telefonda açan biri oyunu yalnızca seyredebilir.
- Kazandığınızda oyun `location.reload()` çağırıyor — "tekrar oyna" demek, koca sayfayı baştan yüklemek demek.

Bunların üçü de düzeltilebilir kusurlar. Beni asıl düşündüren dördüncüsü: hepsini düzeltseniz bile elinizde *çalışan* ama *hissettirmeyen* bir oyun kalıyor. Ekran sarsılmıyor, hiçbir şey patlamıyor, zorluk hep aynı, kazanma anı bir sayfa yenilemesi. Tutorial'ın ölçütü "çalışıyor mu?" — ve oyun o ölçütü geçiyor. Sorun şu ki oyuncunun ölçütü bu değil.

Bu yazı o yüzden iki perde. Perde 1'de o kara kutuları dört direkle değiştiriyoruz: rastgele aralıklı bir spawner, delta-time'lı düşüş ve sinüs salınımı, klavye ile dokunmatiği birlikte dinleyen girdi, ve daire-dikdörtgen çarpışma testi. Perde 2'de ise tutorial'ların anlatmadığı kısma geçiyoruz: juice (oyun hissi) — mekanik bittiği halde oyunun neden ölü hissettirdiği ve bunun beş küçük dokunuşla nasıl düzeldiği. Sonda da bir perde arkası var: yazı yayına hazırlanırken repodaki oyun çekirdeğin çok ötesine geçti, o katmanı da dürüstçe göstereceğim.

Bu, canvas serisinin üçüncü yazısı. Fizik yazısında oyun döngüsünü, `dt`'yi ve çarpışmanın matematiğini kurmuştuk; SABİT YILDIZLAR'da tam ekran canvas desenini ve `lighter` numarasını. İkisine de yeri geldikçe selam vereceğim ama bu yazı tek başına okunur.

Oyunumuzun adı: ATEŞBÖCEKLERİ. Gece yarısı bir bahçe — koyu lacivert, neredeyse siyah. Yukarıdan sıcak sarı ışıklı ateşböcekleri süzülüyor; aralarına sarı-siyah çizgili eşek arıları karışmış. Elinizde bir kavanoz: ok tuşlarıyla (ya da WASD ile) ve parmağınızla, sadece sağa sola değil yukarı aşağı da. Ateşböceği yakalarsanız kavanoz bir tık daha parlar. Arı girerse önce ışığınızı alır — ışığınız yoksa canınızı. Üç canınız var ve bölümün hedefi dolunca bahçe aydınlanır, süreniz ekrana yazılır, bir sonraki bölüm açılır.

### Perde 1: Dört Direk

#### Direk 1 — Spawner: Metronom Değil, Yağmur

Orijinal oyun nesneleri `interval` ile üretiyor: her X saniyede bir, tık, tık, tık. Sabit aralıklı üretim bir metronomdur ve metronomu üç saniyede çözersiniz — bir sonraki nesnenin ne zaman geleceğini *bildiğiniz* an gerilim ölür. Yağmur öyle yağmaz; damlalar ortalama bir sıklıkta ama düzensiz düşer.

Bunu kurmak için fizik yazısından tanıdığınız bir kavramı ödünç alıyoruz: biriktirici (accumulator). Her karede geçen süreyi biriktir, hedefe ulaşınca üret ve *rastgele* bir sonraki hedef seç:

```ts
// src/logic.ts
export interface SpawnTimer {
  next: number; // bir sonraki üretime kalan hedef süre (sn)
  acc: number; // o hedefe doğru biriken süre
}

export function createSpawnTimer(first = 0.6): SpawnTimer {
  return { next: first, acc: 0 };
}

// dt biriktir; süre dolduysa true döner ve rastgele yeni aralık kurar
export function tickSpawn(
  t: SpawnTimer,
  dt: number,
  spawnEvery: number,
  rand: () => number = Math.random,
): boolean {
  t.acc += dt;
  if (t.acc < t.next) return false;
  t.acc -= t.next; // artığı koru: uzun bir karede zamanlama kaymasın
  t.next = spawnEvery * (0.6 + rand() * 0.8); // ortalama spawnEvery, ±%40 sapma
  return true;
}
```

İki küçük ama bilinçli karar var burada. Birincisi, `t.acc -= t.next`: biriktiriciyi sıfırlamak yerine artığı taşıyoruz. Sekme değişiminden dönen o meşhur uzun karede süre çöpe gitmez, spawn ritmi kaymaz. İkincisi, `rand` fonksiyonunu parametre olarak alıyoruz — varsayılanı `Math.random` ama testte sahte bir üreteç verirsiniz ve fonksiyon deterministik olur. SABİT YILDIZLAR'daki tohum disiplininin küçük kardeşi bu; karşılığını testler bölümünde alacağız.

#### Direk 2 — Düşüş ve Salınım: `animate` + `wiggle` Yerine Beş Satır Matematik

ZIM tutorial'ında düşüş bir `animate` çağrısı, sağa sola salınım bir `wiggle` çağrısı. İkisi de çalışıyor — ve ikisinin de içi görünmüyor. Halbuki perdenin arkasındaki matematiğin tamamı birkaç satır.

Önce her canlıyı tanımlayalım:

```ts
// src/main.ts — kısaltılmış (örümcek ağı ve mıknatıs alanları çıkarıldı)
interface Critter {
  id: number;
  kind: CritterKind; // "firefly" | "wasp" | "spider" | "ladybug" | "moth"
  subType?: FireflySubtype; // ateşböceğinin rengi/yeteneği
  baseX: number; // salınımın merkez çizgisi
  y: number;
  offsetX: number; // salınımın üstüne binen sapmalar (kenar itmesi, çekim, titreme)
  offsetY: number;
  t: number; // yaş (sn) — sinüsün girdisi
  amp: number; // salınım genişliği (px)
  freq: number; // saniyedeki salınım turu
  r: number; // çarpışma yarıçapı
  dead?: boolean;
}
```

Dikkat: `x` diye bir alan yok. Canlının yatay konumu saklanmıyor, her an *hesaplanıyor*:

```ts
// src/logic.ts
// Sinüs salınımı: merkez çizgi etrafında yumuşak gidiş-geliş
export function sway(
  t: number,
  base: number,
  amp: number,
  freq: number,
): number {
  return base + Math.sin(t * freq * Math.PI * 2) * amp;
}
```

Güncelleme ise iki satır:

```ts
// src/main.ts — kısaltılmış (ateşböceği dalı; diğer türlerin dalları aşağıda)
for (const c of critters) {
  c.t += dt;
  c.y += fallSpeed * SCALE * dt; // saniyede fallSpeed piksel — karede değil
}
// çizim ve çarpışma anında:
// const x = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
```

Hepsi bu. `animate` dediğiniz şey `y += hız * dt`, `wiggle` dediğiniz şey bir `Math.sin`. Fizik yazısındaki kural burada da geçerli: hız her zaman "saniyede", asla "karede" — yavaş telefonda da hızlı monitörde de ateşböceği aynı sürede iner.

Bugünkü repoda bu döngünün içinde türe göre dallanan birkaç satır daha var: arı `dt * 1.1` ile daha hızlı, güve `dt * 0.5` ile tembel, örümcek `dt * 0.3` ile neredeyse asılı iniyor. Formül aynı formül, çarpan farklı.

Bir incelik: her canlının `t` değeri sıfırdan değil, rastgele bir değerden başlıyor (spawn kodunda `t: Math.random() * 10`). Bunu atlarsanız aynı anda doğan canlılar sinüs dalgasının aynı noktasından başlar ve hepsi asker gibi senkron salınır. Rastgele faz, sürüyü sürü yapar.

Eşek arılarına da karakterlerini bu iki sayı veriyor: daha düşük `freq` (`0.26 + rastgele 0.2`), daha geniş `amp` (`40 + rastgele 32` piksel). Ateşböceği kısa kısa titreşir, arı geniş ve tembel kavisler çizer. Aynı formül, iki farklı kişilik — parametrenin gücü.

#### Direk 3 — Girdi: Klavye VE Parmak

Orijinalin en affedilmez eksiği bence buydu: `MotionController` sadece ok tuşlarını dinliyor. Bir web oyununun telefonda oynanamaması, bir web sitesinin telefonda açılmaması gibidir — teknik olarak mümkün, pratikte kabul edilemez.

Çözüm iki girdiyi *birlikte* dinlemek. Klavye kavanoza doğrudan hız verir; parmak (veya fare) bir hedef bırakır, kavanoz o hedefe koşar. Bir de şu var: kavanoz artık zeminde kaymıyor, bahçenin içinde yüzüyor. Yani hedef bir sayı değil, bir nokta:

```ts
// src/main.ts — kısaltılmış (UI tıklama ve bölüm seçimi dalları çıkarıldı)
const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key), on);
window.addEventListener("keyup", (e) => keys.delete(e.key), on);

let pointerTarget: { x: number; y: number } | null = null;

function setPointerTarget(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((clientX - rect.left) / rect.width) * W;
  const canvasY = ((clientY - rect.top) / rect.height) * H;
  pointerTarget = {
    x: Math.max(0, Math.min(W - jar.w, canvasX - jar.w / 2)),
    y: Math.max(H * 0.12, Math.min(H - jar.h - 15 * SCALE, canvasY - jar.h * 0.5)),
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (state === "playing") setPointerTarget(e.clientX, e.clientY);
}, on);
window.addEventListener("pointermove", (e) => {
  if (pointerTarget !== null && state === "playing") setPointerTarget(e.clientX, e.clientY);
}, on);
window.addEventListener("pointerup", () => (pointerTarget = null), on);
window.addEventListener("pointercancel", () => (pointerTarget = null), on);
```

`pointermove` ve `pointerup` `window`'dan dinleniyor — fizik yazısındaki sapan dersinin aynısı: başlangıç elemandan, devamı ve bitişi `window`'dan. Parmak canvas'ın bir piksel dışına kayınca kavanoz donup kalmasın. `pointercancel` de aynı ailenin unutulan üyesi: mobil tarayıcı dokunuşu bir kaydırma jestine çevirdiğinde `pointerup` gelmez, `pointercancel` gelir.

Kavanozun güncellemesi de iki girdiyi tek harekette birleştiriyor:

```ts
// src/main.ts — kısaltılmış (örümcek ağı taraması ve çim eğilmesi çıkarıldı)
function updateJar(dt: number) {
  // ... aktif ağlar taranıp webSlow (0.3 → 1) hesaplanır
  const speedMult = (speedBoostTimer > 0 ? 1.35 : 1.0) * webSlow;
  const speed = 720 * SCALE * speedMult;
  let targetVx = 0;
  let targetVy = 0;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
    targetVx = -speed;
    pointerTarget = null;
  }
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
    targetVx = speed;
    pointerTarget = null;
  }
  // ArrowUp/W ve ArrowDown/S aynı kalıpla targetVy'yi kurar

  if (pointerTarget !== null) {
    const diffX = pointerTarget.x - jar.x;
    const diffY = pointerTarget.y - jar.y;
    jar.x += diffX * Math.min(1, dt * 28 * speedMult); // hedefe üstel yaklaşma
    jar.y += diffY * Math.min(1, dt * 28 * speedMult);
    jarVx = diffX * 14 * webSlow;
    jarVy = diffY * 14 * webSlow;
  } else {
    jarVx += (targetVx - jarVx) * Math.min(1, dt * 22 * webSlow); // hıza yumuşak geçiş
    jarVy += (targetVy - jarVy) * Math.min(1, dt * 22 * webSlow);
    jar.x += jarVx * dt;
    jar.y += jarVy * dt;
  }

  jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
  jar.y = Math.max(H * 0.12, Math.min(H - jar.h - 15 * SCALE, jar.y));
}
```

Bu fonksiyonda üç sessiz karar saklı. Tuşa basınca `pointerTarget = null` — son dokunan girdi kazanır, iki girdi birbiriyle kavga etmez. Klavye hedef hıza *anında* değil `Math.min(1, dt * 22)` ile yaklaşıyor: kavanoz kalkarken hafifçe ağırlaşıyor, dururken hafifçe kayıyor. Ve parmak modunda kavanoz hedefe ışınlanmıyor, aradaki farkın her karede bir kısmını kapatıyor. Işınlanan kavanozla oyun kolaylaşır ama his ölür — kavanozun ağırlığı, o kısacık gecikmede saklı.

`Math.min(1, dt * 28)` kalıbındaki `min` de bir güvenlik kemeri: sekmeden dönen upuzun bir karede çarpan 1'i geçemez, kavanoz hedefi aşıp geri sıçramaz.

#### Direk 4 — Kavanoz ve Çarpışma: Kara Kutunun İçi

`hitTestCircleRect` — ZIM'in tek satırı. Fizik yazısında daire-daire çarpışmasını yazmıştık: merkezler arası mesafe, yarıçap toplamı, bitti. Daire-dikdörtgen ilk bakışta daha korkutucu görünür çünkü dikdörtgenin köşeleri vardır. Numara şu: problemi *tek noktaya* indirgemek.

Dikdörtgenin içindeki, daire merkezine en yakın noktayı bul. O nokta daireye yarıçaptan yakınsa çarpışma var. En yakın noktayı bulmak ise sadece iki sıkıştırma (clamp):

```ts
// src/logic.ts
// Daire-dikdörtgen çarpışması: dikdörtgendeki en yakın noktayı bul, mesafeye bak
export function hitCircleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw)); // en yakın x
  const ny = Math.max(ry, Math.min(cy, ry + rh)); // en yakın y
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}
```

`Math.max(min, Math.min(değer, max))` deseni, değeri bir aralığa sıkıştırır. Daire merkezi dikdörtgenin solundaysa en yakın x sol kenardır; içindeyse kendisidir. İki clamp ile dikdörtgenin "daireye bakan yüzünü" buluyoruz, gerisi mesafe karşılaştırması. Karekök bile yok — mesafenin karesini yarıçapın karesiyle kıyaslamak yeterli.

Peki çarpışma olduğunda ne oluyor? İşte oyunun kural kitabı burada başlıyor ve burası, ilk yazdığım halinden en çok uzaklaşan yer.

#### Kural Kitabı: Üç Can, Üç Ceza

İlk sürümde tek bir sayaç vardı: `caught`. Arı girince bir eksiliyordu, hedefe ulaşınca oyun bitiyordu. İki tur oynayınca anladım ki bu bir ceza değil, bir yavaşlatma. Kaybetmek mümkün olmayan bir oyunda kazanmak da bir şey ifade etmiyor.

Bugün oyunun üç canı ve üç ayrı ceza kapısı var — hepsi `logic.ts` içinde, DOM'suz, saf:

```ts
// src/logic.ts
// Arı Çarptığında: 0 ateşböceği varsa 1 Can gider, >0 ateşböceği varsa -1 Ateşböceği eksilir.
export function processWaspCollision(
  caught: number,
  lives: number,
): { newCaught: number; newLives: number; lostLife: boolean } {
  if (caught > 0) {
    return { newCaught: caught - 1, newLives: lives, lostLife: false };
  }
  return { newCaught: 0, newLives: Math.max(0, lives - 1), lostLife: true };
}

// Örümcek veya Uğur Böceği Çarptığında: Direkt 1 Can gider!
export function processHazardCollision(
  lives: number,
): { newLives: number; lostLife: boolean } {
  return { newLives: Math.max(0, lives - 1), lostLife: true };
}

// 3 Ateşböceği Kaçtığında: 1 Can gider!
export function processFireflyMiss(
  missedCount: number,
  lives: number,
): { newMissed: number; newLives: number; lostLife: boolean } {
  const nextMissed = missedCount + 1;
  if (nextMissed >= 3) {
    return { newMissed: 0, newLives: Math.max(0, lives - 1), lostLife: true };
  }
  return { newMissed: nextMissed, newLives: lives, lostLife: false };
}
```

Üçünün ortak yanı, üçünün de bir şeyi *yapmaması*: hiçbiri global değişkene dokunmuyor, hiçbiri ekrana bir şey çizmiyor. Sayı alıyor, sayı döndürüyor. `main.ts` de dönen sonucu alıp kendi dünyasına yazıyor.

Arı kuralı bilerek kademeli: kavanozunuz doluysa arı bir ışık çalar, boşsa canınızı alır. Ceza hep aynı büyüklükte değil — riskiniz durumunuza bağlı. Kaçırma kuralı ise oyunun en sessiz baskısı: her kaçan ateşböceği ölümcül olsa oyun bir refleks sınavına döner, hiç sayılmasa tembellik bedava olur. Üçte bir can — arada duran sayı.

Çarpışma döngüsünün bugünkü hali:

```ts
// src/main.ts — kısaltılmış (alt-tür bonusları ve efekt çağrıları çıkarıldı)
for (const c of critters) {
  if (c.dead) continue;
  const x = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
  const y = c.y + c.offsetY;
  if (!hitCircleRect(x, y, c.r, jar.x, jar.y, jar.w, jar.h)) continue;
  c.dead = true;
  if (c.kind === "firefly") {
    // ... alt-türe göre pts (mor = 2), renk ve bonuslar
    caught = Math.min(caught + pts, levelCfg.target);
    syncJarFireflies();
    burst(x, y, pColor, 16); // Tutam 2 — yakalamanın sevinci
    jarSquash = 0.32; // Tutam 3 — kavanozun refleksi
    if (caught === levelCfg.target) {
      finalTime = elapsed;
      state = currentLevel < LEVELS.length ? "levelcomplete" : "campaignwon";
    }
  } else if (c.kind === "wasp") {
    const res = processWaspCollision(caught, lives);
    caught = res.newCaught;
    lives = res.newLives;
    addShake(shake, 18 * SCALE); // Tutam 1 — arının iğnesi
    addFloatingText(x, y - 15 * SCALE, "-1", res.lostLife ? "#ef4444" : "#f87171");
    if (lives <= 0) {
      finalTime = elapsed;
      state = "gameover";
    }
  } else {
    const res = processHazardCollision(lives); // örümcek · uğur böceği · güve
    lives = res.newLives;
    addShake(shake, 22 * SCALE);
    if (lives <= 0) {
      finalTime = elapsed;
      state = "gameover";
    }
  }
}
critters = critters.filter(
  (c) => !c.dead && (c.kind === "ladybug" || c.y + c.offsetY < H + 50 * SCALE),
);
```

Kaçırma kontrolü de ayrı bir yerde, ekranın altını geçen canlılar için:

```ts
// src/main.ts — kısaltılmış
if (c.kind !== "ladybug" && c.y + c.offsetY > H + 40 * SCALE && !c.dead) {
  c.dead = true;
  if (c.kind === "firefly") {
    const res = processFireflyMiss(missed, lives);
    missed = res.newMissed;
    lives = res.newLives;
    burst(currentX, H - 20 * SCALE, "hsl(0 100% 65%)", 16); // kırmızı toz: kaçtı
    addShake(shake, 12 * SCALE);
    if (lives <= 0) {
      finalTime = elapsed;
      state = "gameover";
    }
  }
}
```

Dört direk tamam. Spawner üretiyor, sinüs salındırıyor, iki girdi de çalışıyor, çarpışma sayıyor ve artık cezalandırıyor. Oyun, her tutorial'ın ölçütüne göre bitti.

### Çalışan Oyun, Ölü Oyun

Burada dürüst olmam gereken yer geliyor. İlk oynanabilir sürümü bitirdiğimde oyunu açtım, iki tur oynadım ve kapattım. Kendi yazdığım oyundan iki dakikada sıkılmıştım. Kod doğruydu; testler geçiyordu; ateşböcekleri süzülüyor, kavanoz yakalıyor, sayı artıyordu. Ve hiçbir şey *hissettirmiyordu*.

Bunu en iyi anlatan benzetme mutfaktan: tuzsuz yemek. Bütün malzemeler tarifteki gibi, pişirme süresi doğru, tabak düzgün — ama ilk kaşıkta anlarsınız, bir şey eksik. Eksik olan şey yeni bir malzeme değildir; var olanları *hissedilir* kılan şeydir. Oyun geliştirmede bunun adı juice (ya da game feel, oyun hissi): oynanışı değiştirmeyen ama her eylemi görülür, duyulur, hissedilir yapan geri bildirim katmanı. Martin Jonasson ve Petri Purho'nun meşhur "Juice it or lose it" konuşması bu fikri yaygınlaştırdı: aynı Breakout klonu, mekanik tek satır değişmeden, sadece geri bildirim ekleye ekleye bambaşka bir oyuna dönüşüyor.

Kritik nokta: juice mekanik değildir. Ekran sarsıntısı skoru değiştirmez, parçacıklar çarpışmayı etkilemez. Tuz da yemeği doyurucu yapmaz. Ama tuzsuz yemeği kimse istemez — ve tutorial'lar tuzu hep atlar, çünkü tarif "çalışıyor mu?" sorusunda biter.

Perde 2'de kavanozumuza beş tutam atacağız.

### Perde 2: Beş Tutam Juice

#### Tutam 1 — Ekran Sarsıntısı: Arının İğnesi

Şu anda eşek arısı kavanoza girince ne oluyor? Bir sayı azalıyor. Oyuncunun bunu fark etmesi bile zor. Olması gereken: *acımalı*. En ucuz acı da ekran sarsıntısıdır (screen shake) — bütün dünya bir an kontrolden çıkar.

Sarsıntının tamamı, DOM'a da canvas'a da dokunmayan üç küçük fonksiyon:

```ts
// src/logic.ts
export interface Shake {
  power: number;
  t: number;
}

export function addShake(s: Shake, power: number): void {
  s.power = Math.min(s.power + power, 24); // tavan: art arda arılar ekranı uçurmasın
}

export function updateShake(s: Shake, dt: number): void {
  s.t += dt;
  s.power = Math.max(0, s.power - dt * 30); // doğrusal sönüm: ~yarım saniyede durulur
}

export function shakeOffset(
  s: Shake,
  rand: () => number = Math.random,
): { x: number; y: number } {
  if (s.power <= 0) return { x: 0, y: 0 };
  return {
    x: (rand() * 2 - 1) * s.power,
    y: (rand() * 2 - 1) * s.power,
  };
}
```

Kullanımı iki yerde. Darbe anında `addShake` — ve şiddet, cezanın büyüklüğüne göre ayarlanmış: ateşböceği kaçarsa `12 * SCALE`, güve çarparsa `16 * SCALE`, arı `18 * SCALE`, örümcek ya da uğur böceği `22 * SCALE`. Çizimde ise bütün sahne ofsetle kayıyor:

```ts
// src/main.ts — kısaltılmış
const { x: sx, y: sy } = shakeOffset(shake);
ctx.save();
ctx.translate(sx, sy);
drawBackground();
// ... canlılar, parçacıklar, kavanoz — sahnenin tamamı
ctx.restore();
```

Sönümün önemi büyük: `power` her karede azalır, sarsıntı öfkeyle başlayıp yumuşayarak biter. Sönümsüz sarsıntı titreme olur; sönümlü sarsıntı *darbe* olur. Tavan değeri de aynı derecede önemli — iki arı üst üste girdiğinde oyun cezalandırmalı, mide bulandırmamalı.

#### Tutam 2 — Parçacık Patlaması: Yakalamanın Sevinci

Arının acısı tamam; peki ateşböceğini yakalamanın sevinci nerede? Şu anda bir sayı artıyor. Işık saçan bir böcek kavanoza girdiyse, ışık *saçılmalı*:

```ts
// src/main.ts
function burst(x: number, y: number, color = "hsl(52 100% 70%)", count = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2; // rastgele yön
    const speed = (80 + Math.random() * 220) * SCALE;
    const life = 0.18 + Math.random() * 0.15;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life,
      max: life,
      color,
      size: (2 + Math.random() * 3.5) * SCALE,
      spin: (Math.random() - 0.5) * 8,
    });
  }
}
```

Renk parametre olarak geliyor, çünkü artık her olayın kendi rengi var: yakalayış sarı, mor ateşböceği menekşe, kaçan ateşböceği kırmızı, ağ yakma turuncu. Bir fonksiyon, beş farklı duygu.

Güncelleme, fizik yazısının iki satırlık evreninin minyatürü — hız konumu değiştirir, ömür biter:

```ts
// src/main.ts
for (const p of particles) {
  p.life -= dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}
particles = particles.filter((p) => p.life > 0);
```

İlk sürümde buraya bir de yerçekimi satırı koymuştum (`p.vy += 220 * SCALE * dt`). Sonra çıkardım: ömür 0.33 saniyeye inince kıvılcım zaten düşmeye vakit bulamıyor, yerçekimi sadece patlamanın simetrisini bozuyordu. Kısa ömürlü parçacıkta fizik değil, dağılım okunuyor.

Çizimde SABİT YILDIZLAR'dan tanıdık numara sahnede: `globalCompositeOperation = "lighter"` ile parçacıklar üst üste bindikçe parlaklaşır, `globalAlpha = p.life / p.max` ile ömürleri bittikçe sönerler. On altı minik daire — ama toplanan ışık, patlama anına gerçek bir "yakaladım!" parlaması veriyor.

Parçacık sistemleri kulağa büyük mühendislik gibi gelir. Gördüğünüz gibi: bir dizi, bir filtre, üç satır fizik.

#### Tutam 3 — Squash & Stretch: Kavanozun Refleksi

Klasik animasyonun en eski numaralarından biri: bir şey çarptığında ezilir, toparlanırken esner (squash & stretch). Zıplayan topun yere değdiği karede yassılaşması, karakterin zıplamadan önce çömelmesi — canlılık dediğimiz şeyin iskeleti bu deformasyondur. Kavanozumuz cam ama kuralı umursamıyoruz; his, gerçekçilikten önce gelir.

Yakalama anında tek satır: `jarSquash = 0.32`. Sonra her karede sönüm ve çizimde deformasyon:

```ts
// src/main.ts
jarSquash = Math.max(0, jarSquash - dt * 2.0); // yarım saniyede toparlanır
jarWobble = Math.max(0, jarWobble - dt * 1.5);

// çizimde: taban sabit kalsın diye merkezi alta alıyoruz
ctx.save();
ctx.translate(jar.x + jar.w / 2, jar.y + jar.h);
ctx.rotate(jarTilt + Math.sin(elapsed * 18) * jarWobble); // hareket eğimi + darbe titremesi
ctx.scale(1 + jarSquash, 1 - jarSquash); // yanlara ezil, boyu kısal
drawJar(); // kavanoz artık (0,0) tabanına göre çiziliyor
ctx.restore();
```

`translate`'in kavanozun *tabanına* yapıldığına dikkat edin. Merkezden ölçeklerseniz kavanoz ezilirken havada asılı kalmış gibi görünür; tabandan ölçekleyince yere basarak ezilir. Tek satırlık fark, ama göz yakalar.

Araya sonradan giren `rotate` de aynı ailenin üyesi: `jarTilt` kavanozun yatay hızıyla orantılı, hızlanınca hafifçe yatıyor; `jarWobble` ise yakalama anında 0.15'e fırlayıp sönen bir titreşim. Üçü birlikte, tek bir dikdörtgeni canlıymış gibi gösteriyor.

En güzeli: `scale(1 + s, 1 - s)` alanı kabaca korur — genişlediği kadar kısalır. Ezilme "küçülme" gibi değil, "yumuşama" gibi okunur. Yine matematik, yine bedava.

#### Tutam 4 — Zorluk Eğrisi: Gerilimin Tuzu

Orijinal oyunda düşüş hızı da üretim sıklığı da baştan sona sabit. Otuzuncu saniyedeki oyun, üçüncü saniyedekiyle aynı oyun — gerilim çizgisi dümdüz. Halbuki iyi bir oyun sizi önce eliyle tutar, sonra yavaş yavaş bırakır.

Bunun için tek bir saf fonksiyon yetiyor — geçen süreyi ve bölüm numarasını al, o anki zorluğu döndür:

```ts
// src/logic.ts
export interface Difficulty {
  spawnEvery: number;
  fallSpeed: number;
}

export function difficulty(elapsed: number, level = 1): Difficulty {
  const cfg = getLevelConfig(level);
  const k = Math.min(elapsed / 60, 1); // 0 → 1: ilk dakikada tam zorluğa tırman
  return {
    spawnEvery: Math.max(0.4, cfg.spawnEvery - 0.4 * k), // taban aralık bölümden gelir
    fallSpeed: (120 + 140 * k) * cfg.fallSpeedMult, // 120 → 260, bölüm çarpanıyla ölçeklenir
  };
}
```

Burada iki eksen var. Birincisi zaman: `k`, tur içinde 0'dan 1'e tırmanıyor ve altmışıncı saniyede doyuma ulaşıyor. İkincisi bölüm: taban aralık ve hız çarpanı `getLevelConfig`'ten geliyor. Rakamla bakalım. Birinci bölümde tur `spawnEvery = 1.6`, `fallSpeed = 120` ile açılıyor, bir dakika sonra `1.2` ve `260`'ta duruyor. Yirmi beşinci bölümde ise açılış `0.42` ve `312`, doyum noktası `0.4` ve `676`. Aynı fonksiyon, aynı eğri — sadece başladığı yer değişiyor.

`Math.min(elapsed / 60, 1)` içindeki doyum noktası bilinçli: zorluk sonsuza kadar artarsa oyun bir noktada haksızlaşır. `Math.max(0.4, ...)` da aynı bekçiliği aralık için yapıyor — spawn sıklığının bir tabanı olmalı, yoksa ekran otuzuncu saniyede canlıdan görünmez olur. Eğrinin şekli tamamen sizin tasarım kararınız; önemli olan eğrinin *var olması*. Düz çizgi bir gerilim değildir.

Oyun döngüsünde de her karede sorulur:

```ts
// src/main.ts
const { spawnEvery, fallSpeed } = difficulty(elapsed, currentLevel);
if (tickSpawn(spawnTimer, dt, spawnEvery)) spawnCritter();
```

#### Tutam 5 — Dolan Kavanoz: Skoru Dünyaya Yazmak

Orijinal tutorial ilerlemeyi bir `Indicator` bileşenine, yani arayüzdeki bir göstergeye yazıyor. Çalışır — ama oyuncunun gözünü aksiyondan alıp köşedeki bir sayaca göndermek, sahneden çıkıp skorborda bakmak gibidir. Daha güzel bir yol var: ilerlemeyi arayüze değil, dünyanın kendisine yazmak. Kavanoz yakaladıkça *içi* parlasın:

```ts
// src/main.ts — kısaltılmış (drawJar içinden)
const glow = caught / levelCfg.target; // 0 → 1: kavanozun doluluk ışığı
if (glow > 0) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulseGlow = 0.85 + 0.15 * Math.sin(elapsed * 3.5); // yavaş nefes
  const glowR = w2 * 0.85 * pulseGlow;
  const fillGlow = ctx.createRadialGradient(0, -h2 * 0.45, 0, 0, -h2 * 0.45, glowR);
  fillGlow.addColorStop(0, `hsl(52 100% 75% / ${0.2 + glow * 0.55})`);
  fillGlow.addColorStop(0.45, `hsl(45 100% 65% / ${glow * 0.25})`);
  fillGlow.addColorStop(0.8, `hsl(40 100% 55% / ${glow * 0.08})`);
  fillGlow.addColorStop(1, "hsl(40 100% 50% / 0)");
  ctx.fillStyle = fillGlow;
  ctx.beginPath();
  ctx.arc(0, -h2 * 0.45, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

Sıcak sarı bir radial gradient; yarıçapı nefes alıyor, yoğunluğu `caught / levelCfg.target` ile artıyor. Boş kavanoz sönük bir cam; hedefe yaklaşınca küçük bir fener. Oyuncu skora bakmıyor — skoru *görüyor*, hem de gözünü kavanozdan hiç ayırmadan.

Bunun üstüne bir katman daha bindi sonradan: yakalanan her ateşböceği kavanozun içinde kendi rengiyle dolaşan minik bir noktaya dönüşüyor (`syncJarFireflies`). Arı bir ışık çaldığında o noktalardan biri sönüyor. Kimse size −1 demiyor; kavanozunuzdan bir ışık eksiliyor. Cezanın en zarif hali bu.

Juice'un beş tutamı bu kadar. Mekanik tek satır değişmedi — çarpışma aynı çarpışma, kural aynı kural; eklenenler yalnızca geri bildirim çağrıları. Ama oyun artık cevap veriyor: arı acıtıyor, yakalayış parlıyor, kavanoz esniyor, tempo tırmanıyor, ışık birikiyor. Aynı yemek, tuzuyla.

### Perde Arkası: Çekirdekten Sonra Gelenler

Yazının başında söz vermiştim. Buraya kadar anlattığım her şey oyunun çekirdeği — ama repodaki sürüm orada durmadı. Bir hafta boyunca "bir bölüm daha ekleyeyim" diye diye `main.ts` 3381 satıra çıktı. Sessizce geçmek yerine ne olduğunu göstereyim, çünkü büyümenin *şekli* de bir ders.

Önce bölümler. Tek bir hedef sayısı yerine, elle yazılmış 25 satırlık bir tablo:

```ts
// src/logic.ts
export type FireflySubtype = "gold" | "emerald" | "azure" | "purple" | "red";
export type HazardKind = "wasp" | "spider" | "ladybug" | "moth";

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  target: number; // bölümü bitirmek için gereken ateşböceği
  waspChance: number; // üretilen canlının tehlike olma olasılığı
  fallSpeedMult: number; // difficulty() çıktısını ölçekler
  spawnEvery: number; // bölümün taban üretim aralığı
  maxLadybugs: number;
  maxMoths?: number;
  skyTheme: "twilight" | "emerald" | "midnight" | "azure" | "storm" | "aurora" | "bloodmoon" | "fog" | "starstorm" | "legendary";
  description: string;
  allowedHazards: HazardKind[]; // bu bölümde hangi tehlikeler serbest
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: "Alacakaranlık Çayırı", subtitle: "Gece Kapısı", target: 12, waspChance: 0.08, fallSpeedMult: 1, spawnEvery: 1.6, maxLadybugs: 0, maxMoths: 0, skyTheme: "twilight", description: "Bahçenin ilk ışıkları seni çağırıyor.", allowedHazards: ["wasp"] },
  // ... 2'den 24'e kadar aynı kalıpla
  { level: 25, name: "Işık Muhafızı", subtitle: "Efsanevi Final", target: 34, waspChance: 0.5, fallSpeedMult: 2.6, spawnEvery: 0.42, maxLadybugs: 4, maxMoths: 2, skyTheme: "legendary", description: "Bahçenin son ve en parlak sınavı seni bekliyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
];

export function getLevelConfig(level: number): LevelConfig {
  const index = Math.max(1, Math.min(LEVELS.length, level)) - 1;
  return LEVELS[index];
}
```

Bu tabloyu formülle üretmek mümkündü — hepsi düzgün bir eğri üstünde zaten. Elle yazmayı seçtim çünkü bir bölümü sevmediğimde tek satır düzeltmek istiyordum, formülün katsayısını değil. `getLevelConfig`'in iki clamp'i de burada bedava sigorta: aralık dışı bir numara gelirse fonksiyon patlamıyor, en yakın bölümü veriyor. Testte de tam bunu doğruluyoruz.

`allowedHazards`, tablonun en işlevsel sütunu. Birinci bölümde sadece arı var. İkinci bölümde uğur böceği katılıyor, dördüncüde örümcek, yirmincide güve. Yeni tehlike, oyuncunun eskisine alıştığı yerde giriyor — öğretmenin sınıfa yeni konu vermesi gibi.

Dört tehlikenin dördü de farklı bir dille konuşuyor:

- Arı düz iner ama zikzak çizer; `aggressiveSway` salınımı bölüm numarasıyla genişletir.
- Uğur böceği düşmez, ekranın ortasında dolaşır. Ona çarpmamak sizin işiniz.
- Örümcek yukarıda asılı durur ve aralıklarla ağ atar; ağ menzilindeyken kavanoz hem yavaşlar hem örümceğe doğru çekilir.
- Güve sahte ışıktır: yakaladığınızı sanırsınız, çarpar ve 3.2 saniye boyunca çekim alanınızı kısar.

Ateşböceğinin de beş rengi var ve renk bir yetenek: altın sade bir puan, mor iki puan, zümrüt çekim alanını büyütür, gök mavisi kavanozu hızlandırır, kızıl ise örümcek ağını yakar.

Bütün bu davranışların matematiği yine `logic.ts`'te, yine saf. Dört fonksiyon eklendi:

```ts
// src/logic.ts
export function swayVel(t: number, amp: number, freq: number): number {
  return Math.cos(t * freq * Math.PI * 2) * amp * freq * Math.PI * 2;
}

export function aggressiveSway(
  t: number,
  base: number,
  amp: number,
  freq: number,
  level: number,
): { x: number; extraY: number } {
  const levelMult = 1 + (level - 1) * 0.12; // bölüm ilerledikçe daha geniş, daha hızlı
  const x = base + Math.sin(t * freq * levelMult * Math.PI * 2) * (amp * levelMult);
  const extraY = Math.sin(t * freq * 2.5 * Math.PI) * (14 * levelMult);
  return { x, extraY };
}

// Örümceğin Kavanoza Ağ Çekim Kuvveti Hesabı (Yavaşça Örümceğe Çeker)
export function calculateSpiderWebPull(
  spiderX: number,
  spiderY: number,
  jarX: number,
  jarY: number,
  pullForce = 160,
): { vx: number; vy: number } {
  const dx = spiderX - jarX;
  const dy = spiderY - jarY;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    vx: (dx / dist) * pullForce,
    vy: (dy / dist) * pullForce,
  };
}

// Ağ Kıran Kontrolü: SADECE Kızıl Yakut (Red Firefly) Ağ Kırabilir!
export function shouldBurnSpiderWeb(subType?: FireflySubtype): boolean {
  return subType === "red";
}
```

`swayVel` benim en sevdiğim ekleme, çünkü hiç mekanik değil: `sway`'in analitik türevi. Böceğin o anki yatay hızını veriyor ve tek işi çizimde kanat açısını eğmek — sola giderken sola yatıyor. Beş kelimelik matematik, bir satırlık his. `calculateSpiderWebPull` de dikkat: normalleştirilmiş yön vektörü, `Math.max(1, ...)` ile sıfıra bölünmeye karşı korumalı. Mesafeden bağımsız sabit kuvvet — çünkü menzile giren oyuncu, uzaklığa göre değil, kaçamadığı için ceza almalı.

Bir de kapsam cümlesi: `main.ts`'in 3381 satırının büyük bölümü çizim. On farklı gökyüzü teması, sekiz bacaklı organik örümcek, cam kavanozun kırılma parıltıları, kayan yıldızlar, çim eğilmesi, bölüm seçme ızgarası, tutorial ekranı. Bu yazı çekirdeği anlatıyor; repodaki sürüm buradan devam ediyor ve o katmanın anlatılacak yeri bu yazı değil.

### Kazanmak Bir `location.reload()` Değildir

Son düzeltme, orijinalin en tembel satırına: kazanınca sayfayı baştan yüklemek. Bu, "tekrar oyna" düğmesine basan oyuncuya beyaz bir ekran göstermek demek — üstelik gereksiz; oyunun durumu zaten bir avuç değişken. Onları sıfırlamak bir fonksiyon:

```ts
// src/main.ts — kısaltılmış (atmosfer ve bonus zamanlayıcıları çıkarıldı)
function resetStage(levelNum = currentLevel) {
  currentLevel = Math.max(1, Math.min(LEVELS.length, levelNum));
  levelCfg = getLevelConfig(currentLevel);
  critters = [];
  particles = [];
  jarFireflies = [];
  caught = 0;
  missed = 0;
  lives = 3;
  elapsed = 0;
  spawnTimer = createSpawnTimer();
  shake.power = 0;
  jarSquash = 0;
  jar.x = (W - jar.w) / 2;
  jar.y = H - jar.h - 32 * SCALE;
  pointerTarget = null;
  state = "levelintro";
}
```

Fonksiyonun adı `resetGame` değil `resetStage` — çünkü artık sıfırlanan şey oyun değil, bölüm. Aynı fonksiyon "tekrar dene"yi de, "sonraki bölüm"ü de, bölüm seçme ekranından gelen atlamayı da karşılıyor. Tek giriş kapısı: hangi bölüm?

Durum makinesine gelince — burada eski halime gülüyorum. İlk yazdığımda "durum makinesi iki kelime: `playing | won`" diye övünmüştüm. Bugünkü tip şöyle:

```ts
// src/main.ts
type GameState =
  | "playing"
  | "paused"
  | "tutorial"
  | "settings"
  | "levelselect"
  | "levelcomplete"
  | "gameover"
  | "campaignwon"
  | "levelintro";
```

İki kelimeyle başladı, dokuz oldu. Dürüst olmak gerekirse sekiz: `paused` tipte duruyor ama koda hiç atanmıyor — Escape tuşu duraklatmak yerine ayarlar ekranını açıyor ve o ekran zaten döngüyü durduruyor. Yani `paused` bir plandan kalma ölü satır. Bu yazıyı hazırlarken fark ettim ve silmedim; çünkü büyüyen bir projenin nasıl göründüğünü, temizlenmiş bir tipten daha iyi anlatıyor.

Geçişlerin tamamı iki kapıdan geçiyor: bir tıklama işleyicisi (`handlePointerClick`) ve bir tuş işleyicisi. İkisi de aynı kalıpta — önce hangi durumdayız, sonra hangi düğmeye/tuşa basıldı:

```ts
// src/main.ts — kısaltılmış
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (state === "levelintro") state = "playing";
    else if (state === "levelcomplete") resetStage(currentLevel + 1);
    else if (state === "gameover" || state === "campaignwon")
      resetStage(state === "campaignwon" ? 1 : currentLevel);
  }
  if (e.key === "Escape") {
    if (state === "playing") {
      state = "settings";
      modalAnimTime = 0;
    } else if (state === "settings" || state === "tutorial" || state === "levelselect")
      state = "playing";
  }
}, on);
```

Güncelleme fonksiyonunun tamamı da tek bir `if (state === "playing")` bloğuna sarılı; diğer bütün durumlarda sadece modal animasyonunun zamanı ilerliyor. Kare döngüsü hiç durmuyor, oyun duruyor. Sayfa yenilenmiyor, canvas aynı canvas. SABİT YILDIZLAR'ın menü → oyun → skor makinesinin büyümüş hali — ve aynı ders: oyununuzun yaşam döngüsünü tarayıcıya değil, kendi durumunuza emanet edin.

### Saf Mantığın Karşılığı: Testler

Perde 1 ve 2'nin bütün matematiği — `tickSpawn`, `sway`, `swayVel`, `hitCircleRect`, `difficulty`, can kuralları, sarsıntı üçlüsü, bölüm tablosu — DOM'suz, canvas'sız, saf fonksiyonlar olarak `src/logic.ts` içinde yaşıyor. 224 satır. Karşısında 3381 satırlık `main.ts` var ve o dosyanın tek işi çizmek. Önceki iki yazının ortak ilkesi: çizim çizer, mantık bilir.

Bugün `tests/logic.test.ts` 11 `describe` altında 28 test barındırıyor ve tamamı tarayıcı açılmadan koşuyor. `rand` parametresinin karşılığı da burada ödeniyor:

```ts
// tests/logic.test.ts
it("enjekte edilen rand ile spawn aralığı deterministiktir", () => {
  const t = createSpawnTimer(1);
  const rand = () => 0.5; // hep orta değer
  expect(tickSpawn(t, 0.6, 1, rand)).toBe(false); // 0.6 < 1: henüz değil
  expect(tickSpawn(t, 0.6, 1, rand)).toBe(true);  // 1.2 ≥ 1: üret
  expect(t.next).toBeCloseTo(1);   // 1 * (0.6 + 0.5 * 0.8) = 1
  expect(t.acc).toBeCloseTo(0.2);  // artık taşındı, çöpe gitmedi
});
```

Rastgeleliğe dayanan bir spawner'ın deterministik testi — çünkü rastgelelik fonksiyonun içine gömülü değil, kapıdan veriliyor.

Can kuralları da aynı rahatlıkla sınanıyor. Saf fonksiyon olmasalardı bu testi yazmak için sahte bir canvas, sahte bir oyun döngüsü ve sahte bir kavanoz kurmam gerekirdi:

```ts
// tests/logic.test.ts
describe("processWaspCollision & Can Kuralları", () => {
  it("ateşböceği > 0 ise arı çarpması sadece 1 ateşböceği düşürür, can gitmez", () => {
    const res = processWaspCollision(5, 3);
    expect(res.newCaught).toBe(4);
    expect(res.newLives).toBe(3);
    expect(res.lostLife).toBe(false);
  });

  it("ateşböceği = 0 iken arı çarpması 1 CAN düşürür", () => {
    const res = processWaspCollision(0, 3);
    expect(res.newCaught).toBe(0);
    expect(res.newLives).toBe(2);
    expect(res.lostLife).toBe(true);
  });
});
```

Bölüm tablosu ve zorluk eğrisi de aynı dosyada, aynı sadelikte:

```ts
// tests/logic.test.ts
it("getLevelConfig aralık dışı bölüm numaralarını güvenle sınırlar", () => {
  expect(getLevelConfig(0).level).toBe(1);
  expect(getLevelConfig(999).level).toBe(25);
  expect(getLevelConfig(4).name).toBe("Örümcek Bahçesi");
});

it("bölüm 1 taban değerleri", () => {
  const d = difficulty(0, 1);
  expect(d.spawnEvery).toBeCloseTo(1.6);
  expect(d.fallSpeed).toBeCloseTo(120);
});
```

Aynı şekilde `hitCircleRect`'in köşe teması, `swayVel`'in türev tutarlılığı, `aggressiveSway`'in bölümle genişlemesi, sarsıntının sıfıra inişi: hepsi tarayıcı açılmadan doğrulanıyor. `npx tsc --noEmit` sıfır hata, `npm test` 28/28, `npm run build` temiz.

Bu ayrımın asıl bedelini oyun büyüyünce ödemezsiniz, büyürken ödemezsiniz — büyüdükten sonra kazanırsınız. Çizim katmanı on beş kat büyüdü; testler hiç bozulmadı, çünkü hiçbiri çizime bakmıyor.

### Özetle:

1. "Çalışıyor" bir eşiktir, "hissettiriyor" bir hedef. Tutorial'lar ilkinde durur; oyuncular ikincisini bekler.
2. Spawner metronom olmasın: accumulator ile biriktir, artığı taşı, aralığı rastgele seç.
3. `animate` + `wiggle` = `y += hız * dt` + `Math.sin`. Rastgele faz olmadan sürü, asker olur.
4. Girdiyi çoğalt: klavye hedef hıza yumuşak geçer, parmak bir hedef nokta bırakır; son dokunan girdi kazanır.
5. Daire-dikdörtgen çarpışması iki clamp'tir: en yakın noktayı bul, mesafenin karesine bak.
6. Ceza kademeli olsun: arı önce ışığı alır, ışık yoksa canı; üç kaçan ateşböceği bir can eder. Kaybedilemeyen oyun kazanılamaz.
7. Juice mekanik değildir ama oyunu oyun yapan odur: sönümlü sarsıntı, `lighter` parçacıklar, tabandan squash & stretch, doyuma ulaşan zorluk eğrisi, dünyaya yazılmış skor.
8. Sarsıntıya tavan ve sönüm koyun; cezalandırın, mide bulandırmayın. Şiddeti cezanın büyüklüğüne bağlayın.
9. Zorluk eğrisini iki eksene ayırın: tur içindeki zaman ve bölüm tablosu. Tabloyu elle yazmak, formülle üretmekten daha iyi ayarlanır.
10. "Tekrar oyna" bir `location.reload()` değil, bir `resetStage()` fonksiyonudur — ve tek giriş kapısı olsun.
11. Saf mantık + enjekte edilen `rand` = rastgele görünen sistemlerin deterministik testleri. Çizim katmanı on beş kat büyüse de testler ayakta kalır.

Kodun tamamı — saf mantık, 28 test ve oyunun kendisi — repoda; `npm install && npm run dev` ile bahçe bir dakikada kararıyor, ateşböcekleri süzülmeye başlıyor. (Repoda bir de kardeşi var: `canvas-cyber-falling-game-from-scratch` — `logic.ts`'i satır satır aynı, sadece 25 bölümün isimleri ve metinleri siber temaya göre değişmiş, çizim katmanı ise çok daha kısa; aynı çekirdeğin başka bir derisi.)

Bu yazıyı yazarken şunu fark ettim: tutorial'ların juice'u atlaması tembellik değil, ölçülebilirlik meselesi. Mekanik anlatılabilir — girdisi, çıktısı, doğrusu yanlışı var. His ise ancak oynayınca ortaya çıkıyor ve "sarsıntı 18 mi olmalı 22 mi" sorusunun cevabı hiçbir dokümanda yok; elinizle ayarlıyorsunuz, damakla tuz gibi. Belki de zanaatla tarif arasındaki çizgi tam burasıdır: tarif sizi çalışan yemeğe götürür, tuzu hâlâ sizin atmanız gerekir. ✨⚙️
