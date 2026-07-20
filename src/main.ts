// ATEŞBÖCEKLERİ — Profesyonel Arayüz, Ayarlar ve Yönlendirmeler
// Özellikler: Tam Dokunmatik UI, Ayarlar & Duraklat Modalı, Nasıl Oynanır Yönlendirmesi, Taşmayan Dinamik Metin Hizalaması, Ses & Hassasiyet Ayarları.

import {
  type Shake,
  type SpawnTimer,
  addShake,
  createSpawnTimer,
  difficulty,
  hitCircleRect,
  shakeOffset,
  sway,
  swayVel,
  tickSpawn,
  updateShake,
} from "./logic";

// --- Çift yükleme koruması ---------------------------------------------------
const w = window as unknown as { __stopGame?: () => void };
w.__stopGame?.();
let running = true;
const aborter = new AbortController();
w.__stopGame = () => {
  running = false;
  aborter.abort();
};
const on = { signal: aborter.signal };

// --- Tam ekran canvas --------------------------------------------------------
let W = window.innerWidth;
let H = window.innerHeight;
let SCALE = Math.min(W, H) / 600;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- Oyun Durumu & Tipler ---------------------------------------------------
const TARGET = 6;
const MAX_MISSED = 3;

type GameState = "playing" | "paused" | "tutorial" | "settings" | "won" | "gameover";
type FireflyType = "gold" | "emerald" | "azure";

interface Critter {
  id: number;
  kind: "firefly" | "wasp";
  subType?: FireflyType;
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

let state: GameState = "playing";
let critters: Critter[] = [];
let particles: Particle[] = [];
let floatingTexts: FloatingText[] = [];
let jarFireflies: JarFirefly[] = [];
let caught = 0;
let missed = 0;
let elapsed = 0;
let finalTime = 0;
let nextCritterId = 1;
let spawnTimer: SpawnTimer = createSpawnTimer();
const shake: Shake = { power: 0, t: 0 };

// Ayarlar
let soundEnabled = true;
let highMagnet = false;

// Kavanoz Fizik & Kovalama Değişkenleri
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

// UI Buton Yerleşimleri (Tıklama Tespiti İçin)
const uiButtons = {
  help: { x: 0, y: 0, w: 0, h: 0 },
  settings: { x: 0, y: 0, w: 0, h: 0 },
  modalAction: { x: 0, y: 0, w: 0, h: 0 },
  modalSecondary: { x: 0, y: 0, w: 0, h: 0 },
  toggleSound: { x: 0, y: 0, w: 0, h: 0 },
  toggleMagnet: { x: 0, y: 0, w: 0, h: 0 },
};

function layout() {
  SCALE = Math.min(W, H) / 600;
  jar.w = 100 * SCALE;
  jar.h = 116 * SCALE;
  jar.y = Math.max(H * 0.15, Math.min(H - jar.h - 32 * SCALE, jar.y || H - jar.h - 32 * SCALE));
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x || (W - jar.w) / 2));

  stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.85,
    r: (0.6 + Math.random() * 1.5) * SCALE,
    a: 0.15 + Math.random() * 0.45,
    speed: 0.8 + Math.random() * 2,
  }));

  const colors = ["hsl(52 100% 70%)", "hsl(160 100% 65%)", "hsl(200 100% 70%)"];
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

