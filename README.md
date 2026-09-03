# FIREFLIES — A Falling Game and Juice on Canvas

Working code for the article "Your Game Works. So Why Isn't It Fun? A Falling Game and
Juice on Canvas". At midnight in a garden you catch fireflies drifting down from above
with a jar; wasps that mix into the swarm steal your light. Two layers:

- **Four pillars** (`src/logic.ts` + `src/main.ts`): a random spawner with an accumulator,
  `y += speed * dt` plus sine sway, keyboard **and** touch input, circle-rectangle
  collision built from two clamps
- **Five pinches of juice**: damped screen shake, a `lighter` particle burst, squash &
  stretch anchored at the base, a difficulty curve that saturates at 60 s, and a filling
  jar that writes the score into the world
- Zero assets, no audio, no network requests. Production build: **JS 21.08 kB gzip**
  (verify it with `npm run build`)

## Setup and running

```bash
npm install
npm run dev     # http://localhost:5173 (or whichever port Vite gives you)
```

**How to play:** the arrow keys **or** a finger/mouse drag move the jar (the most recent
input source wins). A firefly is **+1** — a yellow burst, and the jar stretches; a wasp is
**−1** — the screen shakes and the jar's light dims. As time passes, spawns get more
frequent and the fall speeds up (saturation at the 60th second). The inside of the jar
glows as you catch more; you win at the stage target: your time is printed on screen, and
a tap or Enter starts a new round via `resetGame()` — the page is not reloaded.

## Test

```bash
npm test        # 28 unit tests
```

The tests verify the pure logic: deterministic `tickSpawn` with an injected `rand`
(including carrying the remainder — exactly the test from the article), the bounds and peak
of `sway`, `hitCircleRect` (inside / edge touch / 3-4-5 corner touch / far away),
`difficulty` (floor at 0, saturation at 60+, monotonicity), and the shake trio
(ceiling of 24, linear damping, exactly zero offset at zero).

## File layout

```
src/
  logic.ts    # pure logic: tickSpawn, sway, hitCircleRect, the shake trio, difficulty
  main.ts     # state, input (keyboard+pointer), juice, drawing, full-screen canvas
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

## License

MIT
