// ATEŞBÖCEKLERİ — Gece bahçesinde uçan ateşböceklerini yakala, arılardan kaç!
// Güncelleme: Yükselen uçuş mantığı, Kavanoz ile kovalama (2D Dokunmatik & Klavye), 3 Kaçırma Hakkı, Canlı Kronometre.

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

// --- Oyun durumu -------------------------------------------------------------
const TARGET = 6;
const MAX_MISSED = 3;

interface Critter {
  kind: "firefly" | "wasp";
  baseX: number;
  y: number;
  t: number;
  amp: number;
  freq: number;
  r: number;
  dead?: boolean;
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
}

interface JarFirefly {
  rx: number;
  ry: number;
  vx: number;
  vy: number;
  t: number;
}

let state: "playing" | "won" | "gameover" = "playing";
let critters: Critter[] = [];
let particles: Particle[] = [];
let jarFireflies: JarFirefly[] = [];
let caught = 0;
let missed = 0;
let elapsed = 0;
let finalTime = 0;
let spawnTimer: SpawnTimer = createSpawnTimer();
const shake: Shake = { power: 0, t: 0 };

// Kavanoz fizik & animasyon değişkenleri
let jarSquash = 0;
let jarTilt = 0;
let jarVx = 0;
let jarVy = 0;
let waspHitFlash = 0;

const jar = { x: 0, y: 0, w: 0, h: 0 };

// Ortam ögeleri
let stars: { x: number; y: number; r: number; a: number; speed: number }[] = [];
let ambientSpecks: { x: number; y: number; r: number; vy: number; vx: number; alpha: number; t: number }[] = [];
let grassBlades: { x: number; height: number; swayOffset: number; width: number }[] = [];

function layout() {
  SCALE = Math.min(W, H) / 600;
  jar.w = 100 * SCALE;
  jar.h = 116 * SCALE;
  jar.y = Math.max(H * 0.3, Math.min(H - jar.h - 32 * SCALE, jar.y || H - jar.h - 32 * SCALE));
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x || (W - jar.w) / 2));

  stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.85,
    r: (0.6 + Math.random() * 1.4) * SCALE,
    a: 0.15 + Math.random() * 0.45,
    speed: 0.8 + Math.random() * 2,
  }));

  ambientSpecks = Array.from({ length: 30 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: (1 + Math.random() * 2) * SCALE,
    vy: (-15 - Math.random() * 25) * SCALE, // Yukarı süzülen ışıltı tozları
    vx: (Math.random() - 0.5) * 15 * SCALE,
    alpha: 0.1 + Math.random() * 0.4,
    t: Math.random() * 10,
  }));

  const grassCount = Math.floor(W / (12 * SCALE));
  grassBlades = Array.from({ length: grassCount }, (_, i) => ({
    x: i * (12 * SCALE) + Math.random() * 4 * SCALE,
    height: (32 + Math.random() * 28) * SCALE,
    swayOffset: Math.random() * Math.PI * 2,
    width: (4 + Math.random() * 3) * SCALE,
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
    jar.y = Math.max(H * 0.25, Math.min(H - jar.h - 20 * SCALE, jar.y));
  },
  on,
);

function resetGame() {
  critters = [];
  particles = [];
  jarFireflies = [];
  caught = 0;
  missed = 0;
  elapsed = 0;
  spawnTimer = createSpawnTimer();
  shake.power = 0;
  jarSquash = 0;
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
  while (jarFireflies.length < caught) {
    jarFireflies.push({
      rx: (Math.random() - 0.5) * 0.5,
      ry: -0.3 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      t: Math.random() * 10,
    });
  }
  while (jarFireflies.length > caught) {
    jarFireflies.pop();
  }
}

function spawnCritter() {
  const wasp = Math.random() < 0.28;
  const amp = wasp
    ? (38 + Math.random() * 30) * SCALE
    : (12 + Math.random() * 18) * SCALE;
  critters.push({
    kind: wasp ? "wasp" : "firefly",
    baseX: amp + 25 * SCALE + Math.random() * (W - 2 * (amp + 25 * SCALE)),
    y: H + 35 * SCALE, // Ekranın ALTINDAN doğar ve YUKARI uçarlar!
    t: Math.random() * 10,
    amp,
    freq: wasp ? 0.25 + Math.random() * 0.18 : 0.7 + Math.random() * 0.7,
    r: wasp ? 13 * SCALE : 10 * SCALE,
  });
}

// --- Girdi & Mobil Kontroller -----------------------------------------------
let pointerTarget: { x: number; y: number } | null = null;

function setPointerTarget(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((clientX - rect.left) / rect.width) * W;
  const canvasY = ((clientY - rect.top) / rect.height) * H;

  // Kavanozun merkezini parmağın olduğu konuma yumuşakça getir
  pointerTarget = {
    x: Math.max(0, Math.min(W - jar.w, canvasX - jar.w / 2)),
    y: Math.max(H * 0.25, Math.min(H - jar.h - 15 * SCALE, canvasY - jar.h * 0.6)),
  };
}

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key), on);
window.addEventListener("keyup", (e) => keys.delete(e.key), on);

