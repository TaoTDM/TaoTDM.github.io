import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';

/* the sound files in public/sfx. the page gets the list, so it asks for no file that is not there */
let sfx = [];
try { sfx = readdirSync('public/sfx').filter(f => /\.(wav|mp3|ogg)$/.test(f)); } catch {}

export default defineConfig({
  base: '/',
  define: { __SFX__: JSON.stringify(sfx) },
  build: {
    target: 'es2020'
  }
});
