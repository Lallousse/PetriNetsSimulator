import { defineConfig } from 'vite';

export default defineConfig({
  base: '/AlgoViz-Studio/',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
});