// Dokunmatik ve Fare Kontrolleri
canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (state === "playing") {
      setPointerTarget(e.clientX, e.clientY);
    } else {
      resetGame();
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

// Mobil Scroll ve Çimlenme Engelleme
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) {
      if (state === "playing") {
        setPointerTarget(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        resetGame();
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
  },
  on,
);

function updateJar(dt: number) {
  const speed = 620 * SCALE;
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
    
    // Mobil dokunma ile seri ve pürüzsüz takip
    jar.x += diffX * Math.min(1, dt * 22);
    jar.y += diffY * Math.min(1, dt * 22);

    jarVx = diffX * 12;
    jarVy = diffY * 12;
  } else {
    jarVx += (targetVx - jarVx) * Math.min(1, dt * 18);
    jarVy += (targetVy - jarVy) * Math.min(1, dt * 18);

    jar.x += jarVx * dt;
    jar.y += jarVy * dt;
  }

  // Sınırlar
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
  jar.y = Math.max(H * 0.25, Math.min(H - jar.h - 15 * SCALE, jar.y));

  // Eğim (tilt)
  const targetTilt = (jarVx / speed) * 0.16;
  jarTilt += (targetTilt - jarTilt) * Math.min(1, dt * 14);
}

// --- Parçacık Patlaması -----------------------------------------------------
function burst(x: number, y: number, color = "hsl(52 100% 70%)", count = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (50 + Math.random() * 180) * SCALE;
    const life = 0.4 + Math.random() * 0.4;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life,
      max: life,
      color,
      size: (2 + Math.random() * 3.5) * SCALE,
    });
  }
}

