// ATEŞBÖCEKLERİ — Zümrüt Rüzgar Harlesi (Speed Breeze FX) & Sanatsal Akıcı Atmosfer
// Özellikler: 25 Bölüm Yapısı, Sahte Işık Güve Tehlikesi, Zengin İnfografik Rehber, 8-Bacaklı Organik Örümcek ve Pürüzsüz Cam Kavanoz.

import {
  type FireflySubtype,
  type HazardKind,
  type LevelConfig,
  type Shake,
  type SpawnTimer,
  LEVELS,
  addShake,
  aggressiveSway,
  calculateSpiderWebPull,
  createSpawnTimer,
  difficulty,
  getLevelConfig,
  hitCircleRect,
  processFireflyMiss,
  processHazardCollision,
  processWaspCollision,
  shakeOffset,
  shouldBurnSpiderWeb,
  sway,
  swayVel,
  tickSpawn,
  updateShake,
} from "./logic";

// --- Çift Yükleme Koruması ---------------------------------------------------
const w = window as unknown as { __stopGame?: () => void };
w.__stopGame?.();
let running = true;
const aborter = new AbortController();
w.__stopGame = () => {
  running = false;
  aborter.abort();
};
const on = { signal: aborter.signal };

// --- Tam Ekran Canvas --------------------------------------------------------
let W = window.innerWidth;
let H = window.innerHeight;
let DPR = Math.min(2, window.devicePixelRatio || 1);
let SCALE = Math.min(W, H) / 600;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

function fitCanvas() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
fitCanvas();

// --- Oyun Durumu & Tipler ---------------------------------------------------
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

type CritterKind = "firefly" | "wasp" | "spider" | "ladybug" | "moth";

interface Critter {
  id: number;
  kind: CritterKind;
  subType?: FireflySubtype;
  baseX: number;
  y: number;
  offsetX: number;
  offsetY: number;
  t: number;
  amp: number;
  freq: number;
  r: number;
  dead?: boolean;
  beingPulled?: boolean;
  pullAngle?: number;
  webActive?: boolean;
  webTimer?: number;
  webCooldown?: number;
  roamAngle?: number;
  roamSpeed?: number;
  jitterVx?: number;
  jitterVy?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  spin?: number;
}

interface FlameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface AnimeShockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
}

interface JarFirefly {
  rx: number;
  ry: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

let currentLevel = 1;
let levelCfg: LevelConfig = getLevelConfig(currentLevel);
let state: GameState = "levelintro";

let critters: Critter[] = [];
let particles: Particle[] = [];
let flameParticles: FlameParticle[] = [];
let animeShockwaves: AnimeShockwave[] = [];
let shootingStars: ShootingStar[] = [];
let floatingTexts: FloatingText[] = [];
let jarFireflies: JarFirefly[] = [];
let caught = 0;
let missed = 0;
let lives = 3;
let elapsed = 0;
let finalTime = 0;
let modalAnimTime = 0;
let magnetBoostTimer = 0;
let speedBoostTimer = 0;
let blackoutTimer = 0;
let hazardPity = 0;
let seenSpider = false;
let seenLadybug = false;
let seenMoth = false;

let nextCritterId = 1;
let spawnTimer: SpawnTimer = createSpawnTimer();
const shake: Shake = { power: 0, t: 0 };

// Ayarlar
let soundEnabled = true;
let highMagnet = false;

// Sanatsal Kavanoz Fizik & Animasyon Değişkenleri
let jarSquash = 0;
let jarWobble = 0;
let jarTilt = 0;
let jarVx = 0;
let jarVy = 0;
let waspHitFlash = 0;

const jar = { x: 0, y: 0, w: 0, h: 0 };

// Atmosferik Ögeler
let stars: { x: number; y: number; r: number; a: number; speed: number; warm: boolean }[] = [];
let bokehFar: { x: number; y: number; r: number; vy: number; vx: number; alpha: number; t: number; color: string }[] = [];
let bokehNear: { x: number; y: number; r: number; vy: number; vx: number; alpha: number; t: number; color: string }[] = [];
let volumetricFog: { x: number; y: number; w: number; h: number; speed: number; alpha: number }[] = [];
let grassBack: { x: number; height: number; swayOffset: number; width: number; bend: number }[] = [];
let grassFront: { x: number; height: number; swayOffset: number; width: number; bend: number }[] = [];
let hillsFar: { x: number; y: number }[] = [];
let hillsNear: { x: number; y: number }[] = [];
let treeSilhouettes: { x: number; h: number; side: number; lean: number; crowns: { dx: number; dy: number; r: number }[] }[] = [];
let auroraPhase = Math.random() * 10;

const uiButtons = {
  settings: { x: 0, y: 0, w: 0, h: 0 },
  modalAction: { x: 0, y: 0, w: 0, h: 0 },
  modalSecondary: { x: 0, y: 0, w: 0, h: 0 },
  modalLevelSelect: { x: 0, y: 0, w: 0, h: 0 },
  modalTutorialBtn: { x: 0, y: 0, w: 0, h: 0 },
  toggleSound: { x: 0, y: 0, w: 0, h: 0 },
  toggleMagnet: { x: 0, y: 0, w: 0, h: 0 },
};

const levelGridButtons: { level: number; x: number; y: number; r: number }[] = [];
let hoveredLevel = -1;

function genHills(baseY: number, roughness: number, segments: number) {
  const pts: { x: number; y: number }[] = [];
  let y = baseY + (Math.random() - 0.5) * roughness;
  for (let i = 0; i <= segments; i++) {
    pts.push({ x: (i / segments) * W, y });
    y += (Math.random() - 0.5) * roughness;
    y = Math.max(baseY - roughness * 1.6, Math.min(baseY + roughness * 0.6, y));
  }
  return pts;
}

function genTree(x: number, h: number, side: number) {
  const crowns: { dx: number; dy: number; r: number }[] = [];
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    crowns.push({
      dx: (Math.random() - 0.5) * h * 0.55,
      dy: -h * (0.55 + Math.random() * 0.4),
      r: h * (0.18 + Math.random() * 0.14),
    });
  }
  return { x, h, side, lean: (Math.random() - 0.5) * 0.12, crowns };
}

function layout() {
  SCALE = Math.min(W, H) / 600;
  jar.w = 55 * SCALE;
  jar.h = 55 * SCALE;
  jar.y = Math.max(H * 0.15, Math.min(H - jar.h - 32 * SCALE, jar.y || H - jar.h - 32 * SCALE));
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x || (W - jar.w) / 2));

  stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.8,
    r: (0.5 + Math.random() * 1.4) * SCALE,
    a: 0.12 + Math.random() * 0.5,
    speed: 0.8 + Math.random() * 2,
    warm: Math.random() < 0.18,
  }));

  const farColors = ["hsl(52 90% 70%)", "hsl(160 80% 62%)", "hsl(200 85% 68%)"];
  bokehFar = Array.from({ length: 16 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: (10 + Math.random() * 22) * SCALE,
    vy: (4 + Math.random() * 8) * SCALE,
    vx: (Math.random() - 0.5) * 6 * SCALE,
    alpha: 0.04 + Math.random() * 0.07,
    t: Math.random() * 10,
    color: farColors[Math.floor(Math.random() * farColors.length)],
  }));

  const nearColors = ["hsl(52 100% 72%)", "hsl(150 100% 66%)", "hsl(200 100% 70%)", "hsl(280 100% 76%)", "hsl(350 100% 70%)"];
  bokehNear = Array.from({ length: 18 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: (3 + Math.random() * 7) * SCALE,
    vy: (10 + Math.random() * 18) * SCALE,
    vx: (Math.random() - 0.5) * 14 * SCALE,
    alpha: 0.10 + Math.random() * 0.22,
    t: Math.random() * 10,
    color: nearColors[Math.floor(Math.random() * nearColors.length)],
  }));

  volumetricFog = Array.from({ length: 6 }, (_, i) => ({
    x: (i * W) / 5 - 60 * SCALE,
    y: H * 0.45 + Math.random() * 0.32 * H,
    w: (300 + Math.random() * 220) * SCALE,
    h: (70 + Math.random() * 50) * SCALE,
    speed: (7 + Math.random() * 12) * SCALE,
    alpha: 0.05 + Math.random() * 0.07,
  }));

  hillsFar = genHills(H * 0.72, 34 * SCALE, 14);
  hillsNear = genHills(H * 0.82, 46 * SCALE, 12);
  treeSilhouettes = [
    genTree(W * (0.02 + Math.random() * 0.08), (150 + Math.random() * 70) * SCALE, -1),
    genTree(W * (0.9 + Math.random() * 0.07), (170 + Math.random() * 80) * SCALE, 1),
  ];
  if (W > 900) treeSilhouettes.push(genTree(W * (0.68 + Math.random() * 0.1), (110 + Math.random() * 50) * SCALE, 1));

  const gbCount = Math.floor(W / (14 * SCALE));
  grassBack = Array.from({ length: gbCount }, (_, i) => ({
    x: i * 14 * SCALE + Math.random() * 6 * SCALE,
    height: (48 + Math.random() * 34) * SCALE,
    swayOffset: Math.random() * Math.PI * 2,
    width: (5 + Math.random() * 3) * SCALE,
    bend: 0,
  }));
  const gfCount = Math.floor(W / (9 * SCALE));
  grassFront = Array.from({ length: gfCount }, (_, i) => ({
    x: i * 9 * SCALE + Math.random() * 4 * SCALE,
    height: (30 + Math.random() * 26) * SCALE,
    swayOffset: Math.random() * Math.PI * 2,
    width: (3.5 + Math.random() * 3) * SCALE,
    bend: 0,
  }));
}
layout();
jar.x = (W - jar.w) / 2;
jar.y = H - jar.h - 32 * SCALE;

window.addEventListener(
  "resize",
  () => {
    const relX = (jar.x + jar.w / 2) / W;
    const relY = (jar.y + jar.h / 2) / H;
    W = window.innerWidth;
    H = window.innerHeight;
    fitCanvas();
    layout();
    jar.x = Math.max(0, Math.min(W - jar.w, relX * W - jar.w / 2));
    jar.y = Math.max(H * 0.15, Math.min(H - jar.h - 20 * SCALE, relY * H - jar.h / 2));
  },
  on,
);

function resetStage(levelNum = currentLevel) {
  currentLevel = Math.max(1, Math.min(LEVELS.length, levelNum));
  levelCfg = getLevelConfig(currentLevel);
  critters = [];
  particles = [];
  flameParticles = [];
  animeShockwaves = [];
  shootingStars = [];
  floatingTexts = [];
  jarFireflies = [];
  caught = 0;
  missed = 0;
  lives = 3;
  elapsed = 0;
  modalAnimTime = 0;
  magnetBoostTimer = 0;
  speedBoostTimer = 0;
  blackoutTimer = 0;
  hazardPity = 0;
  seenSpider = false;
  seenLadybug = false;
  seenMoth = false;
  spawnTimer = createSpawnTimer();
  shake.power = 0;
  jarSquash = 0;
  jarWobble = 0;
  jarTilt = 0;
  jarVx = 0;
  jarVy = 0;
  waspHitFlash = 0;
  jar.x = (W - jar.w) / 2;
  jar.y = H - jar.h - 32 * SCALE;
  pointerTarget = null;
  state = "levelintro";
}

