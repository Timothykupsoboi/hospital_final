import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Development server proxy (not used in production)
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  },

  build: {
    // Raise the warning threshold to acknowledge the single-chunk build
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        // Manual chunk splitting: vendor libraries into separate cacheable chunks
        manualChunks: {
          // React core — smallest, changes least often
          'react-vendor': ['react', 'react-dom'],

          // Router
          'router': ['react-router-dom'],

          // Supabase client
          'supabase': ['@supabase/supabase-js'],

          // UI utilities
          'ui-vendor': ['lucide-react', 'react-select', 'react-datepicker'],

          // Data utilities
          'data-vendor': ['date-fns', 'axios'],
        }
      }
    }
  }
})
