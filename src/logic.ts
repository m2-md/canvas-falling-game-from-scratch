// ATESHBÖCEKLERİ — saf oyun mantığı. DOM yok, canvas yok, Math.random zorunlu değil:
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

// --- Direk 2 — Salınım & Eğim ------------------------------------------------

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

// Karmaşık Arı Uçuş Eğim Hesabı (Bölüm İlerledikçe Saldırgan Dikey/Yatay Dalış)
export function aggressiveSway(
  t: number,
  base: number,
  amp: number,
  freq: number,
  level: number,
): { x: number; extraY: number } {
  const levelMult = 1 + (level - 1) * 0.12; // Seviye arttıkça salınım agresifleşir
  const x = base + Math.sin(t * freq * levelMult * Math.PI * 2) * (amp * levelMult);
  const extraY = Math.sin(t * freq * 2.5 * Math.PI) * (14 * levelMult);
  return { x, extraY };
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
  s.power = Math.min(s.power + power, 24);
}

export function updateShake(s: Shake, dt: number): void {
  s.t += dt;
  s.power = Math.max(0, s.power - dt * 30);
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

// --- Tutam 4 — 10 Bölümlü Kurgu & Yeni Böcek Türleri --------------------------

export type HazardKind = "wasp" | "grasshopper" | "giant_beetle";

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
  allowedHazards: HazardKind[];
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: "Alacakaranlık Çayırı", subtitle: "Aydınlık Başlangıç", target: 5, waspChance: 0.10, fallSpeedMult: 1.0, spawnEvery: 1.5, skyTheme: "twilight", description: "Altın ateşböceklerini toplayarak başla.", allowedHazards: ["wasp"] },
  { level: 2, name: "Zümrüt Vadi", subtitle: "Zümrüt Işıkları", target: 7, waspChance: 0.18, fallSpeedMult: 1.15, spawnEvery: 1.35, skyTheme: "emerald", description: "Hızlı zümrüt ateşböcekleri iniyor.", allowedHazards: ["wasp"] },
  { level: 3, name: "Sıçrayan Tepe", subtitle: "Çekirgelerin Doğuşu", target: 8, waspChance: 0.25, fallSpeedMult: 1.25, spawnEvery: 1.2, skyTheme: "midnight", description: "Dikkat! Ani sıçrayan hızlı çekirgeler belirdi!", allowedHazards: ["wasp", "grasshopper"] },
  { level: 4, name: "Mavi Yakut Gecesi", subtitle: "Azure Çekimi", target: 10, waspChance: 0.28, fallSpeedMult: 1.35, spawnEvery: 1.1, skyTheme: "azure", description: "Mavi yakut ateşböcekleri ve arı sürüleri.", allowedHazards: ["wasp", "grasshopper"] },
  { level: 5, name: "Dev Kovan Geçidi", subtitle: "Dev Kral Böcek", target: 12, waspChance: 0.32, fallSpeedMult: 1.45, spawnEvery: 1.0, skyTheme: "storm", description: "Devasa yer kaplayan Dev Kral Böceklere dikkat!", allowedHazards: ["wasp", "giant_beetle"] },
  { level: 6, name: "Kutup Işıkları", subtitle: "Aurora Fırtınası", target: 14, waspChance: 0.35, fallSpeedMult: 1.55, spawnEvery: 0.9, skyTheme: "aurora", description: "Çekirgeler ve dev böcekler bir arada saldırıyor.", allowedHazards: ["wasp", "grasshopper", "giant_beetle"] },
  { level: 7, name: "Kanlı Ay Tutulması", subtitle: "Kızıl Tehlike", target: 15, waspChance: 0.40, fallSpeedMult: 1.70, spawnEvery: 0.8, skyTheme: "bloodmoon", description: "Agresif dalış yapan kovan arıları!", allowedHazards: ["wasp", "grasshopper", "giant_beetle"] },
  { level: 8, name: "Derin Orman Sisleri", subtitle: "Sisli Sığınak", target: 18, waspChance: 0.42, fallSpeedMult: 1.85, spawnEvery: 0.72, skyTheme: "fog", description: "Yoğun sis altında hızlı sıçramalar.", allowedHazards: ["wasp", "grasshopper", "giant_beetle"] },
  { level: 9, name: "Yıldız Fırtınası", subtitle: "Kozmik Kaos", target: 20, waspChance: 0.45, fallSpeedMult: 2.0, spawnEvery: 0.65, skyTheme: "starstorm", description: "Kaotik sıçrayışlar ve dev engel böcekleri!", allowedHazards: ["wasp", "grasshopper", "giant_beetle"] },
  { level: 10, name: "Işık Muhafızı", subtitle: "Efsanevi Final Boss", target: 25, waspChance: 0.48, fallSpeedMult: 2.2, spawnEvery: 0.55, skyTheme: "legendary", description: "Tüm zararlılar ve 25 hedef ışık! Efsanevi şampiyon ol!", allowedHazards: ["wasp", "grasshopper", "giant_beetle"] }
];

export function getLevelConfig(level: number): LevelConfig {
  const index = Math.max(1, Math.min(LEVELS.length, level)) - 1;
  return LEVELS[index];
}

export interface Difficulty {
  spawnEvery: number;
  fallSpeed: number;
}

export function difficulty(elapsed: number, level = 1): Difficulty {
  const cfg = getLevelConfig(level);
  const k = Math.min(elapsed / 60, 1);
  return {
    spawnEvery: Math.max(0.4, (cfg.spawnEvery - 0.4 * k)),
    fallSpeed: (120 + 140 * k) * cfg.fallSpeedMult,
  };
}
