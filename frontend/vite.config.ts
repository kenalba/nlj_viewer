import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          flow: ['@xyflow/react'],
          editor: ['@tiptap/react', '@tiptap/starter-kit'],
          utils: ['axios', '@tanstack/react-query', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  esbuild: {
    target: 'esnext',
  },
})
