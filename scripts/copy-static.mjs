import { cp, copyFile } from 'node:fs/promises';

// copy the whole images/ folder (favicon, og-preview, hero.*, etc.) verbatim,
// so runtime paths like /images/hero.jpg resolve on GitHub Pages
await cp('images', 'dist/images', { recursive: true });
await copyFile('CNAME', 'dist/CNAME');
