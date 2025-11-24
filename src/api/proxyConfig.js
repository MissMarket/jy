// 接口配置映射
const apiConfigs = {
    qt: {
        dev: {
            baseUrl: '/api1',
            target: 'https://qt.gtimg.cn',
            pathRewrite: { '^/api1': '' }
        },
        prod: 'https://qt.gtimg.cn'
    },
    eastmoney: {
        dev: {
            baseUrl: '/api2',
            target: 'https://data.eastmoney.com',
            pathRewrite: { '^/api2': '' }
        },
        prod: 'https://data.eastmoney.com'
    },
    sina: {
        dev: {
            baseUrl: '/api3',
            target: 'https://hq.sinajs.cn',
            pathRewrite: { '^/api3': '' }
        },
        prod: 'https://hq.sinajs.cn'
    }
};

// 获取当前环境的API配置
export const getApiConfig = (apiKey) => {
    const config = apiConfigs[apiKey];
    if (!config) throw new Error(`Unknown API key: ${apiKey}`);

    return import.meta.env.PROD
        ? { baseUrl: config.prod }
        : config.dev;
};

// 生成Vite代理配置
export const createViteProxy = () => {
    const proxy = {};

    Object.entries(apiConfigs).forEach(([key, config]) => {
        if (config.dev) {
            proxy[config.dev.baseUrl] = {
                target: config.dev.target,
                changeOrigin: true,
                rewrite: path => path.replace(
                    new RegExp(`^${config.dev.baseUrl}`),
                    config.dev.pathRewrite['^' + config.dev.baseUrl] || ''
                )
            };
        }
    });

    return proxy;
};