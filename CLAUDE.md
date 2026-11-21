# teemo-tween

PrimeTween-style animation library for web games on top of GSAP. Public repo, npm package.

## Layout
- `src/core/` Tween, Sequence, settings (global time scale, hit stop, reduced motion), eases, targets.
- `src/presets/` game-feel presets, built ONLY from the public API in `src/index.ts`.
- `src/react/` optional hooks; core must never import React.
- `test/` Vitest + jsdom. Time is driven by `advance()` in `test/clock.ts` (GSAP ticker removed). Never wait for real time.
- `demo/` Vite demo site (aliases `teemo-tween` to `src/`), deployed to GitHub Pages with the TypeDoc API under `/api/`.

## Commands
- `npm run check`: everything CI runs, one PASS/FAIL line per step.
- `npm test`, `npm run dev` (demo), `npm run build`, `npm run size`, `npm run docs`.

## Rules
- TypeScript strict, no `any`. ESM only, `sideEffects: false`, GSAP is a peer dependency, no other runtime deps.
- Size budgets in `.size-limit.json`; raise them only on purpose.
- Every public function has a test; every public export has TSDoc (the API docs come from it).
- Each user-facing change needs a changeset (`npx changeset`). Releases go through the Release
  workflow with npm trusted publishing (OIDC). Never add an npm token anywhere.
- No secrets in the repo. No AI attribution in commits or PRs.
- Original work: API inspired by PrimeTween, but never copy its code or docs.

## Design decisions
- Every tween is an empty GSAP tween in the library's own root timeline; values are computed in
  `Tween._renderAt` from elapsed time (cycles, modes, delays), so playback is a pure function of time.
- Replacement: per target and property, when the new tween first renders; same-root sequence
  children never replace each other; effects restore their base when stopped.
- Reduced motion is resolved when a tween is created (see `ReducedMotionPolicy`).
