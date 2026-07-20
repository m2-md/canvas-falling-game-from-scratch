import { describe, it, expect } from "vitest";
import {
  type Shake,
  addShake,
  createSpawnTimer,
  difficulty,
  hitCircleRect,
  shakeOffset,
  sway,
  swayVel,
  tickSpawn,
  updateShake,
} from "../src/logic";

describe("tickSpawn: biriktiricili spawner", () => {
  it("enjekte edilen rand ile spawn aralığı deterministiktir", () => {
    const t = createSpawnTimer(1);
    const rand = () => 0.5; // hep orta değer
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(false); // 0.6 < 1: henüz değil
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(true); // 1.2 ≥ 1: üret
    expect(t.next).toBeCloseTo(1); // 1 * (0.6 + 0.5 * 0.8) = 1
    expect(t.acc).toBeCloseTo(0.2); // artık taşındı, çöpe gitmedi
  });

  it("uzun tek karede de artık taşınır", () => {
    const t = createSpawnTimer(1);
    expect(tickSpawn(t, 1.7, 1, () => 0.5)).toBe(true);
    expect(t.acc).toBeCloseTo(0.7); // sekme değişimi karesi çöpe gitmez
  });

  it("varsayılan ilk hedef 0.6 sn'dir", () => {
    expect(createSpawnTimer()).toEqual({ next: 0.6, acc: 0 });
  });

  it("yeni aralık spawnEvery'nin ±%40 bandında kalır", () => {
    for (const r of [0, 0.25, 0.75, 0.999]) {
      const t = createSpawnTimer(0.01);
      tickSpawn(t, 1, 2, () => r);
      expect(t.next).toBeGreaterThanOrEqual(2 * 0.6);
      expect(t.next).toBeLessThanOrEqual(2 * 1.4);
    }
  });
});

describe("sway: sinüs salınımı", () => {
  it("t=0'da merkez çizgidedir", () => {
    expect(sway(0, 100, 30, 2)).toBe(100);
  });

  it("merkezden asla amp'ten fazla uzaklaşmaz", () => {
    for (let t = 0; t < 5; t += 0.01) {
      expect(Math.abs(sway(t, 200, 25, 1.3) - 200)).toBeLessThanOrEqual(
        25 + 1e-9,
      );
    }
  });

  it("çeyrek periyotta tepe noktasına ulaşır", () => {
    // freq=1 → periyot 1 sn; t=0.25'te sin(π/2)=1 → base + amp
    expect(sway(0.25, 50, 10, 1)).toBeCloseTo(60);
  });

  it("swayVel salınımın anlık yatay türevini verir", () => {
    // t=0'da cos(0)=1 -> max hız
    expect(swayVel(0, 10, 1)).toBeCloseTo(10 * 2 * Math.PI);
    // t=0.25'te cos(π/2)=0 -> dönme noktası, hız 0
    expect(swayVel(0.25, 10, 1)).toBeCloseTo(0);
  });
});

describe("hitCircleRect: daire-dikdörtgen çarpışması", () => {
  const rect = [100, 100, 80, 40] as const; // rx, ry, rw, rh

  it("merkez dikdörtgenin içindeyse her zaman çarpar", () => {
    expect(hitCircleRect(140, 120, 1, ...rect)).toBe(true);
  });

  it("kenara tam yarıçap mesafesi temas sayılır (≤)", () => {
    expect(hitCircleRect(95, 120, 5, ...rect)).toBe(true); // tam temas
    expect(hitCircleRect(94.9, 120, 5, ...rect)).toBe(false); // kıl payı uzak
  });

  it("köşe teması köşegen mesafeyle ölçülür", () => {
    // en yakın nokta köşe (100,100); merkez (97,96) → mesafe 3-4-5 üçgeni = 5
    expect(hitCircleRect(97, 96, 5, ...rect)).toBe(true);
    expect(hitCircleRect(97, 96, 4.9, ...rect)).toBe(false);
  });

  it("uzak daire çarpmaz", () => {
    expect(hitCircleRect(0, 0, 10, ...rect)).toBe(false);
  });
});

describe("difficulty: zorluk eğrisi", () => {
  it("0. saniyede taban değerler", () => {
    expect(difficulty(0)).toEqual({ spawnEvery: 1.4, fallSpeed: 120 });
  });

  it("60. saniyede doyuma ulaşır ve orada kalır", () => {
    const d = difficulty(60);
    expect(d.spawnEvery).toBeCloseTo(0.5);
    expect(d.fallSpeed).toBeCloseTo(280);
    expect(difficulty(180)).toEqual(difficulty(60)); // sonsuza kadar artmaz
  });

  it("aralık monoton azalır, hız monoton artar", () => {
    let prev = difficulty(0);
    for (let s = 5; s <= 60; s += 5) {
      const d = difficulty(s);
      expect(d.spawnEvery).toBeLessThan(prev.spawnEvery);
      expect(d.fallSpeed).toBeGreaterThan(prev.fallSpeed);
      prev = d;
    }
  });
});

describe("shake: sarsıntı üçlüsü", () => {
  it("addShake tavanı (24) aşmaz", () => {
    const s: Shake = { power: 0, t: 0 };
    addShake(s, 14);
    expect(s.power).toBe(14);
    addShake(s, 14); // art arda ikinci arı
    expect(s.power).toBe(24); // cezalandır, mide bulandırma
  });

  it("updateShake gücü doğrusal söndürür, eksiye düşürmez", () => {
    const s: Shake = { power: 12, t: 0 };
    updateShake(s, 0.2); // 12 - 0.2 * 30 = 6
    expect(s.power).toBeCloseTo(6);
    updateShake(s, 1); // fazlasıyla yeter
    expect(s.power).toBe(0);
  });

  it("güç sıfırken ofset tam sıfırdır", () => {
    expect(shakeOffset({ power: 0, t: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("ofset enjekte edilen rand ile deterministik ve ±power bandındadır", () => {
    const s: Shake = { power: 10, t: 0 };
    expect(shakeOffset(s, () => 1)).toEqual({ x: 10, y: 10 });
    expect(shakeOffset(s, () => 0)).toEqual({ x: -10, y: -10 });
    expect(shakeOffset(s, () => 0.5)).toEqual({ x: 0, y: 0 });
  });
});