// --- Güncelleme --------------------------------------------------------------
function update(dt: number) {
  if (state === "playing") {
    elapsed += dt;

    const { spawnEvery, fallSpeed } = difficulty(elapsed);
    if (tickSpawn(spawnTimer, dt, spawnEvery)) spawnCritter();

    updateJar(dt);

    for (const c of critters) {
      c.t += dt;
      c.y -= fallSpeed * SCALE * dt; // YUKARI DOĞRU UÇUŞ (-y)

      // Ateşböceği ışık tozu (uçarken arkasında/aşağısında kalır)
      if (c.kind === "firefly" && Math.random() < 0.35) {
        const cx = sway(c.t, c.baseX, c.amp, c.freq);
        particles.push({
          x: cx + (Math.random() - 0.5) * 6 * SCALE,
          y: c.y + 8 * SCALE + (Math.random() - 0.5) * 6 * SCALE,
          vx: (Math.random() - 0.5) * 10 * SCALE,
          vy: 20 * SCALE + Math.random() * 30 * SCALE,
          life: 0.3 + Math.random() * 0.25,
          max: 0.55,
          color: "hsl(54 100% 75%)",
          size: (1 + Math.random() * 1.5) * SCALE,
        });
      }

      // Ekranın ÜSTÜNDEN kaçış kontrolü
      if (c.y < -40 * SCALE && !c.dead) {
        c.dead = true;
        if (c.kind === "firefly") {
          missed++;
          const cx = sway(c.t, c.baseX, c.amp, c.freq);
          burst(cx, 15 * SCALE, "hsl(0 100% 65%)", 14);
          addShake(shake, 10 * SCALE);
          if (missed >= MAX_MISSED) {
            finalTime = elapsed;
            state = "gameover";
          }
        }
      }
    }

    // Çarpışma kontrolü
    for (const c of critters) {
      if (c.dead) continue;
      const x = sway(c.t, c.baseX, c.amp, c.freq);
      if (!hitCircleRect(x, c.y, c.r, jar.x, jar.y, jar.w, jar.h)) continue;
      c.dead = true;
      if (c.kind === "firefly") {
        caught = Math.min(caught + 1, TARGET);
        syncJarFireflies();
        burst(x, c.y, "hsl(52 100% 75%)", 22);
        burst(x, c.y, "hsl(80 100% 70%)", 8);
        jarSquash = 0.28;
        if (caught === TARGET) {
          finalTime = elapsed;
          state = "won";
          burst(W / 2, H * 0.4, "hsl(52 100% 70%)", 60);
          burst(W / 2, H * 0.4, "hsl(180 100% 75%)", 40);
        }
      } else {
        caught = Math.max(caught - 1, 0);
        syncJarFireflies();
        waspHitFlash = 0.38;
        addShake(shake, 18 * SCALE);
        burst(x, c.y, "hsl(15 100% 60%)", 16);
      }
    }
    critters = critters.filter((c) => !c.dead && c.y > -50 * SCALE);
  }

  // İç ateşböceklerinin hareketi
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
  jarSquash = Math.max(0, jarSquash - dt * 1.8);
  waspHitFlash = Math.max(0, waspHitFlash - dt * 2.5);

  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const s of ambientSpecks) {
    s.t += dt;
    s.y += s.vy * dt;
    s.x += s.vx * dt + Math.sin(s.t * 1.5) * 8 * SCALE * dt;
    if (s.y < -20 * SCALE) {
      s.y = H + 20 * SCALE;
      s.x = Math.random() * W;
    }
  }
}

