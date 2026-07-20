// ATEŞBÖCEKLERİ — Gece bahçesinde kavanozla ateşböceği yakala, arıdan kaç.
// Dört direk (spawner, salınım, girdi, çarpışma) + üst düzey görsel & animasyonlar.

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
  rx: number; // Kavanoz merkezine göre bağıl x (-0.35 ile +0.35 arası)
  ry: number; // Kavanoz tabanına göre bağıl y (-0.85 ile -0.2 arası)
  vx: number;
  vy: number;
  t: number;
}

let state: "playing" | "won" = "playing";
let critters: Critter[] = [];
let particles: Particle[] = [];
let jarFireflies: JarFirefly[] = [];
let caught = 0;
let elapsed = 0;
let finalTime = 0;
let spawnTimer: SpawnTimer = createSpawnTimer();
const shake: Shake = { power: 0, t: 0 };

// Kavanoz fizik & animasyon değişkenleri
let jarSquash = 0;
let jarTilt = 0; // Yatay hareket eğimi (radyan)
let jarVx = 0; // Kavanoz anlık hızı
let prevJarX = 0;
let waspHitFlash = 0; // Arı çarpınca kırmızı parıltı süresi

const jar = { x: 0, y: 0, w: 0, h: 0 };

// Dekor: Gece bahçesi yıldızları ve ortam parçacıkları
let stars: { x: number; y: number; r: number; a: number; speed: number }[] = [];
let ambientSpecks: { x: number; y: number; r: number; vy: number; vx: number; alpha: number; t: number }[] = [];
let grassBlades: { x: number; height: number; swayOffset: number; width: number }[] = [];

function layout() {
  SCALE = Math.min(W, H) / 600;
  jar.w = 100 * SCALE;
  jar.h = 116 * SCALE;
  jar.y = H - jar.h - 32 * SCALE;
  jar.x = Math.max(0, Math.min(W - jar.w, jar.x));

  // Yıldızlar
  stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.75,
    r: (0.6 + Math.random() * 1.4) * SCALE,
    a: 0.15 + Math.random() * 0.45,
    speed: 0.8 + Math.random() * 2,
  }));

  // Ortamda süzülen ışıltı tozları
  ambientSpecks = Array.from({ length: 30 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: (1 + Math.random() * 2) * SCALE,
    vy: (-10 - Math.random() * 20) * SCALE,
    vx: (Math.random() - 0.5) * 15 * SCALE,
    alpha: 0.1 + Math.random() * 0.4,
    t: Math.random() * 10,
  }));

  // Çim bıçakları
  const grassCount = Math.floor(W / (12 * SCALE));
  grassBlades = Array.from({ length: grassCount }, (_, i) => ({
    x: i * (12 * SCALE) + Math.random() * 4 * SCALE,
    height: (28 + Math.random() * 26) * SCALE,
    swayOffset: Math.random() * Math.PI * 2,
    width: (4 + Math.random() * 3) * SCALE,
  }));
}

layout();
jar.x = (W - jar.w) / 2;
prevJarX = jar.x;

window.addEventListener(
  "resize",
  () => {
    const relX = (jar.x + jar.w / 2) / W;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    layout();
    jar.x = relX * W - jar.w / 2;
    jar.x = Math.max(0, Math.min(W - jar.w, jar.x));
    prevJarX = jar.x;
  },
  on,
);

function resetGame() {
  critters = [];
  particles = [];
  jarFireflies = [];
  caught = 0;
  elapsed = 0;
  spawnTimer = createSpawnTimer();
  shake.power = 0;
  jarSquash = 0;
  jarTilt = 0;
  jarVx = 0;
  waspHitFlash = 0;
  jar.x = (W - jar.w) / 2;
  prevJarX = jar.x;
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
    y: -30 * SCALE,
    t: Math.random() * 10,
    amp,
    freq: wasp ? 0.25 + Math.random() * 0.18 : 0.7 + Math.random() * 0.7,
    r: wasp ? 13 * SCALE : 10 * SCALE,
  });
}

// --- Girdi -------------------------------------------------------------------
function toX(e: PointerEvent): number {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * W;
}

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key), on);
window.addEventListener("keyup", (e) => keys.delete(e.key), on);