function syncJarFireflies() {
  const colors = ["hsl(52 100% 75%)", "hsl(150 100% 70%)", "hsl(200 100% 75%)", "hsl(280 100% 80%)", "hsl(350 100% 75%)"];
  while (jarFireflies.length < caught) {
    jarFireflies.push({
      rx: (Math.random() - 0.5) * 0.5,
      ry: (Math.random() - 0.5) * 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      t: Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  while (jarFireflies.length > caught) {
    jarFireflies.pop();
  }
}

function spawnCritter() {
  const hazardCap = Math.min(4, 1 + Math.floor((currentLevel - 1) / 6));
  const activeHazards = critters.filter((c) => c.kind !== "firefly" && !c.dead).length;
  const allowed = levelCfg.allowedHazards;
  const needSpider = allowed.includes("spider") && !seenSpider && elapsed > 4 && activeHazards < hazardCap;
  const needMoth = allowed.includes("moth") && !seenMoth && elapsed > 4 && activeHazards < hazardCap;
  const needLadybug = allowed.includes("ladybug") && !seenLadybug && elapsed > 3 && activeHazards < hazardCap;
  const pityForce = hazardPity > 6 && activeHazards < hazardCap;
  let isHazard = Math.random() < levelCfg.waspChance;
  if (needSpider || needMoth || needLadybug || pityForce) isHazard = true;
  if (activeHazards >= hazardCap) isHazard = false;

  if (!isHazard) {
    const amp = (14 + Math.random() * 20) * SCALE;
    let subType: FireflySubtype = "gold";
    const r = Math.random();
    if (r < 0.22) subType = "emerald";
    else if (r < 0.42) subType = "azure";
    else if (r < 0.62) subType = "purple";
    else if (r < 0.78) subType = "red";

    critters.push({
      id: nextCritterId++,
      kind: "firefly",
      subType,
      baseX: amp + 30 * SCALE + Math.random() * (W - 2 * (amp + 30 * SCALE)),
      y: -35 * SCALE,
      offsetX: 0,
      offsetY: 0,
      t: Math.random() * 10,
      amp,
      freq: subType === "red" ? 1.1 + Math.random() * 0.5 : 0.65 + Math.random() * 0.75,
      r: (9.6 + Math.random() * 1.6) * SCALE,
      pullAngle: Math.random() * Math.PI * 2,
    });
  } else {
    hazardPity = 0;
    const activeLadybugs = critters.filter((c) => c.kind === "ladybug" && !c.dead).length;
    const canSpawnLadybug = allowed.includes("ladybug") && activeLadybugs < levelCfg.maxLadybugs;
    const activeMoths = critters.filter((c) => c.kind === "moth" && !c.dead).length;
    const canSpawnMoth = allowed.includes("moth") && activeMoths < (levelCfg.maxMoths || 0);

    let kind: CritterKind = "wasp";
    if (needSpider) kind = "spider";
    else if (needMoth && canSpawnMoth) kind = "moth";
    else if (needLadybug && canSpawnLadybug) kind = "ladybug";
    else if (canSpawnMoth && Math.random() < 0.32) kind = "moth";
    else if (canSpawnLadybug && Math.random() < 0.45) kind = "ladybug";
    else if (allowed.includes("spider") && Math.random() < 0.4) kind = "spider";

    if (kind === "spider") seenSpider = true;
    else if (kind === "moth") seenMoth = true;
    else if (kind === "ladybug") seenLadybug = true;

    if (kind === "ladybug") {
      critters.push({
        id: nextCritterId++,
        kind: "ladybug",
        baseX: W * 0.2 + Math.random() * W * 0.6,
        y: H * 0.2 + Math.random() * H * 0.35,
        offsetX: 0,
        offsetY: 0,
        t: Math.random() * 10,
        amp: 40 * SCALE,
        freq: 0.3 + Math.random() * 0.2,
        r: 13 * SCALE,
        roamAngle: Math.random() * Math.PI * 2,
        roamSpeed: (35 + Math.random() * 25) * SCALE,
      });
    } else if (kind === "spider") {
      critters.push({
        id: nextCritterId++,
        kind: "spider",
        baseX: 60 * SCALE + Math.random() * (W - 120 * SCALE),
        y: 65 * SCALE,
        offsetX: 0,
        offsetY: 0,
        t: Math.random() * 10,
        amp: 30 * SCALE,
        freq: 0.2,
        r: 17 * SCALE,
        webActive: false,
        webTimer: 0,
        webCooldown: 1.2 + Math.random() * 2.0,
      });
    } else if (kind === "moth") {
      const amp = (18 + Math.random() * 22) * SCALE;
      critters.push({
        id: nextCritterId++,
        kind: "moth",
        baseX: amp + 25 * SCALE + Math.random() * (W - 2 * (amp + 25 * SCALE)),
        y: -35 * SCALE,
        offsetX: 0,
        offsetY: 0,
        t: Math.random() * 10,
        amp,
        freq: 0.5 + Math.random() * 0.4,
        r: 13 * SCALE,
        jitterVx: 0,
        jitterVy: 0,
      });
    } else {
      const amp = (40 + Math.random() * 32) * SCALE;
      critters.push({
        id: nextCritterId++,
        kind: "wasp",
        baseX: amp + 25 * SCALE + Math.random() * (W - 2 * (amp + 25 * SCALE)),
        y: -35 * SCALE,
        offsetX: 0,
        offsetY: 0,
        t: Math.random() * 10,
        amp,
        freq: 0.26 + Math.random() * 0.2,
        r: 14 * SCALE,
      });
    }
  }
}

function addAnimeShockwave(x: number, y: number, color = "rgba(254, 240, 138, 0.9)") {
  animeShockwaves.push({ x, y, r: 6 * SCALE, maxR: (40 + Math.random() * 20) * SCALE, life: 0.18, maxLife: 0.18, color });
}

function spawnFlameBurnEffect(startX: number, startY: number, targetX: number, targetY: number) {
  const count = 28;
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const px = startX + (targetX - startX) * progress;
    const py = startY + (targetY - startY) * progress;
    const colors = ["#ff3300", "#ff7700", "#ffcc00", "#ffffff"];
    flameParticles.push({
      x: px + (Math.random() - 0.5) * 10 * SCALE,
      y: py + (Math.random() - 0.5) * 10 * SCALE,
      vx: (Math.random() - 0.5) * 70 * SCALE,
      vy: -70 * SCALE - Math.random() * 90 * SCALE,
      life: 0.25,
      max: 0.25,
      size: (2.5 + Math.random() * 5) * SCALE,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

// --- Girdi -------------------------------------------------------------------
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

function isInsideRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function handlePointerClick(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const cx = ((clientX - rect.left) / rect.width) * W;
  const cy = ((clientY - rect.top) / rect.height) * H;
  if (state === "playing") {
    if (isInsideRect(cx, cy, uiButtons.settings)) {
      state = "settings";
      modalAnimTime = 0;
      return true;
    }
  } else if (state === "levelintro") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      state = "playing";
      return true;
    }
  } else if (state === "tutorial") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      state = "settings";
      return true;
    }
  } else if (state === "settings") {
    if (isInsideRect(cx, cy, uiButtons.toggleSound)) {
      soundEnabled = !soundEnabled;
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.toggleMagnet)) {
      highMagnet = !highMagnet;
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.modalTutorialBtn)) {
      state = "tutorial";
      modalAnimTime = 0;
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.modalLevelSelect)) {
      state = "levelselect";
      modalAnimTime = 0;
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      state = "playing";
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.modalSecondary)) {
      resetStage(1);
      return true;
    }
  } else if (state === "levelselect") {
    for (const b of levelGridButtons) {
      if (Math.hypot(cx - b.x, cy - b.y) <= b.r) {
        hoveredLevel = -1;
        resetStage(b.level);
        return true;
      }
    }
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      hoveredLevel = -1;
      state = "settings";
      return true;
    }
  } else if (state === "levelcomplete") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      resetStage(currentLevel + 1);
      return true;
    }
  } else if (state === "gameover" || state === "campaignwon") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      resetStage(state === "campaignwon" ? 1 : currentLevel);
      return true;
    }
  }
  return false;
}

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key), on);
window.addEventListener("keyup", (e) => keys.delete(e.key), on);
canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (handlePointerClick(e.clientX, e.clientY)) return;
    if (state === "playing") setPointerTarget(e.clientX, e.clientY);
  },
  on,
);
window.addEventListener(
  "pointermove",
  (e) => {
    if (pointerTarget !== null && state === "playing") setPointerTarget(e.clientX, e.clientY);
    if (state === "levelselect") {
      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * W;
      const cy = ((e.clientY - rect.top) / rect.height) * H;
      let found = -1;
      for (const b of levelGridButtons) {
        if (Math.hypot(cx - b.x, cy - b.y) <= b.r * 1.35) {
          found = b.level;
          break;
        }
      }
      hoveredLevel = found;
    }
  },
  on,
);
window.addEventListener("pointerup", () => (pointerTarget = null), on);
window.addEventListener("pointercancel", () => (pointerTarget = null), on);
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      if (handlePointerClick(t.clientX, t.clientY)) {
        e.preventDefault();
        return;
      }
      if (state === "playing") setPointerTarget(t.clientX, t.clientY);
    }
    e.preventDefault();
  },
  { passive: false, signal: aborter.signal },
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0 && state === "playing") setPointerTarget(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  },
  { passive: false, signal: aborter.signal },
);
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") {
      if (state === "levelintro") state = "playing";
      else if (state === "levelcomplete") resetStage(currentLevel + 1);
      else if (state === "gameover" || state === "campaignwon") resetStage(state === "campaignwon" ? 1 : currentLevel);
    }
    if (e.key === "Escape") {
      if (state === "playing") {
        state = "settings";
        modalAnimTime = 0;
      } else if (state === "settings" || state === "tutorial" || state === "levelselect") state = "playing";
    }
  },
  on,
);

function updateJar(dt: number) {
  const WEB_RANGE = 230 * SCALE;
  let webSlow = 1;
  const activeWebs: { spX: number; spY: number; d: number }[] = [];
  for (const c of critters) {
    if (c.kind === "spider" && c.webActive && !c.dead) {
      const spX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const spY = c.y + c.offsetY;
      const d = Math.hypot(jar.x + jar.w / 2 - spX, jar.y + jar.h / 2 - spY);
      activeWebs.push({ spX, spY, d });
      if (d < WEB_RANGE) webSlow = Math.min(webSlow, 0.3 + 0.5 * (d / WEB_RANGE));
    }
  }
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
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
    targetVy = -speed;
    pointerTarget = null;
  }
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
    targetVy = speed;
    pointerTarget = null;
  }

  if (pointerTarget !== null) {
    const diffX = pointerTarget.x - jar.x;
    const diffY = pointerTarget.y - jar.y;
    jar.x += diffX * Math.min(1, dt * 28 * speedMult);
    jar.y += diffY * Math.min(1, dt * 28 * speedMult);
    jarVx = diffX * 14 * webSlow;
    jarVy = diffY * 14 * webSlow;
  } else {
    jarVx += (targetVx - jarVx) * Math.min(1, dt * 22 * webSlow);
    jarVy += (targetVy - jarVy) * Math.min(1, dt * 22 * webSlow);
    jar.x += jarVx * dt;
    jar.y += jarVy * dt;
  }

  for (const w of activeWebs) {
    if (w.d < WEB_RANGE) {
      const pull = calculateSpiderWebPull(w.spX, w.spY, jar.x + jar.w / 2, jar.y + jar.h / 2, 175 * SCALE);
      jar.x += pull.vx * dt;
      jar.y += pull.vy * dt;
    }
  }
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
  jar.y = Math.max(H * 0.12, Math.min(H - jar.h - 15 * SCALE, jar.y));

  const targetTilt = (jarVx / speed) * 0.2;
  jarTilt += (targetTilt - jarTilt) * Math.min(1, dt * 16);

  const jarCenterX = jar.x + jar.w / 2;
  for (const list of [grassBack, grassFront]) {
    for (const b of list) {
      const dist = Math.abs(b.x - jarCenterX);
      if (dist < jar.w * 0.8 && jar.y + jar.h > H - b.height * 1.2) {
        const dir = Math.sign(b.x - jarCenterX) || 1;
        b.bend += (dir * 18 * SCALE - b.bend) * Math.min(1, dt * 10);
      } else {
        b.bend += (0 - b.bend) * Math.min(1, dt * 4);
      }
    }
  }
}

