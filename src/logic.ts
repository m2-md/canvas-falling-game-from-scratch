// FIREFLIES — Pure Game Logic & Damage/Health Rules
// Features: 3 Lives System Logic, Web-Breaking Red Firefly Check, Screen Shake and Stage Configuration.

// --- Pillar 1 — Spawner -------------------------------------------------------

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

// --- Pillar 2 — Sway & Aggressive Tilt ---------------------------------------

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

// Spider Web Pull Force Calculation (Drifts jar toward spider)
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

// --- Pillar 3 — Health & Damage Rules ----------------------------------

// On Wasp Hit: if 0 fireflies, lose 1 Life; if >0, lose 1 Firefly.
export function processWaspCollision(
  caught: number,
  lives: number,
): { newCaught: number; newLives: number; lostLife: boolean } {
  if (caught > 0) {
    return { newCaught: caught - 1, newLives: lives, lostLife: false };
  }
  return { newCaught: 0, newLives: Math.max(0, lives - 1), lostLife: true };
}

// On Spider or Ladybug Hit: Directly lose 1 Life!
export function processHazardCollision(
  lives: number,
): { newLives: number; lostLife: boolean } {
  return { newLives: Math.max(0, lives - 1), lostLife: true };
}

// On 3 Missed Fireflies: Lose 1 Life!
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

// Web-Breaker Check: Only Red Fireflies can sever spider webs!
export function shouldBurnSpiderWeb(subType?: FireflySubtype): boolean {
  return subType === "red";
}

// --- Pillar 4 — Collision ------------------------------------------------------

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

// --- Juice 1 — Screen Shake ----------------------------------------------

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

