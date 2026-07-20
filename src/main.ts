// ATEŞBÖCEKLERİ — Gerçekçi 3D Cam Fanus Boynu & Dribbble Karakter Sanatı
// Özellikler: Fiziksel Doğru Cam Fanus Boynu, Kıvrımlı Dudak (Glass Lip), Mantar Tıpa & Kusursuz Geometri.

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
  shakeOffset,
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
let SCALE = Math.min(W, H) / 600;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- Oyun Durumu & Tipler ---------------------------------------------------
const MAX_MISSED = 3;

type GameState = "playing" | "paused" | "tutorial" | "settings" | "levelselect" | "levelcomplete" | "gameover" | "campaignwon";
type CritterKind = "firefly" | "wasp" | "spider" | "ladybug";

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
let state: GameState = "playing";

let critters: Critter[] = [];
let particles: Particle[] = [];
let floatingTexts: FloatingText[] = [];
let jarFireflies: JarFirefly[] = [];
let caught = 0;
let missed = 0;
let elapsed = 0;
let finalTime = 0;
let modalAnimTime = 0;
let magnetBoostTimer = 0;
let speedBoostTimer = 0;

let nextCritterId = 1;
let spawnTimer: SpawnTimer = createSpawnTimer();
const shake: Shake = { power: 0, t: 0 };

// Ayarlar
let soundEnabled = true;
let highMagnet = false;

// Yuvarlak Fanus Fizik & Kovalama Değişkenleri
let jarSquash = 0;
let jarWobble = 0;
let jarTilt = 0;
let jarVx = 0;
let jarVy = 0;
let waspHitFlash = 0;

const jar = { x: 0, y: 0, w: 0, h: 0 };

// Atmosferik Ögeler
let stars: { x: number; y: number; r: number; a: number; speed: number }[] = [];
let bokehOrbs: { x: number; y: number; r: number; vy: number; vx: number; alpha: number; t: number; color: string }[] = [];
let clouds: { x: number; y: number; w: number; h: number; speed: number; alpha: number }[] = [];
let grassBlades: { x: number; height: number; swayOffset: number; width: number; bend: number }[] = [];

// UI Yerleşimleri
const uiButtons = {
  help: { x: 0, y: 0, w: 0, h: 0 },
  settings: { x: 0, y: 0, w: 0, h: 0 },
  modalAction: { x: 0, y: 0, w: 0, h: 0 },
  modalSecondary: { x: 0, y: 0, w: 0, h: 0 },
  modalLevelSelect: { x: 0, y: 0, w: 0, h: 0 },
  toggleSound: { x: 0, y: 0, w: 0, h: 0 },
  toggleMagnet: { x: 0, y: 0, w: 0, h: 0 },
};

const levelGridButtons: { level: number; x: number; y: number; w: number; h: number }[] = [];

function layout() {
  SCALE = Math.min(W, H) / 600;
  jar.w = 110 * SCALE;
  jar.h = 110 * SCALE;
  jar.y = Math.max(H * 0.15, Math.min(H - jar.h - 32 * SCALE, jar.y || H - jar.h - 32 * SCALE));
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x || (W - jar.w) / 2));

  stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.85,
    r: (0.6 + Math.random() * 1.5) * SCALE,
    a: 0.15 + Math.random() * 0.45,
    speed: 0.8 + Math.random() * 2,
  }));

  const colors = ["hsl(52 100% 70%)", "hsl(160 100% 65%)", "hsl(200 100% 70%)", "hsl(280 100% 75%)", "hsl(350 100% 70%)"];
  bokehOrbs = Array.from({ length: 24 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: (4 + Math.random() * 10) * SCALE,
    vy: (8 + Math.random() * 16) * SCALE,
    vx: (Math.random() - 0.5) * 12 * SCALE,
    alpha: 0.08 + Math.random() * 0.22,
    t: Math.random() * 10,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  clouds = Array.from({ length: 4 }, (_, i) => ({
    x: (i * W) / 3 - 50 * SCALE,
    y: (40 + Math.random() * 60) * SCALE,
    w: (180 + Math.random() * 120) * SCALE,
    h: (45 + Math.random() * 25) * SCALE,
    speed: (4 + Math.random() * 6) * SCALE,
    alpha: 0.12 + Math.random() * 0.12,
  }));

  const grassCount = Math.floor(W / (10 * SCALE));
  grassBlades = Array.from({ length: grassCount }, (_, i) => ({
    x: i * (10 * SCALE) + Math.random() * 3 * SCALE,
    height: (34 + Math.random() * 30) * SCALE,
    swayOffset: Math.random() * Math.PI * 2,
    width: (4 + Math.random() * 3) * SCALE,
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
    canvas.width = W;
    canvas.height = H;
    layout();
    jar.x = relX * W - jar.w / 2;
    jar.y = relY * H - jar.h / 2;
    jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
    jar.y = Math.max(H * 0.15, Math.min(H - jar.h - 20 * SCALE, jar.y));
  },
  on,
);

function resetStage(levelNum = currentLevel) {
  currentLevel = Math.max(1, Math.min(LEVELS.length, levelNum));
  levelCfg = getLevelConfig(currentLevel);
  critters = [];
  particles = [];
  floatingTexts = [];
  jarFireflies = [];
  caught = 0;
  missed = 0;
  elapsed = 0;
  modalAnimTime = 0;
  magnetBoostTimer = 0;
  speedBoostTimer = 0;
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
  state = "playing";
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
  const isHazard = Math.random() < levelCfg.waspChance;

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
      baseX: amp + 25 * SCALE + Math.random() * (W - 2 * (amp + 25 * SCALE)),
      y: -35 * SCALE,
      offsetX: 0,
      offsetY: 0,
      t: Math.random() * 10,
      amp,
      freq: subType === "red" ? 1.1 + Math.random() * 0.5 : 0.65 + Math.random() * 0.75,
      r: subType === "purple" ? 12 * SCALE : 10 * SCALE,
      pullAngle: Math.random() * Math.PI * 2,
    });
  } else {
    const allowed = levelCfg.allowedHazards;
    const activeLadybugs = critters.filter((c) => c.kind === "ladybug" && !c.dead).length;
    const canSpawnLadybug = allowed.includes("ladybug") && activeLadybugs < levelCfg.maxLadybugs;

    let kind: CritterKind = "wasp";
    if (canSpawnLadybug && Math.random() < 0.45) {
      kind = "ladybug";
    } else if (allowed.includes("spider") && Math.random() < 0.4) {
      kind = "spider";
    }

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

// --- Girdi Yönetimi ---------------------------------------------------------
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

function isInsideRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function handlePointerClick(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const cx = ((clientX - rect.left) / rect.width) * W;
  const cy = ((clientY - rect.top) / rect.height) * H;

  if (state === "playing") {
    if (isInsideRect(cx, cy, uiButtons.help)) {
      state = "tutorial";
      modalAnimTime = 0;
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.settings)) {
      state = "settings";
      modalAnimTime = 0;
      return true;
    }
  } else if (state === "tutorial") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      state = "playing";
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
      if (isInsideRect(cx, cy, b)) {
        resetStage(b.level);
        return true;
      }
    }
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
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
    if (state === "playing") {
      setPointerTarget(e.clientX, e.clientY);
    }
  },
  on,
);