function resetGame() {
  critters = [];
  particles = [];
  floatingTexts = [];
  jarFireflies = [];
  caught = 0;
  missed = 0;
  elapsed = 0;
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
  const colors = ["hsl(52 100% 75%)", "hsl(150 100% 70%)", "hsl(200 100% 75%)"];
  while (jarFireflies.length < caught) {
    jarFireflies.push({
      rx: (Math.random() - 0.5) * 0.5,
      ry: -0.3 - Math.random() * 0.4,
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
  const wasp = Math.random() < 0.28;
  const amp = wasp
    ? (40 + Math.random() * 32) * SCALE
    : (14 + Math.random() * 20) * SCALE;

  let subType: FireflyType = "gold";
  if (!wasp) {
    const r = Math.random();
    if (r < 0.25) subType = "emerald";
    else if (r < 0.45) subType = "azure";
  }

  critters.push({
    id: nextCritterId++,
    kind: wasp ? "wasp" : "firefly",
    subType,
    baseX: amp + 25 * SCALE + Math.random() * (W - 2 * (amp + 25 * SCALE)),
    y: -35 * SCALE,
    offsetX: 0,
    offsetY: 0,
    t: Math.random() * 10,
    amp,
    freq: wasp ? 0.26 + Math.random() * 0.2 : 0.65 + Math.random() * 0.75,
    r: wasp ? 14 * SCALE : 10 * SCALE,
    pullAngle: Math.random() * Math.PI * 2,
  });
}

// --- Girdi & Dokunmatik Etkileşim Yönetimi ----------------------------------
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
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.settings)) {
      state = "settings";
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
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      state = "playing";
      return true;
    }
    if (isInsideRect(cx, cy, uiButtons.modalSecondary)) {
      resetGame();
      return true;
    }
  } else if (state === "won" || state === "gameover") {
    if (isInsideRect(cx, cy, uiButtons.modalAction)) {
      resetGame();
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
    if ((state === "won" || state === "gameover") && e.key === "Enter") resetGame();
    if (e.key === "Escape") {
      if (state === "playing") state = "settings";
      else if (state === "settings" || state === "tutorial") state = "playing";
    }
  },
  on,
);