// --- Vektör ikonlar ----------------------------------------------------------
function drawGearIcon(x: number, y: number, r: number, color = "#94a3b8") {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.roundRect(-r * 0.18, -r * 0.95, r * 0.36, r * 0.35, 2 * SCALE);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawClockIcon(x: number, y: number, r: number, color = "#60a5fa") {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * SCALE;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.45);
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.35, -r * 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawCrystalHeartIcon(x: number, y: number, size: number, filled = true) {
  ctx.save();
  ctx.translate(x, y);
  if (filled) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2);
    g.addColorStop(0, "rgba(244, 63, 94, 0.6)");
    g.addColorStop(1, "rgba(244, 63, 94, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const gemG = ctx.createLinearGradient(-size, -size, size, size);
  if (filled) {
    gemG.addColorStop(0, "#fda4af");
    gemG.addColorStop(0.4, "#f43f5e");
    gemG.addColorStop(1, "#9f1239");
  } else {
    gemG.addColorStop(0, "rgba(255,255,255,0.1)");
    gemG.addColorStop(1, "rgba(239,68,68,0.1)");
  }
  ctx.fillStyle = gemG;
  ctx.strokeStyle = filled ? "#fecdd3" : "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1.4 * SCALE;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(size * 0.75, -size * 0.45);
  ctx.lineTo(size * 0.85, size * 0.05);
  ctx.lineTo(0, size * 0.95);
  ctx.lineTo(-size * 0.85, size * 0.05);
  ctx.lineTo(-size * 0.75, -size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (filled) {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1 * SCALE;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.95);
    ctx.lineTo(0, size * 0.95);
    ctx.moveTo(-size * 0.75, -size * 0.45);
    ctx.lineTo(size * 0.75, -size * 0.45);
    ctx.moveTo(-size * 0.85, size * 0.05);
    ctx.lineTo(size * 0.85, size * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHUDMissedFireflyIcon(x: number, y: number, r: number, active = true) {
  ctx.save();
  ctx.translate(x, y);
  if (active) {
    ctx.fillStyle = "rgba(250, 204, 21, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, -r * 0.2, r * 0.7, r * 0.35, -0.3, 0, Math.PI * 2);
    ctx.ellipse(r * 0.6, -r * 0.2, r * 0.7, r * 0.35, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 1 * SCALE;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1.2 * SCALE;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.5);
    ctx.lineTo(r * 0.5, r * 0.5);
    ctx.moveTo(r * 0.5, -r * 0.5);
    ctx.lineTo(-r * 0.5, r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function burst(x: number, y: number, color = "hsl(52 100% 70%)", count = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
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

function addFloatingText(x: number, y: number, text: string, color = "#fef08a") {
  floatingTexts.push({ x, y, text, color, life: 0.55, max: 0.55 });
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (context.measureText(testLine).width > maxWidth && n > 0) {
      context.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else line = testLine;
  }
  context.fillText(line.trim(), x, currentY);
  return currentY;
}

// --- Güncelleme ---------------------------------------------------------------
function update(dt: number) {
  auroraPhase += dt * 0.3;
  if (state === "playing") {
    elapsed += dt;
    hazardPity += dt;
    if (magnetBoostTimer > 0) magnetBoostTimer -= dt;
    if (speedBoostTimer > 0) speedBoostTimer -= dt;
    if (blackoutTimer > 0) blackoutTimer -= dt;

    if (Math.random() < dt * 0.8) {
      shootingStars.push({
        x: Math.random() * W * 0.8,
        y: Math.random() * H * 0.3,
        length: (60 + Math.random() * 90) * SCALE,
        speed: (400 + Math.random() * 350) * SCALE,
        alpha: 0.7 + Math.random() * 0.3,
        life: 0.35,
        maxLife: 0.35,
      });
    }

    const { spawnEvery, fallSpeed } = difficulty(elapsed, currentLevel);
    if (tickSpawn(spawnTimer, dt, spawnEvery)) spawnCritter();
    updateJar(dt);

    const jarMouthX = jar.x + jar.w / 2;
    const jarMouthY = jar.y - 12 * SCALE;
    const baseRadius = highMagnet ? 175 : 140;
    const blackoutMult = blackoutTimer > 0 ? 0.55 : 1;
    const MAGNET_RADIUS = (magnetBoostTimer > 0 ? baseRadius * 1.35 : baseRadius) * blackoutMult * SCALE;

    for (const c of critters) {
      c.t += dt;
      if (c.kind === "ladybug") {
        c.roamAngle = (c.roamAngle || 0) + dt * 0.8;
        const roamVx = Math.cos(c.roamAngle) * (c.roamSpeed || 40 * SCALE);
        const roamVy = Math.sin(c.roamAngle * 1.5) * (c.roamSpeed || 40 * SCALE) * 0.6;
        c.baseX += roamVx * dt;
        c.y += roamVy * dt;
        c.baseX = Math.max(40 * SCALE, Math.min(W - 40 * SCALE, c.baseX));
        c.y = Math.max(H * 0.15, Math.min(H * 0.65, c.y));
      } else if (c.kind === "spider") {
        c.y += fallSpeed * SCALE * dt * 0.3;
        if (!c.webActive) {
          c.webCooldown = (c.webCooldown || 0) - dt;
          if (c.webCooldown <= 0) {
            c.webActive = true;
            c.webTimer = 2.8;
          }
        } else {
          c.webTimer = (c.webTimer || 0) - dt;
          if (c.webTimer <= 0) {
            c.webActive = false;
            c.webCooldown = 3.5 + Math.random() * 3.0;
          }
        }
      } else if (c.kind === "wasp") {
        c.y += fallSpeed * SCALE * dt * 1.1;
        const { x: aggrX, extraY } = aggressiveSway(c.t, c.baseX, c.amp, c.freq, currentLevel);
        c.offsetX = aggrX - c.baseX;
        c.offsetY = extraY;
      } else if (c.kind === "moth") {
        c.y += fallSpeed * SCALE * dt * 0.5;
        c.jitterVx = (c.jitterVx || 0) + (Math.random() - 0.5) * 700 * SCALE * dt;
        c.jitterVy = (c.jitterVy || 0) + (Math.random() - 0.5) * 420 * SCALE * dt;
        c.jitterVx *= 0.92;
        c.jitterVy *= 0.92;
        c.offsetX += c.jitterVx * dt;
        c.offsetY += c.jitterVy * dt;
        c.offsetY = Math.max(-28 * SCALE, Math.min(28 * SCALE, c.offsetY));
      } else {
        c.y += fallSpeed * SCALE * dt;
      }

      let currentX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      if (currentX < 15 * SCALE) c.offsetX += (15 * SCALE - currentX) * Math.min(1, dt * 8);
      else if (currentX > W - 15 * SCALE) c.offsetX += (W - 15 * SCALE - currentX) * Math.min(1, dt * 8);

      if (c.kind === "firefly" && !c.dead) {
        const dx = jarMouthX - currentX;
        const dy = jarMouthY - (c.y + c.offsetY);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAGNET_RADIUS) {
          c.beingPulled = true;
          c.pullAngle = (c.pullAngle || 0) + dt * 10;
          const pullForce = (1 - dist / MAGNET_RADIUS) * (highMagnet ? 450 : 360) * SCALE * dt;
          const spiralX = Math.cos(c.pullAngle) * 20 * SCALE * (dist / MAGNET_RADIUS);
          const spiralY = Math.sin(c.pullAngle) * 20 * SCALE * (dist / MAGNET_RADIUS);
          c.offsetX += (dx / dist) * pullForce + spiralX * dt * 3;
          c.offsetY += (dy / dist) * pullForce + spiralY * dt * 3;
          c.offsetY = Math.max(-25 * SCALE, c.offsetY);
          if (Math.random() < 0.45) {
            const pColor = c.subType === "purple" ? "hsl(280 100% 80%)" : c.subType === "red" ? "hsl(350 100% 75%)" : c.subType === "emerald" ? "hsl(150 100% 75%)" : c.subType === "azure" ? "hsl(200 100% 80%)" : "hsl(52 100% 80%)";
            particles.push({
              x: currentX,
              y: c.y + c.offsetY,
              vx: (dx / dist) * 140 * SCALE + spiralX * 4,
              vy: (dy / dist) * 140 * SCALE + spiralY * 4,
              life: 0.18,
              max: 0.18,
              color: pColor,
              size: (1.5 + Math.random() * 2.5) * SCALE,
            });
          }
        } else {
          c.beingPulled = false;
          c.offsetX += (0 - c.offsetX) * Math.min(1, dt * 5);
          c.offsetY += (0 - c.offsetY) * Math.min(1, dt * 5);
        }
      }

      if (c.kind === "firefly" && Math.random() < 0.38) {
        const pColor = c.subType === "purple" ? "hsl(280 100% 80%)" : c.subType === "red" ? "hsl(350 100% 75%)" : c.subType === "emerald" ? "hsl(150 100% 70%)" : c.subType === "azure" ? "hsl(200 100% 75%)" : "hsl(54 100% 75%)";
        particles.push({
          x: currentX + (Math.random() - 0.5) * 6 * SCALE,
          y: c.y + c.offsetY - 6 * SCALE,
          vx: (Math.random() - 0.5) * 12 * SCALE,
          vy: -15 * SCALE - Math.random() * 20 * SCALE,
          life: 0.18 + Math.random() * 0.12,
          max: 0.3,
          color: pColor,
          size: (1 + Math.random() * 1.8) * SCALE,
        });
      }

      if (c.kind !== "ladybug" && c.y + c.offsetY > H + 40 * SCALE && !c.dead) {
        c.dead = true;
        if (c.kind === "firefly") {
          const res = processFireflyMiss(missed, lives);
          missed = res.newMissed;
          lives = res.newLives;
          burst(currentX, H - 20 * SCALE, "hsl(0 100% 65%)", 16);
          addShake(shake, 12 * SCALE);
          addFloatingText(currentX, H - 40 * SCALE, "-1", res.lostLife ? "#ef4444" : "#fca5a5");
          if (lives <= 0) {
            finalTime = elapsed;
            state = "gameover";
            modalAnimTime = 0;
          }
        }
      }
    }

    for (const c of critters) {
      if (c.dead) continue;
      const x = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const y = c.y + c.offsetY;
      if (!hitCircleRect(x, y, c.r, jar.x, jar.y, jar.w, jar.h)) continue;
      c.dead = true;
      if (c.kind === "firefly") {
        let pts = 1;
        let pColor = "hsl(52 100% 75%)";
        addAnimeShockwave(x, y, c.subType === "purple" ? "rgba(216,180,254,0.95)" : c.subType === "red" ? "rgba(252,165,165,0.95)" : "rgba(254,240,138,0.95)");
        if (c.subType === "purple") {
          pts = 2;
          pColor = "hsl(280 100% 80%)";
          addFloatingText(x, y - 15 * SCALE, "+2", "#e879f9");
        } else if (c.subType === "red") {
          pColor = "hsl(350 100% 75%)";
          if (shouldBurnSpiderWeb(c.subType)) {
            for (const sp of critters) {
              if (sp.kind === "spider" && sp.webActive) {
                sp.webActive = false;
                const spX = sway(sp.t, sp.baseX, sp.amp, sp.freq) + sp.offsetX;
                const spY = sp.y + sp.offsetY;
                spawnFlameBurnEffect(jar.x + jar.w / 2, jar.y, spX, spY);
              }
            }
            burst(x, y, "hsl(15 100% 60%)", 24);
          }
          addFloatingText(x, y - 15 * SCALE, "+1", "#f87171");
        } else if (c.subType === "emerald") {
          magnetBoostTimer = 2.5;
          pColor = "hsl(150 100% 70%)";
          addFloatingText(x, y - 15 * SCALE, "+1", "#6ee7b7");
        } else if (c.subType === "azure") {
          speedBoostTimer = 1.2;
          pColor = "hsl(200 100% 75%)";
          addFloatingText(x, y - 15 * SCALE, "+1", "#7dd3fc");
        } else addFloatingText(x, y - 15 * SCALE, "+1", "#fef08a");

        caught = Math.min(caught + pts, levelCfg.target);
        syncJarFireflies();
        burst(x, y, pColor, 16);
        burst(x, y, "#ffffff", 5);
        jarSquash = 0.32;
        jarWobble = 0.15;
        if (caught === levelCfg.target) {
          finalTime = elapsed;
          state = currentLevel < LEVELS.length ? "levelcomplete" : "campaignwon";
          modalAnimTime = 0;
          burst(W / 2, H * 0.4, "hsl(52 100% 70%)", 70);
          burst(W / 2, H * 0.4, "hsl(180 100% 75%)", 50);
          burst(W / 2, H * 0.4, "hsl(150 100% 75%)", 30);
        }
      } else if (c.kind === "wasp") {
        const res = processWaspCollision(caught, lives);
        caught = res.newCaught;
        lives = res.newLives;
        syncJarFireflies();
        waspHitFlash = 0.42;
        addShake(shake, 18 * SCALE);
        addFloatingText(x, y - 15 * SCALE, "-1", res.lostLife ? "#ef4444" : "#f87171");
        if (lives <= 0) {
          finalTime = elapsed;
          state = "gameover";
          modalAnimTime = 0;
        }
      } else if (c.kind === "moth") {
        const res = processHazardCollision(lives);
        lives = res.newLives;
        blackoutTimer = 3.2;
        waspHitFlash = 0.5;
        addShake(shake, 16 * SCALE);
        addFloatingText(x, y - 15 * SCALE, "-1", "#94a3b8");
        if (lives <= 0) {
          finalTime = elapsed;
          state = "gameover";
          modalAnimTime = 0;
        }
      } else {
        const res = processHazardCollision(lives);
        lives = res.newLives;
        waspHitFlash = 0.5;
        addShake(shake, 22 * SCALE);
        addFloatingText(x, y - 15 * SCALE, "-1", "#ef4444");
        if (lives <= 0) {
          finalTime = elapsed;
          state = "gameover";
          modalAnimTime = 0;
        }
      }
    }
    critters = critters.filter((c) => !c.dead && (c.kind === "ladybug" || c.y + c.offsetY < H + 50 * SCALE));
  } else {
    modalAnimTime += dt;
  }

  for (const jf of jarFireflies) {
    jf.t += dt;
    jf.rx += jf.vx * dt;
    jf.ry += jf.vy * dt;
    if (jf.rx < -0.36 || jf.rx > 0.36) jf.vx *= -1;
    if (jf.ry < -0.36 || jf.ry > 0.36) jf.vy *= -1;
    jf.vx += (Math.random() - 0.5) * dt * 2;
    jf.vy += (Math.random() - 0.5) * dt * 2;
    jf.vx = Math.max(-0.5, Math.min(0.5, jf.vx));
    jf.vy = Math.max(-0.5, Math.min(0.5, jf.vy));
  }

  updateShake(shake, dt);
  jarSquash = Math.max(0, jarSquash - dt * 2.0);
  jarWobble = Math.max(0, jarWobble - dt * 1.5);
  waspHitFlash = Math.max(0, waspHitFlash - dt * 2.5);

  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const fp of flameParticles) {
    fp.life -= dt;
    fp.x += fp.vx * dt;
    fp.y += fp.vy * dt;
    fp.size = Math.max(0.5 * SCALE, fp.size - dt * 6 * SCALE);
  }
  flameParticles = flameParticles.filter((fp) => fp.life > 0);
  for (const sw of animeShockwaves) {
    sw.life -= dt;
    sw.r += dt * 240 * SCALE;
  }
  animeShockwaves = animeShockwaves.filter((sw) => sw.life > 0);
  for (const ss of shootingStars) {
    ss.life -= dt;
    ss.x += ss.speed * dt;
    ss.y += ss.speed * 0.45 * dt;
  }
  shootingStars = shootingStars.filter((ss) => ss.life > 0);
  for (const ft of floatingTexts) {
    ft.life -= dt;
    ft.y -= 45 * SCALE * dt;
  }
  floatingTexts = floatingTexts.filter((ft) => ft.life > 0);

  for (const list of [bokehFar, bokehNear]) {
    for (const s of list) {
      s.t += dt;
      s.y += s.vy * dt;
      s.x += s.vx * dt + Math.sin(s.t * 1.2) * 6 * SCALE * dt;
      if (s.y > H + 30 * SCALE) {
        s.y = -30 * SCALE;
        s.x = Math.random() * W;
      }
    }
  }
  for (const fg of volumetricFog) {
    fg.x += fg.speed * dt;
    if (fg.x > W + fg.w) {
      fg.x = -fg.w * 1.5;
      fg.y = H * 0.4 + Math.random() * H * 0.35;
    }
  }
}

// ============================================================================
// ÇİZİM — sinematik katmanlar
// ============================================================================
const SKY = {
  twilight: ["#0a1030", "#182a52", "#0b1631", "#040814"],
  emerald: ["#021710", "#07352a", "#04231a", "#010a07"],
  midnight: ["#050816", "#0c1633", "#070f22", "#020307"],
  azure: ["#031424", "#0a3050", "#052036", "#010b14"],
  storm: ["#12101f", "#252040", "#151228", "#08060f"],
  aurora: ["#031f24", "#0a4a48", "#04252c", "#010c0e"],
  bloodmoon: ["#1f0507", "#421015", "#240609", "#0d0103"],
  fog: ["#0a1218", "#16242e", "#0c161e", "#04080b"],
  starstorm: ["#190826", "#341050", "#1c082c", "#08020d"],
  legendary: ["#1a0a2a", "#3a1258", "#200a34", "#0a030f"],
};

function themeColors() {
  return SKY[levelCfg.skyTheme] || SKY.midnight;
}

function drawAurora() {
  if (levelCfg.skyTheme !== "aurora" && levelCfg.skyTheme !== "legendary") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hues = levelCfg.skyTheme === "aurora" ? [150, 180, 120] : [280, 320, 200];
  for (let band = 0; band < 3; band++) {
    const hue = hues[band];
    ctx.beginPath();
    const baseY = H * (0.12 + band * 0.07);
    ctx.moveTo(-50, baseY);
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * (W + 100) - 50;
      const y = baseY + Math.sin(i * 0.55 + auroraPhase * (1.2 + band * 0.3) + band * 2) * H * 0.045;
      ctx.lineTo(x, y);
    }
    for (let i = 24; i >= 0; i--) {
      const x = (i / 24) * (W + 100) - 50;
      const y = baseY + Math.sin(i * 0.55 + auroraPhase * (1.2 + band * 0.3) + band * 2) * H * 0.045 + H * (0.13 - band * 0.02);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, baseY, 0, baseY + H * 0.16);
    g.addColorStop(0, `hsl(${hue} 90% 60% / 0.10)`);
    g.addColorStop(0.5, `hsl(${hue} 90% 55% / 0.05)`);
    g.addColorStop(1, `hsl(${hue} 90% 50% / 0)`);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

function drawMoon() {
  const moonX = W * 0.82;
  const moonY = H * 0.16;
  const moonR = 40 * SCALE;
  const blood = levelCfg.skyTheme === "bloodmoon";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 4.2);
  if (blood) {
    halo.addColorStop(0, "rgba(255,110,100,0.4)");
    halo.addColorStop(0.4, "rgba(210,55,50,0.16)");
    halo.addColorStop(1, "rgba(200,0,0,0)");
  } else if (levelCfg.skyTheme === "emerald" || levelCfg.skyTheme === "aurora") {
    halo.addColorStop(0, "rgba(170,255,225,0.36)");
    halo.addColorStop(0.4, "rgba(110,225,185,0.15)");
    halo.addColorStop(1, "rgba(100,220,180,0)");
  } else {
    halo.addColorStop(0, "rgba(232,243,255,0.38)");
    halo.addColorStop(0.4, "rgba(185,218,255,0.14)");
    halo.addColorStop(1, "rgba(180,215,255,0)");
  }
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const mg = ctx.createRadialGradient(moonX - moonR * 0.45, moonY - moonR * 0.45, moonR * 0.1, moonX, moonY, moonR * 1.15);
  if (blood) {
    mg.addColorStop(0, "#ffb3a8");
    mg.addColorStop(0.55, "#e0524a");
    mg.addColorStop(1, "#7f1d1d");
  } else {
    mg.addColorStop(0, "#ffffff");
    mg.addColorStop(0.55, "#e6edf7");
    mg.addColorStop(1, "#aab8cf");
  }
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  const craters = [
    { dx: -0.28, dy: -0.18, r: 0.17 },
    { dx: 0.3, dy: 0.16, r: 0.22 },
    { dx: -0.1, dy: 0.38, r: 0.12 },
    { dx: 0.12, dy: -0.34, r: 0.09 },
    { dx: -0.45, dy: 0.22, r: 0.1 },
  ];
  for (const c of craters) {
    const cx = moonX + c.dx * moonR;
    const cy = moonY + c.dy * moonR;
    const cr = c.r * moonR;
    const cg = ctx.createRadialGradient(cx - cr * 0.35, cy - cr * 0.35, 0, cx, cy, cr);
    cg.addColorStop(0, blood ? "rgba(120,28,25,0.28)" : "rgba(120,138,165,0.32)");
    cg.addColorStop(0.8, blood ? "rgba(90,18,16,0.42)" : "rgba(95,112,140,0.42)");
    cg.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHillLayer(pts: { x: number; y: number }[], color: string, drift: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-60, H + 10);
  const dx = Math.sin(auroraPhase * 0.5) * drift;
  ctx.lineTo(pts[0].x - 60 + dx, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev.x + cur.x) / 2 + dx;
    ctx.quadraticCurveTo(prev.x + dx, prev.y, mx, (prev.y + cur.y) / 2);
  }
  ctx.lineTo(W + 60, pts[pts.length - 1].y);
  ctx.lineTo(W + 60, H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrees(color: string) {
  ctx.save();
  ctx.fillStyle = color;
  for (const t of treeSilhouettes) {
    const baseY = H - 8 * SCALE;
    const swayT = Math.sin(elapsed * 0.7 + t.x) * 0.012 + t.lean;
    ctx.save();
    ctx.translate(t.x, baseY);
    ctx.rotate(swayT);
    ctx.beginPath();
    ctx.moveTo(-t.h * 0.045, 0);
    ctx.quadraticCurveTo(-t.h * 0.02, -t.h * 0.5, -t.h * 0.012, -t.h * 0.72);
    ctx.lineTo(t.h * 0.012, -t.h * 0.72);
    ctx.quadraticCurveTo(t.h * 0.02, -t.h * 0.5, t.h * 0.045, 0);
    ctx.closePath();
    ctx.fill();
    for (const c of t.crowns) {
      ctx.beginPath();
      ctx.arc(c.dx, c.dy, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawGrassLayer(list: { x: number; height: number; swayOffset: number; width: number; bend: number }[], color: string, swayAmp: number) {
  ctx.fillStyle = color;
  for (const b of list) {
    const swayX = Math.sin(elapsed * 2 + b.swayOffset) * swayAmp + b.bend;
    ctx.beginPath();
    ctx.moveTo(b.x - b.width / 2, H);
    ctx.quadraticCurveTo(b.x, H - b.height * 0.6, b.x + swayX, H - b.height);
    ctx.quadraticCurveTo(b.x + b.width / 2, H - b.height * 0.6, b.x + b.width / 2, H);
    ctx.fill();
  }
}

function drawBackground() {
  const [c0, c1, c2, c3] = themeColors();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c0);
  g.addColorStop(0.4, c1);
  g.addColorStop(0.85, c2);
  g.addColorStop(1, c3);
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  for (const s of stars) {
    const alpha = s.a + Math.sin(elapsed * s.speed + s.x) * 0.15;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
    ctx.fillStyle = s.warm ? "#ffe9c4" : "#dce7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawAurora();
  drawMoon();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const ss of shootingStars) {
    const alpha = (ss.life / ss.maxLife) * ss.alpha;
    const starG = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.length, ss.y - ss.length * 0.45);
    starG.addColorStop(0, `rgba(255,255,255,${alpha})`);
    starG.addColorStop(0.4, `rgba(96,165,250,${alpha * 0.6})`);
    starG.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = starG;
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x - ss.length, ss.y - ss.length * 0.45);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bokehFar) {
    const a = b.alpha * (0.6 + 0.4 * Math.sin(b.t * 1.4));
    const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    bg.addColorStop(0, b.color.replace(")", " / " + Math.max(0, a).toFixed(3) + ")"));
    bg.addColorStop(1, b.color.replace(")", " / 0)"));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const hillFarC = levelCfg.skyTheme === "bloodmoon" ? "rgba(28,6,9,0.85)" : "rgba(4,10,18,0.75)";
  const hillNearC = levelCfg.skyTheme === "bloodmoon" ? "#160305" : "#030810";
  drawHillLayer(hillsFar, hillFarC, 6 * SCALE);
  drawHillLayer(hillsNear, hillNearC, 12 * SCALE);
  drawTrees(hillNearC);

  for (const fg2 of volumetricFog) {
    const fogG = ctx.createRadialGradient(fg2.x, fg2.y, 0, fg2.x, fg2.y, fg2.w / 2);
    fogG.addColorStop(0, `rgba(180,215,255,${fg2.alpha})`);
    fogG.addColorStop(0.6, `rgba(100,150,220,${fg2.alpha * 0.4})`);
    fogG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fogG;
    ctx.beginPath();
    ctx.ellipse(fg2.x, fg2.y, fg2.w / 2, fg2.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bokehNear) {
    const a = b.alpha * (0.6 + 0.4 * Math.sin(b.t * 2));
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  const soil = ctx.createLinearGradient(0, H - 80 * SCALE, 0, H);
  soil.addColorStop(0, "rgba(1,4,8,0)");
  soil.addColorStop(0.6, "rgba(1,4,8,0.55)");
  soil.addColorStop(1, "rgba(0,2,5,0.92)");
  ctx.fillStyle = soil;
  ctx.fillRect(0, H - 80 * SCALE, W, 80 * SCALE);

  drawGrassLayer(grassBack, "#04101a", 4 * SCALE);
}

function drawVignette() {
  const grade = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  grade.addColorStop(0, "rgba(38,66,130,0.13)");
  grade.addColorStop(1, "rgba(38,66,130,0)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, W, H * 0.5);

  const v = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.38, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.7, "rgba(1,2,8,0.28)");
  v.addColorStop(1, "rgba(1,2,8,0.62)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawSuctionBeams() {
  const jarMouthX = jar.x + jar.w / 2;
  const jarMouthY = jar.y - 12 * SCALE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const c of critters) {
    if (c.kind === "firefly" && c.beingPulled && !c.dead) {
      const cx = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const cy = c.y + c.offsetY;
      const beamColor = c.subType === "purple" ? "280 100% 80%" : c.subType === "red" ? "350 100% 75%" : c.subType === "emerald" ? "150 100% 75%" : c.subType === "azure" ? "200 100% 80%" : "52 100% 75%";
      const g = ctx.createLinearGradient(jarMouthX, jarMouthY, cx, cy);
      g.addColorStop(0, `hsl(${beamColor} / 0.7)`);
      g.addColorStop(0.6, `hsl(${beamColor} / 0.3)`);
      g.addColorStop(1, `hsl(${beamColor} / 0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 8 * SCALE;
      ctx.beginPath();
      ctx.moveTo(jarMouthX, jarMouthY);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const pulse = (elapsed * 5 + i * 0.33) % 1;
        const hx = jarMouthX + (cx - jarMouthX) * pulse;
        const hy = jarMouthY + (cy - jarMouthY) * pulse;
        const hr = (4 + pulse * 14) * SCALE;
        ctx.strokeStyle = `hsl(${beamColor} / ${0.7 - pulse * 0.5})`;
        ctx.lineWidth = (2 - pulse) * SCALE;
        ctx.beginPath();
        ctx.ellipse(hx, hy, hr, hr * 0.4, c.pullAngle || 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (c.kind === "spider" && c.webActive && !c.dead) {
      const spX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const spY = c.y + c.offsetY;
      const wd = Math.hypot(jarMouthX - spX, jarMouthY - spY);
      const wrange = 230 * SCALE;
      if (wd < wrange) {
        const wa = 1 - wd / wrange;
        ctx.strokeStyle = `rgba(232,121,249,${0.85 * wa})`;
        ctx.lineWidth = 2.5 * SCALE;
        ctx.beginPath();
        ctx.moveTo(spX, spY);
        ctx.lineTo(jarMouthX, jarMouthY);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * wa})`;
        ctx.lineWidth = 1 * SCALE;
        ctx.beginPath();
        ctx.moveTo(spX, spY);
        ctx.lineTo(jarMouthX, jarMouthY);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawFirefly(x: number, y: number, r: number, t: number, amp: number, freq: number, subType: FireflySubtype = "gold") {
  ctx.save();
  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);
  ctx.translate(x, y);
  ctx.rotate(-tilt * 0.35);

  let coreColor = "hsl(54 100% 88%)";
  let auraHue = "52 100% 82%";
  let outerHue = "50 100% 62%";
  let capHue = "32 95% 62%";
  if (subType === "purple") {
    coreColor = "hsl(280 100% 92%)";
    auraHue = "280 100% 84%";
    outerHue = "270 100% 66%";
    capHue = "300 75% 68%";
  } else if (subType === "red") {
    coreColor = "hsl(350 100% 90%)";
    auraHue = "350 100% 80%";
    outerHue = "340 100% 60%";
    capHue = "8 85% 62%";
  } else if (subType === "emerald") {
    coreColor = "hsl(154 100% 88%)";
    auraHue = "150 100% 80%";
    outerHue = "140 100% 60%";
    capHue = "150 70% 56%";
  } else if (subType === "azure") {
    coreColor = "hsl(198 100% 90%)";
    auraHue = "200 100% 84%";
    outerHue = "190 100% 64%";
    capHue = "200 80% 64%";
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.85 + 0.25 * Math.sin(t * 9);
  const auraR = r * 4.2 * pulse;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, auraR);
  g.addColorStop(0, `hsl(${auraHue} / 0.95)`);
  g.addColorStop(0.35, `hsl(${outerHue} / 0.4)`);
  g.addColorStop(0.75, `hsl(${outerHue} / 0.12)`);
  g.addColorStop(1, `hsl(${outerHue} / 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wingAngle = Math.sin(t * 34) * 0.42;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.28 + wingAngle));
    const wg = ctx.createLinearGradient(0, -r * 0.3, side * r * 1.7, r * 0.2);
    wg.addColorStop(0, "rgba(255,255,255,0.85)");
    wg.addColorStop(0.6, "rgba(230,245,255,0.55)");
    wg.addColorStop(1, "rgba(210,235,255,0.22)");
    ctx.fillStyle = wg;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 0.9 * SCALE;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.1);
    ctx.quadraticCurveTo(side * r * 0.65, -r * 0.85, side * r * 1.55, -r * 0.25);
    ctx.quadraticCurveTo(side * r * 1.55, r * 0.35, side * r * 0.75, r * 0.42);
    ctx.quadraticCurveTo(side * r * 0.3, r * 0.42, 0, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = "#0d0b09";
  ctx.lineWidth = 0.9 * SCALE;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.92);
  ctx.quadraticCurveTo(-r * 0.5, r * 1.35, -r * 0.6, r * 1.52);
  ctx.moveTo(r * 0.12, r * 0.92);
  ctx.quadraticCurveTo(r * 0.5, r * 1.35, r * 0.6, r * 1.52);
  ctx.stroke();
  ctx.fillStyle = `hsl(${capHue})`;
  ctx.beginPath();
  ctx.arc(-r * 0.6, r * 1.52, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.6, r * 1.52, r * 0.09, 0, Math.PI * 2);
  ctx.fill();

  const elytra = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
  elytra.addColorStop(0, "#0a0806");
  elytra.addColorStop(0.5, "#241d16");
  elytra.addColorStop(1, "#0a0806");
  ctx.fillStyle = elytra;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.02, r * 0.56, r * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.7 * SCALE;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.58);
  ctx.lineTo(0, -r * 0.88);
  ctx.stroke();

  ctx.fillStyle = `hsl(${capHue})`;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.74, r * 0.48, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, r * 0.66, r * 0.14, r * 0.09, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.74, r * 0.18, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lantern = ctx.createRadialGradient(0, -r * 0.62, 0, 0, -r * 0.62, r * 0.88);
  lantern.addColorStop(0, coreColor);
  lantern.addColorStop(0.55, `hsl(${auraHue} / 0.8)`);
  lantern.addColorStop(1, `hsl(${outerHue} / 0)`);
  ctx.fillStyle = lantern;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.6, r * 0.46, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.58, r * 0.17, r * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();

  const twinkle = 0.5 + 0.5 * Math.sin(t * 6.5);
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * twinkle})`;
  ctx.lineWidth = 0.7 * SCALE;
  ctx.beginPath();
  ctx.moveTo(r * 0.32, -r * 0.95);
  ctx.lineTo(r * 0.44, -r * 0.95);
  ctx.moveTo(r * 0.38, -r * 1.01);
  ctx.lineTo(r * 0.38, -r * 0.89);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawWasp(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();
  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);
  ctx.translate(x, y);
  ctx.rotate(-tilt * 0.45);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hazardGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
  hazardGlow.addColorStop(0, "rgba(255,140,30,0.22)");
  hazardGlow.addColorStop(0.6, "rgba(255,90,20,0.08)");
  hazardGlow.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = hazardGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (let ghost = 2; ghost >= 0; ghost--) {
    const gFlap = Math.sin(t * 52 - ghost * 0.9);
    const alpha = ghost === 0 ? 0.5 : 0.14;
    ctx.fillStyle = `rgba(215,235,255,${alpha})`;
    ctx.strokeStyle = `rgba(255,255,255,${ghost === 0 ? 0.55 : 0.12})`;
    ctx.lineWidth = 0.8 * SCALE;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * r * 0.3, -r * 0.1);
      ctx.rotate(side * (0.9 + gFlap * 0.55));
      ctx.beginPath();
      ctx.ellipse(side * r * 0.85, -r * 0.15, r * 1.05, r * 0.34, side * 0.25, 0, Math.PI * 2);
      ctx.fill();
      if (ghost === 0) ctx.stroke();
      ctx.restore();
    }
  }

  ctx.strokeStyle = "#171310";
  ctx.lineWidth = 1.1 * SCALE;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.3, r * 0.1);
    ctx.quadraticCurveTo(side * r * 0.75, r * 0.05, side * r * 1.0, -r * 0.35);
    ctx.moveTo(side * r * 0.32, r * 0.28);
    ctx.quadraticCurveTo(side * r * 0.8, r * 0.3, side * r * 1.08, -r * 0.05);
    ctx.moveTo(side * r * 0.3, r * 0.45);
    ctx.quadraticCurveTo(side * r * 0.72, r * 0.62, side * r * 0.95, r * 0.35);
    ctx.stroke();
  }

  ctx.fillStyle = "#0c0a08";
  ctx.beginPath();
  ctx.moveTo(-r * 0.09, -r * 1.52);
  ctx.lineTo(r * 0.09, -r * 1.52);
  ctx.lineTo(0, -r * 1.95);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.55);
  ctx.bezierCurveTo(-r * 0.55, -r * 1.35, -r * 0.62, -r * 0.72, -r * 0.3, -r * 0.18);
  ctx.quadraticCurveTo(0, -r * 0.02, r * 0.3, -r * 0.18);
  ctx.bezierCurveTo(r * 0.62, -r * 0.72, r * 0.55, -r * 1.35, 0, -r * 1.55);
  ctx.closePath();
  const abdomenG = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
  abdomenG.addColorStop(0, "#b8860b");
  abdomenG.addColorStop(0.45, "#fbbf24");
  abdomenG.addColorStop(0.55, "#fcd34d");
  abdomenG.addColorStop(1, "#92600a");
  ctx.fillStyle = abdomenG;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#181310";
  for (const sy of [-1.38, -0.98, -0.58]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, sy * r);
    ctx.quadraticCurveTo(0, sy * r + r * 0.16, r * 0.7, sy * r);
    ctx.lineTo(r * 0.7, sy * r + r * 0.22);
    ctx.quadraticCurveTo(0, sy * r + r * 0.38, -r * 0.7, sy * r + r * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.95, r * 0.14, r * 0.5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const thoraxG = ctx.createRadialGradient(-r * 0.15, r * 0.08, 0, 0, r * 0.18, r * 0.62);
  thoraxG.addColorStop(0, "#3a2f24");
  thoraxG.addColorStop(0.7, "#1c1611");
  thoraxG.addColorStop(1, "#0e0b08");
  ctx.fillStyle = thoraxG;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.2, r * 0.48, r * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#151009";
  ctx.beginPath();
  ctx.arc(0, r * 0.82, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    const eyeG = ctx.createLinearGradient(side * r * 0.1, r * 0.6, side * r * 0.4, r * 1.0);
    eyeG.addColorStop(0, "#4a1508");
    eyeG.addColorStop(0.5, "#7a2410");
    eyeG.addColorStop(1, "#300d05");
    ctx.fillStyle = eyeG;
    ctx.beginPath();
    ctx.ellipse(side * r * 0.24, r * 0.8, r * 0.13, r * 0.24, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,220,180,0.55)";
    ctx.beginPath();
    ctx.arc(side * r * 0.2, r * 0.72, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#0c0a08";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 1.05);
  ctx.quadraticCurveTo(-r * 0.35, r * 1.35, -r * 0.62, r * 1.42);
  ctx.moveTo(r * 0.1, r * 1.05);
  ctx.quadraticCurveTo(r * 0.35, r * 1.35, r * 0.62, r * 1.42);
  ctx.stroke();

  ctx.restore();
}

function drawSpider(
  x: number,
  y: number,
  r: number,
  t: number,
  webActive = false,
) {
  ctx.save();
  ctx.translate(x, y);

  // 1. DANGEROUS RED AURA
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const auraR = r * 3.4;
  const auraG = ctx.createRadialGradient(0, 0, 0, 0, 0, auraR);
  if (webActive) {
    auraG.addColorStop(0, "rgba(239, 68, 68, 0.6)");
    auraG.addColorStop(0.4, "rgba(185, 28, 28, 0.28)");
    auraG.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else {
    auraG.addColorStop(0, "rgba(220, 38, 38, 0.28)");
    auraG.addColorStop(0.5, "rgba(127, 29, 29, 0.12)");
    auraG.addColorStop(1, "rgba(0, 0, 0, 0)");
  }
  ctx.fillStyle = auraG;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body Micro-Animations
  const crawlSpeed = 8;
  const bodyBob = Math.sin(t * crawlSpeed) * (1.2 * SCALE);
  const bodyTilt = Math.sin(t * (crawlSpeed * 0.5)) * 0.05;
  const abdomenPacing = Math.sin(t * 3) * 0.04;

  ctx.translate(0, bodyBob);
  ctx.rotate(bodyTilt);

  // 2. PERFECTLY SYMMETRIC 8 LEGS (Purple with Black Borders)
  const legDefs = [
    { angle: -1.25, femurLen: 1.1, tibiaLen: 1.25, jointY: -r * 0.45, phase: 0 },
    { angle: -0.55, femurLen: 1.2, tibiaLen: 1.3, jointY: -r * 0.2, phase: Math.PI * 0.5 },
    { angle: 0.45, femurLen: 1.2, tibiaLen: 1.3, jointY: r * 0.05, phase: Math.PI },
    { angle: 1.15, femurLen: 1.3, tibiaLen: 1.35, jointY: r * 0.3, phase: Math.PI * 1.5 },
  ];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const side of [1, -1]) {
    for (let i = 0; i < legDefs.length; i++) {
      const leg = legDefs[i];
      const sidePhase = side === 1 ? leg.phase : leg.phase + Math.PI;
      const swing = Math.sin(t * crawlSpeed + sidePhase) * 0.12;
      const flex = Math.cos(t * crawlSpeed + sidePhase) * 0.08;

      const rootX = side * (r * 0.35);
      const rootY = leg.jointY;

      // Symmetric angle calculation
      const effAngle = leg.angle + swing;
      let baseA = effAngle;
      let kneeX = 0;
      let kneeY = 0;
      let tipX = 0;
      let tipY = 0;

      if (side === 1) {
        kneeX = rootX + Math.cos(baseA) * (r * leg.femurLen);
        kneeY = rootY + Math.sin(baseA) * (r * leg.femurLen) - Math.abs(swing) * 2 * SCALE;
        tipX = kneeX + Math.cos(baseA + 0.5) * (r * leg.tibiaLen);
        tipY = kneeY + Math.sin(baseA + 0.5) * (r * leg.tibiaLen) + flex * 2 * SCALE;
      } else {
        baseA = Math.PI - effAngle;
        kneeX = rootX + Math.cos(baseA) * (r * leg.femurLen);
        kneeY = rootY + Math.sin(baseA) * (r * leg.femurLen) - Math.abs(swing) * 2 * SCALE;
        tipX = kneeX + Math.cos(baseA - 0.5) * (r * leg.tibiaLen);
        tipY = kneeY + Math.sin(baseA - 0.5) * (r * leg.tibiaLen) + flex * 2 * SCALE;
      }

      // Outer Black Border Stroke
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3.6 * SCALE;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Inner Purple Chitin Fill Stroke
      ctx.strokeStyle = webActive ? "#e879f9" : "#a855f7";
      ctx.lineWidth = 2.0 * SCALE;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Knee Joint Accent Bulb
      ctx.fillStyle = "#6b21a8";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1 * SCALE;
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 2 * SCALE, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 3. ABDOMEN (Deep Purple & Black Velvet Chitin with Black Borders)
  ctx.save();
  ctx.translate(0, r * 0.45);
  ctx.rotate(abdomenPacing);

  const abG = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 1.25);
  abG.addColorStop(0, "#c084fc");
  abG.addColorStop(0.3, "#9333ea");
  abG.addColorStop(0.65, "#581c87");
  abG.addColorStop(1, "#140727");

  ctx.fillStyle = abG;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2 * SCALE;

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 1.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Purple Chevron Patterns across Abdomen
  ctx.strokeStyle = webActive ? "rgba(239, 68, 68, 0.6)" : "rgba(216, 180, 254, 0.5)";
  ctx.lineWidth = 1.6 * SCALE;
  for (let k = 0; k < 3; k++) {
    const sy = -r * 0.4 + k * (r * 0.35);
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, sy);
    ctx.quadraticCurveTo(0, sy - r * 0.2, r * 0.45, sy);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.25, r * 0.45, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 4. CEPHALOTHORAX (Black / Obsidian Head as requested)
  const cephG = ctx.createRadialGradient(-r * 0.15, -r * 0.5, r * 0.05, 0, -r * 0.45, r * 0.65);
  cephG.addColorStop(0, "#3f3f46");
  cephG.addColorStop(0.55, "#18181b");
  cephG.addColorStop(1, "#09090b");

  ctx.fillStyle = cephG;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.8 * SCALE;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.45, r * 0.58, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 5. PEDIPALPS (Black & Purple Feelers)
  const palpTwitch = Math.sin(t * 12) * 0.12;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2.4 * SCALE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (r * 0.2), -r * 0.75);
    ctx.quadraticCurveTo(
      side * (r * 0.45),
      -r * 1.05 + palpTwitch * 2 * SCALE,
      side * (r * 0.25),
      -r * 1.2 + side * palpTwitch * 3 * SCALE
    );
    ctx.stroke();
  }

  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 1.2 * SCALE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (r * 0.2), -r * 0.75);
    ctx.quadraticCurveTo(
      side * (r * 0.45),
      -r * 1.05 + palpTwitch * 2 * SCALE,
      side * (r * 0.25),
      -r * 1.2 + side * palpTwitch * 3 * SCALE
    );
    ctx.stroke();
  }

  // 6. FANGS (Black & Crimson Tips)
  ctx.fillStyle = "#18181b";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.ellipse(-r * 0.14, -r * 0.85, r * 0.12, r * 0.2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(r * 0.14, -r * 0.85, r * 0.12, r * 0.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.95);
  ctx.quadraticCurveTo(-r * 0.12, -r * 1.15, -r * 0.04, -r * 0.92);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.12, -r * 1.15, r * 0.04, -r * 0.92);
  ctx.fill();

  // 7. GLOWING RED SPIDER EYE CLUSTER (8 eyes with white reflection pinpoints)
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.62, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.18, -r * 0.62, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f87171";
  ctx.beginPath();
  ctx.arc(-r * 0.34, -r * 0.58, r * 0.075, 0, Math.PI * 2);
  ctx.arc(r * 0.34, -r * 0.58, r * 0.075, 0, Math.PI * 2);
  ctx.arc(-r * 0.1, -r * 0.48, r * 0.07, 0, Math.PI * 2);
  ctx.arc(r * 0.1, -r * 0.48, r * 0.07, 0, Math.PI * 2);
  ctx.arc(-r * 0.28, -r * 0.46, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.46, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.65, r * 0.035, 0, Math.PI * 2);
  ctx.arc(r * 0.16, -r * 0.65, r * 0.035, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLadybug(x: number, y: number, r: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.8);
  g.addColorStop(0, "rgba(244,63,94,0.45)");
  g.addColorStop(0.5, "rgba(225,29,72,0.2)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wingFlutter = Math.sin(t * 36) * 0.45;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1 * SCALE;
  ctx.save();
  ctx.rotate(-0.45 - wingFlutter);
  ctx.beginPath();
  ctx.ellipse(-r * 1.0, 0, r * 1.25, r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.rotate(0.45 + wingFlutter);
  ctx.beginPath();
  ctx.ellipse(r * 1.0, 0, r * 1.25, r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const shellG = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.2);
  shellG.addColorStop(0, "#fb7185");
  shellG.addColorStop(0.4, "#e11d48");
  shellG.addColorStop(1, "#881337");
  ctx.fillStyle = shellG;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.88, r * 0.98, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.8 * SCALE;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, r * 1.05);
  ctx.stroke();

  const spots = [
    { x: -r * 0.42, y: -r * 0.25, sr: r * 0.19 },
    { x: r * 0.42, y: -r * 0.25, sr: r * 0.19 },
    { x: -r * 0.44, y: r * 0.35, sr: r * 0.18 },
    { x: r * 0.44, y: r * 0.35, sr: r * 0.18 },
    { x: 0, y: r * 0.1, sr: r * 0.22 },
  ];
  for (const sp of spots) {
    ctx.fillStyle = "rgba(244,63,94,0.4)";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.sr * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(sp.x - sp.sr * 0.25, sp.y - sp.sr * 0.25, sp.sr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, -r * 0.72, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.82, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.16, -r * 0.82, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.6 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.95);
  ctx.quadraticCurveTo(-r * 0.4, -r * 1.3, -r * 0.6, -r * 1.4);
  ctx.moveTo(r * 0.15, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.4, -r * 1.3, r * 0.6, -r * 1.4);
  ctx.stroke();
  ctx.restore();
}

function drawMoth(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();
  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);
  ctx.translate(x, y);
  ctx.rotate(-tilt * 0.5);

  const flicker = Math.sin(t * 5.5) * Math.sin(t * 1.7) * 0.5 + 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const auraR = r * 2.9 * Math.max(0.55, flicker);
  const fg = ctx.createRadialGradient(0, -r * 0.5, 0, 0, -r * 0.5, auraR);
  fg.addColorStop(0, `rgba(240,238,232,${0.2 + 0.35 * flicker})`);
  fg.addColorStop(1, "rgba(203,196,214,0)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(0, -r * 0.5, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const flap = Math.sin(t * 20) * 0.5;
  const wingG = ctx.createLinearGradient(-r * 1.6, 0, r * 1.6, 0);
  wingG.addColorStop(0, "#ded6e6");
  wingG.addColorStop(0.5, "#9686a3");
  wingG.addColorStop(1, "#ded6e6");
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.15, -r * 0.1);
    ctx.rotate(side * (0.55 + flap * 0.3));
    ctx.fillStyle = wingG;
    ctx.strokeStyle = "rgba(255,250,245,0.65)";
    ctx.lineWidth = 1.1 * SCALE;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * r * 1.1, -r * 0.6, side * r * 1.7, -r * 0.1);
    ctx.quadraticCurveTo(side * r * 1.2, r * 0.35, side * r * 0.3, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#241c2c";
    ctx.beginPath();
    ctx.arc(side * r * 0.9, -r * 0.2, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8ab4f";
    ctx.beginPath();
    ctx.arc(side * r * 0.9, -r * 0.2, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1420";
    ctx.beginPath();
    ctx.arc(side * r * 0.9, -r * 0.2, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const bodyG = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.8);
  bodyG.addColorStop(0, "#8a7d94");
  bodyG.addColorStop(1, "#332b3e");
  ctx.fillStyle = bodyG;
  ctx.strokeStyle = "rgba(255,250,245,0.4)";
  ctx.lineWidth = 0.8 * SCALE;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.32, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#332b3e";
  ctx.beginPath();
  ctx.arc(0, r * 0.78, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#332b3e";
  ctx.lineWidth = 0.9 * SCALE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.08, r * 0.95);
    ctx.quadraticCurveTo(side * r * 0.3, r * 1.2, side * r * 0.45, r * 1.35);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const kt = k / 3;
      const bx = side * (r * 0.08 + kt * r * 0.37);
      const by = r * 0.95 + kt * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * r * 0.1, by - r * 0.06);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function jarBodyPath(w2: number, h2: number, inset = 0) {
  const hw = w2 / 2 - inset;
  const nk = w2 * 0.41 - inset;
  const topY = -h2 + inset;
  const shoulderY = -h2 * 0.58;
  const br = Math.min(14 * SCALE, hw * 0.35);
  ctx.beginPath();
  ctx.moveTo(-nk, topY);
  ctx.quadraticCurveTo(-hw, topY, -hw, shoulderY);
  ctx.lineTo(-hw, -br - inset);
  ctx.quadraticCurveTo(-hw, -inset, -hw + br, -inset);
  ctx.lineTo(hw - br, -inset);
  ctx.quadraticCurveTo(hw, -inset, hw, -br - inset);
  ctx.lineTo(hw, shoulderY);
  ctx.quadraticCurveTo(hw, topY, nk, topY);
  ctx.closePath();
}

function drawArtisticCorkStopper(neckW: number, neckY: number) {
  const corkW = neckW * 0.74;
  const corkH = 10 * SCALE;
  const corkY = neckY - 7 * SCALE;

  ctx.save();
  ctx.fillStyle = "rgba(10, 6, 2, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, corkY + corkH, corkW * 0.48, 2.5 * SCALE, 0, 0, Math.PI * 2);
  ctx.fill();

  const corkG = ctx.createLinearGradient(-corkW / 2, 0, corkW / 2, 0);
  corkG.addColorStop(0, "#633c1d");
  corkG.addColorStop(0.25, "#8e572d");
  corkG.addColorStop(0.5, "#b57b48");
  corkG.addColorStop(0.75, "#965f33");
  corkG.addColorStop(1, "#543015");

  ctx.fillStyle = corkG;
  ctx.strokeStyle = "rgba(60, 32, 14, 0.6)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.roundRect(-corkW / 2, corkY, corkW, corkH, 3 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 235, 205, 0.28)";
  ctx.beginPath();
  ctx.roundRect(
    -corkW / 2 + 1.5 * SCALE,
    corkY + 1 * SCALE,
    corkW - 3 * SCALE,
    2.5 * SCALE,
    1.5 * SCALE,
  );
  ctx.fill();

  ctx.restore();
}

// ULTRA-HIGH END SANATSAL KLASİK CAM KAVANOZ & YUMUŞAK AZURE RÜZGAR HARLESİ (SPEED BREEZE FX)
function drawJar() {
  const w2 = jar.w;
  const h2 = jar.h;
  const glow = caught / levelCfg.target;

  ctx.save();

  if (speedBoostTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const breezeAlpha = Math.min(1, speedBoostTimer / 1.2) * 0.35;
    const breezeR = w2 * 0.75;
    const breezeG = ctx.createRadialGradient(0, -h2 * 0.5, 0, 0, -h2 * 0.5, breezeR);
    breezeG.addColorStop(0, `rgba(125,211,252,${breezeAlpha})`);
    breezeG.addColorStop(0.6, `rgba(56,189,248,${breezeAlpha * 0.4})`);
    breezeG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = breezeG;
    ctx.beginPath();
    ctx.arc(0, -h2 * 0.5, breezeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulseGlow = 0.85 + 0.15 * Math.sin(elapsed * 3.5);
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

  if (waspHitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,50,30,${waspHitFlash * 0.75})`;
    jarBodyPath(w2, h2, -6 * SCALE);
    ctx.fill();
    ctx.restore();
  }

  const glassVolumeGrad = ctx.createLinearGradient(-w2 / 2, 0, w2 / 2, 0);
  glassVolumeGrad.addColorStop(0, "rgba(8,18,35,0.65)");
  glassVolumeGrad.addColorStop(0.3, "rgba(12,28,50,0.35)");
  glassVolumeGrad.addColorStop(0.7, "rgba(12,28,50,0.35)");
  glassVolumeGrad.addColorStop(1, "rgba(8,18,35,0.65)");
  ctx.fillStyle = glassVolumeGrad;
  jarBodyPath(w2, h2);
  ctx.fill();

  const backWall = ctx.createLinearGradient(0, -h2, 0, 0);
  backWall.addColorStop(0, "rgba(120,170,220,0.10)");
  backWall.addColorStop(0.5, "rgba(60,100,150,0.05)");
  backWall.addColorStop(1, "rgba(20,40,70,0.14)");
  ctx.fillStyle = backWall;
  jarBodyPath(w2, h2, 4 * SCALE);
  ctx.fill();

  ctx.fillStyle = "rgba(6,14,28,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, -2 * SCALE, w2 / 2 - 3 * SCALE, 7 * SCALE, 0, 0, Math.PI);
  ctx.fill();

  const neckW = w2 * 0.82;
  const neckY = -h2;
  drawArtisticCorkStopper(neckW, neckY);

  if (glow > 0) {
    ctx.save();
    jarBodyPath(w2, h2, 3 * SCALE);
    ctx.clip();
    const liquidH = h2 * 0.72 * glow;
    const liquidY = -liquidH;
    const wave1 = Math.sin(elapsed * 4.5 + jar.x * 0.02) * 4.5 * SCALE;
    const wave2 = Math.cos(elapsed * 6.5 + jar.x * 0.03) * 2.8 * SCALE;
    ctx.fillStyle = `hsl(45 100% 55% / ${0.2 + glow * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(-w2 / 2 - 10 * SCALE, 0);
    ctx.lineTo(-w2 / 2 - 10 * SCALE, liquidY + wave2);
    ctx.quadraticCurveTo(0, liquidY - wave2, w2 / 2 + 10 * SCALE, liquidY + wave2);
    ctx.lineTo(w2 / 2 + 10 * SCALE, 0);
    ctx.closePath();
    ctx.fill();

    const liqG = ctx.createLinearGradient(0, liquidY, 0, 0);
    liqG.addColorStop(0, `hsl(54 100% 78% / ${0.35 + glow * 0.45})`);
    liqG.addColorStop(1, `hsl(48 100% 62% / ${0.2 + glow * 0.35})`);
    ctx.fillStyle = liqG;
    ctx.beginPath();
    ctx.moveTo(-w2 / 2 - 10 * SCALE, 0);
    ctx.lineTo(-w2 / 2 - 10 * SCALE, liquidY + wave1);
    ctx.quadraticCurveTo(0, liquidY - wave1, w2 / 2 + 10 * SCALE, liquidY + wave1);
    ctx.lineTo(w2 / 2 + 10 * SCALE, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${0.4 + glow * 0.4})`;
    ctx.lineWidth = 1.8 * SCALE;
    ctx.beginPath();
    ctx.moveTo(-w2 / 2 + 4 * SCALE, liquidY + wave1);
    ctx.quadraticCurveTo(0, liquidY - wave1, w2 / 2 - 4 * SCALE, liquidY + wave1);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  jarBodyPath(w2, h2, 6 * SCALE);
  ctx.clip();
  for (const jf of jarFireflies) {
    const fx = jf.rx * (w2 * 0.33);
    const fy = -h2 * 0.32 + jf.ry * (h2 * 0.18);
    const pulse = 0.8 + 0.2 * Math.sin(jf.t * 8);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14 * SCALE * pulse);
    g.addColorStop(0, jf.color || "hsl(54 100% 85% / 0.9)");
    g.addColorStop(0.4, "hsl(50 100% 65% / 0.4)");
    g.addColorStop(1, "hsl(50 100% 60% / 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, 14 * SCALE * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(215,240,255,0.85)";
  ctx.lineWidth = 2.6 * SCALE;
  ctx.fillStyle = "rgba(180,225,255,0.07)";
  jarBodyPath(w2, h2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  jarBodyPath(w2, h2, 2 * SCALE);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  const streakA = 0.10 + 0.04 * Math.sin(elapsed * 1.8);
  ctx.fillStyle = `rgba(220,240,255,${streakA})`;
  ctx.save();
  ctx.rotate(-0.28);
  ctx.fillRect(-w2 * 0.42, -h2 * 1.35, w2 * 0.13, h2 * 1.8);
  ctx.fillRect(-w2 * 0.2, -h2 * 1.35, w2 * 0.05, h2 * 1.8);
  ctx.restore();
  ctx.restore();

  const highlightAlpha = 0.38 + 0.15 * Math.sin(elapsed * 2.5);
  ctx.strokeStyle = `rgba(255,255,255,${highlightAlpha})`;
  ctx.lineWidth = 3.5 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-w2 / 2 + 6 * SCALE, -h2 + 16 * SCALE);
  ctx.lineTo(-w2 / 2 + 6 * SCALE, -16 * SCALE);
  ctx.stroke();

  ctx.strokeStyle = "rgba(210,232,255,0.5)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.moveTo(w2 / 2 - 5 * SCALE, -h2 + 18 * SCALE);
  ctx.lineTo(w2 / 2 - 5 * SCALE, -20 * SCALE);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.arc(w2 / 2 - 12 * SCALE, -h2 + 12 * SCALE, 8 * SCALE, -Math.PI * 0.4, 0);
  ctx.stroke();

  ctx.restore();
}

function drawJarShadow() {
  const cx = jar.x + jar.w / 2;
  const groundY = H - 10 * SCALE;
  const height = Math.max(0, groundY - (jar.y + jar.h));
  const k = Math.min(1, height / (H * 0.5));
  const alpha = 0.38 * (1 - k * 0.8);
  const rx = jar.w * (0.42 + k * 0.35);
  if (alpha <= 0.02) return;
  const g = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, rx, rx * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- HUD ----------------------------------------------------------------------
function hudPanel(x: number, y: number, pw: number, ph: number, radius: number) {
  const pg = ctx.createLinearGradient(x, y, x, y + ph);
  pg.addColorStop(0, "rgba(22,32,58,0.82)");
  pg.addColorStop(1, "rgba(8,13,26,0.88)");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 12 * SCALE;
  ctx.shadowOffsetY = 4 * SCALE;
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, radius);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, radius);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(x + radius, y + 1.5 * SCALE);
  ctx.lineTo(x + pw - radius, y + 1.5 * SCALE);
  ctx.stroke();
}

function drawHUD() {
  ctx.save();
  const lvlW = 90 * SCALE;
  const lvlH = 46 * SCALE;
  const lvlX = 16 * SCALE;
  const lvlY = 16 * SCALE;
  hudPanel(lvlX, lvlY, lvlW, lvlH, 23 * SCALE);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#93c5fd";
  ctx.font = `900 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4 * SCALE;
  ctx.fillText(`${currentLevel}/${LEVELS.length}`, lvlX + lvlW / 2, lvlY + lvlH / 2 + 1 * SCALE);
  ctx.shadowBlur = 0;

  const hudCenterW = 200 * SCALE;
  const hudCenterX = (W - hudCenterW) / 2;
  const hudCenterY = 16 * SCALE;
  hudPanel(hudCenterX, hudCenterY, hudCenterW, lvlH, 23 * SCALE);
  drawCrystalHeartIcon(hudCenterX + 22 * SCALE, hudCenterY + lvlH / 2, 10 * SCALE, true);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${18 * SCALE}px 'Outfit', sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4 * SCALE;
  ctx.fillText(`${lives}`, hudCenterX + 40 * SCALE, hudCenterY + lvlH / 2 + 1 * SCALE);
  ctx.shadowBlur = 0;
  const missStartX = hudCenterX + 110 * SCALE;
  for (let i = 0; i < 3; i++) {
    drawHUDMissedFireflyIcon(missStartX + i * 24 * SCALE, hudCenterY + lvlH / 2, 6 * SCALE, !(i < missed));
  }

  const btnSize = 46 * SCALE;
  const setX = W - btnSize - 16 * SCALE;
  const setY = 16 * SCALE;
  uiButtons.settings = { x: setX, y: setY, w: btnSize, h: btnSize };
  hudPanel(setX, setY, btnSize, btnSize, 14 * SCALE);
  drawGearIcon(setX + btnSize / 2, setY + btnSize / 2, 11 * SCALE, "#94a3b8");

  const timerW = Math.min(W * 0.18, 95 * SCALE);
  const timerX = setX - timerW - 10 * SCALE;
  const timerY = 16 * SCALE;
  hudPanel(timerX, timerY, timerW, btnSize, 23 * SCALE);
  drawClockIcon(timerX + 18 * SCALE, timerY + btnSize / 2, 8 * SCALE, "#60a5fa");
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#93c5fd";
  ctx.font = `900 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4 * SCALE;
  ctx.fillText(`${elapsed.toFixed(1)}s`, timerX + 32 * SCALE, timerY + btnSize / 2 + 1 * SCALE);
  ctx.shadowBlur = 0;

  const pbW = 220 * SCALE;
  const pbH = 7 * SCALE;
  const pbX = (W - pbW) / 2;
  const pbY = hudCenterY + lvlH + 10 * SCALE;
  ctx.fillStyle = "rgba(8,13,26,0.7)";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.roundRect(pbX, pbY, pbW, pbH, pbH / 2);
  ctx.fill();
  ctx.stroke();
  const prog = caught / levelCfg.target;
  if (prog > 0) {
    const pg2 = ctx.createLinearGradient(pbX, 0, pbX + pbW, 0);
    pg2.addColorStop(0, "#f59e0b");
    pg2.addColorStop(1, "#fef08a");
    ctx.save();
    ctx.shadowColor = "rgba(250,204,21,0.8)";
    ctx.shadowBlur = 10 * SCALE;
    ctx.fillStyle = pg2;
    ctx.beginPath();
    ctx.roundRect(pbX, pbY, Math.max(pbH, pbW * prog), pbH, pbH / 2);
    ctx.fill();
    ctx.restore();

    const tipX = pbX + Math.max(pbH, pbW * prog);
    const tipY = pbY + pbH / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const tip = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 9 * SCALE);
    tip.addColorStop(0, "rgba(255,251,235,0.95)");
    tip.addColorStop(1, "rgba(250,204,21,0)");
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 9 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(254,240,138,0.85)";
  ctx.font = `700 ${11 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${caught} / ${levelCfg.target}`, W / 2, pbY + pbH + 12 * SCALE);
  ctx.restore();
}

// --- Modallar -------------------------------------------------------------------
function modalBase(borderColor: string, wide = false) {
  ctx.fillStyle = "rgba(2,4,12,0.82)";
  ctx.fillRect(0, 0, W, H);

  const p = Math.min(1, modalAnimTime / 0.32);
  const ease = 1 - Math.pow(1 - p, 3);
  ctx.globalAlpha = ease;
  ctx.translate(0, (1 - ease) * 26 * SCALE);
  const cardW = wide ? Math.min(W * 0.96, 940 * SCALE) : Math.min(W * 0.94, 680 * SCALE);
  const cardH = wide ? Math.min(H * 0.94, 720 * SCALE) : Math.min(H * 0.9, 540 * SCALE);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(W / 2, cardY + cardH / 2, cardW * 0.2, W / 2, cardY + cardH / 2, cardW * 0.75);
  halo.addColorStop(0, borderColor.replace(/[\d.]+\)$/, "0.10)"));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cardX - cardW * 0.3, cardY - cardH * 0.3, cardW * 1.6, cardH * 1.6);
  ctx.restore();
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, "rgba(17,26,48,0.97)");
  cardGrad.addColorStop(0.5, "rgba(12,18,36,0.98)");
  cardGrad.addColorStop(1, "rgba(8,12,24,0.99)");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40 * SCALE;
  ctx.shadowOffsetY = 14 * SCALE;
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.6 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(cardX + 30 * SCALE, cardY + 2 * SCALE);
  ctx.lineTo(cardX + cardW - 30 * SCALE, cardY + 2 * SCALE);
  ctx.stroke();
  return { cardX, cardY, cardW, cardH };
}

function modalBadge(text: string, badgeYAbs: number, color: string, bg: string, border: string) {
  ctx.font = `900 ${12 * SCALE}px 'Outfit', sans-serif`;
  const badgeW = Math.max(200 * SCALE, ctx.measureText(text).width + 56 * SCALE);
  const badgeH = 30 * SCALE;
  const badgeX = (W - badgeW) / 2;
  const badgeY = badgeYAbs;
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, badgeY + badgeH / 2 + 1 * SCALE);
}

function primaryButton(text: string, btnY: number, cardW: number, colors: [string, string], btnH = 50 * SCALE) {
  const btnW = Math.min(cardW - 80 * SCALE, 340 * SCALE);
  const btnX = (W - btnW) / 2;
  const radius = btnH / 2;
  uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };
  const bpulse = 1 + Math.sin(modalAnimTime * 3.2) * 0.04;
  ctx.save();
  ctx.shadowColor = colors[0];
  ctx.shadowBlur = 24 * SCALE * bpulse;
  const g = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, radius);
  ctx.clip();
  const sheen = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH * 0.55);
  sheen.addColorStop(0, "rgba(255,255,255,0.26)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(btnX, btnY, btnW, btnH * 0.55);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(17 * SCALE, btnH * 0.36)}px 'Outfit', sans-serif`;
  ctx.fillText(text, W / 2, btnY + btnH / 2 + 1 * SCALE);
}

function drawLevelIntroModal() {
  ctx.save();
  const { cardX, cardY, cardW, cardH } = modalBase("rgba(250,204,21,0.35)");
  const titleY = cardY + 44 * SCALE;
  const titleFont = Math.min(cardW * 0.075, 34 * SCALE);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.save();
  ctx.shadowColor = "rgba(250,204,21,0.85)";
  ctx.shadowBlur = (18 + Math.sin(modalAnimTime * 2.5) * 6) * SCALE;
  const tg = ctx.createLinearGradient(0, titleY, 0, titleY + titleFont);
  tg.addColorStop(0, "#fffbeb");
  tg.addColorStop(0.55, "#fde68a");
  tg.addColorStop(1, "#f59e0b");
  ctx.fillStyle = tg;
  ctx.font = `900 ${titleFont}px 'Outfit', sans-serif`;
  ctx.fillText("ATEŞBÖCEKLERİ", W / 2, titleY);
  ctx.restore();

  drawFirefly(cardX + 44 * SCALE + Math.sin(modalAnimTime * 1.3) * 6 * SCALE, titleY + titleFont * 0.5 + Math.cos(modalAnimTime * 1.7) * 5 * SCALE, 5 * SCALE, modalAnimTime + 2, 0, 0, "gold");
  drawFirefly(cardX + cardW - 44 * SCALE + Math.cos(modalAnimTime * 1.1) * 6 * SCALE, titleY + titleFont * 0.5 + Math.sin(modalAnimTime * 1.5) * 5 * SCALE, 4.5 * SCALE, modalAnimTime, 0, 0, "emerald");

  const badgeY = titleY + titleFont + 22 * SCALE;
  modalBadge(`BÖLÜM ${levelCfg.level} / ${LEVELS.length} • ${levelCfg.subtitle.toLocaleUpperCase("tr")}`, badgeY, "#fde68a", "rgba(250,204,21,0.12)", "rgba(250,204,21,0.35)");

  const nameY = badgeY + 30 * SCALE + 26 * SCALE;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.min(cardW * 0.05, 23 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(levelCfg.name, W / 2, nameY);
  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 ${14 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`Hedef: ${levelCfg.target} Ateşböceği • 3 Can`, W / 2, nameY + 32 * SCALE);

  const descY = nameY + 70 * SCALE;
  const descH = 64 * SCALE;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.roundRect(cardX + 32 * SCALE, descY, cardW - 64 * SCALE, descH, 16 * SCALE);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `500 ${14 * SCALE}px 'Outfit', sans-serif`;
  drawWrappedText(ctx, levelCfg.description, W / 2, descY + descH / 2 - 4 * SCALE, cardW - 88 * SCALE, 20 * SCALE);

  const btnY = cardY + cardH - 74 * SCALE;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(148,163,184,0.75)";
  ctx.font = `500 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("← → ok tuşları • WASD • dokun & sürükle", W / 2, btnY - 22 * SCALE);
  primaryButton("BAŞLA", btnY, cardW, ["#f59e0b", "#d97706"]);
  ctx.restore();
}

function drawLevelSelectModal() {
  ctx.save();
  const { cardX, cardY, cardW, cardH } = modalBase("rgba(96,165,250,0.45)", true);
  modalBadge("BÖLÜM SEÇİMİ", cardY + 22 * SCALE, "#60a5fa", "rgba(96,165,250,0.15)", "rgba(96,165,250,0.4)");
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.04, 24 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(`${LEVELS.length} EFSANEVİ DURAK`, W / 2, cardY + 58 * SCALE);
  ctx.fillStyle = "rgba(148,163,184,0.8)";
  ctx.font = `500 ${12.5 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("Bir durağın üzerine gel, açıklamasını gör", W / 2, cardY + 88 * SCALE);

  const mapX = cardX + 56 * SCALE;
  const mapY = cardY + 124 * SCALE;
  const mapW = cardW - 112 * SCALE;
  const mapH = cardH - 214 * SCALE;
  const cols = 5;
  const rows = Math.ceil(LEVELS.length / cols);
  const colGap = mapW / (cols - 1);
  const rowGap = rows > 1 ? mapH / (rows - 1) : 0;

  const nodePositions = LEVELS.map((lvl, i) => {
    const row = Math.floor(i / cols);
    let col = i % cols;
    if (row % 2 === 1) col = cols - 1 - col;
    const wob = Math.sin(i * 1.7) * rowGap * 0.15;
    return { level: lvl.level, x: mapX + col * colGap, y: mapY + row * rowGap + wob };
  });

  ctx.save();
  ctx.strokeStyle = "rgba(250,204,21,0.32)";
  ctx.lineWidth = 3 * SCALE;
  ctx.setLineDash([1 * SCALE, 11 * SCALE]);
  ctx.lineCap = "round";
  ctx.beginPath();
  nodePositions.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else {
      const prev = nodePositions[i - 1];
      ctx.quadraticCurveTo(prev.x, p.y, p.x, p.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  levelGridButtons.length = 0;
  let hoveredData: { lvl: LevelConfig; p: { level: number; x: number; y: number }; r: number } | null = null;
  for (let i = 0; i < nodePositions.length; i++) {
    const p = nodePositions[i];
    const lvl = LEVELS[i];
    const milestone = lvl.level % 5 === 0;
    const r = (milestone ? 23 : 17) * SCALE;
    levelGridButtons.push({ level: lvl.level, x: p.x, y: p.y, r });
    const isCurrent = lvl.level === currentLevel;
    const isHovered = hoveredLevel === lvl.level;
    if (isHovered) hoveredData = { lvl, p, r };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glowColor = isCurrent ? "253,224,71" : isHovered ? "224,231,255" : milestone ? "196,155,255" : "96,165,250";
    const glowA = isCurrent ? 0.6 : isHovered ? 0.45 : 0.2;
    const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    gg.addColorStop(0, `rgba(${glowColor},${glowA})`);
    gg.addColorStop(1, `rgba(${glowColor},0)`);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const bodyG = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
    if (isCurrent) {
      bodyG.addColorStop(0, "#fef9c3");
      bodyG.addColorStop(1, "#eab308");
    } else if (milestone) {
      bodyG.addColorStop(0, "#4c1d95");
      bodyG.addColorStop(1, "#1e1b4b");
    } else {
      bodyG.addColorStop(0, "#1e293b");
      bodyG.addColorStop(1, "#0b1220");
    }
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = isCurrent ? "#fde68a" : isHovered ? "#bfdbfe" : milestone ? "rgba(196,155,255,0.6)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = (isCurrent || isHovered ? 2.4 : 1.4) * SCALE;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isCurrent ? "#78350f" : "#e2e8f0";
    ctx.font = `900 ${r * 0.8}px 'Outfit', sans-serif`;
    ctx.fillText(`${lvl.level}`, p.x, p.y + 1 * SCALE);
  }

  if (hoveredData) {
    const { lvl, p, r } = hoveredData;
    ctx.font = `800 ${13 * SCALE}px 'Outfit', sans-serif`;
    const nameW = ctx.measureText(lvl.name).width;
    const tipW = Math.min(mapW * 0.6, Math.max(180 * SCALE, nameW + 40 * SCALE));
    const tipH = 64 * SCALE;
    let tipX = p.x - tipW / 2;
    tipX = Math.max(cardX + 14 * SCALE, Math.min(cardX + cardW - tipW - 14 * SCALE, tipX));
    const above = p.y - r - tipH - 14 * SCALE > cardY + 96 * SCALE;
    const tipY = above ? p.y - r - tipH - 10 * SCALE : p.y + r + 10 * SCALE;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 16 * SCALE;
    const tg = ctx.createLinearGradient(tipX, tipY, tipX, tipY + tipH);
    tg.addColorStop(0, "rgba(30,41,59,0.98)");
    tg.addColorStop(1, "rgba(15,23,42,0.98)");
    ctx.fillStyle = tg;
    ctx.strokeStyle = "rgba(96,165,250,0.5)";
    ctx.lineWidth = 1.4 * SCALE;
    ctx.beginPath();
    ctx.roundRect(tipX, tipY, tipW, tipH, 14 * SCALE);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(15,23,42,0.98)";
    ctx.beginPath();
    if (above) {
      ctx.moveTo(p.x - 7 * SCALE, tipY + tipH);
      ctx.lineTo(p.x + 7 * SCALE, tipY + tipH);
      ctx.lineTo(p.x, tipY + tipH + 8 * SCALE);
    } else {
      ctx.moveTo(p.x - 7 * SCALE, tipY);
      ctx.lineTo(p.x + 7 * SCALE, tipY);
      ctx.lineTo(p.x, tipY - 8 * SCALE);
    }
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fde68a";
    ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(`${lvl.level}. ${lvl.name}`, tipX + tipW / 2, tipY + 10 * SCALE);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `500 ${11.5 * SCALE}px 'Outfit', sans-serif`;
    drawWrappedText(ctx, lvl.description, tipX + tipW / 2, tipY + 30 * SCALE, tipW - 24 * SCALE, 15 * SCALE);
  }

  primaryButton("GERİ DÖN", cardY + cardH - 66 * SCALE, cardW, ["#334155", "#1e293b"]);
  ctx.restore();
}

function drawModalCard(statusBadge: string, title: string, primaryBtnText: string, isWin: boolean) {
  ctx.save();
  const border = isWin ? "rgba(250,204,21,0.45)" : "rgba(239,68,68,0.45)";
  const { cardX, cardY, cardW, cardH } = modalBase(border);

  const heroJarX = cardX + 54 * SCALE;
  const heroJarY = cardY + 70 * SCALE;
  ctx.save();
  ctx.translate(heroJarX, heroJarY);
  ctx.scale(0.55, 0.55);
  drawJar();
  ctx.restore();

  drawFirefly(cardX + cardW - 60 * SCALE, cardY + 55 * SCALE, 9 * SCALE, elapsed, 0, 0, "purple");
  if (!isWin) drawSpider(cardX + cardW - 110 * SCALE, cardY + 80 * SCALE, 12 * SCALE, elapsed, true);
  else drawLadybug(cardX + cardW - 115 * SCALE, cardY + 80 * SCALE, 10 * SCALE, elapsed);

  modalBadge(
    statusBadge,
    cardY + 22 * SCALE,
    isWin ? "#fef08a" : "#fca5a5",
    isWin ? "rgba(250,204,21,0.15)" : "rgba(239,68,68,0.15)",
    isWin ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.5)",
  );

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.055, 28 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(title, W / 2, cardY + 70 * SCALE);

  const gridW = cardW - 64 * SCALE;
  const gridX = cardX + 32 * SCALE;
  const gridY = cardY + 128 * SCALE;
  const gridH = 150 * SCALE;
  const colW = (gridW - 24 * SCALE) / 3;

  const stats = isWin
    ? [
        { label: "BÖLÜM HEDEFİ", targetVal: caught, total: levelCfg.target, unit: "Tamamlandı", color: "#fef08a", type: "ratio" },
        { label: "BÖLÜM SÜRESİ", targetVal: finalTime, total: 0, unit: "Saniye", color: "#60a5fa", type: "time" },
        { label: "KALAN CAN", targetVal: lives, total: 3, unit: "Can Hakkı", color: "#f43f5e", type: "ratio" },
      ]
    : [
        { label: "TOPLANAN IŞIK", targetVal: caught, total: levelCfg.target, unit: "Ateşböceği", color: "#fef08a", type: "ratio" },
        { label: "GEÇEN SÜRE", targetVal: finalTime, total: 0, unit: "Saniye", color: "#60a5fa", type: "time" },
        { label: "KALAN CAN", targetVal: 0, total: 3, unit: "Tükendi", color: "#f87171", type: "ratio" },
      ];

  for (let i = 0; i < 3; i++) {
    const cx = gridX + i * (colW + 12 * SCALE);
    const s = stats[i];
    const cardDelay = i * 0.2;
    const cardProgress = Math.max(0, Math.min(1, (modalAnimTime - cardDelay) / 0.35));
    const cardScale = 0.7 + 0.3 * Math.sin((cardProgress * Math.PI) / 2);
    ctx.save();
    ctx.globalAlpha = cardProgress;
    ctx.fillStyle = "rgba(30,41,59,0.6)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.2 * SCALE;
    ctx.beginPath();
    ctx.roundRect(cx, gridY, colW, gridH, 18 * SCALE);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 ${11 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(s.label, cx + colW / 2, gridY + 20 * SCALE);
    let displayVal = "";
    if (s.type === "ratio") displayVal = `${Math.round(s.targetVal * cardProgress)}/${s.total}`;
    else displayVal = `${(s.targetVal * cardProgress).toFixed(1)}s`;
    ctx.fillStyle = s.color;
    ctx.font = `900 ${28 * SCALE * cardScale}px 'Outfit', sans-serif`;
    ctx.fillText(displayVal, cx + colW / 2, gridY + 48 * SCALE);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `600 ${12 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(s.unit, cx + colW / 2, gridY + 98 * SCALE);
    ctx.restore();
  }

  const descY = gridY + gridH + 20 * SCALE;
  const descText = isWin
    ? `${levelCfg.name} tamamlandı! ${currentLevel < LEVELS.length ? "Sonraki seviyeye geçmeye hazırsın." : "Tüm " + LEVELS.length + " bölümü başardın!"}`
    : "Tüm canların tükendi. Tekrar deneyerek bu bölümü geç!";
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.roundRect(gridX, descY, gridW, 44 * SCALE, 12 * SCALE);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${14 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(descText, W / 2, descY + 22 * SCALE);

  primaryButton(primaryBtnText, cardY + cardH - 74 * SCALE, cardW, isWin ? ["#10b981", "#059669"] : ["#dc2626", "#b91c1c"]);
  ctx.restore();
}

function drawTutorialModal() {
  ctx.save();
  const { cardX, cardY, cardW, cardH } = modalBase("rgba(96,165,250,0.45)", true);
  modalBadge("OYUN REHBERİ", cardY + 22 * SCALE, "#60a5fa", "rgba(96,165,250,0.15)", "rgba(96,165,250,0.4)");
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.05, 24 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("CAN & ÖZEL BÖCEK MEKANİĞİ", W / 2, cardY + 62 * SCALE);

  const gridW = cardW - 56 * SCALE;
  const gridX = cardX + 28 * SCALE;
  const gridY = cardY + 106 * SCALE;
  const colW = (gridW - 20 * SCALE) / 2;
  const rules = [
    { drawIcon: (x: number, y: number) => drawSpider(x, y, 10 * SCALE, elapsed, true), title: "AVCI ÖRÜMCEK (-1 CAN)", desc: "Örümcek veya Uğur böceği çarptığında direkt 1 can eksilir!" },
    { drawIcon: (x: number, y: number) => drawMoth(x, y, 10 * SCALE, elapsed, 0, 0), title: "SAHTE IŞIK GÜVE (-1 + KARARTMA)", desc: "Can götürür ve kavanozun çekim gücünü bir süreliğine söndürür!" },
    { drawIcon: (x: number, y: number) => drawWasp(x, y, 9 * SCALE, elapsed, 0, 0), title: "TEHLİKELİ ARI (-1)", desc: "Ateşböceğin varsa -1 eksiltir, 0 ateşböceğinde ise 1 can götürür!" },
    { drawIcon: (x: number, y: number) => drawFirefly(x, y, 8 * SCALE, elapsed, 0, 0, "red"), title: "KIZIL YAKUT (AĞ KIRAN)", desc: "Sadece Kızıl Yakut ateşböceği örümceğin ipek ağını anında yakar!" },
    { drawIcon: (x: number, y: number) => drawFirefly(x, y, 8 * SCALE, elapsed, 0, 0, "purple"), title: "MOR MİSTİK (+2 IŞIK)", desc: "Çok nadirdir ve tek yakalayışta kavanoza tam +2 ışık kazandırır." },
  ];
  const ruleRows = Math.ceil(rules.length / 2);
  const rowH = (cardH - 200 * SCALE - (ruleRows - 1) * 16 * SCALE) / ruleRows;
  for (let i = 0; i < rules.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const isLastLone = i === rules.length - 1 && rules.length % 2 === 1;
    const cx = isLastLone ? gridX + (gridW - colW) / 2 : gridX + col * (colW + 20 * SCALE);
    const cy = gridY + row * (rowH + 16 * SCALE);
    const r = rules[i];
    const cardProgress = Math.max(0, Math.min(1, (modalAnimTime - i * 0.15) / 0.3));
    ctx.save();
    ctx.globalAlpha = cardProgress;
    ctx.fillStyle = "rgba(30,41,59,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.2 * SCALE;
    ctx.beginPath();
    ctx.roundRect(cx, cy, colW, rowH, 18 * SCALE);
    ctx.fill();
    ctx.stroke();
    r.drawIcon(cx + 30 * SCALE, cy + 30 * SCALE);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fef08a";
    ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(r.title, cx + 56 * SCALE, cy + 22 * SCALE);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 ${12 * SCALE}px 'Outfit', sans-serif`;
    ctx.textAlign = "center";
    drawWrappedText(ctx, r.desc, cx + colW / 2, cy + 60 * SCALE, colW - 40 * SCALE, 17 * SCALE);
    ctx.restore();
  }
  primaryButton("GERİ DÖN", cardY + cardH - 70 * SCALE, cardW, ["#2563eb", "#1d4ed8"]);
  ctx.restore();
}

function drawSettingsModal() {
  ctx.save();
  const { cardX, cardY, cardW, cardH } = modalBase("rgba(255,255,255,0.18)");
  modalBadge("SİSTEM MENÜSÜ", cardY + 22 * SCALE, "#94a3b8", "rgba(255,255,255,0.1)", "rgba(255,255,255,0.25)");
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.05, 24 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(`AYARLAR • BÖLÜM ${currentLevel}/${LEVELS.length}`, W / 2, cardY + 56 * SCALE);

  const rowW = cardW - 64 * SCALE;
  const rowX = cardX + 32 * SCALE;
  const row1Y = cardY + 96 * SCALE;
  const rowH = 56 * SCALE;

  function settingRow(y: number, title: string, desc: string, btnRect: { x: number; y: number; w: number; h: number }, onColor: string, onText: string) {
    ctx.fillStyle = "rgba(30,41,59,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.2 * SCALE;
    ctx.beginPath();
    ctx.roundRect(rowX, y, rowW, rowH, 18 * SCALE);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${13.5 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(title, rowX + 20 * SCALE, y + 11 * SCALE);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 ${11.5 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(desc, rowX + 20 * SCALE, y + 31 * SCALE);
    const tW = 96 * SCALE;
    const tH = 30 * SCALE;
    const tX = rowX + rowW - tW - 14 * SCALE;
    const tY = y + (rowH - tH) / 2;
    btnRect.x = tX;
    btnRect.y = tY;
    btnRect.w = tW;
    btnRect.h = tH;
    ctx.fillStyle = onColor;
    ctx.beginPath();
    ctx.roundRect(tX, tY, tW, tH, 15 * SCALE);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${11.5 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(onText, tX + tW / 2, tY + tH / 2);
  }
  settingRow(row1Y, "SES EFEKTLERİ", "Oyun içi ses ve çarpışma efektlerini yönet", uiButtons.toggleSound, soundEnabled ? "#10b981" : "#334155", soundEnabled ? "AÇIK" : "KAPALI");
  const row2Y = row1Y + rowH + 10 * SCALE;
  settingRow(row2Y, "VAKUM ÇEKİM HASSASİYETİ", "Mıknatıs çekim alanının yarıçapını ayarla", uiButtons.toggleMagnet, highMagnet ? "#06b6d4" : "#334155", highMagnet ? "YÜKSEK" : "NORMAL");

  const row3Y = row2Y + rowH + 12 * SCALE;
  const btnTutH = 44 * SCALE;
  uiButtons.modalTutorialBtn = { x: rowX, y: row3Y, w: rowW, h: btnTutH };
  ctx.fillStyle = "rgba(147,51,234,0.2)";
  ctx.strokeStyle = "rgba(192,132,252,0.6)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(rowX, row3Y, rowW, btnTutH, 18 * SCALE);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e879f9";
  ctx.font = `900 ${13.5 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("OYUN REHBERİ & BÖCEK KARTLARI", rowX + rowW / 2, row3Y + btnTutH / 2 + 1 * SCALE);

  const btnLvlW = Math.min(cardW - 80 * SCALE, 360 * SCALE);
  const btnLvlH = 40 * SCALE;
  const btnLvlX = (W - btnLvlW) / 2;
  const btnLvlY = row3Y + btnTutH + 12 * SCALE;
  uiButtons.modalLevelSelect = { x: btnLvlX, y: btnLvlY, w: btnLvlW, h: btnLvlH };
  ctx.fillStyle = "rgba(59,130,246,0.2)";
  ctx.strokeStyle = "rgba(96,165,250,0.6)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnLvlX, btnLvlY, btnLvlW, btnLvlH, 20 * SCALE);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#93c5fd";
  ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("BÖLÜM SEÇİM TABLOSU", W / 2, btnLvlY + btnLvlH / 2 + 1 * SCALE);

  const btnW = Math.min(cardW - 80 * SCALE, 340 * SCALE);
  const btnH = 44 * SCALE;
  const btnX = (W - btnW) / 2;
  const btn1Y = cardY + cardH - 110 * SCALE;
  primaryButton("DEVAM ET", btn1Y, cardW, ["#2563eb", "#1d4ed8"], btnH);

  const btn2Y = cardY + cardH - 58 * SCALE;
  uiButtons.modalSecondary = { x: btnX, y: btn2Y, w: btnW, h: btnH };
  ctx.fillStyle = "rgba(239,68,68,0.15)";
  ctx.strokeStyle = "rgba(239,68,68,0.5)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnX, btn2Y, btnW, btnH, 22 * SCALE);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(btnX + 22 * SCALE, btn2Y + 1.5 * SCALE);
  ctx.lineTo(btnX + btnW - 22 * SCALE, btn2Y + 1.5 * SCALE);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fca5a5";
  ctx.font = `800 ${13.5 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("BAŞTAN BAŞLA (BÖLÜM 1)", W / 2, btn2Y + btnH / 2 + 1 * SCALE);
  ctx.restore();
}

// --- Ana çizim ------------------------------------------------------------------
function draw() {
  const { x: sx, y: sy } = shakeOffset(shake);
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();

  if (state === "playing") drawSuctionBeams();

  for (const c of critters) {
    const x = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
    const y = c.y + c.offsetY;
    if (c.kind === "firefly") drawFirefly(x, y, c.r, c.t, c.amp, c.freq, c.subType);
    else if (c.kind === "spider") drawSpider(x, y, c.r, c.t, c.webActive);
    else if (c.kind === "ladybug") drawLadybug(x, y, c.r, c.t);
    else if (c.kind === "moth") drawMoth(x, y, c.r, c.t, c.amp, c.freq);
    else drawWasp(x, y, c.r, c.t, c.amp, c.freq);
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fp of flameParticles) {
    ctx.globalAlpha = fp.life / fp.max;
    ctx.fillStyle = fp.color;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, fp.size, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const sw2 of animeShockwaves) {
    const alpha = sw2.life / sw2.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = sw2.color;
    ctx.lineWidth = (3 - alpha * 2) * SCALE;
    ctx.beginPath();
    ctx.arc(sw2.x, sw2.y, sw2.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  for (const ft of floatingTexts) {
    ctx.save();
    const p = 1 - ft.life / ft.max;
    const pop = p < 0.22 ? 1 + (1 - p / 0.22) * 0.45 : 1;
    ctx.globalAlpha = Math.min(1, (ft.life / ft.max) * 1.6);
    ctx.translate(ft.x, ft.y);
    ctx.scale(pop, pop);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 5 * SCALE;
    ctx.fillStyle = ft.color;
    ctx.font = `900 ${22 * SCALE}px 'Outfit', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
  }

  drawJarShadow();
  {
    const glow = caught / levelCfg.target;
    if (glow > 0.02) {
      const gx = jar.x + jar.w / 2;
      const gy = H - 8 * SCALE;
      const gr = jar.w * (0.9 + glow * 1.1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const spill = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      spill.addColorStop(0, `hsl(48 100% 65% / ${0.22 * glow})`);
      spill.addColorStop(0.6, `hsl(45 100% 55% / ${0.08 * glow})`);
      spill.addColorStop(1, "hsl(45 100% 50% / 0)");
      ctx.fillStyle = spill;
      ctx.beginPath();
      ctx.ellipse(gx, gy, gr, gr * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(jar.x + jar.w / 2, jar.y + jar.h);
  ctx.rotate(jarTilt + Math.sin(elapsed * 18) * jarWobble);
  ctx.scale(1 + jarSquash, 1 - jarSquash);
  drawJar();
  ctx.restore();

  drawGrassLayer(grassFront, "#07121c", 6 * SCALE);
  if (blackoutTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(8,10,18,${Math.min(0.4, blackoutTimer * 0.13)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  drawVignette();

  if (state === "playing") drawHUD();
  ctx.restore();

  if (state === "levelintro") drawLevelIntroModal();
  else if (state === "levelselect") drawLevelSelectModal();
  else if (state === "levelcomplete") drawModalCard(`BÖLÜM ${currentLevel} TAMAMLANDI`, `${levelCfg.name} Geçildi!`, `SONRAKİ BÖLÜM (${currentLevel + 1})`, true);
  else if (state === "campaignwon") drawModalCard("EFSANEVİ ŞAMPİYON", "TÜM BÖLÜMLER BİTTİ", "YENİDEN BAŞLA (Bölüm 1)", true);
  else if (state === "gameover") drawModalCard(`BÖLÜM ${currentLevel} BAŞARISIZ`, "TÜM CANLAR TÜKENDİ", "TEKRAR DENE", false);
  else if (state === "tutorial") drawTutorialModal();
  else if (state === "settings") drawSettingsModal();
}

let last = performance.now();
function frame(now: number) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
