/**
 * 数据预处理模块
 * 功能：数据清洗、标准化、平滑处理、特征工程
 */

/**
 * 计算日收益率
 * @param {number[]} prices - 价格数组
 * @returns {number[]} 收益率数组
 */
export const calculateReturns = (prices) => {
  if (!prices || prices.length < 2) return []
  
  const returns = []
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  
  return returns
}

/**
 * 计算对数收益率
 * @param {number[]} prices - 价格数组
 * @returns {number[]} 对数收益率数组
 */
export const calculateLogReturns = (prices) => {
  if (!prices || prices.length < 2) return []
  
  const returns = []
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]))
  }
  
  return returns
}

/**
 * 计算简单移动平均
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @returns {number[]} 移动平均数组
 */
export const calculateSMA = (data, window = 20) => {
  if (!data || data.length < window) return []
  
  const sma = []
  for (let i = window - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < window; j++) {
      sum += data[i - j]
    }
    sma.push(sum / window)
  }
  
  return sma
}

/**
 * 计算指数移动平均
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @returns {number[]} 指数移动平均数组
 */
export const calculateEMA = (data, window = 20) => {
  if (!data || data.length < window) return []
  
  const ema = []
  const multiplier = 2 / (window + 1)
  
  // 第一个EMA值使用SMA
  let sum = 0
  for (let i = 0; i < window; i++) {
    sum += data[i]
  }
  ema.push(sum / window)
  
  // 后续值使用EMA公式
  for (let i = window; i < data.length; i++) {
    const currentEMA = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]
    ema.push(currentEMA)
  }
  
  return ema
}

/**
 * 计算波动率（标准差）
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @returns {number[]} 波动率数组
 */
export const calculateVolatility = (data, window = 20) => {
  if (!data || data.length < window) return []
  
  const volatility = []
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1)
    const mean = slice.reduce((sum, val) => sum + val, 0) / window
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window
    volatility.push(Math.sqrt(variance))
  }
  
  return volatility
}

/**
 * 计算RSI指标
 * @param {number[]} prices - 价格数组
 * @param {number} period - 周期
 * @returns {number[]} RSI数组
 */
export const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return []
  
  const returns = calculateReturns(prices.slice(1))
  
  const gains = returns.map(r => r > 0 ? r : 0)
  const losses = returns.map(r => r < 0 ? -r : 0)
  
  const avgGain = []
  const avgLoss = []
  
  // 第一个平均值
  let firstGainSum = 0
  let firstLossSum = 0
  for (let i = 0; i < period; i++) {
    firstGainSum += gains[i]
    firstLossSum += losses[i]
  }
  avgGain.push(firstGainSum / period)
  avgLoss.push(firstLossSum / period)
  
  // 后续平均值使用平滑处理
  for (let i = period; i < returns.length; i++) {
    const currentAvgGain = (avgGain[avgGain.length - 1] * (period - 1) + gains[i]) / period
    const currentAvgLoss = (avgLoss[avgLoss.length - 1] * (period - 1) + losses[i]) / period
    avgGain.push(currentAvgGain)
    avgLoss.push(currentAvgLoss)
  }
  
  // 计算RSI
  const rsi = []
  for (let i = 0; i < avgGain.length; i++) {
    if (avgLoss[i] === 0) {
      rsi.push(100)
    } else {
      const rs = avgGain[i] / avgLoss[i]
      rsi.push(100 - (100 / (1 + rs)))
    }
  }
  
  return rsi
}

/**
 * Z-Score标准化
 * @param {number[]} data - 数据数组
 * @returns {number[]} 标准化后的数组
 */
export const zscoreNormalize = (data) => {
  if (!data || data.length === 0) return []
  
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return data.map(() => 0)
  
  return data.map(val => (val - mean) / stdDev)
}

/**
 * Min-Max归一化
 * @param {number[]} data - 数据数组
 * @param {number} min - 最小值（可选，默认为数组最小值）
 * @param {number} max - 最大值（可选，默认为数组最大值）
 * @returns {number[]} 归一化后的数组（0-1之间）
 */
export const minmaxNormalize = (data, min, max) => {
  if (!data || data.length === 0) return []
  
  const dataMin = min !== undefined ? min : Math.min(...data)
  const dataMax = max !== undefined ? max : Math.max(...data)
  
  if (dataMax === dataMin) return data.map(() => 0.5)
  
  return data.map(val => (val - dataMin) / (dataMax - dataMin))
}

/**
 * 数据平滑处理（加权移动平均）
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @returns {number[]} 平滑后的数组
 */
export const smoothData = (data, window = 5) => {
  if (!data || data.length < window) return []
  
  const smoothed = []
  for (let i = window - 1; i < data.length; i++) {
    let weightedSum = 0
    let weightSum = 0
    for (let j = 0; j < window; j++) {
      const weight = j + 1
      weightedSum += data[i - j] * weight
      weightSum += weight
    }
    smoothed.push(weightedSum / weightSum)
  }
  
  return smoothed
}

/**
 * 计算MACD指标
 * @param {number[]} prices - 价格数组
 * @param {number} fastPeriod - 快线周期
 * @param {number} slowPeriod - 慢线周期
 * @param {number} signalPeriod - 信号线周期
 * @returns {Object} 包含MACD、信号线、柱线
 */