function updateJar(dt: number) {
  const speed = 720 * SCALE;
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
    
    jar.x += diffX * Math.min(1, dt * 28);
    jar.y += diffY * Math.min(1, dt * 28);

    jarVx = diffX * 14;
    jarVy = diffY * 14;
  } else {
    jarVx += (targetVx - jarVx) * Math.min(1, dt * 22);
    jarVy += (targetVy - jarVy) * Math.min(1, dt * 22);

    jar.x += jarVx * dt;
    jar.y += jarVy * dt;
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

// --- Efektler ---------------------------------------------------------------
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

// --- Metin Kaydırma & Kırma Yardımcısı (Dışa Taşma Engelleyici) ------------
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

    const { spawnEvery, fallSpeed } = difficulty(elapsed);
    if (tickSpawn(spawnTimer, dt, spawnEvery)) spawnCritter();

    updateJar(dt);

    const jarMouthX = jar.x + jar.w / 2;
    const jarMouthY = jar.y - 8 * SCALE;
    const MAGNET_RADIUS = (highMagnet ? 175 : 140) * SCALE;

    for (const c of critters) {
      c.t += dt;

      if (c.kind === "wasp") {
        c.y += fallSpeed * SCALE * dt * 1.1;
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
            const pColor = c.subType === "emerald" ? "hsl(150 100% 75%)" : c.subType === "azure" ? "hsl(200 100% 80%)" : "hsl(52 100% 80%)";
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
        const pColor = c.subType === "emerald" ? "hsl(150 100% 70%)" : c.subType === "azure" ? "hsl(200 100% 75%)" : "hsl(54 100% 75%)";
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

      if (c.y + c.offsetY > H + 40 * SCALE && !c.dead) {
        c.dead = true;
        if (c.kind === "firefly") {
          missed++;
          burst(currentX, H - 20 * SCALE, "hsl(0 100% 65%)", 16);
          addShake(shake, 12 * SCALE);
          addFloatingText(currentX, H - 40 * SCALE, "KAÇTI!", "#f87171");
          if (missed >= MAX_MISSED) {
            finalTime = elapsed;
            state = "gameover";
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
        caught = Math.min(caught + 1, TARGET);
        syncJarFireflies();

        const pColor = c.subType === "emerald" ? "hsl(150 100% 70%)" : c.subType === "azure" ? "hsl(200 100% 75%)" : "hsl(52 100% 75%)";
        burst(x, y, pColor, 24);
        burst(x, y, "#ffffff", 8);

        addFloatingText(x, y - 15 * SCALE, "+1", c.subType === "emerald" ? "#6ee7b7" : c.subType === "azure" ? "#7dd3fc" : "#fef08a");
        jarSquash = 0.32;
        jarWobble = 0.15;

        if (caught === TARGET) {
          finalTime = elapsed;
          state = "won";
          burst(W / 2, H * 0.4, "hsl(52 100% 70%)", 70);
          burst(W / 2, H * 0.4, "hsl(180 100% 75%)", 50);
          burst(W / 2, H * 0.4, "hsl(150 100% 75%)", 30);
        }
      } else {
        caught = Math.max(caught - 1, 0);
        syncJarFireflies();
        waspHitFlash = 0.42;
        addShake(shake, 20 * SCALE);
        addFloatingText(x, y - 15 * SCALE, "-1", "#f87171");
        burst(x, y, "hsl(15 100% 60%)", 18);
      }
    }
    critters = critters.filter((c) => !c.dead && c.y + c.offsetY < H + 50 * SCALE);
  }

  for (const jf of jarFireflies) {
    jf.t += dt;
    jf.rx += jf.vx * dt;
    jf.ry += jf.vy * dt;
    if (jf.rx < -0.36 || jf.rx > 0.36) jf.vx *= -1;
    if (jf.ry < -0.8 || jf.ry > -0.15) jf.vy *= -1;
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
  g.addColorStop(0, "#050816");
  g.addColorStop(0.4, "#091026");
  g.addColorStop(0.85, "#050814");
  g.addColorStop(1, "#020307");
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  const moonX = W * 0.82;
  const moonY = H * 0.18;
  const moonR = 36 * SCALE;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3.5);
  moonGlow.addColorStop(0, "rgba(230, 242, 255, 0.4)");
  moonGlow.addColorStop(0.4, "rgba(180, 215, 255, 0.15)");
  moonGlow.addColorStop(1, "rgba(180, 215, 255, 0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const moonGrad = ctx.createLinearGradient(moonX - moonR, moonY - moonR, moonX + moonR, moonY + moonR);
  moonGrad.addColorStop(0, "#f8fafc");
  moonGrad.addColorStop(0.7, "#e2e8f0");
  moonGrad.addColorStop(1, "#cbd5e1");
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
  const jarMouthY = jar.y - 8 * SCALE;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const c of critters) {
    if (c.kind === "firefly" && c.beingPulled && !c.dead) {
      const cx = sway(c.t, c.baseX, c.amp, c.freq) + c.offsetX;
      const cy = c.y + c.offsetY;

      const beamColor = c.subType === "emerald" ? "150 100% 75%" : c.subType === "azure" ? "200 100% 80%" : "52 100% 75%";

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
  }

  ctx.restore();
}

function drawFirefly(x: number, y: number, r: number, t: number, amp: number, freq: number, subType: FireflyType = "gold") {
  ctx.save();

  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.4);

  let coreColor = "hsl(54 100% 82%)";
  let auraHue = "52 100% 80%";
  let outerHue = "50 100% 60%";

  if (subType === "emerald") {
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

function drawJar() {
  const w = jar.w;
  const h = jar.h;
  const glow = caught / TARGET;

  ctx.save();

  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fillGlow = ctx.createRadialGradient(0, -h * 0.4, 0, 0, -h * 0.4, w * 1.4);
    fillGlow.addColorStop(0, `hsl(52 100% 70% / ${0.15 + glow * 0.55})`);
    fillGlow.addColorStop(0.6, `hsl(52 100% 60% / ${glow * 0.25})`);
    fillGlow.addColorStop(1, "hsl(52 100% 60% / 0)");
    ctx.fillStyle = fillGlow;
    ctx.fillRect(-w * 1.5, -h * 1.5, w * 3, h * 1.8);
    ctx.restore();
  }

  if (waspHitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 50, 30, ${waspHitFlash * 0.7})`;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 6 * SCALE, -h - 12 * SCALE, w + 12 * SCALE, h + 16 * SCALE, 16 * SCALE);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(10, 22, 40, 0.45)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 14 * SCALE);
  ctx.fill();

  const neckW = w * 0.82;
  const neckH = 14 * SCALE;
  const neckY = -h - neckH * 0.5;

  const corkG = ctx.createLinearGradient(-neckW / 2, 0, neckW / 2, 0);
  corkG.addColorStop(0, "#8c5a32");
  corkG.addColorStop(0.5, "#b87d4b");
  corkG.addColorStop(1, "#6e4324");
  ctx.fillStyle = corkG;
  ctx.beginPath();
  ctx.roundRect(-neckW * 0.44, neckY - 12 * SCALE, neckW * 0.88, 14 * SCALE, 4 * SCALE);
  ctx.fill();

  ctx.fillStyle = "rgba(195, 230, 255, 0.38)";
  ctx.strokeStyle = "rgba(220, 245, 255, 0.75)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(-neckW / 2, neckY, neckW, neckH, 5 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#d4a373";
  ctx.lineWidth = 2.5 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-neckW / 2 + 2 * SCALE, neckY + neckH / 2);
  ctx.lineTo(neckW / 2 - 2 * SCALE, neckY + neckH / 2);
  ctx.stroke();

  if (glow > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 3 * SCALE, -h + 3 * SCALE, w - 6 * SCALE, h - 6 * SCALE, 12 * SCALE);
    ctx.clip();

    const liquidH = h * 0.7 * glow;
    const liquidY = -liquidH;
    const sloshing = Math.sin(elapsed * 4 + jar.x * 0.02) * 4 * SCALE;

    const liqG = ctx.createLinearGradient(0, liquidY, 0, 0);
    liqG.addColorStop(0, `hsl(52 100% 75% / ${0.3 + glow * 0.4})`);
    liqG.addColorStop(1, `hsl(48 100% 60% / ${0.15 + glow * 0.3})`);

    ctx.fillStyle = liqG;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, liquidY + sloshing);
    ctx.quadraticCurveTo(0, liquidY - sloshing, w / 2, liquidY + sloshing);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const jf of jarFireflies) {
    const fx = jf.rx * w;
    const fy = jf.ry * h;
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

  ctx.strokeStyle = "rgba(215, 240, 255, 0.65)";
  ctx.lineWidth = 2.8 * SCALE;
  ctx.fillStyle = "rgba(180, 225, 255, 0.08)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5 * SCALE, -h + 8 * SCALE, 6 * SCALE, h - 22 * SCALE, 3 * SCALE);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - 8 * SCALE, -h + 12 * SCALE, 3.5 * SCALE, h - 28 * SCALE, 2 * SCALE);
  ctx.fill();

  ctx.restore();
}

// --- HUD: Üst Bar ve Butonlar -----------------------------------------------
function drawHUD() {
  ctx.save();

  // 1. Sol Üst: Skor & Kaçırma Hakları
  const barW = Math.min(W * 0.48, 230 * SCALE);
  const barH = 46 * SCALE;
  const barX = 16 * SCALE;
  const barY = 16 * SCALE;

  ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  const iconX = barX + 20 * SCALE;
  const iconY = barY + barH / 2;
  drawFirefly(iconX, iconY, 6 * SCALE, elapsed, 0, 0, "gold");

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fef08a";
  ctx.font = `700 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${caught}/${TARGET}`, barX + 34 * SCALE, barY + barH / 2);

  const heartsX = barX + 105 * SCALE;
  const remainingLives = MAX_MISSED - missed;

  for (let i = 0; i < MAX_MISSED; i++) {
    const hx = heartsX + i * 20 * SCALE;
    const hy = barY + barH / 2;
    if (i < remainingLives) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "hsl(52 100% 70%)";
      ctx.beginPath();
      ctx.arc(hx, hy, 6 * SCALE, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(hx, hy, 2.2 * SCALE, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.beginPath();
      ctx.arc(hx, hy, 6 * SCALE, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.8 * SCALE;
      ctx.beginPath();
      ctx.moveTo(hx - 3 * SCALE, hy - 3 * SCALE);
      ctx.lineTo(hx + 3 * SCALE, hy + 3 * SCALE);
      ctx.moveTo(hx + 3 * SCALE, hy - 3 * SCALE);
      ctx.lineTo(hx - 3 * SCALE, hy + 3 * SCALE);
      ctx.stroke();
    }
  }

  // 2. Sağ Üst: Kronometre & Butonlar
  const btnSize = 46 * SCALE;
  const btnGap = 10 * SCALE;

  // Ayarlar Butonu (⚙️)
  const setX = W - btnSize - 16 * SCALE;
  const setY = 16 * SCALE;
  uiButtons.settings = { x: setX, y: setY, w: btnSize, h: btnSize };

  ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(setX, setY, btnSize, btnSize, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${20 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("⚙️", setX + btnSize / 2, setY + btnSize / 2 + 1 * SCALE);

  // Nasıl Oynanır Butonu (❓)
  const helpX = setX - btnSize - btnGap;
  const helpY = 16 * SCALE;
  uiButtons.help = { x: helpX, y: helpY, w: btnSize, h: btnSize };

  ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(helpX, helpY, btnSize, btnSize, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.font = `${20 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("❓", helpX + btnSize / 2, helpY + btnSize / 2 + 1 * SCALE);

  // Canlı Kronometre
  const timerW = Math.min(W * 0.22, 105 * SCALE);
  const timerX = helpX - timerW - btnGap;
  const timerY = 16 * SCALE;

  ctx.fillStyle = "rgba(12, 18, 38, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(timerX, timerY, timerW, btnSize, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#60a5fa";
  ctx.font = `700 ${15 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`⏱️ ${elapsed.toFixed(1)}s`, timerX + timerW / 2, timerY + btnSize / 2 + 1 * SCALE);

  ctx.restore();
}

// --- Profesyonel Modal Çizim Sistemi (Tam Hizalı, Dışa Taşmaz) -------------
function drawModalCard(
  title: string,
  subtitle: string,
  primaryBtnText: string,
  secondaryBtnText: string | null,
  isWinOrLoss: boolean | null = null,
) {
  ctx.save();
  ctx.fillStyle = "rgba(2, 4, 12, 0.84)";
  ctx.fillRect(0, 0, W, H);

  // Dinamik Kapasiteli Kart
  const cardW = Math.min(W * 0.9, 440 * SCALE);
  const cardH = secondaryBtnText ? 380 * SCALE : 320 * SCALE;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  let borderColor = "rgba(255, 255, 255, 0.2)";
  if (isWinOrLoss === true) borderColor = "rgba(250, 204, 21, 0.5)";
  else if (isWinOrLoss === false) borderColor = "rgba(239, 68, 68, 0.5)";

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Başlık
  let titleColor = "#fef08a";
  if (isWinOrLoss === false) titleColor = "#fca5a5";
  else if (isWinOrLoss === null) titleColor = "#38bdf8";

  ctx.fillStyle = titleColor;
  ctx.font = `800 ${Math.min(W * 0.07, 30 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(title, W / 2, cardY + 28 * SCALE);

  // Alt Metin / Açıklama (Çok Satırlı Otomatik Kaydırma)
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `500 ${Math.min(W * 0.04, 16 * SCALE)}px 'Outfit', sans-serif`;
  const textMaxW = cardW - 48 * SCALE;
  const endY = drawWrappedText(ctx, subtitle, W / 2, cardY + 74 * SCALE, textMaxW, 24 * SCALE);

  // Butonlar
  const btnW = cardW - 56 * SCALE;
  const btnH = 48 * SCALE;
  const btnX = (W - btnW) / 2;

  if (secondaryBtnText) {
    // Çift Buton (Örn: Devam Et / Sıfırla)
    const btn1Y = cardY + cardH - 120 * SCALE;
    uiButtons.modalAction = { x: btnX, y: btn1Y, w: btnW, h: btnH };

    const g1 = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
    g1.addColorStop(0, "#3b82f6");
    g1.addColorStop(1, "#2563eb");
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.roundRect(btnX, btn1Y, btnW, btnH, 24 * SCALE);
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${17 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(primaryBtnText, W / 2, btn1Y + btnH / 2 + 1 * SCALE);

    const btn2Y = cardY + cardH - 64 * SCALE;
    uiButtons.modalSecondary = { x: btnX, y: btn2Y, w: btnW, h: btnH };

    ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 1.5 * SCALE;
    ctx.beginPath();
    ctx.roundRect(btnX, btn2Y, btnW, btnH, 24 * SCALE);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fca5a5";
    ctx.font = `700 ${16 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(secondaryBtnText, W / 2, btn2Y + btnH / 2 + 1 * SCALE);
  } else {
    // Tek Buton (Örn: Tekrar Dene)
    const btnY = cardY + cardH - 74 * SCALE;
    uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };

    const g = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
    if (isWinOrLoss === false) {
      g.addColorStop(0, "#ef4444");
      g.addColorStop(1, "#dc2626");
    } else {
      g.addColorStop(0, "#facc15");
      g.addColorStop(1, "#eab308");
    }

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 24 * SCALE);
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.fillStyle = isWinOrLoss === false ? "#ffffff" : "#0f172a";
    ctx.font = `800 ${18 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(primaryBtnText, W / 2, btnY + btnH / 2 + 1 * SCALE);
  }

  ctx.restore();
}

// --- Özel Yönlendirme (Nasıl Oynanır) Modalı --------------------------------
function drawTutorialModal() {
  ctx.save();
  ctx.fillStyle = "rgba(2, 4, 12, 0.84)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.9, 440 * SCALE);
  const cardH = 410 * SCALE;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#60a5fa";
  ctx.font = `800 ${26 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("NASIL OYNANIR? 📖", W / 2, cardY + 24 * SCALE);

  // Kurallar Listesi
  const rules = [
    { icon: "🧲", title: "Kavanozu Hareket Ettir", desc: "Dokunarak/sürükleyerek veya Yön/WASD tuşlarıyla kavanozu yönet." },
    { icon: "✨", title: "Ateşböceklerini Çek", desc: "Ateşböceklerine yaklaştığında çekim gücü onları kavanoza çeker." },
    { icon: "🐝", title: "Arılardan Kaç", desc: "Arıya çarparsan kavanozdaki 1 ışığı kaybedersin!" },
    { icon: "💔", title: "3 Kaçırma Hakkı", desc: "3 ateşböceği ekranın altından kaçarsa oyun biter." },
  ];

  ctx.textAlign = "left";
  let itemY = cardY + 68 * SCALE;

  for (const r of rules) {
    ctx.font = `${20 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(r.icon, cardX + 24 * SCALE, itemY);

    ctx.fillStyle = "#fef08a";
    ctx.font = `700 ${15 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(r.title, cardX + 56 * SCALE, itemY);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `400 ${13 * SCALE}px 'Outfit', sans-serif`;
    ctx.fillText(r.desc, cardX + 56 * SCALE, itemY + 18 * SCALE);

    itemY += 56 * SCALE;
  }

  // Buton
  const btnW = cardW - 48 * SCALE;
  const btnH = 46 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 64 * SCALE;

  uiButtons.modalAction = { x: btnX, y: btnY, w: btnW, h: btnH };

  const g = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  g.addColorStop(0, "#3b82f6");
  g.addColorStop(1, "#2563eb");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 23 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("ANLADIM, BAŞLA! 🚀", W / 2, btnY + btnH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- Ayarlar Modalı --------------------------------------------------------
function drawSettingsModal() {
  ctx.save();
  ctx.fillStyle = "rgba(2, 4, 12, 0.84)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.9, 440 * SCALE);
  const cardH = 370 * SCALE;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#fef08a";
  ctx.font = `800 ${26 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("AYARLAR & DURAKLAT ⚙️", W / 2, cardY + 24 * SCALE);

  // Toggle 1: Ses Efektleri
  const row1Y = cardY + 78 * SCALE;
  ctx.textAlign = "left";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `600 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("🔊 Ses Efektleri", cardX + 28 * SCALE, row1Y + 8 * SCALE);

  const toggle1W = 100 * SCALE;
  const toggle1H = 36 * SCALE;
  const toggle1X = cardX + cardW - toggle1W - 28 * SCALE;
  uiButtons.toggleSound = { x: toggle1X, y: row1Y, w: toggle1W, h: toggle1H };

  ctx.fillStyle = soundEnabled ? "#22c55e" : "#475569";
  ctx.beginPath();
  ctx.roundRect(toggle1X, row1Y, toggle1W, toggle1H, 18 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${14 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(soundEnabled ? "AÇIK" : "KAPALI", toggle1X + toggle1W / 2, row1Y + toggle1H / 2);

  // Toggle 2: Vakum Çekim Gücü
  const row2Y = cardY + 130 * SCALE;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `600 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("🧲 Vakum Gücü", cardX + 28 * SCALE, row2Y + 8 * SCALE);

  const toggle2W = 100 * SCALE;
  const toggle2H = 36 * SCALE;
  const toggle2X = cardX + cardW - toggle2W - 28 * SCALE;
  uiButtons.toggleMagnet = { x: toggle2X, y: row2Y, w: toggle2W, h: toggle2H };

  ctx.fillStyle = highMagnet ? "#3b82f6" : "#475569";
  ctx.beginPath();
  ctx.roundRect(toggle2X, row2Y, toggle2W, toggle2H, 18 * SCALE);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${14 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(highMagnet ? "YÜKSEK" : "NORMAL", toggle2X + toggle2W / 2, row2Y + toggle2H / 2);

  // Butonlar
  const btnW = cardW - 56 * SCALE;
  const btnH = 46 * SCALE;
  const btnX = (W - btnW) / 2;

  const btn1Y = cardY + cardH - 116 * SCALE;
  uiButtons.modalAction = { x: btnX, y: btn1Y, w: btnW, h: btnH };

  const g1 = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  g1.addColorStop(0, "#3b82f6");
  g1.addColorStop(1, "#2563eb");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.roundRect(btnX, btn1Y, btnW, btnH, 23 * SCALE);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("OYUNA DEVAM ET ▶️", W / 2, btn1Y + btnH / 2 + 1 * SCALE);

  const btn2Y = cardY + cardH - 60 * SCALE;
  uiButtons.modalSecondary = { x: btnX, y: btn2Y, w: btnW, h: btnH };

  ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(btnX, btn2Y, btnW, btnH, 23 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fca5a5";
  ctx.font = `700 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText("OYUNU SIFIRLA 🔄", W / 2, btn2Y + btnH / 2 + 1 * SCALE);

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
    ctx.font = `800 ${22 * SCALE}px 'Outfit', sans-serif`;
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

  // Modal Yönetimi
  if (state === "won") {
    drawModalCard(
      "KAVANOZ DOLDU! ✨",
      `${TARGET} ateşböceğinin hepsini ${finalTime.toFixed(1)} saniyede başarıyla topladın!`,
      "TEKRAR OYNA 🔄",
      null,
      true,
    );
  } else if (state === "gameover") {
    drawModalCard(
      "ATEŞBÖCEKLERİ KAÇTI! 🌙",
      `3 ateşböceği geceye karışarak kaçtı. Toplanan: ${caught}/${TARGET} (${finalTime.toFixed(1)} sn)`,
      "TEKRAR DENE 🔄",
      null,
      false,
    );
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
