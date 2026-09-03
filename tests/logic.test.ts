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
  processFireflyMiss,
  processHazardCollision,
  processWaspCollision,
  shakeOffset,
  shouldBurnSpiderWeb,
  sway,
  swayVel,
  tickSpawn,
  updateShake,
} from "../src/logic";

describe("processWaspCollision & Health Rules", () => {
  it("drops only 1 firefly without losing life when fireflies > 0 on wasp hit", () => {
    const res = processWaspCollision(5, 3);
    expect(res.newCaught).toBe(4);
    expect(res.newLives).toBe(3);
    expect(res.lostLife).toBe(false);
  });

  it("loses 1 life when fireflies = 0 on wasp hit", () => {
    const res = processWaspCollision(0, 3);
    expect(res.newCaught).toBe(0);
    expect(res.newLives).toBe(2);
    expect(res.lostLife).toBe(true);
  });
});

describe("processHazardCollision: Spider & Ladybug Impacts", () => {
  it("directly loses 1 life on spider or ladybug hit", () => {
    const res = processHazardCollision(3);
    expect(res.newLives).toBe(2);
    expect(res.lostLife).toBe(true);
  });
});

describe("processFireflyMiss: 3 Missed Fireflies Rule", () => {
  it("does not lose a life on 1 or 2 missed fireflies", () => {
    const res1 = processFireflyMiss(0, 3);
    expect(res1.newMissed).toBe(1);
    expect(res1.newLives).toBe(3);

    const res2 = processFireflyMiss(1, 3);
    expect(res2.newMissed).toBe(2);
    expect(res2.newLives).toBe(3);
  });

  it("loses 1 life and resets missed count on 3rd missed firefly", () => {
    const res3 = processFireflyMiss(2, 3);
    expect(res3.newMissed).toBe(0);
    expect(res3.newLives).toBe(2);
    expect(res3.lostLife).toBe(true);
  });
});

describe("shouldBurnSpiderWeb: Web-Burning Red Firefly Check", () => {
  it("allows only red fireflies to burn and sever spider webs", () => {
    expect(shouldBurnSpiderWeb("red")).toBe(true);
    expect(shouldBurnSpiderWeb("gold")).toBe(false);
    expect(shouldBurnSpiderWeb("emerald")).toBe(false);
    expect(shouldBurnSpiderWeb("purple")).toBe(false);
    expect(shouldBurnSpiderWeb("azure")).toBe(false);
    expect(shouldBurnSpiderWeb(undefined)).toBe(false);
  });
});

describe("tickSpawn: accumulator-based spawner", () => {
  it("produces deterministic spawn intervals with injected rand", () => {
    const t = createSpawnTimer(1);
    const rand = () => 0.5;
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(false);
    expect(tickSpawn(t, 0.6, 1, rand)).toBe(true);
    expect(t.next).toBeCloseTo(1);
    expect(t.acc).toBeCloseTo(0.2);
  });

  it("carries over accumulator remainder across long frames", () => {
    const t = createSpawnTimer(1);
    expect(tickSpawn(t, 1.7, 1, () => 0.5)).toBe(true);
    expect(t.acc).toBeCloseTo(0.7);
  });

  it("defaults initial target to 0.6 seconds", () => {
    expect(createSpawnTimer()).toEqual({ next: 0.6, acc: 0 });
  });

  it("keeps new interval within ±40% of spawnEvery", () => {
    for (const r of [0, 0.25, 0.75, 0.999]) {
      const t = createSpawnTimer(0.01);
      tickSpawn(t, 1, 2, () => r);
      expect(t.next).toBeGreaterThanOrEqual(2 * 0.6);
      expect(t.next).toBeLessThanOrEqual(2 * 1.4);
    }
  });
});

describe("calculateSpiderWebPull: Spider Web Attraction Physics", () => {
  it("pulls jar directly toward spider position", () => {
    const pull = calculateSpiderWebPull(100, 100, 100, 300, 200);
    expect(pull.vx).toBeCloseTo(0);
    expect(pull.vy).toBeCloseTo(-200);
  });
});

