import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PetriNetsSimulator/',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
});
