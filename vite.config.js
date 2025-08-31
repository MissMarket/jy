import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: process.env.NODE_ENV === 'production' ? '/jy/' : '/',
    build: {
        outDir: 'dist', // 显式声明
        emptyOutDir: true // 构建前清空目录
    }
})