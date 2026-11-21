import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import mdx from '@astrojs/mdx';

// GitHub Pages：repo 建好後把 site 與 base 改成實際網址，例如
// site: 'https://<帳號>.github.io', base: '/AI_Network_online_lab'
export default defineConfig({
  integrations: [svelte(), mdx()],
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
});