// --- Juice 4 — 25 Stage Design & Species Attributes -----------------------------

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
  { level: 1, name: "Twilight Meadow", subtitle: "Night Gate", target: 12, waspChance: 0.08, fallSpeedMult: 1, spawnEvery: 1.6, maxLadybugs: 0, maxMoths: 0, skyTheme: "twilight", description: "The first lights of the garden beckon you.", allowedHazards: ["wasp"] },
  { level: 2, name: "Clover Garden", subtitle: "Little Wanderers", target: 13, waspChance: 0.098, fallSpeedMult: 1.067, spawnEvery: 1.551, maxLadybugs: 1, maxMoths: 0, skyTheme: "emerald", description: "Ladybugs have become your companions tonight.", allowedHazards: ["wasp", "ladybug"] },
  { level: 3, name: "Willow Shadows", subtitle: "Whispering Branches", target: 14, waspChance: 0.115, fallSpeedMult: 1.133, spawnEvery: 1.502, maxLadybugs: 1, maxMoths: 0, skyTheme: "midnight", description: "Beneath the willows, lights flicker more timidly.", allowedHazards: ["wasp", "ladybug"] },
  { level: 4, name: "Spider Garden", subtitle: "First Trap", target: 15, waspChance: 0.133, fallSpeedMult: 1.2, spawnEvery: 1.453, maxLadybugs: 1, maxMoths: 0, skyTheme: "azure", description: "A patient predator waiting in the shadows has awakened.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 5, name: "Ruby Valley", subtitle: "Fiery Lights", target: 16, waspChance: 0.15, fallSpeedMult: 1.267, spawnEvery: 1.403, maxLadybugs: 1, maxMoths: 0, skyTheme: "storm", description: "Crimson lights can now burn and sever the spider web.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 6, name: "Polar Whisper", subtitle: "Color Curtain", target: 17, waspChance: 0.168, fallSpeedMult: 1.333, spawnEvery: 1.354, maxLadybugs: 1, maxMoths: 0, skyTheme: "aurora", description: "The sky dances, and lights accompany its rhythm.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 7, name: "Blood Full Moon", subtitle: "Crimson Warning", target: 17, waspChance: 0.185, fallSpeedMult: 1.4, spawnEvery: 1.305, maxLadybugs: 1, maxMoths: 0, skyTheme: "bloodmoon", description: "The moon turned crimson, wasps are agitated.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 8, name: "Misty Grove", subtitle: "Unseen Paths", target: 18, waspChance: 0.203, fallSpeedMult: 1.467, spawnEvery: 1.256, maxLadybugs: 2, maxMoths: 0, skyTheme: "fog", description: "Remember to follow your light through the mist.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 9, name: "Stardust", subtitle: "Sky Rain", target: 19, waspChance: 0.22, fallSpeedMult: 1.533, spawnEvery: 1.207, maxLadybugs: 2, maxMoths: 0, skyTheme: "starstorm", description: "Even the stars yearn to fall to the earth tonight.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 10, name: "Moon Guardian", subtitle: "First Trial", target: 20, waspChance: 0.237, fallSpeedMult: 1.6, spawnEvery: 1.158, maxLadybugs: 2, maxMoths: 0, skyTheme: "legendary", description: "The ancient keeper of the garden tests you.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 11, name: "Dewdrop Garden", subtitle: "New Dawn", target: 21, waspChance: 0.255, fallSpeedMult: 1.667, spawnEvery: 1.108, maxLadybugs: 2, maxMoths: 0, skyTheme: "emerald", description: "Every dewdrop conceals a brand-new light.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 12, name: "Emerald Path", subtitle: "Fellow Travelers", target: 22, waspChance: 0.273, fallSpeedMult: 1.733, spawnEvery: 1.059, maxLadybugs: 2, maxMoths: 0, skyTheme: "midnight", description: "Ladybugs now roam in greater numbers.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 13, name: "Realm of Shadows", subtitle: "Deep Silence", target: 23, waspChance: 0.29, fallSpeedMult: 1.8, spawnEvery: 1.01, maxLadybugs: 2, maxMoths: 0, skyTheme: "azure", description: "Darkness settles heavier here.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 14, name: "Spider Valley", subtitle: "Patient Hunter", target: 24, waspChance: 0.307, fallSpeedMult: 1.867, spawnEvery: 0.961, maxLadybugs: 3, maxMoths: 0, skyTheme: "storm", description: "Webs are spun more tightly tonight.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 15, name: "Storm Gate", subtitle: "Halfway Point", target: 25, waspChance: 0.325, fallSpeedMult: 1.933, spawnEvery: 0.912, maxLadybugs: 3, maxMoths: 0, skyTheme: "aurora", description: "You reached the heart of the garden; winds accelerate.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 16, name: "Polar Flame", subtitle: "Flickering Sky", target: 26, waspChance: 0.343, fallSpeedMult: 2, spawnEvery: 0.863, maxLadybugs: 3, maxMoths: 0, skyTheme: "bloodmoon", description: "Vivid colors swirl, lights struggle against the gust.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 17, name: "Crimson Midnight", subtitle: "Warning Bells", target: 26, waspChance: 0.36, fallSpeedMult: 2.067, spawnEvery: 0.813, maxLadybugs: 3, maxMoths: 0, skyTheme: "fog", description: "The moon reddened once more; danger heightened.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 18, name: "Lost Mist", subtitle: "Uncertain Path", target: 27, waspChance: 0.378, fallSpeedMult: 2.133, spawnEvery: 0.764, maxLadybugs: 3, maxMoths: 0, skyTheme: "starstorm", description: "The trail has vanished; trust only your light.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 19, name: "Meteor Shower", subtitle: "Final Preparation", target: 28, waspChance: 0.395, fallSpeedMult: 2.2, spawnEvery: 0.715, maxLadybugs: 3, maxMoths: 0, skyTheme: "twilight", description: "The heavens shatter; the final trial approaches.", allowedHazards: ["wasp", "ladybug", "spider"] },
  { level: 20, name: "Moth Night", subtitle: "False Lights", target: 29, waspChance: 0.412, fallSpeedMult: 2.267, spawnEvery: 0.666, maxLadybugs: 4, maxMoths: 1, skyTheme: "legendary", description: "Certain false lights glow only to deceive you.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 21, name: "Twilight Legend", subtitle: "Ancient Memory", target: 30, waspChance: 0.43, fallSpeedMult: 2.333, spawnEvery: 0.617, maxLadybugs: 4, maxMoths: 1, skyTheme: "midnight", description: "The garden summons you back to its inaugural night.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 22, name: "Emerald Throne", subtitle: "Green Kingdom", target: 31, waspChance: 0.448, fallSpeedMult: 2.4, spawnEvery: 0.568, maxLadybugs: 4, maxMoths: 1, skyTheme: "azure", description: "Emerald lights establish a radiant kingdom here.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 23, name: "Ancient Shadow", subtitle: "Forgotten Whisper", target: 32, waspChance: 0.465, fallSpeedMult: 2.467, spawnEvery: 0.518, maxLadybugs: 4, maxMoths: 1, skyTheme: "storm", description: "The oldest shadows awaken in these depths.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 24, name: "Final Web", subtitle: "Lord of Darkness", target: 33, waspChance: 0.483, fallSpeedMult: 2.533, spawnEvery: 0.469, maxLadybugs: 4, maxMoths: 2, skyTheme: "aurora", description: "The spider will not rest tonight.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
  { level: 25, name: "Light Guardian", subtitle: "Legendary Finale", target: 34, waspChance: 0.5, fallSpeedMult: 2.6, spawnEvery: 0.42, maxLadybugs: 4, maxMoths: 2, skyTheme: "legendary", description: "The garden's final and most radiant trial awaits you.", allowedHazards: ["wasp", "ladybug", "spider", "moth"] },
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