let pointerX: number | null = null;
canvas.addEventListener(
  "pointerdown",
  (e) => {
    pointerX = toX(e);
  },
  on,
);
window.addEventListener(
  "pointermove",
  (e) => {
    if (pointerX !== null) pointerX = toX(e);
  },
  on,
);
window.addEventListener("pointerup", () => (pointerX = null), on);

canvas.addEventListener(
  "pointerdown",
  () => {
    if (state === "won") resetGame();
  },
  on,
);
window.addEventListener(
  "keydown",
  (e) => {
    if (state === "won" && e.key === "Enter") resetGame();
  },
  on,
);

function updateJar(dt: number) {
  const speed = 580 * SCALE;
  let targetVx = 0;

  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
    targetVx = -speed;
    pointerX = null;
  } else if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
    targetVx = speed;
    pointerX = null;
  } else if (pointerX !== null) {
    const diff = pointerX - (jar.x + jar.w / 2);
    if (Math.abs(diff) > 4 * SCALE) {
      targetVx = Math.sign(diff) * Math.min(Math.abs(diff) * 8, speed * 1.4);
    }
  }

  // Yumuşak hızlanma / yavaşlama
  jarVx += (targetVx - jarVx) * Math.min(1, dt * 18);
  jar.x += jarVx * dt;

  // Sınır koruma
  if (jar.x < 0) {
    jar.x = 0;
    jarVx = 0;
  }
  if (jar.x > W - jar.w) {
    jar.x = W - jar.w;
    jarVx = 0;
  }

  // Eğim (tilt) fiziği
  const targetTilt = (jarVx / speed) * 0.14; // Maks ~8 derece eğim
  jarTilt += (targetTilt - jarTilt) * Math.min(1, dt * 12);
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
      vy: Math.sin(a) * speed - 50 * SCALE,
      life,
      max: life,
      color,
      size: (2 + Math.random() * 3.5) * SCALE,
    });
  }
}

