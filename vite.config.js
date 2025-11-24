import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createViteProxy } from './src/api/proxyConfig';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: process.env.NODE_ENV === 'production' ? '/jy/' : '/',
    build: {
        outDir: 'dist', // 显式声明
        emptyOutDir: true // 构建前清空目录
    },
    server: {
        proxy: createViteProxy()
    },
    define: {
        'import.meta.env.VITE_PROXY_KEY': JSON.stringify(process.env.VITE_PROXY_KEY || 'default')
    }
})
