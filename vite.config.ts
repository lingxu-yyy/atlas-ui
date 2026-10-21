import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'components/AtButton': resolve(__dirname, 'src/components/AtButton/index.ts'),
        'components/AtProTable': resolve(__dirname, 'src/components/AtProTable/index.ts'),
        'components/AtSearchForm': resolve(__dirname, 'src/components/AtSearchForm/index.ts'),
        'components/AtEditableTable': resolve(__dirname, 'src/components/AtEditableTable/index.ts'),
        'components/AtVirtualSelect': resolve(__dirname, 'src/components/AtVirtualSelect/index.ts'),
        'components/AtImageUploader': resolve(__dirname, 'src/components/AtImageUploader/index.ts'),
      },
      name: 'AtlasUI',
      formats: ['es', 'cjs'],
      // 入口 key 带目录，产物统一落到 <入口>/index.js|.cjs
      fileName: (format, entryName) => {
        const extension = format === 'es' ? 'js' : 'cjs'
        return entryName === 'index' ? `index.${extension}` : `${entryName}/index.${extension}`
      },
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    cssCodeSplit: false,
  },
})