function burstWaspSparks(x: number, y: number) {
  burst(x, y, "hsl(15 100% 60%)", 14);
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
      c.y += fallSpeed * SCALE * dt;

      // Ateşböceği arkasında mikro ışık izi
      if (c.kind === "firefly" && Math.random() < 0.35) {
        const cx = sway(c.t, c.baseX, c.amp, c.freq);
        particles.push({
          x: cx + (Math.random() - 0.5) * 6 * SCALE,
          y: c.y + (Math.random() - 0.5) * 6 * SCALE,
          vx: (Math.random() - 0.5) * 10 * SCALE,
          vy: 10 * SCALE + Math.random() * 20 * SCALE,
          life: 0.3 + Math.random() * 0.25,
          max: 0.55,
          color: "hsl(54 100% 75%)",
          size: (1 + Math.random() * 1.5) * SCALE,
        });
      }
    }

    // Çarpışma kontrolü
    for (const c of critters) {
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
          // Zafer patlaması
          burst(W / 2, H * 0.4, "hsl(52 100% 70%)", 60);
          burst(W / 2, H * 0.4, "hsl(180 100% 75%)", 40);
        }
      } else {
        caught = Math.max(caught - 1, 0);
        syncJarFireflies();
        waspHitFlash = 0.35;
        addShake(shake, 16 * SCALE);
        burstWaspSparks(x, c.y);
      }
    }
    critters = critters.filter((c) => !c.dead && c.y < H + 40 * SCALE);
  }

  // Kavanozdaki iç ateşböceklerinin fiziği
  for (const jf of jarFireflies) {
    jf.t += dt;
    jf.rx += jf.vx * dt;
    jf.ry += jf.vy * dt;
    if (jf.rx < -0.36 || jf.rx > 0.36) jf.vx *= -1;
    if (jf.ry < -0.8 || jf.ry > -0.15) jf.vy *= -1;
    // Hafif rasgele süzülme
    jf.vx += (Math.random() - 0.5) * dt * 2;
    jf.vy += (Math.random() - 0.5) * dt * 2;
    jf.vx = Math.max(-0.5, Math.min(0.5, jf.vx));
    jf.vy = Math.max(-0.5, Math.min(0.5, jf.vy));
  }

  // Sönümlenmeler
  updateShake(shake, dt);
  jarSquash = Math.max(0, jarSquash - dt * 1.8);
  waspHitFlash = Math.max(0, waspHitFlash - dt * 2.5);

  // Parçacıklar
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * SCALE * dt;
  }
  particles = particles.filter((p) => p.life > 0);

  // Ortam parçacıkları
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
  // Zengin Gece Gökyüzü Gradiyenti
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#080c1d");
  g.addColorStop(0.4, "#0b122b");
  g.addColorStop(0.8, "#060917");
  g.addColorStop(1, "#030409");
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  // Yanıp Sönen Yıldızlar
  for (const s of stars) {
    const alpha = s.a + Math.sin(elapsed * s.speed + s.x) * 0.15;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
    ctx.fillStyle = "#dce7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ortam Işıltı Tozları
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

  // Arka Plan Çim Silüeti
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

// --- Profesyonel Ateşböceği Çizimi -----------------------------------------
function drawFirefly(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();

  // Yalpalama açısı (salınım yönüne göre eğilme)
  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(120 * SCALE, vx) - Math.PI / 2;

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.3);

  // 1. Çok katmanlı parlama aurası (Pulsing Glow)
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

  // 2. Çırpınan Şeffaf Kanatlar
  const wingAngle = Math.sin(t * 38) * 0.45;
  ctx.fillStyle = "rgba(230, 245, 255, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 0.8 * SCALE;

  // Sol Kanat
  ctx.save();
  ctx.rotate(-0.3 - wingAngle);
  ctx.beginPath();
  ctx.ellipse(-r * 0.85, -r * 0.4, r * 1.1, r * 0.48, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Sağ Kanat
  ctx.save();
  ctx.rotate(0.3 + wingAngle);
  ctx.beginPath();
  ctx.ellipse(r * 0.85, -r * 0.4, r * 1.1, r * 0.48, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. Böcek Gövdesi
  // Göğüs (Thorax)
  ctx.fillStyle = "#1e1b18";
  ctx.beginPath();
  ctx.arc(0, -r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Baş ve Gözler
  ctx.fillStyle = "#0f0d0b";
  ctx.beginPath();
  ctx.arc(0, -r * 0.65, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.72, r * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Işıldayan Karın (Glowing Abdomen)
  ctx.fillStyle = "hsl(54 100% 82%)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.4, r * 0.52, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sıcak Çekirdek
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.28, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// --- Profesyonel Arı / Eşek Arısı Çizimi ------------------------------------
function drawWasp(x: number, y: number, r: number, t: number, amp: number, freq: number) {
  ctx.save();

  // Yalpalama ve yön açısı
  const vx = swayVel(t, amp, freq);
  const tilt = Math.atan2(140 * SCALE, vx) - Math.PI / 2;

  ctx.translate(x, y);
  ctx.rotate(tilt * 0.45);

  // 1. Tehlike Aurası (Kırmızımsı Parıltı)
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

  // 2. Çırpınan Çift Kanatlar (Yüksek frekanslı animasyon)
  const wingFlutter = Math.sin(t * 48) * 0.5;

  ctx.fillStyle = "rgba(200, 230, 255, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1 * SCALE;

  // Sol Arka & Ön Kanat
  ctx.save();
  ctx.rotate(-0.5 - wingFlutter);
  ctx.beginPath();
  ctx.ellipse(-r * 1.15, -r * 0.6, r * 1.35, r * 0.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Sağ Arka & Ön Kanat
  ctx.save();
  ctx.rotate(0.5 + wingFlutter);
  ctx.beginPath();
  ctx.ellipse(r * 1.15, -r * 0.6, r * 1.35, r * 0.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. İğne (Stinger)
  ctx.fillStyle = "#0f0d0a";
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 1.25);
  ctx.lineTo(r * 0.25, r * 1.25);
  ctx.lineTo(0, r * 1.85);
  ctx.closePath();
  ctx.fill();

  // 4. Çizgili Tüylü Gövde (Abdomen)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.92, r * 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#facc15"; // Canlı Arı Sarısı
  ctx.fill();
  ctx.clip();

  // Siyah Şeritler (Kavisli ve detaylı)
  ctx.fillStyle = "#14110f";
  const bH = r * 0.42;
  ctx.fillRect(-r * 1.2, -r * 0.8, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, -r * 0.05, r * 2.4, bH);
  ctx.fillRect(-r * 1.2, r * 0.7, r * 2.4, bH);
  ctx.restore();

  // Göğüs (Thorax) & Tüy Dokusu
  ctx.fillStyle = "#26201a";
  ctx.beginPath();
  ctx.arc(0, -r * 0.45, r * 0.68, 0, Math.PI * 2);
  ctx.fill();

  // Antenler
  ctx.strokeStyle = "#14110f";
  ctx.lineWidth = 1.8 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.9);
  ctx.quadraticCurveTo(-r * 0.6, -r * 1.5, -r * 0.75, -r * 1.7);
  ctx.moveTo(r * 0.2, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.6, -r * 1.5, r * 0.75, -r * 1.7);
  ctx.stroke();

  // Baş & Tehditkar Gözler
  ctx.fillStyle = "#14110f";
  ctx.beginPath();
  ctx.arc(0, -r * 0.85, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Parlak Siyah Parlama Gözleri
  ctx.fillStyle = "#ef4444"; // Kızgın Kırmızımsı Göz Vurgusu
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.92, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.92, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-r * 0.24, -r * 0.96, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.96, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// --- Cam Kavanoz Çizimi (Taban Merkezli) ------------------------------------
function drawJar() {
  const w = jar.w;
  const h = jar.h;
  const glow = caught / TARGET;

  ctx.save();

  // 1. Dış Işık Parıltısı (Doluluk Seviyesine Göre Dinamik)
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

  // Arı çarptığında kırmızı çeper parıltısı
  if (waspHitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 50, 30, ${waspHitFlash * 0.7})`;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 6 * SCALE, -h - 12 * SCALE, w + 12 * SCALE, h + 16 * SCALE, 16 * SCALE);
    ctx.fill();
    ctx.restore();
  }

  // 2. Cam Arka Yüzeyi & Taban Gölgesi
  ctx.fillStyle = "rgba(10, 22, 40, 0.45)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 14 * SCALE);
  ctx.fill();

  // 3. Mantar Tıpa & İp Dekoru (Jar Lid / Cork)
  const neckW = w * 0.82;
  const neckH = 14 * SCALE;
  const neckY = -h - neckH * 0.5;

  // Mantar Tıpa
  const corkG = ctx.createLinearGradient(-neckW / 2, 0, neckW / 2, 0);
  corkG.addColorStop(0, "#8c5a32");
  corkG.addColorStop(0.5, "#b87d4b");
  corkG.addColorStop(1, "#6e4324");
  ctx.fillStyle = corkG;
  ctx.beginPath();
  ctx.roundRect(-neckW * 0.44, neckY - 12 * SCALE, neckW * 0.88, 14 * SCALE, 4 * SCALE);
  ctx.fill();

  // Cam Ağız Boğumu (Neck Rim)
  ctx.fillStyle = "rgba(195, 230, 255, 0.38)";
  ctx.strokeStyle = "rgba(220, 245, 255, 0.75)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(-neckW / 2, neckY, neckW, neckH, 5 * SCALE);
  ctx.fill();
  ctx.stroke();

  // Ağız İpi Dekoru
  ctx.strokeStyle = "#d4a373";
  ctx.lineWidth = 2.5 * SCALE;
  ctx.beginPath();
  ctx.moveTo(-neckW / 2 + 2 * SCALE, neckY + neckH / 2);
  ctx.lineTo(neckW / 2 - 2 * SCALE, neckY + neckH / 2);
  ctx.stroke();

  // 4. Kavanoz İçindeki Işık Sıvısı / Parıltı Tabanı
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

  // 5. Kavanoz İçinde Yakalanmış Ateşböcekleri
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

    // Çekirdek
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Ön Cam Gövdesi & Parlak İnce Yansımalar (Glass Specular Highlights)
  ctx.strokeStyle = "rgba(215, 240, 255, 0.65)";
  ctx.lineWidth = 2.8 * SCALE;
  ctx.fillStyle = "rgba(180, 225, 255, 0.08)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, 14 * SCALE);
  ctx.fill();
  ctx.stroke();

  // Sol Cam Yansıması (Kavisli Parlak Şerit)
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5 * SCALE, -h + 8 * SCALE, 6 * SCALE, h - 22 * SCALE, 3 * SCALE);
  ctx.fill();

  // Sağ Cam İnce Parlama
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - 8 * SCALE, -h + 12 * SCALE, 3.5 * SCALE, h - 28 * SCALE, 2 * SCALE);
  ctx.fill();

  ctx.restore();
}

// --- HUD & Skor Arayüzü -----------------------------------------------------
function drawHUD() {
  ctx.save();

  // Üst Bar Glassmorphism Kartı
  const barW = Math.min(W * 0.88, 340 * SCALE);
  const barH = 50 * SCALE;
  const barX = (W - barW) / 2;
  const barY = 20 * SCALE;

  ctx.fillStyle = "rgba(12, 18, 38, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5 * SCALE;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 25 * SCALE);
  ctx.fill();
  ctx.stroke();

  // Ateşböceği İkonu
  const iconX = barX + 28 * SCALE;
  const iconY = barY + barH / 2;
  drawFirefly(iconX, iconY, 7 * SCALE, elapsed, 0, 0);

  // İlerleme Metni
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fef08a";
  ctx.font = `700 ${18 * SCALE}px 'Outfit', sans-serif`;
  ctx.fillText(`${caught} / ${TARGET}`, barX + 48 * SCALE, barY + barH / 2);

  // İlerleme Çubuğu (Progress Bar)
  const pBarX = barX + 115 * SCALE;
  const pBarW = barW - 135 * SCALE;
  const pBarH = 12 * SCALE;
  const pBarY = barY + (barH - pBarH) / 2;

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.roundRect(pBarX, pBarY, pBarW, pBarH, pBarH / 2);
  ctx.fill();

  if (caught > 0) {
    const fillW = Math.max(pBarH, (pBarW * caught) / TARGET);
    const pGrad = ctx.createLinearGradient(pBarX, 0, pBarX + pBarW, 0);
    pGrad.addColorStop(0, "#facc15");
    pGrad.addColorStop(1, "#a3e635");

    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(pBarX, pBarY, fillW, pBarH, pBarH / 2);
    ctx.fill();
  }

  ctx.restore();
}

// --- Zafer Ekranı ------------------------------------------------------------
function drawWin() {
  ctx.save();
  ctx.fillStyle = "rgba(3, 5, 14, 0.78)";
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(W * 0.85, 420 * SCALE);
  const cardH = 320 * SCALE;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;

  // Glassmorphic Modal Card
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
  ctx.lineWidth = 2 * SCALE;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24 * SCALE);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";

  // Başlık Parıltısı
  ctx.fillStyle = "#fef08a";
  ctx.font = `800 ${Math.min(W * 0.08, 38 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("KAVANOZ DOLDU! ✨", W / 2, cardY + 70 * SCALE);

  // Açıklama
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `600 ${Math.min(W * 0.045, 20 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText(
    `${TARGET} ateşböceğini ${finalTime.toFixed(1)} saniyede topladın!`,
    W / 2,
    cardY + 130 * SCALE,
  );

  // Tekrar Oyna Butonu
  const btnW = cardW * 0.65;
  const btnH = 50 * SCALE;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 95 * SCALE;

  const btnG = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
  btnG.addColorStop(0, "#facc15");
  btnG.addColorStop(1, "#eab308");

  ctx.fillStyle = btnG;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 25 * SCALE);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = `800 ${Math.min(W * 0.045, 20 * SCALE)}px 'Outfit', sans-serif`;
  ctx.fillText("TEKRAR OYNA", W / 2, btnY + btnH / 2 + 1 * SCALE);

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

  // Düşen Canlılar (Fireflies & Wasps)
  for (const c of critters) {
    const x = sway(c.t, c.baseX, c.amp, c.freq);
    if (c.kind === "firefly") {
      drawFirefly(x, c.y, c.r, c.t, c.amp, c.freq);
    } else {
      drawWasp(x, c.y, c.r, c.t, c.amp, c.freq);
    }
  }

  // Parçacıklar (Lighter Blend)
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

  // Kavanoz (Squash, Stretch ve Tilt Dönüşümleri)
  ctx.save();
  ctx.translate(jar.x + jar.w / 2, jar.y + jar.h);
  ctx.rotate(jarTilt);
  ctx.scale(1 + jarSquash, 1 - jarSquash);
  drawJar();
  ctx.restore();

  // HUD
  if (state === "playing") {
    drawHUD();
  }

  ctx.restore();

  if (state === "won") {
    drawWin();
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
