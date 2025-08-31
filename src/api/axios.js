import axios from 'axios';
import { getProxyConfig } from './proxyConfig';

// 创建axios实例
const instance = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 根据环境获取基础URL
const getBaseUrl = () => {
    if (import.meta.env.PROD) {
        // 生产环境使用完整路径
        return import.meta.env.VITE_PROD_API_BASE || '/api';
    }
    // 开发环境使用代理
    return getProxyConfig().baseUrl;
};

// 请求拦截器
instance.interceptors.request.use(config => {
    config.baseURL = getBaseUrl();
    // 可以在这里添加token等
    return config;
}, error => {
    return Promise.reject(error);
});

// 响应拦截器
instance.interceptors.response.use(response => {
    return response.data;
}, error => {
    // 统一错误处理
    console.error('API Error:', error);
    return Promise.reject(error);
});

export default instance;