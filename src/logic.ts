// ATEŞBÖCEKLERİ — saf oyun mantığı. DOM yok, canvas yok, Math.random zorunlu değil:
// rastgelelik kapıdan (rand parametresi) verilir, her fonksiyon deterministik test edilir.

// --- Direk 1 — Spawner: metronom değil, yağmur -------------------------------

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

// --- Direk 2 — Salınım -------------------------------------------------------

// Sinüs salınımı: merkez çizgi etrafında yumuşak gidiş-geliş
export function sway(
  t: number,
  base: number,
  amp: number,
  freq: number,
): number {
  return base + Math.sin(t * freq * Math.PI * 2) * amp;
}

// Salınımın anlık yatay hızı (türev): eğim/yön türetmek için
export function swayVel(
  t: number,
  amp: number,
  freq: number,
): number {
  return Math.cos(t * freq * Math.PI * 2) * amp * freq * Math.PI * 2;
}

// --- Direk 4 — Çarpışma ------------------------------------------------------

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

// --- Tutam 1 — Ekran sarsıntısı ----------------------------------------------

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

// --- Tutam 4 — Zorluk eğrisi -------------------------------------------------

export interface Difficulty {
  spawnEvery: number;
  fallSpeed: number;
}

// Süre geçtikçe üretim sıklaşır, düşüş hızlanır; 60. saniyede doyuma ulaşır
export function difficulty(elapsed: number): Difficulty {
  const k = Math.min(elapsed / 60, 1); // 0 → 1: ilk dakikada tam zorluğa tırman
  return {
    spawnEvery: 1.4 - 0.9 * k, // ortalama aralık: 1.4 sn → 0.5 sn
    fallSpeed: 120 + 160 * k, // düşüş: 120 → 280 px/sn (SCALE ile çarpılır)
  };
}
