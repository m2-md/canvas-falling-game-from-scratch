import { describe, it, expect } from "vitest";
import {
  type Shake,
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
} from "../src/logic";

describe("tickSpawn: biriktiricili spawner", () => {
  it("enjekte edilen rand ile spawn aralığı deterministiktir", () => {
    const t = createSpawnTimer(1);
    const rand = () => 0.5;
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(false);
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(true);
    expect(t.next).toBeCloseTo(1);
    expect(t.acc).toBeCloseTo(0.2);
  });

  it("uzun tek karede de artık taşınır", () => {
    const t = createSpawnTimer(1);
    expect(tickSpawn(t, 1.7, 1, () => 0.5)).toBe(true);
    expect(t.acc).toBeCloseTo(0.7);
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

describe("calculateSpiderWebPull: Örümcek Ağ Çekim Fiziği", () => {
  it("kavanozu doğrudan örümcek yönüne çeker", () => {
    const pull = calculateSpiderWebPull(100, 100, 100, 300, 200);
    expect(pull.vx).toBeCloseTo(0);
    expect(pull.vy).toBeCloseTo(-200);
  });
});

describe("sway & aggressiveSway: salınım ve agresif arı eğimi", () => {
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

  it("swayVel salınımın anlık yatay türevini verir", () => {
    expect(swayVel(0, 10, 1)).toBeCloseTo(10 * 2 * Math.PI);
    expect(swayVel(0.25, 10, 1)).toBeCloseTo(0);
  });

  it("aggressiveSway seviye 10'da seviye 1'e göre maksimum genişliği daha fazladır", () => {
    let maxOffset1 = 0;
    let maxOffset10 = 0;
    for (let t = 0; t < 2; t += 0.01) {
      maxOffset1 = Math.max(maxOffset1, Math.abs(aggressiveSway(t, 100, 20, 1, 1).x - 100));
      maxOffset10 = Math.max(maxOffset10, Math.abs(aggressiveSway(t, 100, 20, 1, 10).x - 100));
    }
    expect(maxOffset10).toBeGreaterThan(maxOffset1);
  });
});

describe("hitCircleRect: daire-dikdörtgen çarpışması", () => {
  const rect = [100, 100, 80, 40] as const;

  it("merkez dikdörtgenin içindeyse her zaman çarpar", () => {
    expect(hitCircleRect(140, 120, 1, ...rect)).toBe(true);
  });

  it("kenara tam yarıçap mesafesi temas sayılır (≤)", () => {
    expect(hitCircleRect(95, 120, 5, ...rect)).toBe(true);
    expect(hitCircleRect(94.9, 120, 5, ...rect)).toBe(false);
  });

  it("köşe teması köşegen mesafeyle ölçülür", () => {
    expect(hitCircleRect(97, 96, 5, ...rect)).toBe(true);
    expect(hitCircleRect(97, 96, 4.9, ...rect)).toBe(false);
  });

  it("uzak daire çarpmaz", () => {
    expect(hitCircleRect(0, 0, 10, ...rect)).toBe(false);
  });
});

describe("LEVELS & getLevelConfig: 10 Seviyeli Kurgu & Örümcek/Uğur Böceği", () => {
  it("tam 10 bölüm tanımlıdır", () => {
    expect(LEVELS.length).toBe(10);
  });

  it("bölümlerde izin verilen engeller doğru yapılandırılmıştır", () => {
    expect(LEVELS[0].allowedHazards).toContain("wasp");
    expect(LEVELS[1].allowedHazards).toContain("ladybug");
    expect(LEVELS[2].allowedHazards).toContain("spider");
  });

  it("getLevelConfig aralık dışı bölüm numaralarını güvenle sınırlar", () => {
    expect(getLevelConfig(0).level).toBe(1);
    expect(getLevelConfig(999).level).toBe(10);
    expect(getLevelConfig(3).name).toBe("Örümcekli Ağ Vadisi");
  });
});

describe("difficulty: zorluk eğrisi", () => {
  it("bölüm 1 taban değerleri", () => {
    const d = difficulty(0, 1);
    expect(d.spawnEvery).toBeCloseTo(1.5);
    expect(d.fallSpeed).toBeCloseTo(120);
  });

  it("ilerleyen bölümlerde hız çarpanı artar", () => {
    const d1 = difficulty(0, 1);
    const d10 = difficulty(0, 10);
    expect(d10.fallSpeed).toBeGreaterThan(d1.fallSpeed);
  });
});

describe("shake: sarsıntı üçlüsü", () => {
  it("addShake tavanı (24) aşmaz", () => {
    const s: Shake = { power: 0, t: 0 };
    addShake(s, 14);
    expect(s.power).toBe(14);
    addShake(s, 14);
    expect(s.power).toBe(24);
  });

  it("updateShake gücü doğrusal söndürür, eksiye düşürmez", () => {
    const s: Shake = { power: 12, t: 0 };
    updateShake(s, 0.2);
    expect(s.power).toBeCloseTo(6);
    updateShake(s, 1);
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
