import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: '.',  // this is the app root
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@streetweave': path.resolve(__dirname, '../streetweave'),
      '@data': path.resolve(__dirname, '../data'),
      '@examples': path.resolve(__dirname, '../examples'),
    },
  },
});