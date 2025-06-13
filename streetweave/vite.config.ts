import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'parser.ts'), // or index.ts
      name: 'StreetWeave',
      fileName: (format) => `streetweave.${format}.js`
    },
    outDir: 'dist',
  },
});