import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/ws': { target: 'ws://backend:3000', ws: true },
      '/api': { target: 'http://backend:3000' },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
