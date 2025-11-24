import axiosInstance from './axios';

export const dataApi = {
    // 获取股票数据
    fetchStockData: async (symbol, days) => {
        return axiosInstance.get('/stock', {
            params: {
                symbol,
                days
            }
        });
    },

    // 获取指数数据
    fetchIndexData: async (indexCode, days) => {
        return axiosInstance.get('/index', {
            params: {
                indexCode,
                days
            }
        });
    },

    // 批量获取数据
    fetchBatchData: async (requests) => {
        return axiosInstance.post('/batch', requests);
    }
};