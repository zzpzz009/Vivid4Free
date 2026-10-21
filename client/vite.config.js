import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

export default defineConfig({
  plugins: [vue(), {
    name: 'skin-license-notices',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: readFileSync(new URL('./THIRD-PARTY-NOTICES.txt', import.meta.url), 'utf8') })
    }
  }],
  base: './',
  publicDir: false,
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'tests', 'test-results']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia', 'axios'],
          ui: ['@headlessui/vue']
        }
      }
    }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  }
})