window.addEventListener(
  "pointermove",
  (e) => {
    if (pointerTarget !== null && state === "playing") {
      setPointerTarget(e.clientX, e.clientY);
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
      if (state === "playing") {
        setPointerTarget(t.clientX, t.clientY);
      }
    }
    e.preventDefault();
  },
  { passive: false, signal: aborter.signal },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0 && state === "playing") {
      setPointerTarget(e.touches[0].clientX, e.touches[0].clientY);
    }
    e.preventDefault();
  },
  { passive: false, signal: aborter.signal },
);

window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") {
      if (state === "levelcomplete") resetStage(currentLevel + 1);
      else if (state === "gameover" || state === "campaignwon") resetStage(state === "campaignwon" ? 1 : currentLevel);
    }
    if (e.key === "Escape") {
      if (state === "playing") {
        state = "settings";
        modalAnimTime = 0;
      } else if (state === "settings" || state === "tutorial" || state === "levelselect") {
        state = "playing";
      }
    }
  },
  on,
);

function updateJar(dt: number) {
  const speedMult = speedBoostTimer > 0 ? 1.35 : 1.0;
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

    jarVx = diffX * 14;
    jarVy = diffY * 14;
  } else {
    jarVx += (targetVx - jarVx) * Math.min(1, dt * 22);
    jarVy += (targetVy - jarVy) * Math.min(1, dt * 22);

    jar.x += jarVx * dt;
    jar.y += jarVy * dt;
  }

  for (const c of critters) {
    if (c.kind === "spider" && c.webActive && !c.dead) {
      const spX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const spY = c.y + c.offsetY;
      const pull = calculateSpiderWebPull(spX, spY, jar.x + jar.w / 2, jar.y + jar.h / 2, 160 * SCALE);
      
      jar.x += pull.vx * dt;
      jar.y += pull.vy * dt;
    }
  }

  jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
  jar.y = Math.max(H * 0.12, Math.min(H - jar.h - 15 * SCALE, jar.y));

  const targetTilt = (jarVx / speed) * 0.2;
  jarTilt += (targetTilt - jarTilt) * Math.min(1, dt * 16);

  const jarCenterX = jar.x + jar.w / 2;
  for (const b of grassBlades) {
    const dist = Math.abs(b.x - jarCenterX);
    if (dist < jar.w * 0.8 && jar.y + jar.h > H - b.height * 1.2) {
      const dir = Math.sign(b.x - jarCenterX) || 1;
      b.bend += (dir * 18 * SCALE - b.bend) * Math.min(1, dt * 10);
    } else {
      b.bend += (0 - b.bend) * Math.min(1, dt * 4);
    }
  }
}

// --- Vektör İkon Çizimleri ---------------------------------------------------
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
    const angle = (i * Math.PI) / 3;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-r * 0.18, -r * 0.95, r * 0.36, r * 0.35, 2 * SCALE);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawHelpIcon(x: number, y: number, r: number, color = "#94a3b8") {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2 * SCALE;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -r * 0.22, r * 0.3, -Math.PI * 0.8, Math.PI * 0.25);
  ctx.lineTo(0, r * 0.15);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, r * 0.45, 1.8 * SCALE, 0, Math.PI * 2);
  ctx.fill();

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

// --- Efektler & Metin Kırma --------------------------------------------------
function burst(x: number, y: number, color = "hsl(52 100% 70%)", count = 20) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (60 + Math.random() * 200) * SCALE;
    const life = 0.4 + Math.random() * 0.45;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life,
      max: life,
      color,
      size: (2 + Math.random() * 4) * SCALE,
      spin: (Math.random() - 0.5) * 8,
    });
  }
}

function addFloatingText(x: number, y: number, text: string, color = "#fef08a") {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.85,
    max: 0.85,
  });
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      context.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line.trim(), x, currentY);
  return currentY;
}