export const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (!prices || prices.length < slowPeriod) return { macd: [], signal: [], histogram: [] }
  
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)
  
  // 对齐两个数组的长度
  const minLength = Math.min(fastEMA.length, slowEMA.length)
  const fastAligned = fastEMA.slice(fastEMA.length - minLength)
  const slowAligned = slowEMA.slice(slowEMA.length - minLength)
  
  // 计算MACD线
  const macd = []
  for (let i = 0; i < minLength; i++) {
    macd.push(fastAligned[i] - slowAligned[i])
  }
  
  // 计算信号线
  const signal = calculateEMA(macd, signalPeriod)
  
  // 计算柱线
  const histogram = []
  const minSignalLength = Math.min(macd.length, signal.length)
  for (let i = 0; i < minSignalLength; i++) {
    histogram.push(macd[macd.length - minSignalLength + i] - signal[i])
  }
  
  return { macd, signal, histogram }
}

/**
 * 计算布林带
 * @param {number[]} data - 数据数组
 * @param {number} window - 窗口大小
 * @param {number} numStdDevs - 标准差倍数
 * @returns {Object} 包含上轨、下轨、中轨
 */
export const calculateBollingerBands = (data, window = 20, numStdDevs = 2) => {
  if (!data || data.length < window) return { upper: [], lower: [], middle: [] }
  
  const middle = calculateSMA(data, window)
  const volatility = calculateVolatility(data, window)
  
  const upper = []
  const lower = []
  
  for (let i = 0; i < middle.length; i++) {
    upper.push(middle[i] + numStdDevs * volatility[i])
    lower.push(middle[i] - numStdDevs * volatility[i])
  }
  
  return { upper, lower, middle }
}

/**
 * 统一截取数据为指定长度（取最近的数据）
 * @param {Array} stockData - 股票数据数组
 * @param {number} length - 目标长度
 * @returns {Array} 处理后的股票数据数组
 */
export const truncateDataToLength = (stockData, length = 970) => {
  if (!stockData || stockData.length === 0) return []
  
  return stockData.map(stock => {
    const totalLength = Math.min(stock.dateArr.length, stock.priceArr.length, stock.volumnArr.length)
    const startIndex = Math.max(0, totalLength - length)
    const actualLength = totalLength - startIndex
    
    return {
      id: stock.id,
      plate: stock.plate,
      stock: stock.stock,
      fund: stock.fund,
      dateArr: stock.dateArr.slice(startIndex),
      priceArr: stock.priceArr.slice(startIndex),
      volumnArr: stock.volumnArr.slice(startIndex),
      totalDays: actualLength,
    }
  })
}

/**
 * 批量计算所有股票的技术指标
 * @param {Array} stockData - 股票数据数组
 * @returns {Array} 包含技术指标的股票数据数组
 */
export const calculateAllIndicators = (stockData) => {
  if (!stockData || stockData.length === 0) return []
  
  return stockData.map(stock => {
    const prices = stock.priceArr
    
    const returns = calculateReturns(prices)
    const logReturns = calculateLogReturns(prices)
    const sma20 = calculateSMA(prices, 20)
    const ema20 = calculateEMA(prices, 20)
    const volatility = calculateVolatility(returns, 20)
    const rsi = calculateRSI(prices, 14)
    const macd = calculateMACD(prices, 12, 26, 9)
    const bollinger = calculateBollingerBands(prices, 20, 2)
    
    return {
      ...stock,
      indicators: {
        returns,
        logReturns,
        sma20,
        ema20,
        volatility,
        rsi,
        macd,
        bollinger,
      },
    }
  })
}

/**
 * 提取HMM训练特征
 * @param {Object} stockWithIndicators - 包含技术指标的股票数据
 * @returns {number[]} 特征数组
 */
export const extractHMMFeatures = (stockWithIndicators) => {
  const { indicators } = stockWithIndicators
  
  if (!indicators) return []
  
  // 使用多个特征：收益率、波动率、RSI等
  const features = []
  
  // 收益率特征
  features.push(...(indicators.returns || []))
  
  // 波动率特征
  features.push(...(indicators.volatility || []))
  
  // RSI特征（归一化到0-1）
  const normalizedRSI = indicators.rsi ? indicators.rsi.map(r => r / 100) : []
  features.push(...normalizedRSI)
  
  return features
}

/**
 * 离散化连续数据为HMM观测状态
 * @param {number[]} data - 连续数据数组
 * @param {number} numStates - 状态数量
 * @returns {number[]} 离散状态数组
 */
export const discretizeToStates = (data, numStates = 10) => {
  if (!data || data.length === 0) return []
  
  // 使用分位数离散化
  const sortedData = [...data].sort((a, b) => a - b)
  const thresholds = []
  
  for (let i = 1; i < numStates; i++) {
    const idx = Math.floor((sortedData.length * i) / numStates)
    thresholds.push(sortedData[idx])
  }
  
  // 离散化
  return data.map(value => {
    for (let i = 0; i < thresholds.length; i++) {
      if (value < thresholds[i]) {
        return i
      }
    }
    return thresholds.length
  })
}
