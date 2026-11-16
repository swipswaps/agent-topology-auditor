import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This is a GitHub Pages project site, so assets must resolve beneath the
// repository path instead of the domain root.
export default defineConfig({
  base: '/agent-topology-auditor/',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Separate the major visualization libraries from application code.
        // This improves browser caching and makes bundle failures easier to
        // isolate than one large monolithic JavaScript file.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) {
            return 'three';
          }
          if (id.includes('/node_modules/d3')) {
            return 'd3';
          }
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