// --- Güncelleme --------------------------------------------------------------
function update(dt: number) {
  if (state === "playing") {
    elapsed += dt;

    if (magnetBoostTimer > 0) magnetBoostTimer -= dt;
    if (speedBoostTimer > 0) speedBoostTimer -= dt;

    const { spawnEvery, fallSpeed } = difficulty(elapsed, currentLevel);
    if (tickSpawn(spawnTimer, dt, spawnEvery)) spawnCritter();

    updateJar(dt);

    const jarMouthX = jar.x + jar.w / 2;
    const jarMouthY = jar.y - jar.h * 0.85;
    const baseRadius = highMagnet ? 175 : 140;
    const MAGNET_RADIUS = (magnetBoostTimer > 0 ? baseRadius * 1.35 : baseRadius) * SCALE;

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
            addFloatingText(sway(c.t, c.baseX, c.amp, c.freq), c.y, "AĞ ATILDI!", "#c084fc");
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
      } else {
        c.y += fallSpeed * SCALE * dt;
      }

      const currentX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;

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

          if (Math.random() < 0.45) {
            const pColor = c.subType === "purple" ? "hsl(280 100% 80%)" : c.subType === "red" ? "hsl(350 100% 75%)" : c.subType === "emerald" ? "hsl(150 100% 75%)" : c.subType === "azure" ? "hsl(200 100% 80%)" : "hsl(52 100% 80%)";
            particles.push({
              x: currentX,
              y: c.y + c.offsetY,
              vx: (dx / dist) * 140 * SCALE + spiralX * 4,
              vy: (dy / dist) * 140 * SCALE + spiralY * 4,
              life: 0.25,
              max: 0.25,
              color: pColor,
              size: (1.5 + Math.random() * 2.5) * SCALE,
            });
          }
        } else {
          c.beingPulled = false;
        }
      }

      if (c.kind === "firefly" && Math.random() < 0.38) {
        const pColor = c.subType === "purple" ? "hsl(280 100% 80%)" : c.subType === "red" ? "hsl(350 100% 75%)" : c.subType === "emerald" ? "hsl(150 100% 70%)" : c.subType === "azure" ? "hsl(200 100% 75%)" : "hsl(54 100% 75%)";
        particles.push({
          x: currentX + (Math.random() - 0.5) * 6 * SCALE,
          y: c.y + c.offsetY - 6 * SCALE,
          vx: (Math.random() - 0.5) * 12 * SCALE,
          vy: -15 * SCALE - Math.random() * 20 * SCALE,
          life: 0.3 + Math.random() * 0.25,
          max: 0.55,
          color: pColor,
          size: (1 + Math.random() * 1.8) * SCALE,
        });
      }

      if (c.kind !== "ladybug" && c.y + c.offsetY > H + 40 * SCALE && !c.dead) {
        c.dead = true;
        if (c.kind === "firefly") {
          missed++;
          burst(currentX, H - 20 * SCALE, "hsl(0 100% 65%)", 16);
          addShake(shake, 12 * SCALE);
          addFloatingText(currentX, H - 40 * SCALE, "KAÇTI!", "#f87171");
          if (missed >= MAX_MISSED) {
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

        if (c.subType === "purple") {
          pts = 2;
          pColor = "hsl(280 100% 80%)";
          addFloatingText(x, y - 15 * SCALE, "+2 MOR MİSTİK!", "#e879f9");
        } else if (c.subType === "red") {
          pColor = "hsl(350 100% 75%)";
          for (const sp of critters) {
            if (sp.kind === "spider") sp.webActive = false;
          }
          addFloatingText(x, y - 15 * SCALE, "+1 AĞ KILINDI!", "#f87171");
        } else if (c.subType === "emerald") {
          magnetBoostTimer = 3.5;
          pColor = "hsl(150 100% 70%)";
          addFloatingText(x, y - 15 * SCALE, "+1 MIKNATIS!", "#6ee7b7");
        } else if (c.subType === "azure") {
          speedBoostTimer = 3.5;
          pColor = "hsl(200 100% 75%)";
          addFloatingText(x, y - 15 * SCALE, "+1 HIZ TAKVİYESİ!", "#7dd3fc");
        } else {
          addFloatingText(x, y - 15 * SCALE, "+1", "#fef08a");
        }

        caught = Math.min(caught + pts, levelCfg.target);
        syncJarFireflies();

        burst(x, y, pColor, 26);
        burst(x, y, "#ffffff", 8);

        jarSquash = 0.32;
        jarWobble = 0.15;

        if (caught === levelCfg.target) {
          finalTime = elapsed;
          if (currentLevel < LEVELS.length) {
            state = "levelcomplete";
          } else {
            state = "campaignwon";
          }
          modalAnimTime = 0;
          burst(W / 2, H * 0.4, "hsl(52 100% 70%)", 70);
          burst(W / 2, H * 0.4, "hsl(180 100% 75%)", 50);
          burst(W / 2, H * 0.4, "hsl(150 100% 75%)", 30);
        }
      } else {
        caught = Math.max(caught - 1, 0);
        syncJarFireflies();
        waspHitFlash = 0.42;

        addShake(shake, 18 * SCALE);
        const txt = c.kind === "spider" ? "ÖRÜMCEK DARBESİ!" : c.kind === "ladybug" ? "UĞUR BÖCEĞİ TEMASI!" : "-1 ARI!";
        addFloatingText(x, y - 15 * SCALE, txt, "#f87171");
        burst(x, y, "hsl(15 100% 60%)", 20);
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

  for (const ft of floatingTexts) {
    ft.life -= dt;
    ft.y -= 32 * SCALE * dt;
  }
  floatingTexts = floatingTexts.filter((ft) => ft.life > 0);

  for (const s of bokehOrbs) {
    s.t += dt;
    s.y += s.vy * dt;
    s.x += s.vx * dt + Math.sin(s.t * 1.2) * 6 * SCALE * dt;
    if (s.y > H + 30 * SCALE) {
      s.y = -30 * SCALE;
      s.x = Math.random() * W;
    }
  }

  for (const cl of clouds) {
    cl.x += cl.speed * dt;
    if (cl.x > W + cl.w) {
      cl.x = -cl.w * 1.5;
      cl.y = (30 + Math.random() * 80) * SCALE;
    }
  }
}

// --- Çizim Fonksiyonları ------------------------------------------------------

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);

  switch (levelCfg.skyTheme) {
    case "emerald":
      g.addColorStop(0, "#021710");
      g.addColorStop(0.4, "#05291d");
      g.addColorStop(0.85, "#031711");
      g.addColorStop(1, "#010a07");
      break;
    case "azure":
      g.addColorStop(0, "#031424");
      g.addColorStop(0.4, "#07243c");
      g.addColorStop(0.85, "#031627");
      g.addColorStop(1, "#010b14");
      break;
    case "bloodmoon":
      g.addColorStop(0, "#1f0507");
      g.addColorStop(0.4, "#360a0f");
      g.addColorStop(0.85, "#1c0407");
      g.addColorStop(1, "#0d0103");
      break;
    case "aurora":
      g.addColorStop(0, "#031f24");
      g.addColorStop(0.4, "#083a38");
      g.addColorStop(0.85, "#031a1e");
      g.addColorStop(1, "#010c0e");
      break;
    case "starstorm":
    case "legendary":
      g.addColorStop(0, "#190826");
      g.addColorStop(0.4, "#2d0d42");
      g.addColorStop(0.85, "#150621");
      g.addColorStop(1, "#08020d");
      break;
    default:
      g.addColorStop(0, "#050816");
      g.addColorStop(0.4, "#091026");
      g.addColorStop(0.85, "#050814");
      g.addColorStop(1, "#020307");
  }

  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  const moonX = W * 0.82;
  const moonY = H * 0.18;
  const moonR = 36 * SCALE;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3.5);
  if (levelCfg.skyTheme === "bloodmoon") {
    moonGlow.addColorStop(0, "rgba(255, 100, 100, 0.45)");
    moonGlow.addColorStop(0.4, "rgba(200, 50, 50, 0.2)");
    moonGlow.addColorStop(1, "rgba(200, 0, 0, 0)");
  } else if (levelCfg.skyTheme === "emerald" || levelCfg.skyTheme === "aurora") {
    moonGlow.addColorStop(0, "rgba(160, 255, 220, 0.4)");
    moonGlow.addColorStop(0.4, "rgba(100, 220, 180, 0.18)");
    moonGlow.addColorStop(1, "rgba(100, 220, 180, 0)");
  } else {
    moonGlow.addColorStop(0, "rgba(230, 242, 255, 0.4)");
    moonGlow.addColorStop(0.4, "rgba(180, 215, 255, 0.15)");
    moonGlow.addColorStop(1, "rgba(180, 215, 255, 0)");
  }
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const moonGrad = ctx.createLinearGradient(moonX - moonR, moonY - moonR, moonX + moonR, moonY + moonR);
  if (levelCfg.skyTheme === "bloodmoon") {
    moonGrad.addColorStop(0, "#fca5a5");
    moonGrad.addColorStop(0.7, "#ef4444");
    moonGrad.addColorStop(1, "#991b1b");
  } else {
    moonGrad.addColorStop(0, "#f8fafc");
    moonGrad.addColorStop(0.7, "#e2e8f0");
    moonGrad.addColorStop(1, "#cbd5e1");
  }
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  ctx.beginPath();
  ctx.arc(moonX - 10 * SCALE, moonY - 8 * SCALE, 7 * SCALE, 0, Math.PI * 2);
  ctx.arc(moonX + 12 * SCALE, moonY + 6 * SCALE, 9 * SCALE, 0, Math.PI * 2);
  ctx.arc(moonX - 4 * SCALE, moonY + 14 * SCALE, 5 * SCALE, 0, Math.PI * 2);
  ctx.fill();

  for (const cl of clouds) {
    ctx.save();
    ctx.fillStyle = `rgba(148, 163, 184, ${cl.alpha})`;
    ctx.beginPath();
    ctx.ellipse(cl.x, cl.y, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2);
    ctx.ellipse(cl.x - cl.w * 0.25, cl.y + 6 * SCALE, cl.w * 0.35, cl.h * 0.4, 0, 0, Math.PI * 2);
    ctx.ellipse(cl.x + cl.w * 0.25, cl.y + 4 * SCALE, cl.w * 0.35, cl.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const s of stars) {
    const alpha = s.a + Math.sin(elapsed * s.speed + s.x) * 0.15;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
    ctx.fillStyle = "#dce7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "lighter";
  for (const b of bokehOrbs) {
    const a = b.alpha * (0.6 + 0.4 * Math.sin(b.t * 2));
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#07121c";
  for (const b of grassBlades) {
    const swayX = Math.sin(elapsed * 2 + b.swayOffset) * 6 * SCALE + b.bend;
    ctx.beginPath();
    ctx.moveTo(b.x - b.width / 2, H);
    ctx.quadraticCurveTo(b.x, H - b.height * 0.6, b.x + swayX, H - b.height);
    ctx.quadraticCurveTo(b.x + b.width / 2, H - b.height * 0.6, b.x + b.width / 2, H);
    ctx.fill();
  }
}

function drawSuctionBeams() {
  const jarMouthX = jar.x + jar.w / 2;
  const jarMouthY = jar.y - jar.h * 0.85;

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
        const pulse = ((elapsed * 5 + i * 0.33) % 1);
        const hx = jarMouthX + (cx - jarMouthX) * pulse;
        const hy = jarMouthY + (cy - jarMouthY) * pulse;
        const hr = (4 + pulse * 14) * SCALE;

        ctx.strokeStyle = `hsl(${beamColor} / ${0.7 - pulse * 0.5})`;
        ctx.lineWidth = (2 - pulse * 1) * SCALE;
        ctx.beginPath();
        ctx.ellipse(hx, hy, hr, hr * 0.4, c.pullAngle || 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (c.kind === "spider" && c.webActive && !c.dead) {
      const spX = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const spY = c.y + c.offsetY;

      ctx.strokeStyle = "rgba(232, 121, 249, 0.85)";
      ctx.lineWidth = 2.5 * SCALE;
      ctx.beginPath();
      ctx.moveTo(spX, spY);
      ctx.lineTo(jarMouthX, jarMouthY);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1 * SCALE;
      ctx.beginPath();
      ctx.moveTo(spX, spY);
      ctx.lineTo(jarMouthX, jarMouthY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawFirefly(x: number, y: number, r: number, t: number, amp: number, freq: number, subType: FireflySubtype = "gold") {
  ctx.save();

  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.4);

  let coreColor = "hsl(54 100% 82%)";
  let auraHue = "52 100% 80%";
  let outerHue = "50 100% 60%";

  if (subType === "purple") {
    coreColor = "hsl(280 100% 88%)";
    auraHue = "280 100% 80%";
    outerHue = "270 100% 60%";
  } else if (subType === "red") {
    coreColor = "hsl(350 100% 85%)";
    auraHue = "350 100% 75%";
    outerHue = "340 100% 55%";
  } else if (subType === "emerald") {
    coreColor = "hsl(154 100% 82%)";
    auraHue = "150 100% 75%";
    outerHue = "140 100% 55%";
  } else if (subType === "azure") {
    coreColor = "hsl(198 100% 85%)";
    auraHue = "200 100% 80%";
    outerHue = "190 100% 60%";
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.85 + 0.25 * Math.sin(t * 9);
  const auraR = r * 4.0 * pulse;

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

  const wingAngle = Math.sin(t * 38) * 0.45;
  ctx.fillStyle = "rgba(235, 248, 255, 0.7)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 0.85 * SCALE;

  ctx.save();
  ctx.rotate(-0.3 - wingAngle);
  ctx.beginPath();
  ctx.ellipse(-r * 0.85, 0, r * 1.1, r * 0.48, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.rotate(0.3 + wingAngle);
  ctx.beginPath();
  ctx.ellipse(r * 0.85, 0, r * 1.1, r * 0.48, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4, r * 0.52, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.35, r * 0.28, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1e1b18";
  ctx.beginPath();
  ctx.arc(0, r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f0d0b";
  ctx.beginPath();
  ctx.arc(0, r * 0.65, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.12, r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.12, r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWasp(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();

  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.45);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hazardGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.8);
  hazardGlow.addColorStop(0, "rgba(255, 60, 0, 0.35)");
  hazardGlow.addColorStop(0.5, "rgba(255, 120, 0, 0.15)");
  hazardGlow.addColorStop(1, "rgba(255, 0, 0, 0)");
  ctx.fillStyle = hazardGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wingFlutter = Math.sin(t * 48) * 0.5;
  ctx.fillStyle = "rgba(200, 230, 255, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1 * SCALE;

  ctx.save();
  ctx.rotate(-0.5 - wingFlutter);
  ctx.beginPath();
  ctx.ellipse(-r * 1.15, 0, r * 1.35, r * 0.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.rotate(0.5 + wingFlutter);
  ctx.beginPath();
  ctx.ellipse(r * 1.15, 0, r * 1.35, r * 0.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#0f0d0a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 1.35);
  ctx.lineTo(r * 0.25, -r * 1.35);
  ctx.lineTo(0, -r * 1.9);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.35, r * 0.92, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = "#14110f";
  const bH = r * 0.42;
  ctx.fillRect(-r * 1.2, -r * 0.8, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, -r * 0.15, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, r * 0.6, r * 2.4, bH);
  ctx.restore();

  ctx.fillStyle = "#26201a";
  ctx.beginPath();
  ctx.arc(0, r * 0.35, r * 0.68, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#14110f";
  ctx.beginPath();
  ctx.arc(0, r * 0.75, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(-r * 0.22, r * 0.82, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.22, r * 0.82, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.24, r * 0.86, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.2, r * 0.86, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#14110f";
  ctx.lineWidth = 1.8 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.8);
  ctx.quadraticCurveTo(-r * 0.6, r * 1.4, -r * 0.75, r * 1.6);
  ctx.moveTo(r * 0.2, r * 0.8);
  ctx.quadraticCurveTo(r * 0.6, r * 1.4, r * 0.75, r * 1.6);
  ctx.stroke();

  ctx.restore();
}

// ULTRA-HIGH END SANATSAL KRİSTAL ÖRÜMCEK & YÜZ/DİŞLER
function drawSpider(x: number, y: number, r: number, t: number, webActive = false) {
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2);
  g.addColorStop(0, webActive ? "rgba(232, 121, 249, 0.75)" : "rgba(168, 85, 247, 0.35)");
  g.addColorStop(0.5, "rgba(126, 34, 206, 0.18)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 2.4 * SCALE;
  ctx.lineCap = "round";

  for (let i = 0; i < 4; i++) {
    const legAngle = -0.7 + i * 0.45 + Math.sin(t * 4 + i) * 0.08;
    
    ctx.save();
    ctx.rotate(legAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 1.3, -r * 0.9);
    ctx.lineTo(-r * 2.3, r * 0.6);
    ctx.stroke();
    
    ctx.fillStyle = "#e879f9";
    ctx.beginPath();
    ctx.arc(-r * 1.3, -r * 0.9, 2.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(-legAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 1.3, -r * 0.9);
    ctx.lineTo(r * 2.3, r * 0.6);
    ctx.stroke();

    ctx.fillStyle = "#e879f9";
    ctx.beginPath();
    ctx.arc(r * 1.3, -r * 0.9, 2.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const bodyG = ctx.createLinearGradient(-r, -r, r, r);
  bodyG.addColorStop(0, "#581c87");
  bodyG.addColorStop(0.5, "#3b0764");
  bodyG.addColorStop(1, "#1e1b4b");

  ctx.fillStyle = bodyG;
  ctx.strokeStyle = "rgba(232, 121, 249, 0.6)";
  ctx.lineWidth = 1.5 * SCALE;

  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.85, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -r * 0.5, r * 0.58, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.62, r * 0.13, 0, Math.PI * 2);
  ctx.arc(r * 0.25, -r * 0.62, r * 0.13, 0, Math.PI * 2);
  ctx.arc(-r * 0.09, -r * 0.46, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.09, -r * 0.46, r * 0.09, 0, Math.PI * 2);
  ctx.arc(-r * 0.34, -r * 0.46, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.34, -r * 0.46, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.27, -r * 0.65, r * 0.04, 0, Math.PI * 2);
  ctx.arc(r * 0.23, -r * 0.65, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e879f9";
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 1.2 * SCALE;

  ctx.beginPath();
  ctx.moveTo(-r * 0.22, -r * 0.28);
  ctx.quadraticCurveTo(-r * 0.38, -r * 0.08, -r * 0.15, r * 0.08);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.1, -r * 0.22, -r * 0.28);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(r * 0.22, -r * 0.28);
  ctx.quadraticCurveTo(r * 0.38, -r * 0.08, r * 0.15, r * 0.08);
  ctx.quadraticCurveTo(r * 0.1, -r * 0.1, r * 0.22, -r * 0.28);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// ULTRA-HIGH END SANATSAL UĞUR BÖCEĞİ & ORGANİK YAKUT BENEKLER
function drawLadybug(x: number, y: number, r: number, t: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.8);
  g.addColorStop(0, "rgba(244, 63, 94, 0.45)");
  g.addColorStop(0.5, "rgba(225, 29, 72, 0.2)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const wingFlutter = Math.sin(t * 36) * 0.45;
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
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

  const spotPositions = [
    { x: -r * 0.42, y: -r * 0.25, spotR: r * 0.19 },
    { x: r * 0.42, y: -r * 0.25, spotR: r * 0.19 },
    { x: -r * 0.44, y: r * 0.35, spotR: r * 0.18 },
    { x: r * 0.44, y: r * 0.35, spotR: r * 0.18 },
    { x: 0, y: r * 0.1, spotR: r * 0.22 },
  ];

  for (const sp of spotPositions) {
    ctx.fillStyle = "rgba(244, 63, 94, 0.4)";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.spotR * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#090d16";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.spotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(sp.x - sp.spotR * 0.25, sp.y - sp.spotR * 0.25, sp.spotR * 0.35, 0, Math.PI * 2);
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

// 100% FİZİKSEL DOĞRU GERÇEKÇİ 3D CAM FANUS BOYNU (Realistic Glass Fishbowl Neck)
function drawJar() {
  const w = jar.w;
  const h = jar.h;
  const r = w / 2; // Fanus Küre Yarıçapı (r = 55px * SCALE)
  const glow = caught / levelCfg.target;

  ctx.save();

  // 1. Dış Dairesel Işık Parıltısı
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glowR = r * 1.45;
    const fillGlow = ctx.createRadialGradient(0, -r, 0, 0, -r, glowR);
    fillGlow.addColorStop(0, `hsl(52 100% 75% / ${0.15 + glow * 0.45})`);
    fillGlow.addColorStop(0.5, `hsl(52 100% 65% / ${glow * 0.18})`);
    fillGlow.addColorStop(1, "hsl(52 100% 60% / 0)");
    ctx.fillStyle = fillGlow;
    ctx.beginPath();
    ctx.arc(0, -r, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (waspHitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 50, 30, ${waspHitFlash * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, -r, r + 8 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Cam Fanus Ana Gövdesi (Kusursuz Cam Küre)
  ctx.fillStyle = "rgba(10, 22, 40, 0.45)";
  ctx.beginPath();
  ctx.arc(0, -r, r, 0, Math.PI * 2);
  ctx.fill();

  // 3. FİZİKSEL DOĞRU CAM FANUS BOYNU (Seamless Glass Neck & Curved Rim Lip)
  // Boyun başlangıcı kürenin üst kısmından doğal olarak yükselir (y: -r * 1.5 - r * 0.35)
  const neckBaseY = -r * 1.62;
  const neckTopY = -r * 1.95;
  const neckRadiusX = r * 0.42;

  // Dikey Silindirik Cam Boyun Gövdesi
  const glassNeckGrad = ctx.createLinearGradient(-neckRadiusX, 0, neckRadiusX, 0);
  glassNeckGrad.addColorStop(0, "rgba(215, 240, 255, 0.55)");
  glassNeckGrad.addColorStop(0.3, "rgba(180, 225, 255, 0.18)");
  glassNeckGrad.addColorStop(0.7, "rgba(180, 225, 255, 0.18)");
  glassNeckGrad.addColorStop(1, "rgba(215, 240, 255, 0.55)");

  ctx.fillStyle = glassNeckGrad;
  ctx.beginPath();
  ctx.moveTo(-neckRadiusX - 3 * SCALE, neckBaseY);
  ctx.lineTo(-neckRadiusX, neckTopY);
  ctx.lineTo(neckRadiusX, neckTopY);
  ctx.lineTo(neckRadiusX + 3 * SCALE, neckBaseY);
  ctx.closePath();
  ctx.fill();

  // Doğal Ahşap Mantar Tıpa (Snug Fit Inside Cork Stopper)
  const corkY = neckTopY - 4 * SCALE;
  const corkG = ctx.createLinearGradient(-neckRadiusX, 0, neckRadiusX, 0);
  corkG.addColorStop(0, "#734828");
  corkG.addColorStop(0.5, "#a67043");
  corkG.addColorStop(1, "#59361c");

  ctx.fillStyle = corkG;
  ctx.beginPath();
  ctx.ellipse(0, corkY, neckRadiusX * 0.88, 5.5 * SCALE, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cam Fanus Kıvrımlı Dudak (Flared Glass Lip / Rim Ring)
  ctx.strokeStyle = "rgba(235, 248, 255, 0.85)";
  ctx.lineWidth = 2.4 * SCALE;
  ctx.fillStyle = "rgba(215, 240, 255, 0.28)";

  ctx.beginPath();
  ctx.ellipse(0, neckTopY, neckRadiusX + 1.5 * SCALE, 6.5 * SCALE, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4. Sıvı Işık Dolgusu (Yuvarlak Fanusa Kırpılmış Liquid)
  if (glow > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -r, r - 3 * SCALE, 0, Math.PI * 2);
    ctx.clip();

    const liquidH = h * 0.7 * glow;
    const liquidY = -liquidH;
    const sloshing = Math.sin(elapsed * 4 + jar.x * 0.02) * 4 * SCALE;

    const liqG = ctx.createLinearGradient(0, liquidY, 0, 0);
    liqG.addColorStop(0, `hsl(52 100% 75% / ${0.3 + glow * 0.4})`);
    liqG.addColorStop(1, `hsl(48 100% 60% / ${0.15 + glow * 0.3})`);

    ctx.fillStyle = liqG;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r, liquidY + sloshing);
    ctx.quadraticCurveTo(0, liquidY - sloshing, r, liquidY + sloshing);
    ctx.lineTo(r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 5. İçeride Süzülen Ateşböcekleri
  for (const jf of jarFireflies) {
    const fx = jf.rx * (r * 1.3);
    const fy = -r + jf.ry * (r * 1.3);
    const pulse = 0.8 + 0.2 * Math.sin(jf.t * 8);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16 * SCALE * pulse);
    g.addColorStop(0, jf.color || "hsl(54 100% 85% / 0.9)");
    g.addColorStop(0.4, "hsl(50 100% 65% / 0.4)");
    g.addColorStop(1, "hsl(50 100% 60% / 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, 16 * SCALE * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. 3D Cam Yansımaları ve Yuvarlak Çerçeve
  ctx.strokeStyle = "rgba(215, 240, 255, 0.75)";
  ctx.lineWidth = 3 * SCALE;
  ctx.fillStyle = "rgba(180, 225, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(0, -r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 4 * SCALE;
  ctx.beginPath();
  ctx.arc(0, -r, r - 6 * SCALE, Math.PI * 0.75, Math.PI * 1.25);
  ctx.stroke();

  ctx.restore();
}

// --- HUD ---------------------------------------------------------------------
function drawHUD() {
  ctx.save();

  const lvlW = Math.min(W * 0.45, 250 * SCALE);
  const lvlH = 46 * SCALE;
  const lvlX = 16 * SCALE;
  const lvlY = 16 * SCALE;

  ctx.fillStyle = "rgba(10, 15, 30, 0.8)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(lvlX, lvlY, lvlW, lvlH, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#60a5fa";
  ctx.font = `900 ${11 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`BÖLÜM ${levelCfg.level}/10 • ${levelCfg.name.toUpperCase()}`, lvlX + 16 * SCALE, lvlY + 8 * SCALE);

  const barX = lvlX + 16 * SCALE;
  const barY = lvlY + 26 * SCALE;
  const barInnerW = lvlW - 85 * SCALE;
  const barInnerH = 10 * SCALE;
  const progressRatio = Math.min(1, caught / levelCfg.target);

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barInnerW, barInnerH, 5 * SCALE);
  ctx.fill();

  if (progressRatio > 0) {
    const pG = ctx.createLinearGradient(barX, 0, barX + barInnerW, 0);
    pG.addColorStop(0, "#facc15");
    pG.addColorStop(1, "#34d399");
    ctx.fillStyle = pG;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(8 * SCALE, barInnerW * progressRatio), barInnerH, 5 * SCALE);
    ctx.fill();
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fef08a";
  ctx.font = `900 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${caught}/${levelCfg.target}`, lvlX + lvlW - 14 * SCALE, lvlY + lvlH / 2 + 1 * SCALE);

  const btnSize = 46 * SCALE;
  const btnGap = 10 * SCALE;

  const setX = W - btnSize - 16 * SCALE;
  const setY = 16 * SCALE;
  uiButtons.settings = { x: setX, y: setY, w: btnSize, h: btnSize };

  ctx.fillStyle = "rgba(10, 15, 30, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(setX, setY, btnSize, btnSize, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  drawGearIcon(setX + btnSize / 2, setY + btnSize / 2, 11 * SCALE, "#94a3b8");

  const helpX = setX - btnSize - btnGap;
  const helpY = 16 * SCALE;
  uiButtons.help = { x: helpX, y: helpY, w: btnSize, h: btnSize };

  ctx.fillStyle = "rgba(10, 15, 30, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(helpX, helpY, btnSize, btnSize, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  drawHelpIcon(helpX + btnSize / 2, helpY + btnSize / 2, 11 * SCALE, "#94a3b8");

  const timerW = Math.min(W * 0.2, 100 * SCALE);
  const timerX = helpX - timerW - btnGap;
  const timerY = 16 * SCALE;

  ctx.fillStyle = "rgba(10, 15, 30, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(timerX, timerY, timerW, btnSize, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  drawClockIcon(timerX + 18 * SCALE, timerY + btnSize / 2, 8 * SCALE, "#60a5fa");

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#60a5fa";
  ctx.font = `900 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${elapsed.toFixed(1)}s`, timerX + 32 * SCALE, timerY + btnSize / 2 + 1 * SCALE);

  ctx.restore();
}

// --- 10 BÖLÜM SEÇİM TABLOSU MODALI -------------------------------------------
function drawLevelSelectModal() {
  ctx.save();
  ctx.fillStyle = "rgba(3, 6, 16, 0.88)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.94, 680 * SCALE);
  const cardH = Math.min(H * 0.90, 540 * SCALE);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, "rgba(15, 23, 42, 0.97)");
  cardGrad.addColorStop(1, "rgba(10, 15, 28, 0.99)");

  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = "rgba(96, 165, 250, 0.45)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.fill();
  ctx.stroke();

  const badgeW = 180 * SCALE;
  const badgeH = 30 * SCALE;
  const badgeX = (W - badgeW) / 2;
  const badgeY = cardY + 22 * SCALE;

  ctx.fillStyle = "rgba(96, 165, 250, 0.15)";
  ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 15 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#60a5fa";
  ctx.font = `900 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("BÖLÜM SEÇİMİ", W / 2, badgeY + badgeH / 2 + 1 * SCALE);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.055, 26 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("10 EFSANEVİ BÖLÜM TABLOSU", W / 2, cardY + 58 * SCALE);

  const gridW = cardW - 48 * SCALE;
  const gridX = cardX + 24 * SCALE;
  const gridY = cardY + 102 * SCALE;

  const cols = 5;
  const colW = (gridW - (cols - 1) * 10 * SCALE) / cols;
  const rowH = 150 * SCALE;

  levelGridButtons.length = 0;

  for (let i = 0; i < 10; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const bx = gridX + c * (colW + 10 * SCALE);
    const by = gridY + r * (rowH + 12 * SCALE);
    const lvl = LEVELS[i];

    levelGridButtons.push({ level: lvl.level, x: bx, y: by, w: colW, h: rowH });

    const isCurrent = lvl.level === currentLevel;

    ctx.fillStyle = isCurrent ? "rgba(37, 99, 235, 0.35)" : "rgba(30, 41, 59, 0.5)";
    ctx.strokeStyle = isCurrent ? "#60a5fa" : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = (isCurrent ? 2 : 1.2) * SCALE;
    ctx.beginPath();
    ctx.roundRect(bx, by, colW, rowH, 16 * SCALE);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = isCurrent ? "#fef08a" : "#60a5fa";
    ctx.font = `900 ${14 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(`BÖLÜM ${lvl.level}`, bx + colW / 2, by + 12 * SCALE);

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${10.5 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(lvl.name, bx + colW / 2, by + 34 * SCALE);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 ${9.5 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(`Hedef: ${lvl.target}`, bx + colW / 2, by + 68 * SCALE);

    ctx.fillStyle = lvl.allowedHazards.includes("spider") ? "#c084fc" : lvl.allowedHazards.includes("ladybug") ? "#f43f5e" : "#facc15";
    ctx.font = `700 ${9 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(lvl.allowedHazards.length > 1 ? "ÖZEL BÖCEKLER" : "ARI", bx + colW / 2, by + 115 * SCALE);
  }

  const btnW = Math.min(cardW - 80 * SCALE, 320 * SCALE);
  const btnH = 46 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 64 * SCALE;

  uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("GERİ DÖN", W / 2, btnY + btnH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- SIRALI ANİMASYONLU MODAL SİSTEMİ ---------------------------------------
function drawModalCard(
  statusBadge: string,
  title: string,
  primaryBtnText: string,
  isWin: boolean,
) {
  ctx.save();
  ctx.fillStyle = "rgba(3, 6, 16, 0.88)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.94, 680 * SCALE);
  const cardH = Math.min(H * 0.90, 540 * SCALE);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  const borderColor = isWin ? "rgba(250, 204, 21, 0.45)" : "rgba(239, 68, 68, 0.45)";
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, "rgba(15, 23, 42, 0.97)");
  cardGrad.addColorStop(1, "rgba(10, 15, 28, 0.99)");

  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.fill();
  ctx.stroke();

  const heroJarX = cardX + 54 * SCALE;
  const heroJarY = cardY + 70 * SCALE;
  ctx.save();
  ctx.translate(heroJarX, heroJarY);
  ctx.scale(0.55, 0.55);
  drawJar();
  ctx.restore();

  drawFirefly(cardX + cardW - 60 * SCALE, cardY + 55 * SCALE, 9 * SCALE, elapsed, 0, 0, "purple");
  if (!isWin) {
    drawSpider(cardX + cardW - 110 * SCALE, cardY + 80 * SCALE, 12 * SCALE, elapsed, true);
  } else {
    drawLadybug(cardX + cardW - 115 * SCALE, cardY + 80 * SCALE, 10 * SCALE, elapsed);
  }

  const badgeW = 200 * SCALE;
  const badgeH = 32 * SCALE;
  const badgeX = (W - badgeW) / 2;
  const badgeY = cardY + 24 * SCALE;

  ctx.fillStyle = isWin ? "rgba(250, 204, 21, 0.15)" : "rgba(239, 68, 68, 0.15)";
  ctx.strokeStyle = isWin ? "rgba(250, 204, 21, 0.5)" : "rgba(239, 68, 68, 0.5)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isWin ? "#fef08a" : "#fca5a5";
  ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(statusBadge, W / 2, badgeY + badgeH / 2 + 1 * SCALE);

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
        { label: "BÖLÜM HEDEFİ", targetVal: caught, total: levelCfg.target, unit: "100% Tamam", color: "#fef08a", type: "ratio" },
        { label: "BÖLÜM SÜRESİ", targetVal: finalTime, total: 0, unit: "Saniye", color: "#60a5fa", type: "time" },
        { label: "GEÇİLEN BÖLÜM", targetVal: currentLevel, total: 10, unit: `${levelCfg.name}`, color: "#34d399", type: "level" },
      ]
    : [
        { label: "TOPLANAN IŞIK", targetVal: caught, total: levelCfg.target, unit: "Ateşböceği", color: "#fef08a", type: "ratio" },
        { label: "GEÇEN SÜRE", targetVal: finalTime, total: 0, unit: "Saniye", color: "#60a5fa", type: "time" },
        { label: "KAÇAN IŞIKLAR", targetVal: missed, total: MAX_MISSED, unit: "Geceye Karıştı", color: "#f87171", type: "ratio" },
      ];

  for (let i = 0; i < 3; i++) {
    const cx = gridX + i * (colW + 12 * SCALE);
    const s = stats[i];

    const cardDelay = i * 0.20;
    const cardProgress = Math.max(0, Math.min(1, (modalAnimTime - cardDelay) / 0.35));
    const cardScale = 0.7 + 0.3 * Math.sin(cardProgress * Math.PI / 2);

    ctx.save();
    ctx.globalAlpha = cardProgress;

    ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
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
    if (s.type === "ratio") {
      const cur = Math.round(s.targetVal * cardProgress);
      displayVal = `${cur}/${s.total}`;
    } else if (s.type === "time") {
      const curT = (s.targetVal * cardProgress).toFixed(1);
      displayVal = `${curT}s`;
    } else if (s.type === "level") {
      displayVal = `${s.targetVal}/10`;
    }

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
    ? `${levelCfg.name} tamamlandı! ${currentLevel < 10 ? 'Sonraki seviyeye geçmeye hazırsın.' : 'Tüm 10 bölümü başardın!'}`
    : "3 ateşböceği geceye karıştı. Tekrar deneyerek bu bölümü geç!";

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.roundRect(gridX, descY, gridW, 44 * SCALE, 12 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${14 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(descText, W / 2, descY + 22 * SCALE);

  const btnW = Math.min(cardW - 80 * SCALE, 360 * SCALE);
  const btnH = 50 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 74 * SCALE;

  uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };

  const g = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  if (!isWin) {
    g.addColorStop(0, "#dc2626");
    g.addColorStop(1, "#b91c1c");
  } else {
    g.addColorStop(0, "#10b981");
    g.addColorStop(1, "#059669");
  }

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 25 * SCALE);
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(primaryBtnText, W / 2, btnY + btnH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- İNFOGRAFİK REHBER ------------------------------------------------------
function drawTutorialModal() {
  ctx.save();
  ctx.fillStyle = "rgba(3, 6, 16, 0.88)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.94, 680 * SCALE);
  const cardH = Math.min(H * 0.90, 540 * SCALE);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, "rgba(15, 23, 42, 0.97)");
  cardGrad.addColorStop(1, "rgba(10, 15, 28, 0.99)");

  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = "rgba(96, 165, 250, 0.45)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.fill();
  ctx.stroke();

  const badgeW = 160 * SCALE;
  const badgeH = 30 * SCALE;
  const badgeX = (W - badgeW) / 2;
  const badgeY = cardY + 24 * SCALE;

  ctx.fillStyle = "rgba(96, 165, 250, 0.15)";
  ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 15 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#60a5fa";
  ctx.font = `900 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("OYUN REHBERİ", W / 2, badgeY + badgeH / 2 + 1 * SCALE);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.055, 28 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("BÖCEKLER & AĞ MEKANİĞİ", W / 2, cardY + 62 * SCALE);

  const gridW = cardW - 56 * SCALE;
  const gridX = cardX + 28 * SCALE;
  const gridY = cardY + 110 * SCALE;

  const colW = (gridW - 20 * SCALE) / 2;
  const rowH = 150 * SCALE;

  const rules = [
    { drawIcon: (x: number, y: number) => drawSpider(x, y, 11 * SCALE, elapsed, true), title: "AVCI ÖRÜMCEK AĞI", desc: "Fanusa ipek ağ atarak seni yavaşça çeker. Karşı yöne asılarak ağdan kurtul!" },
    { drawIcon: (x: number, y: number) => drawLadybug(x, y, 10 * SCALE, elapsed), title: "GEZGİN UĞUR BÖCEĞİ", desc: "Ekrandan hiç çıkmaz, sürekli yumuşak yörüngede uçar. Çarpmamaya dikkat et!" },
    { drawIcon: (x: number, y: number) => drawFirefly(x, y, 8 * SCALE, elapsed, 0, 0, "purple"), title: "MOR MİSTİK (+2 IŞIK)", desc: "Çok nadirdir ve tek yakalayışta fanusa tam +2 ışık kazandırır." },
    { drawIcon: (x: number, y: number) => drawFirefly(x, y, 8 * SCALE, elapsed, 0, 0, "red"), title: "KIZIL YAKUT (AĞ KIRAN)", desc: "Yakalandığında Örümceğin bağlı olduğu ağı anında yakarak yok eder!" },
  ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = gridX + col * (colW + 20 * SCALE);
    const cy = gridY + row * (rowH + 16 * SCALE);
    const r = rules[i];

    const cardDelay = i * 0.15;
    const cardProgress = Math.max(0, Math.min(1, (modalAnimTime - cardDelay) / 0.3));

    ctx.save();
    ctx.globalAlpha = cardProgress;

    ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1.2 * SCALE;
    ctx.beginPath();
    ctx.roundRect(cx, cy, colW, rowH, 18 * SCALE);
    ctx.fill();
    ctx.stroke();

    r.drawIcon(cx + 30 * SCALE, cy + 30 * SCALE);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fef08a";
    ctx.font = `900 ${14 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(r.title, cx + 58 * SCALE, cy + 22 * SCALE);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 ${13 * SCALE}px 'Outfit', sans-serif`;
    drawWrappedText(ctx, r.desc, cx + 22 * SCALE, cy + 62 * SCALE, colW - 44 * SCALE, 18 * SCALE);

    ctx.restore();
  }

  const btnW = Math.min(cardW - 80 * SCALE, 360 * SCALE);
  const btnH = 50 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 74 * SCALE;

  uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };

  const g = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  g.addColorStop(0, "#2563eb");
  g.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 25 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("OYUNA BAŞLA", W / 2, btnY + btnH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- İNFOGRAFİK AYARLAR MODALI -----------------------------------------------
function drawSettingsModal() {
  ctx.save();
  ctx.fillStyle = "rgba(3, 6, 16, 0.88)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.94, 680 * SCALE);
  const cardH = Math.min(H * 0.90, 520 * SCALE);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, "rgba(15, 23, 42, 0.97)");
  cardGrad.addColorStop(1, "rgba(10, 15, 28, 0.99)");

  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28 * SCALE);
  ctx.fill();
  ctx.stroke();

  const badgeW = 160 * SCALE;
  const badgeH = 30 * SCALE;
  const badgeX = (W - badgeW) / 2;
  const badgeY = cardY + 20 * SCALE;

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 15 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#94a3b8";
  ctx.font = `900 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("SİSTEM MENÜSÜ", W / 2, badgeY + badgeH / 2 + 1 * SCALE);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(cardW * 0.055, 26 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(`AYARLAR • BÖLÜM ${currentLevel}/10`, W / 2, cardY + 56 * SCALE);

  const rowW = cardW - 64 * SCALE;
  const rowX = cardX + 32 * SCALE;

  const row1Y = cardY + 105 * SCALE;
  const rowH = 64 * SCALE;

  ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(rowX, row1Y, rowW, rowH, 18 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("SES EFEKTLERİ", rowX + 24 * SCALE, row1Y + 14 * SCALE);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("Oyun içi ses ve çarpışma efektlerini yönet", rowX + 24 * SCALE, row1Y + 36 * SCALE);

  const toggle1W = 110 * SCALE;
  const toggle1H = 36 * SCALE;
  const toggle1X = rowX + rowW - toggle1W - 16 * SCALE;
  const toggle1Y = row1Y + (rowH - toggle1H) / 2;
  uiButtons.toggleSound = { x: toggle1X, y: toggle1Y, w: toggle1W, h: toggle1H };

  ctx.fillStyle = soundEnabled ? "#10b981" : "#334155";
  ctx.beginPath();
  ctx.roundRect(toggle1X, toggle1Y, toggle1W, toggle1H, 18 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(soundEnabled ? "AÇIK" : "KAPALI", toggle1X + toggle1W / 2, toggle1Y + toggle1H / 2);

  const row2Y = row1Y + rowH + 12 * SCALE;

  ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1.2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(rowX, row2Y, rowW, rowH, 18 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("VAKUM ÇEKİM HASSASİYETİ", rowX + 24 * SCALE, row2Y + 14 * SCALE);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 ${12 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("Mıknatıs çekim alanının yarıçapını ve gücünü ayarla", rowX + 24 * SCALE, row2Y + 36 * SCALE);

  const toggle2W = 110 * SCALE;
  const toggle2H = 36 * SCALE;
  const toggle2X = rowX + rowW - toggle2W - 16 * SCALE;
  const toggle2Y = row2Y + (rowH - toggle2H) / 2;
  uiButtons.toggleMagnet = { x: toggle2X, y: toggle2Y, w: toggle2W, h: toggle2H };

  ctx.fillStyle = highMagnet ? "#06b6d4" : "#334155";
  ctx.beginPath();
  ctx.roundRect(toggle2X, toggle2Y, toggle2W, toggle2H, 18 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${13 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(highMagnet ? "YÜKSEK" : "NORMAL", toggle2X + toggle2W / 2, toggle2Y + toggle2H / 2);

  const btnLvlW = Math.min(cardW - 80 * SCALE, 360 * SCALE);
  const btnLvlH = 44 * SCALE;
  const btnLvlX = (W - btnLvlW) / 2;
  const btnLvlY = row2Y + rowH + 16 * SCALE;

  uiButtons.modalLevelSelect = { x: btnLvlX, y: btnLvlY, w: btnLvlW, h: btnLvlH };

  ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
  ctx.strokeStyle = "rgba(96, 165, 250, 0.6)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnLvlX, btnLvlY, btnLvlW, btnLvlH, 22 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#93c5fd";
  ctx.font = `900 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("BÖLÜM SEÇİM TABLOSU (10 LEVEL)", W / 2, btnLvlY + btnLvlH / 2 + 1 * SCALE);

  const btnW = Math.min(cardW - 80 * SCALE, 360 * SCALE);
  const btnH = 46 * SCALE;
  const btnX = (W - btnW) / 2;

  const btn1Y = cardY + cardH - 118 * SCALE;
  uiButtons.modalAction = { x: btnX, y: btn1Y, w: btnW, h: btnH };

  const g1 = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  g1.addColorStop(0, "#2563eb");
  g1.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.roundRect(btnX, btn1Y, btnW, btnH, 23 * SCALE);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("DEVAM ET", W / 2, btn1Y + btnH / 2 + 1 * SCALE);

  const btn2Y = cardY + cardH - 62 * SCALE;
  uiButtons.modalSecondary = { x: btnX, y: btn2Y, w: btnW, h: btnH };

  ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
  ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnX, btn2Y, btnW, btnH, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fca5a5";
  ctx.font = `800 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("BAŞTAN BAŞLA (BÖLÜM 1)", W / 2, btn2Y + btnH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- Ana Çizim Döngüsü ------------------------------------------------------
function draw() {
  const { x: sx, y: sy } = shakeOffset(shake);
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();

  if (state === "playing") {
    drawSuctionBeams();
  }

  for (const c of critters) {
    const x = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
    const y = c.y + c.offsetY;
    if (c.kind === "firefly") {
      drawFirefly(x, y, c.r, c.t, c.amp, c.freq, c.subType);
    } else if (c.kind === "spider") {
      drawSpider(x, y, c.r, c.t, c.webActive);
    } else if (c.kind === "ladybug") {
      drawLadybug(x, y, c.r, c.t);
    } else {
      drawWasp(x, y, c.r, c.t, c.amp, c.freq);
    }
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
  ctx.restore();

  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.life / ft.max;
    ctx.fillStyle = ft.color;
    ctx.font = `900 ${22 * SCALE}px 'Outfit', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(jar.x + jar.w / 2, jar.y + jar.h);
  ctx.rotate(jarTilt + Math.sin(elapsed * 18) * jarWobble);
  ctx.scale(1 + jarSquash, 1 - jarSquash);
  drawJar();
  ctx.restore();

  if (state === "playing") {
    drawHUD();
  }

  ctx.restore();

  if (state === "levelselect") {
    drawLevelSelectModal();
  } else if (state === "levelcomplete") {
    drawModalCard(`BÖLÜM ${currentLevel} TAMAMLANDI`, `${levelCfg.name} Geçildi!`, `SONRAKİ BÖLÜM (Bölüm ${currentLevel + 1})`, true);
  } else if (state === "campaignwon") {
    drawModalCard("EFSANEVİ ŞAMPİYON", "TÜM BÖLÜMLER BİTTİ", "YENİDEN BAŞLA (Bölüm 1)", true);
  } else if (state === "gameover") {
    drawModalCard(`BÖLÜM ${currentLevel} BAŞARISIZ`, "ATEŞBÖCEKLERİ KAÇTI", "TEKRAR DENE", false);
  } else if (state === "tutorial") {
    drawTutorialModal();
  } else if (state === "settings") {
    drawSettingsModal();
  }
}

// --- Oyun Döngüsü ------------------------------------------------------------
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