describe("sway & aggressiveSway: Sine sway and aggressive wasp oscillation", () => {
  it("starts on center line at t=0", () => {
    expect(sway(0, 100, 30, 2)).toBe(100);
  });

  it("never exceeds amplitude limit from center", () => {
    for (let t = 0; t < 5; t += 0.01) {
      expect(Math.abs(sway(t, 200, 25, 1.3) - 200)).toBeLessThanOrEqual(
        25 + 1e-9,
      );
    }
  });

  it("returns instantaneous horizontal derivative for sway velocity", () => {
    expect(swayVel(0, 10, 1)).toBeCloseTo(10 * 2 * Math.PI);
    expect(swayVel(0.25, 10, 1)).toBeCloseTo(0);
  });

  it("exhibits greater maximum sway amplitude at level 10 than level 1", () => {
  // maximum width test
    let maxOffset1 = 0;
    let maxOffset10 = 0;
    for (let t = 0; t < 2; t += 0.01) {
      maxOffset1 = Math.max(maxOffset1, Math.abs(aggressiveSway(t, 100, 20, 1, 1).x - 100));
      maxOffset10 = Math.max(maxOffset10, Math.abs(aggressiveSway(t, 100, 20, 1, 10).x - 100));
    }
    expect(maxOffset10).toBeGreaterThan(maxOffset1);
  });
});

describe("hitCircleRect: Circle-AABB collision", () => {
  const rect = [100, 100, 80, 40] as const;

  it("always collides when center is inside rectangle", () => {
    expect(hitCircleRect(140, 120, 1, ...rect)).toBe(true);
  });

  it("treats exact radius distance to edge as collision (<=)", () => {
    expect(hitCircleRect(95, 120, 5, ...rect)).toBe(true);
    expect(hitCircleRect(94.9, 120, 5, ...rect)).toBe(false);
  });

  it("evaluates corner contact via diagonal distance", () => {
    expect(hitCircleRect(97, 96, 5, ...rect)).toBe(true);
    expect(hitCircleRect(97, 96, 4.9, ...rect)).toBe(false);
  });

  it("does not collide with distant circle", () => {
    expect(hitCircleRect(0, 0, 10, ...rect)).toBe(false);
  });
});

describe("LEVELS & getLevelConfig: 25 Stage Setup & Spider/Ladybug", () => {
  it("defines exactly 25 stages", () => {
    expect(LEVELS.length).toBe(25);
  });

  it("configures allowed obstacles correctly across stages", () => {
    expect(LEVELS[0].allowedHazards).toContain("wasp");
    expect(LEVELS[1].allowedHazards).toContain("ladybug");
    expect(LEVELS[3].allowedHazards).toContain("spider");
  });

  it("safely clamps out-of-range stage numbers", () => {
    expect(getLevelConfig(0).level).toBe(1);
    expect(getLevelConfig(999).level).toBe(25);
    expect(getLevelConfig(4).name).toBe("Spider Garden");
  });
});

describe("difficulty: scaling difficulty curve", () => {
  it("verifies base values for stage 1", () => {
    const d = difficulty(0, 1);
    expect(d.spawnEvery).toBeCloseTo(1.6);
    expect(d.fallSpeed).toBeCloseTo(120);
  });

  it("scales velocity multiplier upward in later stages", () => {
    const d1 = difficulty(0, 1);
    const d10 = difficulty(0, 10);
    expect(d10.fallSpeed).toBeGreaterThan(d1.fallSpeed);
  });
});

describe("shake: screen shake trio", () => {
  it("clamps addShake below maximum ceiling (24)", () => {
    const s: Shake = { power: 0, t: 0 };
    addShake(s, 14);
    expect(s.power).toBe(14);
    addShake(s, 14);
    expect(s.power).toBe(24);
  });

  it("decays shake linearly without dropping below zero", () => {
    const s: Shake = { power: 12, t: 0 };
    updateShake(s, 0.2);
    expect(s.power).toBeCloseTo(6);
    updateShake(s, 1);
    expect(s.power).toBe(0);
  });

  it("offset is exactly zero when power is zero", () => {
    expect(shakeOffset({ power: 0, t: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("offset is deterministic with injected rand and remains within ±power", () => {
    const s: Shake = { power: 10, t: 0 };
    expect(shakeOffset(s, () => 1)).toEqual({ x: 10, y: 10 });
    expect(shakeOffset(s, () => 0)).toEqual({ x: -10, y: -10 });
    expect(shakeOffset(s, () => 0.5)).toEqual({ x: 0, y: 0 });
  });
});
