/**
 * 数据模块 - 股票指数数据管理
 */

/**
 * sz399997 指数配置和数据
 */
export const SZ399997_INDEX = {
  code: 'sz399997',
  name: '中证1000指数',
  fullName: '中证1000指数收益率',
  market: '深圳',
  exchange: 'SZSE',
  sector: '综合指数',
  
  // 指数基本信息
  basicInfo: {
    launchDate: '2014-10-17',
    baseDate: '2004-12-31',
    basePoint: 1000,
    constituents: 1000, // 成分股数量
    weightingMethod: '自由流通市值加权',
    
    // 编制方案
    sampleSpace: '全部A股中剔除中证800指数样本股后规模偏小且流动性不足的股票',
    selectionCriteria: '综合考察总市值、成交金额等因素',
    reviewFrequency: '每半年定期调整'
  },
  
  // 最新行情数据（模拟数据）
  latestData: {
    currentPrice: 5687.45,
    change: '+12.36',
    changePercent: '+0.22%',
    openPrice: 5675.09,
    highPrice: 5698.23,
    lowPrice: 5664.88,
    volume: '2.35亿手',
    amount: '892.6亿元',
    turnoverRate: '1.28%',
    pe: 18.65,
    pb: 1.58,
    updateTime: '2025-12-07 15:00:00'
  },
  
  // 历史数据（最近几个交易日）
  historicalData: [
    { date: '2025-12-07', close: 5687.45, change: '+0.22%', volume: '2.35亿手' },
    { date: '2025-12-06', close: 5675.09, change: '-0.15%', volume: '2.18亿手' },
    { date: '2025-12-05', close: 5683.61, change: '+0.48%', volume: '2.42亿手' },
    { date: '2025-12-04', close: 5656.51, change: '-0.32%', volume: '2.05亿手' },
    { date: '2025-12-03', close: 5674.63, change: '+0.12%', volume: '2.28亿手' }
  ],
  
  // 技术指标
  technicalIndicators: {
    ma5: 5672.34,     // 5日均线
    ma10: 5658.92,   // 10日均线
    ma20: 5632.18,   // 20日均线
    ma60: 5587.45,   // 60日均线
    rsi: 58.3,       // RSI指标
    macd: {
      dif: 12.56,
      dea: 8.92,
      macd: 7.28
    },
    kdj: {
      k: 68.5,
      d: 62.3,
      j: 80.9
    }
  },
  
  // 成分股行业分布
  sectorDistribution: [
    { sector: '工业', weight: '28.5%', count: 285 },
    { sector: '信息技术', weight: '22.3%', count: 223 },
    { sector: '原材料', weight: '15.8%', count: 158 },
    { sector: '可选消费', weight: '12.4%', count: 124 },
    { sector: '医药卫生', weight: '8.7%', count: 87 },
    { sector: '金融地产', weight: '6.2%', count: 62 },
    { sector: '公用事业', weight: '3.8%', count: 38 },
    { sector: '能源', weight: '2.3%', count: 23 }
  ],
  
  // 市值分布
  marketCapDistribution: {
    largeCap: { range: '500亿以上', weight: '35.2%', count: 45 },
    midCap: { range: '100-500亿', weight: '42.8%', count: 280 },
    smallCap: { range: '50-100亿', weight: '15.3%', count: 420 },
    microCap: { range: '50亿以下', weight: '6.7%', count: 255 }
  },
  
  // 指数特点说明
  characteristics: [
    '中证1000指数由全部A股中剔除中证800指数样本股后规模偏小且流动性不足的股票组成',
    '综合反映A股市场中中小市值公司的整体表现',
    '成分股数量为1000只，覆盖沪深两市',
    '每半年定期调整一次样本股，确保指数代表性',
    '是中证指数体系中的重要宽基指数之一'
  ]
};

/**
 * 获取sz399997指数数据
 * @param {string} type 数据类型：basic/latest/historical/technical
 * @returns {Object} 对应的指数数据
 */
export const getSz399997Data = (type = 'latest') => {
  switch (type) {
    case 'basic':
      return {
        ...SZ399997_INDEX.basicInfo,
        code: SZ399997_INDEX.code,
        name: SZ399997_INDEX.name,
        fullName: SZ399997_INDEX.fullName
      };
    
    case 'latest':
      return SZ399997_INDEX.latestData;
    
    case 'historical':
      return SZ399997_INDEX.historicalData;
    
    case 'technical':
      return SZ399997_INDEX.technicalIndicators;
    
    case 'sector':
      return SZ399997_INDEX.sectorDistribution;
    
    case 'marketcap':
      return SZ399997_INDEX.marketCapDistribution;
    
    case 'characteristics':
      return SZ399997_INDEX.characteristics;
    
    default:
      return SZ399997_INDEX;
  }
};

/**
 * 获取sz399997实时行情
 * @returns {Promise<Object>} 通过API获取的实时数据
 */
export const getSz399997RealtimeData = async () => {
  try {
    // 这里可以调用真实的API接口获取数据
    // const response = await StockApiService.getTencentStockData('sz399997');
    // return response;
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return SZ399997_INDEX.latestData;
  } catch (error) {
    console.error('获取sz399997实时数据失败:', error);
    throw error;
  }
};

/**
 * 格式化sz399997数据用于显示
 * @param {Object} data 原始数据
 * @param {string} format 格式类型：table/chart/json
 * @returns {Object} 格式化后的数据
 */
export const formatSz399997Data = (data, format = 'json') => {
  switch (format) {
    case 'table':
      return {
        columns: ['指标', '数值'],
        rows: [
          ['指数名称', data.name || SZ399997_INDEX.name],
          ['指数代码', data.code || SZ399997_INDEX.code],
          ['最新点位', data.currentPrice || SZ399997_INDEX.latestData.currentPrice],
          ['涨跌额', data.change || SZ399997_INDEX.latestData.change],
          ['涨跌幅', data.changePercent || SZ399997_INDEX.latestData.changePercent],
          ['开盘价', data.openPrice || SZ399997_INDEX.latestData.openPrice],
          ['最高价', data.highPrice || SZ399997_INDEX.latestData.highPrice],
          ['最低价', data.lowPrice || SZ399997_INDEX.latestData.lowPrice],
          ['成交量', data.volume || SZ399997_INDEX.latestData.volume],
          ['成交额', data.amount || SZ399997_INDEX.latestData.amount]
        ]
      };
    
    case 'chart':
      return {
        labels: SZ399997_INDEX.historicalData.map(item => item.date),
        datasets: [{
          label: SZ399997_INDEX.name,
          data: SZ399997_INDEX.historicalData.map(item => item.close),
          borderColor: '#409eff',
          backgroundColor: 'rgba(64, 158, 255, 0.1)',
          fill: true
        }]
      };
    
    default:
      return data;
  }
};

// 默认导出
export default {
  SZ399997_INDEX,
  getSz399997Data,
  getSz399997RealtimeData,
  formatSz399997Data
};