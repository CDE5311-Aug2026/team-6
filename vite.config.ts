import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/pawsona-web-prototype/' : '/',
  plugins: [react()],
  // The course folder contains a colon, which Vite's default allow-list treats
  // as a path separator. This server is bound to 127.0.0.1 for local preview.
  server: { fs: { strict: false } },
}));
