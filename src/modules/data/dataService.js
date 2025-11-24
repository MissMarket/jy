import { dataApi } from '../../api/dataApi';

export class DataService {
    constructor() {
        this.storageKey = 'investment_data';
    }

    // 获取并保存数据
    async fetchAndSaveData (symbols, days) {
        try {
            // 批量获取数据
            const requests = symbols.map(symbol => ({
                type: symbol.includes('.') ? 'index' : 'stock',
                symbol,
                days
            }));

            const data = await dataApi.fetchBatchData(requests);

            // 保存到本地存储
            this.saveToLocal(data);

            return data;
        } catch (error) {
            console.error('Failed to fetch data:', error);
            throw error;
        }
    }

    // 保存到本地存储
    saveToLocal (data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('LocalStorage error:', error);
            // 处理存储空间不足等情况
        }
    }

    // 从本地加载
    loadFromLocal () {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return null;

        try {
            const { data, timestamp } = JSON.parse(raw);
            return { data, timestamp };
        } catch (error) {
            console.error('Failed to parse local data:', error);
            return null;
        }
    }

    // 检查数据新鲜度
    isDataFresh (maxAgeHours = 24) {
        const localData = this.loadFromLocal();
        if (!localData) return false;

        const ageHours = (Date.now() - localData.timestamp) / (1000 * 60 * 60);
        return ageHours < maxAgeHours;
    }
}