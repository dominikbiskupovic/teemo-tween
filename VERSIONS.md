# Versions

Checked against the npm registry and official docs on 2026-11-22.

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 26.10 local, 24 in CI | Trusted publishing needs Node >= 22.14 |
| npm | 11.19 local, `npm@11` in CI | Trusted publishing needs npm >= 11.5.1 |
| TypeScript | 6.0.3 | 7.0 is out, but typescript-eslint (<6.1) and TypeDoc (<=6.0) don't support it yet |
| tsdown | 0.23.7 | Library bundler (rolldown), ESM + d.ts |
| Vite | 8.3.8 | Demo site |
| Vitest | 5.1.1 | browser mode with `@vitest/browser-playwright` 5.1.1 |
| Playwright | 1.65.1 | Chromium, WebKit and Firefox for tests |
| ESLint | 10.15 with typescript-eslint 8.73 | flat config |
| size-limit | 14.3 | preset-small-lib, brotli |
| publint | 0.3.25 | |
| @arethetypeswrong/cli | 0.18.5 | `--profile esm-only` |
| @changesets/cli | 3.0.3 | `changesets/action@v2` |
| TypeDoc | 0.28.20 | API reference |
| React (dev/peer) | 19.3.1 | peer `>=18`, optional |
| GitHub Actions | checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | |

## Browser baseline

Native animation needs the Web Animations API, CSS `linear()` easing and the individual transform
properties (`translate`, `scale`, `rotate`): Chrome/Edge 113+, Safari 17.2+, Firefox 128+ (axis
variables use `CSS.registerProperty`). Older browsers fall back to JS writes every frame.
