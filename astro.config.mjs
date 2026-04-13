// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

/** Post-build: renomeia elementos internos do Astro nos arquivos gerados */
function hideAstroFingerprints() {
  return {
    name: 'hide-astro-fingerprints',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const dirPath = dir instanceof URL ? dir.pathname : String(dir);
        const exts = new Set(['.html', '.js', '.css']);
        const replacements = [
          ['astro-island', 'x-c'],
          ['astro-slot', 'x-s'],
          ['astro-static-slot', 'x-ss'],
        ];

        async function walk(d) {
          const entries = await readdir(d, { withFileTypes: true });
          await Promise.all(entries.map(async (e) => {
            const full = join(d, e.name);
            if (e.isDirectory()) return walk(full);
            if (!exts.has(extname(e.name))) return;
            let content = await readFile(full, 'utf8');
            const original = content;
            for (const [from, to] of replacements) content = content.replaceAll(from, to);
            if (content !== original) await writeFile(full, content, 'utf8');
          }));
        }

        await walk(dirPath);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [react(), icon(), hideAstroFingerprints()],

  server: { port: 3005 },

  // Esconder fingerprints do Astro
  scopedStyleStrategy: 'class',

  // Inline small stylesheets to eliminate render-blocking CSS requests
  build: {
    inlineStylesheets: 'always',
    assets: '_assets',
  },

  // Remove meta generator tag
  compressHTML: true,

  // Prefetch: carrega apenas quando usuario interage (tap/hover)
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "tap",
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Desabilitar source maps em producao (evita exposicao de codigo)
      sourcemap: false,
      // Inline CSS pequeno para reduzir requests
      cssMinify: true,
      // Chunk splitting otimizado
      rollupOptions: {
        output: {
          chunkFileNames: '[hash].js',
          assetFileNames: '[hash][extname]',
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
          }
        }
      }
    }
  }
});