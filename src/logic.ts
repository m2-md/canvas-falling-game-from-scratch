// ATEŞBÖCEKLERİ — Saf Oyun Mantığı & Zarar/Can Sistem Kuralları
// Özellikler: 3 Can Hakları Sistem Mantığı, Ağ Kıran Kızıl Yakut Kontrolü, Sarsıntı ve Seviye Yapılandırması.

// --- Direk 1 — Spawner -------------------------------------------------------

export interface SpawnTimer {
  next: number;
  acc: number;
}

export function createSpawnTimer(first = 0.6): SpawnTimer {
  return { next: first, acc: 0 };
}

export function tickSpawn(
  t: SpawnTimer,
  dt: number,
  spawnEvery: number,
  rand: () => number = Math.random,
): boolean {
  t.acc += dt;
  if (t.acc < t.next) return false;
  t.acc -= t.next;
  t.next = spawnEvery * (0.6 + rand() * 0.8);
  return true;
}

// --- Direk 2 — Salınım & Agresif Eğim ---------------------------------------

export function sway(
  t: number,
  base: number,
  amp: number,
  freq: number,
): number {
  return base + Math.sin(t * freq * Math.PI * 2) * amp;
}

export function swayVel(
  t: number,
  amp: number,
  freq: number,
): number {
  return Math.cos(t * freq * Math.PI * 2) * amp * freq * Math.PI * 2;
}

export function aggressiveSway(
  t: number,
  base: number,
  amp: number,
  freq: number,
  level: number,
): { x: number; extraY: number } {
  const levelMult = 1 + (level - 1) * 0.12;
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

// --- Direk 3 — Can & Zarar Sistem Kuralları ----------------------------------

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

// Ağ Kıran Kontrolü: SADECE Kızıl Yakut (Red Firefly) Ağ Kırabilir!
export function shouldBurnSpiderWeb(subType?: FireflySubtype): boolean {
  return subType === "red";
}

// --- Direk 4 — Çarpışma ------------------------------------------------------

export function hitCircleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

// --- Tutam 1 — Ekran Sarsıntısı ----------------------------------------------

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

// --- Tutam 4 — 10 Bölüm Kurgusu & Tür Özellikleri -----------------------------

export type FireflySubtype = "gold" | "emerald" | "azure" | "purple" | "red";
export type HazardKind = "wasp" | "spider" | "ladybug";

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  target: number;
  waspChance: number;
  fallSpeedMult: number;
  spawnEvery: number;
  maxLadybugs: number;
  skyTheme: "twilight" | "emerald" | "midnight" | "azure" | "storm" | "aurora" | "bloodmoon" | "fog" | "starstorm" | "legendary";
  description: string;
  allowedHazards: HazardKind[];
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: "Alacakaranlık Çayırı", subtitle: "Aydınlık Başlangıç", target: 15, waspChance: 0.10, fallSpeedMult: 1.0, spawnEvery: 1.5, maxLadybugs: 0, skyTheme: "twilight", description: "Altın ve zümrüt ateşböceklerini toplayarak başla.", allowedHazards: ["wasp"] },
  { level: 2, name: "Gezgin Uğur Bahçesi", subtitle: "Uğur Böcekleri", target: 16, waspChance: 0.15, fallSpeedMult: 1.15, spawnEvery: 1.35, maxLadybugs: 1, skyTheme: "emerald", description: "Ekrandan çıkmayan yavaş uçan uğur böcekleri belirdi.", allowedHazards: ["wasp", "ladybug"] },
  { level: 3, name: "Örümcekli Ağ Vadisi", subtitle: "Avcı Örümcek", target: 17, waspChance: 0.22, fallSpeedMult: 1.25, spawnEvery: 1.2, maxLadybugs: 1, skyTheme: "midnight", description: "Dikkat! Örümcek kavanoza ağ atıp seni çekmeye çalışır!", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 4, name: "Mor Mistik Gece", subtitle: "Mistik Işıklar", target: 18, waspChance: 0.26, fallSpeedMult: 1.35, spawnEvery: 1.1, maxLadybugs: 2, skyTheme: "azure", description: "+2 değerindeki Mor Mistik Ateşböcekleri gökyüzünde süzülüyor.", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 5, name: "Kızıl Yakut Fırtınası", subtitle: "Ağ Kıran Işıklar", target: 19, waspChance: 0.30, fallSpeedMult: 1.45, spawnEvery: 1.0, maxLadybugs: 2, skyTheme: "storm", description: "Kızıl Yakut Ateşböceği yakalandığında Örümceğin ağını anında yakar!", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 6, name: "Kutup Işıkları", subtitle: "Aurora Gecesi", target: 20, waspChance: 0.34, fallSpeedMult: 1.55, spawnEvery: 0.9, maxLadybugs: 2, skyTheme: "aurora", description: "Ağ atan örümcekler ve uğur böcekleri bir arada.", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 7, name: "Kanlı Ay Tutulması", subtitle: "Kızıl Tehlike", target: 21, waspChance: 0.38, fallSpeedMult: 1.70, spawnEvery: 0.8, maxLadybugs: 2, skyTheme: "bloodmoon", description: "Kızıl ay altında agresif dalış yapan arılar ve örümcekler!", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 8, name: "Derin Orman Ağları", subtitle: "Yoğun Tuzak", target: 22, waspChance: 0.40, fallSpeedMult: 1.85, spawnEvery: 0.72, maxLadybugs: 3, skyTheme: "fog", description: "Maksimum 3 Uğur böceği ekranda sürekli uçuşur.", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 9, name: "Yıldız Fırtınası", subtitle: "Kozmik Tuzak", target: 23, waspChance: 0.44, fallSpeedMult: 2.0, spawnEvery: 0.65, maxLadybugs: 3, skyTheme: "starstorm", description: "Hızlı örümcek ağları ve tüm ateşböceği türleri!", allowedHazards: ["wasp", "spider", "ladybug"] },
  { level: 10, name: "Işık Muhafızı", subtitle: "Efsanevi Final Boss", target: 25, waspChance: 0.48, fallSpeedMult: 2.2, spawnEvery: 0.55, maxLadybugs: 3, skyTheme: "legendary", description: "Tüm özel böcekler ve 25 ışık hedefi! Efsanevi şampiyon ol!", allowedHazards: ["wasp", "spider", "ladybug"] }
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
