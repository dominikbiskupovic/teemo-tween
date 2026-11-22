# teemo-tween

PrimeTween-style animation library for web games on the Web Animations API. Zero dependencies.
Public repo, npm package.

## Layout
- `src/core/` clock (frame loop, time scale, hit stop), playable (shared timing), Tween, Sequence,
  element (CSS channels), value (interpolation), eases, settings.
- `src/presets/` game-feel presets, built ONLY from the public API in `src/index.ts`.
- `src/react/` optional hooks; core must never import React.
- `test/` Vitest browser mode in Chromium, WebKit and Firefox (Playwright). Time moves only through
  `advance()` in `test/clock.ts` (manual clock; native animations are paused and seeked). Never wait for real time.
  Assert what the browser renders (`getComputedStyle`, `transformOf`), not internal state.
- `demo/` Vite demo site (aliases `teemo-tween` to `src/`), deployed to GitHub Pages with the TypeDoc API under `/api/`.

## Commands
- `npm run check`: everything CI runs, one PASS/FAIL line per step.
- `npm test`, `npm run dev` (demo), `npm run build`, `npm run size`, `npm run docs`.

## Rules
- TypeScript strict, no `any`. ESM only, `sideEffects: false`, zero runtime dependencies (React is an optional peer for `/react`).
- Size budgets in `.size-limit.json`; raise them only on purpose.
- Every public function has a test; every public export has TSDoc (the API docs come from it).
- Each user-facing change needs a changeset (`npx changeset`). Merging the "Version packages" PR
  makes the Release workflow STAGE the version (`scripts/release.sh`, npm trusted publishing,
  stage-only); Dominik approves it with 2FA on npmjs.com. Never add an npm token anywhere.
- No secrets in the repo. No AI attribution in commits or PRs.
- Original work: API inspired by PrimeTween, but never copy its code or docs.

## Design decisions
- Time: one rAF loop (`clock.ts`) on `document.timeline`; every tween/sequence value is a pure function of
  its time `T`. Sequences map their local time to children (cycles, rewind) and fire callbacks on crossing.
- Rendering: while a tween is active, element channels play as a native animation (`el.animate`, keyframes
  built at claim, ease as CSS `linear()`); the loop only keeps it in step (pause, speed, sequences) and
  commits values to inline styles when it leaves its active window. Objects, `custom` and CSS variables
  are written from JS each frame. Without WAAPI, everything falls back to JS writes.
- Elements: CSS `translate`/`scale`/`rotate`. Each axis is a registered variable (`--tt-x`...) so x and
  y tweens coexist; a tween that owns a whole property animates it directly (GPU-friendly).
- Replacement: per target and property, when the new tween first renders; same-root sequence
  children never replace each other; effects restore their base when stopped.
- Reduced motion is resolved when a tween is created (see `ReducedMotionPolicy`).
