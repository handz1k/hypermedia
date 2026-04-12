import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
