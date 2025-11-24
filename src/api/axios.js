import axios from 'axios';
import { getApiConfig } from './proxyConfig';

// 创建基础实例
const createInstance = (apiKey) => {
    const config = getApiConfig(apiKey);

    const instance = axios.create({
        baseURL: config.baseUrl,
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // 请求拦截器
    instance.interceptors.request.use(config => {
        // 可以在这里添加token等
        return config;
    }, error => {
        return Promise.reject(error);
    });

    // 响应拦截器
    instance.interceptors.response.use(response => {
        return response.data;
    }, error => {
        console.error(`API [${apiKey}] Error:`, error);
        return Promise.reject(error);
    });

    return instance;
};

// 创建三个接口实例
export const qtInstance = createInstance('qt');
export const eastmoneyInstance = createInstance('eastmoney');
export const sinaInstance = createInstance('sina');