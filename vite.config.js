import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: '/jy/', // 直接写死生产环境路径（更可靠）
    build: {
        outDir: 'dist', // 显式声明
        emptyOutDir: true // 构建前清空目录
    }
})