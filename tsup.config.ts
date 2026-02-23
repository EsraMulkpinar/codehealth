import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    clean: true,
    shims: true,
  },
]);
