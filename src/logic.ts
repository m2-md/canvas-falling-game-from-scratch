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
export type HazardKind = "wasp" | "spider" | "ladybug" | "moth";

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  target: number;
  waspChance: number;
  fallSpeedMult: number;
  spawnEvery: number;
  maxLadybugs: number;
  maxMoths?: number;
  skyTheme: "twilight" | "emerald" | "midnight" | "azure" | "storm" | "aurora" | "bloodmoon" | "fog" | "starstorm" | "legendary";
  description: string;
  allowedHazards: HazardKind[];
}

export const LEVELS: LevelConfig[] = [
  { level: 1, name: "Alacakaranlık Çayırı", subtitle: "Gece Kapısı", target: 12, waspChance: 0.08, fallSpeedMult: 1, spawnEvery: 1.6, maxLadybugs: 0, maxMoths: 0, skyTheme: "twilight", description: "Bahçenin ilk ışıkları seni çağırıyor.", allowedHazards: ["wasp"] },
  { level: 2, name: "Yonca Bahçesi", subtitle: "Küçük Gezginler", target: 13, waspChance: 0.098, fallSpeedMult: 1.067, spawnEvery: 1.551, maxLadybugs: 1, maxMoths: 0, skyTheme: "emerald", description: "Uğur böcekleri bu gece yoldaşın oldu.", allowedHazards: ["wasp", "ladybug"] },
  { level: 3, name: "Söğüt Gölgeleri", subtitle: "Fısıltılı Dallar", target: 14, waspChance: 0.115, fallSpeedMult: 1.133, spawnEvery: 1.502, maxLadybugs: 1, maxMoths: 0, skyTheme: "midnight", description: "Söğütlerin altında ışıklar daha ürkek titrer.", allowedHazards: ["wasp", "ladybug"] },
  { level: 4, name: "Örümcek Bahçesi", subtitle: "İlk Tuzak", target: 15, waspChance: 0.133, fallSpeedMult: 1.2, spawnEvery: 1.453, maxLadybugs: 1, maxMoths: 0, skyTheme: "azure", description: "Gölgede sabırla bekleyen bir avcı uyandı.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 5, name: "Yakut Vadisi", subtitle: "Alevden Işıklar", target: 16, waspChance: 0.15, fallSpeedMult: 1.267, spawnEvery: 1.403, maxLadybugs: 1, maxMoths: 0, skyTheme: "storm", description: "Kızıl ışıklar örümcek ağını yakabilir artık.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 6, name: "Kutup Fısıltısı", subtitle: "Renkli Perde", target: 17, waspChance: 0.168, fallSpeedMult: 1.333, spawnEvery: 1.354, maxLadybugs: 1, maxMoths: 0, skyTheme: "aurora", description: "Gökyüzü dans ediyor, ışıklar ona eşlik ediyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 7, name: "Kanlı Dolunay", subtitle: "Kızıl Uyarı", target: 17, waspChance: 0.185, fallSpeedMult: 1.4, spawnEvery: 1.305, maxLadybugs: 1, maxMoths: 0, skyTheme: "bloodmoon", description: "Ay kızıla döndü, arılar telaşlandı.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 8, name: "Sisli Koru", subtitle: "Görünmeyen Yollar", target: 18, waspChance: 0.203, fallSpeedMult: 1.467, spawnEvery: 1.256, maxLadybugs: 2, maxMoths: 0, skyTheme: "fog", description: "Sis içinde ışığını takip etmeyi unutma.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 9, name: "Yıldız Tozu", subtitle: "Gökyüzü Yağmuru", target: 19, waspChance: 0.22, fallSpeedMult: 1.533, spawnEvery: 1.207, maxLadybugs: 2, maxMoths: 0, skyTheme: "starstorm", description: "Yıldızlar bile bu gece yere düşmek istiyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 10, name: "Ay Muhafızı", subtitle: "İlk Sınav", target: 20, waspChance: 0.237, fallSpeedMult: 1.6, spawnEvery: 1.158, maxLadybugs: 2, maxMoths: 0, skyTheme: "legendary", description: "Bahçenin eski bekçisi seni sınıyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 11, name: "Çiy Damlası Bahçesi", subtitle: "Yeni Şafak", target: 21, waspChance: 0.255, fallSpeedMult: 1.667, spawnEvery: 1.108, maxLadybugs: 2, maxMoths: 0, skyTheme: "emerald", description: "Her çiy damlası yeni bir ışık saklıyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 12, name: "Zümrüt Patika", subtitle: "Yol Arkadaşları", target: 22, waspChance: 0.273, fallSpeedMult: 1.733, spawnEvery: 1.059, maxLadybugs: 2, maxMoths: 0, skyTheme: "midnight", description: "Uğur böcekleri artık daha kalabalık geziyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 13, name: "Gölgeler Diyarı", subtitle: "Derin Sessizlik", target: 23, waspChance: 0.29, fallSpeedMult: 1.8, spawnEvery: 1.01, maxLadybugs: 2, maxMoths: 0, skyTheme: "azure", description: "Karanlık burada daha ağır çöküyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 14, name: "Örümcek Vadisi", subtitle: "Sabırlı Avcı", target: 24, waspChance: 0.307, fallSpeedMult: 1.867, spawnEvery: 0.961, maxLadybugs: 3, maxMoths: 0, skyTheme: "storm", description: "Ağlar bu gece daha sık örülüyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 15, name: "Fırtına Kapısı", subtitle: "Yarı Yol", target: 25, waspChance: 0.325, fallSpeedMult: 1.933, spawnEvery: 0.912, maxLadybugs: 3, maxMoths: 0, skyTheme: "aurora", description: "Bahçenin ortasına vardın, rüzgar hızlanıyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 16, name: "Kutup Alevi", subtitle: "Titreşen Gökyüzü", target: 26, waspChance: 0.343, fallSpeedMult: 2, spawnEvery: 0.863, maxLadybugs: 3, maxMoths: 0, skyTheme: "bloodmoon", description: "Renkler coşkuyla savruluyor, ışıklar zorlanıyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 17, name: "Kızıl Gece Yarısı", subtitle: "Uyarı Çanları", target: 26, waspChance: 0.36, fallSpeedMult: 2.067, spawnEvery: 0.813, maxLadybugs: 3, maxMoths: 0, skyTheme: "fog", description: "Ay yeniden kızardı, tehlike arttı.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 18, name: "Kayıp Sis", subtitle: "Belirsiz Patika", target: 27, waspChance: 0.378, fallSpeedMult: 2.133, spawnEvery: 0.764, maxLadybugs: 3, maxMoths: 0, skyTheme: "starstorm", description: "Yol kayboldu, sadece ışığına güven.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 19, name: "Göktaşı Yağmuru", subtitle: "Son Hazırlık", target: 28, waspChance: 0.395, fallSpeedMult: 2.2, spawnEvery: 0.715, maxLadybugs: 3, maxMoths: 0, skyTheme: "twilight", description: "Gökyüzü parçalanıyor, büyük sınav yaklaşıyor.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 20, name: "Güve Gecesi", subtitle: "Sahte Işıklar", target: 29, waspChance: 0.412, fallSpeedMult: 2.267, spawnEvery: 0.666, maxLadybugs: 4, maxMoths: 1, skyTheme: "legendary", description: "Bazı ışıklar seni aldatmak için parlıyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 21, name: "Alacakaranlık Efsanesi", subtitle: "Eski Anı", target: 30, waspChance: 0.43, fallSpeedMult: 2.333, spawnEvery: 0.617, maxLadybugs: 4, maxMoths: 1, skyTheme: "midnight", description: "Bahçe seni ilk gecesine geri çağırıyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 22, name: "Zümrüt Taht", subtitle: "Yeşil Krallık", target: 31, waspChance: 0.448, fallSpeedMult: 2.4, spawnEvery: 0.568, maxLadybugs: 4, maxMoths: 1, skyTheme: "azure", description: "Yeşil ışıklar burada bir krallık kuruyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 23, name: "Kadim Gölge", subtitle: "Unutulmuş Fısıltı", target: 32, waspChance: 0.465, fallSpeedMult: 2.467, spawnEvery: 0.518, maxLadybugs: 4, maxMoths: 1, skyTheme: "storm", description: "En eski gölgeler burada uyanıyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 24, name: "Son Ağ", subtitle: "Karanlığın Efendisi", target: 33, waspChance: 0.483, fallSpeedMult: 2.533, spawnEvery: 0.469, maxLadybugs: 4, maxMoths: 2, skyTheme: "aurora", description: "Örümcek bu gece hiç uyumayacak.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 25, name: "Işık Muhafızı", subtitle: "Efsanevi Final", target: 34, waspChance: 0.5, fallSpeedMult: 2.6, spawnEvery: 0.42, maxLadybugs: 4, maxMoths: 2, skyTheme: "legendary", description: "Bahçenin son ve en parlak sınavı seni bekliyor.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
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
