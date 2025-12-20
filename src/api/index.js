import axios from 'axios';

const instance = axios.create({
    baseURL: import.meta.env.DEV ? '' : 'https://web.ifzq.gtimg.cn',
    timeout: 10000
});

instance.interceptors.request.use(config => {
    if (import.meta.env.DEV && !config.url.startsWith('/api')) {
        config.url = '/api' + config.url;
    }
    return config;
});

export const getData = (url, params = {}) => instance.get(url, { params });

export default { getData };