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
    proxy: {
      '^/api/(?!.*\\.(ts|tsx|js|jsx)$)': {
        target: process.env.NODE_ENV === 'development' && process.env.DOCKER_ENV 
          ? 'http://nlj-api:8000' 
          : 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
    hmr: {
      overlay: true,
      port: 5173
    },
  },
  optimizeDeps: {
    force: false,
    include: ['date-fns', 'date-fns/*', 'hls.js'], // Force include dependencies
  },
  esbuild: {
    target: 'esnext',
  },
})