// --- Çizim Fonksiyonları ------------------------------------------------------

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#060918");
  g.addColorStop(0.5, "#0a1128");
  g.addColorStop(0.9, "#050816");
  g.addColorStop(1, "#020308");
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  for (const s of stars) {
    const alpha = s.a + Math.sin(elapsed * s.speed + s.x) * 0.15;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
    ctx.fillStyle = "#dce7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "lighter";
  for (const s of ambientSpecks) {
    const a = s.alpha * (0.6 + 0.4 * Math.sin(s.t * 2));
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = "hsl(52 100% 70%)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#07121c";
  for (const b of grassBlades) {
    const swayX = Math.sin(elapsed * 2 + b.swayOffset) * 6 * SCALE;
    ctx.beginPath();
    ctx.moveTo(b.x - b.width / 2, H);
    ctx.quadraticCurveTo(b.x, H - b.height * 0.6, b.x + swayX, H - b.height);
    ctx.quadraticCurveTo(b.x + b.width / 2, H - b.height * 0.6, b.x + b.width / 2, H);
    ctx.fill();
  }
}

// YUKARI UÇAN Ateşböceği Çizimi
function drawFirefly(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();

  const vx = swayVel(t, amp, freq);
  // Yukarı doğru uçarken eğim açısı
  const tilt = Math.atan2(vx, 140 * SCALE);

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.4);

  // 1. Parlama Aurası
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.85 + 0.25 * Math.sin(t * 9);
  const auraR = r * 3.8 * pulse;

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, auraR);
  g.addColorStop(0, "hsl(52 100% 80% / 0.9)");
  g.addColorStop(0.3, "hsl(50 100% 60% / 0.4)");
  g.addColorStop(0.7, "hsl(70 100% 50% / 0.12)");
  g.addColorStop(1, "hsl(52 100% 50% / 0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Kanatlar
  const wingAngle = Math.sin(t * 38) * 0.45;
  ctx.fillStyle = "rgba(230, 245, 255, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 0.8 * SCALE;

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

  // 3. Yukarı Yönlü Gövde (Baş yukarıda -y, Karın aşağıda +y)
  // Baş & Gözler
  ctx.fillStyle = "#0f0d0b";
  ctx.beginPath();
  ctx.arc(0, -r * 0.65, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Göğüs
  ctx.fillStyle = "#1e1b18";
  ctx.beginPath();
  ctx.arc(0, -r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Işıldayan Karın
  ctx.fillStyle = "hsl(54 100% 82%)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.4, r * 0.52, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.28, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// YUKARI UÇAN Eşek Arısı Çizimi
function drawWasp(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();

  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(vx, 140 * SCALE);

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.45);

  // 1. Tehlike Aurası
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

  // 2. Kanatlar
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

  // 3. Yukarı Uçan Gövde (Baş yukarıda -y, İğne altta +y)
  // Antenler
  ctx.strokeStyle = "#14110f";
  ctx.lineWidth = 1.8 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.8);
  ctx.quadraticCurveTo(-r * 0.6, -r * 1.4, -r * 0.75, -r * 1.6);
  ctx.moveTo(r * 0.2, -r * 0.8);
  ctx.quadraticCurveTo(r * 0.6, -r * 1.4, r * 0.75, -r * 1.6);
  ctx.stroke();

  // Baş & Gözler
  ctx.fillStyle = "#14110f";
  ctx.beginPath();
  ctx.arc(0, -r * 0.75, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.82, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.82, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.24, -r * 0.86, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.86, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Göğüs
  ctx.fillStyle = "#26201a";
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r * 0.68, 0, Math.PI * 2);
  ctx.fill();

  // Çizgili Karın
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.92, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = "#14110f";
  const bH = r * 0.42;
  ctx.fillRect(-r * 1.2, -r * 0.6, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, r * 0.15, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, r * 0.8, r * 2.4, bH);
  ctx.restore();

  // İğne
  ctx.fillStyle = "#0f0d0a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 1.35);
  ctx.lineTo(r * 0.25, r * 1.35);
  ctx.lineTo(0, r * 1.9);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// --- Cam Kavanoz Çizimi ------------------------------------------------------
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
    g.addColorStop(0, "hsl(54 100% 85% / 0.9)");
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

// --- HUD: Skor, Kaçırma Hakları ve Canlı Kronometre ------------------------
function drawHUD() {
  ctx.save();

  // 1. Sol Üst: Yakalama & Kaçırma Hakları Kartı
  const barW = Math.min(W * 0.58, 260 * SCALE);
  const barH = 48 * SCALE;
  const barX = 16 * SCALE;
  const barY = 16 * SCALE;

  ctx.fillStyle = "rgba(12, 18, 38, 0.72)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  // Yakalama İkonu & Skor
  const iconX = barX + 22 * SCALE;
  const iconY = barY + barH / 2;
  drawFirefly(iconX, iconY, 6 * SCALE, elapsed, 0, 0);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fef08a";
  ctx.font = `700 ${17 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${caught}/${TARGET}`, barX + 38 * SCALE, barY + barH / 2);

  // 3 Kaçırma Hakkı Simgeleri
  const heartsX = barX + 115 * SCALE;
  const remainingLives = MAX_MISSED - missed;

  for (let i = 0; i < MAX_MISSED; i++) {
    const hx = heartsX + i * 22 * SCALE;
    const hy = barY + barH / 2;
    if (i < remainingLives) {
      // Aktif can (parlayan sarı ışık)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "hsl(52 100% 70%)";
      ctx.beginPath();
      ctx.arc(hx, hy, 6.5 * SCALE, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(hx, hy, 2.5 * SCALE, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Kaçırılmış can (sönük kırmızı x)
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.beginPath();
      ctx.arc(hx, hy, 6.5 * SCALE, 0, Math.PI * 2);
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

  // 2. Sağ Üst: Canlı Kronometre
  const timerW = Math.min(W * 0.32, 120 * SCALE);
  const timerH = 48 * SCALE;
  const timerX = W - timerW - 16 * SCALE;
  const timerY = 16 * SCALE;

  ctx.fillStyle = "rgba(12, 18, 38, 0.72)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(timerX, timerY, timerW, timerH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#60a5fa";
  ctx.font = `700 ${16 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`⏱️ ${elapsed.toFixed(1)}s`, timerX + timerW / 2, timerY + timerH / 2 + 1 * SCALE);

  ctx.restore();
}

// --- Oyun Sonu / Zafer Ekranları -------------------------------------------
function drawModal(title: string, subtitle: string, btnText: string, isWin: boolean) {
  ctx.save();
  ctx.fillStyle = "rgba(3, 5, 14, 0.82)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.88, 420 * SCALE);
  const cardH = 320 * SCALE;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  ctx.strokeStyle = isWin ? "rgba(250, 204, 21, 0.4)" : "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";

  // Başlık
  ctx.fillStyle = isWin ? "#fef08a" : "#fca5a5";
  ctx.font = `800 ${Math.min(W * 0.08, 36 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(title, W / 2, cardY + 70 * SCALE);

  // Açıklama
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${Math.min(W * 0.042, 19 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(subtitle, W / 2, cardY + 125 * SCALE);

  // Süre Bilgisi
  ctx.fillStyle = "#94a3b8";
  ctx.font = `500 ${Math.min(W * 0.038, 16 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(`Geçen Süre: ${finalTime.toFixed(1)} saniye`, W / 2, cardY + 160 * SCALE);

  // Buton
  const btnW = cardW * 0.68;
  const btnH = 50 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 95 * SCALE;

  const btnG = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  if (isWin) {
    btnG.addColorStop(0, "#facc15");
    btnG.addColorStop(1, "#eab308");
  } else {
    btnG.addColorStop(0, "#ef4444");
    btnG.addColorStop(1, "#dc2626");
  }

  ctx.fillStyle = btnG;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 25 * SCALE);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.min(W * 0.045, 20 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(btnText, W / 2, btnY + btnH / 2 + 1 * SCALE);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 ${Math.min(W * 0.035, 14 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("dokun ya da Enter'a bas", W / 2, btnY + btnH + 24 * SCALE);

  ctx.restore();
}

// --- Ana Çizim Döngüsü ------------------------------------------------------
function draw() {
  const { x: sx, y: sy } = shakeOffset(shake);
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();

  // Uçan Canlılar
  for (const c of critters) {
    const x = sway(c.t, c.baseX, c.amp, c.freq);
    if (c.kind === "firefly") {
      drawFirefly(x, c.y, c.r, c.t, c.amp, c.freq);
    } else {
      drawWasp(x, c.y, c.r, c.t, c.amp, c.freq);
    }
  }

  // Parçacıklar
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

  // Kavanoz (Kovalama Fiziği)
  ctx.save();
  ctx.translate(jar.x + jar.w / 2, jar.y + jar.h);
  ctx.rotate(jarTilt);
  ctx.scale(1 + jarSquash, 1 - jarSquash);
  drawJar();
  ctx.restore();

  if (state === "playing") {
    drawHUD();
  }

  ctx.restore();

  if (state === "won") {
    drawModal("KAVANOZ DOLDU! ✨", `${TARGET} ateşböceğinin hepsini yakaladın!`, "TEKRAR OYNA", true);
  } else if (state === "gameover") {
    drawModal("ATEŞBÖCEKLERİ KAÇTI! 🌙", "3 ateşböceği geceye karıştı.", "TEKRAR DENE", false);
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
