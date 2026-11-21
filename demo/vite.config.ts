import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

export default defineConfig({
  base: process.env.DEMO_BASE ?? '/',
  resolve: {
    alias: [
      { find: /^teemo-tween\/presets$/, replacement: src('presets/index.ts') },
      { find: /^teemo-tween$/, replacement: src('index.ts') },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
