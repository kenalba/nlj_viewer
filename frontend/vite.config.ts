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
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'callcoach.training',
      'www.callcoach.training'
    ],
    hmr: {
      overlay: true,
      clientPort: 443,
      host: 'callcoach.training',
      protocol: 'wss'
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/app/, to: '/index.html' },
      ],
    },
  },
  optimizeDeps: {
    force: process.env.NODE_ENV === 'development',
    include: ['date-fns', 'date-fns/*', 'hls.js'], // Force include dependencies
  },
  esbuild: {
    target: 'esnext',
  },
})
