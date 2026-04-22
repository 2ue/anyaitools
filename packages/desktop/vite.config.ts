import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import svgr from 'vite-plugin-svgr'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: [
                'electron',
                'path',
                'fs',
                'os',
                'http',
                'https',
                'url',
                'child_process',
                // @anyaitools/core 应该被打包到 bundle 中，不作为外部依赖
              ],
            },
          },
          json: {
            stringify: true,
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              external: [
                'electron',
                // @anyaitools/core 应该被打包到 bundle 中，不作为外部依赖
              ],
            },
          },
        },
        onstart(options) {
          options.reload()
        },
      },
    ]),
  ],
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      external: [
        // 渲染进程只引用类型，不需要运行时代码
        // 标记为 external 避免 Vite 尝试打包 Node.js 模块
        '@anyaitools/core',
      ],
    },
  },
  // 开发模式：告诉 Vite 不要预打包 @anyaitools/core（它是 Node.js 模块）
  optimizeDeps: {
    exclude: ['@anyaitools/core'],
  },
  resolve: {
    alias: {
      '@anyaitools/types': path.resolve(__dirname, '../types/dist/index.js'),
    },
  },
  server: {
    port: 5173,
  },
})
