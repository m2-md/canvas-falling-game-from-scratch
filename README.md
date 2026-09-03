# FIREFLIES — A Falling Game and Juice on Canvas

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/canvas-falling-game-from-scratch/)** · [Source](https://github.com/m2-md/canvas-falling-game-from-scratch)
<!-- LINKS:END -->

> A 25-stage falling-catch game built from scratch on HTML5 Canvas: sine-sway physics,
> screen shake and particle juice, a 3-lives damage system, and wasp/ladybug/spider/moth
> hazards, all drawn in code with zero external assets.

Working code for the article "Your Game Works. So Why Isn't It Fun? A Falling Game and
Juice on Canvas". At midnight in a garden you catch fireflies drifting down from above
with a jar, across a 25-stage campaign that layers in wasps, ladybugs, a web-spinning
spider and a deceptive light-mimicking moth.

- **Core mechanics** (`src/logic.ts` + `src/main.ts`): an accumulator-driven spawner,
  sine sway (`sway` / `aggressiveSway`, more aggressive at higher stages), keyboard
  **and** touch input, circle-rectangle collision built from two clamps, a 3-lives
  damage system (`processWaspCollision`, `processHazardCollision`, `processFireflyMiss`),
  a spider web pull force (`calculateSpiderWebPull`), and a rule where only red
  fireflies can burn through the spider's web (`shouldBurnSpiderWeb`).
- **Juice**: damped screen shake, a `lighter` particle burst, squash & stretch anchored
  at the base, a per-stage difficulty curve that saturates at 60 s, and a filling jar
  that writes the score into the world.
- **25 named stages** (the `LEVELS` table in `src/logic.ts`), each with its own target,
  hazard mix, fall-speed multiplier and sky theme.
- Zero assets, no audio, no network requests. Production build: **JS 21.09 kB gzip**
  (verify it with `npm run build`)

## Setup and running

```bash
npm install
npm run dev     # http://localhost:5173 (or whichever port Vite gives you)
```

**How to play:** the arrow keys **or** a finger/mouse drag move the jar (the most recent
input source wins). Catching a firefly is **+1** with a yellow burst; missing three in a
row, taking a wasp hit with an empty jar, or touching a ladybug, spider or moth costs
**one of your 3 lives**. A red firefly can burn through the spider's web. Clear a stage's
target to advance to the next of the 25 stages; clear all of them and you win the
campaign. Losing all 3 lives ends the run. A tap or Enter restarts via `resetGame()` —
the page is never reloaded.

## Test

```bash
npm test        # 28 unit tests
```

The tests verify the pure logic: the 3-lives damage rules (`processWaspCollision`,
`processHazardCollision`, `processFireflyMiss`), the red-firefly web-burn check
(`shouldBurnSpiderWeb`), deterministic `tickSpawn` with an injected `rand` (including
carrying the remainder — exactly the test from the article), the bounds of `sway` and the
per-stage `aggressiveSway`, the spider web pull vector, `hitCircleRect` (inside / edge
touch / 3-4-5 corner touch / far away), the 25-entry `LEVELS` table and `getLevelConfig`
clamping, the difficulty curve, and the shake trio (ceiling of 24, linear damping, exactly
zero offset at zero).

## File layout

```
src/
  logic.ts    # pure logic: spawner, sway, 3-lives damage rules, spider web pull,
              # hitCircleRect, the 25-stage LEVELS table, difficulty, shake trio
  main.ts     # state, input (keyboard+pointer), 25-stage progression, juice,
              # drawing, full-screen canvas
tests/
  logic.test.ts
```

## Lessons learned (also covered in the article)

- A fixed-interval spawner is a metronome; an accumulator plus a random interval is rain.
  Carry the remainder with `acc -= next` so the rhythm does not drift on a long frame.
- Without a random phase (`t: Math.random() * 10`) the swarm sways in sync like soldiers.
- `pointermove`/`pointerup` are listened for **on window**; if you listen on the canvas,
  the jar freezes the moment the finger slides one pixel outside.
- In finger mode the jar does not teleport to the target, it runs there at a limited speed —
  the sense of weight is hidden in that tiny delay.
- Give the shake a ceiling and damping: shake without damping is a tremor, shake with
  damping is a blow.
- Put the center of squash & stretch at the **base** of the jar; if you scale from the
  center, the jar squashes while hanging in mid-air.
- "Play again" is not a `location.reload()`, it is a `resetGame()` function.
- Randomness is not buried inside a function, it is handed in at the door (the `rand`
  parameter) — systems that look random get tested deterministically.

## Tech stack

- TypeScript
- Vite
- Vitest
- HTML5 Canvas 2D (no libraries, no external assets)

## License

MIT
