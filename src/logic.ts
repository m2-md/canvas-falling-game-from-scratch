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

// --- Tutam 4 — Bölümler & Zorluk Eğrisi ---------------------------------------

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  target: number;
  waspChance: number;
  fallSpeedMult: number;
  spawnEvery: number;
  skyTheme: "twilight" | "emerald" | "midnight" | "azure" | "storm" | "aurora" | "bloodmoon" | "fog" | "starstorm" | "legendary";
  description: string;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: "Alacakaranlık Çayırı", subtitle: "Aydınlık Başlangıç", target: 5, waspChance: 0.10, fallSpeedMult: 1.0, spawnEvery: 1.5, skyTheme: "twilight", description: "Hafif esintide ışıldayan altın ateşböceklerini toplayarak kavanozunu doldur." },
  { level: 2, name: "Zümrüt Vadi", subtitle: "Zümrüt Işıkları", target: 7, waspChance: 0.18, fallSpeedMult: 1.15, spawnEvery: 1.35, skyTheme: "emerald", description: "Vadiye hızlı zümrüt ateşböcekleri iniyor. Dikkatli ol!" },
  { level: 3, name: "Gece Yarısı Kovanı", subtitle: "Tehlike Artıyor", target: 8, waspChance: 0.25, fallSpeedMult: 1.25, spawnEvery: 1.2, skyTheme: "midnight", description: "Eşek arıları çoğalıyor, hareketlerini dikkatle planla!" },
  { level: 4, name: "Mavi Yakut Gecesi", subtitle: "Azure Çekimi", target: 10, waspChance: 0.28, fallSpeedMult: 1.35, spawnEvery: 1.1, skyTheme: "azure", description: "Nadir mavi yakut ateşböcekleri hızlı süzülüyor." },
  { level: 5, name: "Fırtına Öncesi Sessizlik", subtitle: "Rüzgarlı Yolculuk", target: 12, waspChance: 0.32, fallSpeedMult: 1.45, spawnEvery: 1.0, skyTheme: "storm", description: "Rüzgar sertleşiyor, böceklerin salınımı hızlanıyor!" },
  { level: 6, name: "Kutup Işıkları", subtitle: "Aurora Gecesi", target: 14, waspChance: 0.35, fallSpeedMult: 1.55, spawnEvery: 0.9, skyTheme: "aurora", description: "Kutupsal ışık hüzmelerinin altında yüksek konsantrasyon gerekir." },
  { level: 7, name: "Kanlı Ay Tutulması", subtitle: "Kızıl Tehlike", target: 15, waspChance: 0.40, fallSpeedMult: 1.70, spawnEvery: 0.8, skyTheme: "bloodmoon", description: "Kızıl ay altında saldırgan eşek arılarına karşı hayatta kal!" },
  { level: 8, name: "Derin Orman Sisleri", subtitle: "Sisli Sığınak", target: 18, waspChance: 0.42, fallSpeedMult: 1.85, spawnEvery: 0.72, skyTheme: "fog", description: "Yoğun sis altında süratli hareket ve yüksek refleks gerektirir." },
  { level: 9, name: "Yıldız Fırtınası", subtitle: "Kozmik Av", target: 20, waspChance: 0.45, fallSpeedMult: 2.0, spawnEvery: 0.65, skyTheme: "starstorm", description: "Gece gökyüzünden yağmur gibi inen böcekleri ustalıkla yakala!" },
  { level: 10, name: "Işık Muhafızı", subtitle: "Efsanevi Final Boss", target: 25, waspChance: 0.48, fallSpeedMult: 2.2, spawnEvery: 0.55, skyTheme: "legendary", description: "Tüm seviyelerin en büyük sınavı! Gece bahçesinin efsanevi muhafızı ol!" }
];

export function getLevelConfig(level: number): LevelConfig {
  const index = Math.max(1, Math.min(LEVELS.length, level)) - 1;
  return LEVELS[index];
}

export interface Difficulty {
  spawnEvery: number;
  fallSpeed: number;
}

// Süre ve bölüm numarasına göre dinamik zorluk hesabı
export function difficulty(elapsed: number, level = 1): Difficulty {
  const cfg = getLevelConfig(level);
  const k = Math.min(elapsed / 60, 1);
  return {
    spawnEvery: Math.max(0.4, (cfg.spawnEvery - 0.4 * k)),
    fallSpeed: (120 + 140 * k) * cfg.fallSpeedMult,
  };
}
