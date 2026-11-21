import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    presets: 'src/presets/index.ts',
    react: 'src/react/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: false,
  deps: { neverBundle: ['gsap', 'react'] },
  outputOptions: { chunkFileNames: 'core-[hash].js' },
});
