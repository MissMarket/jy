/**
 * 股票数据管理组合式函数
 * 集中管理股票数据的获取、处理和缓存
 */

import { ref } from 'vue'
import { getStockHistoricalData } from '@/dataModule'
import calculateJMA from '@/signalModule'
import {
  calculateShape,
  calculateTradingSignal,
  normalizePrices,
  calculateATR14,
  rankAndScore,
} from '@/utils'

/**
 * 股票数据管理组合式函数
 * @returns {Object} 股票数据管理对象
 */
export const useStockData = () => {
  const loading = ref(true)
  const stockData = ref([])
  const error = ref(null)

  /**
   * 获取股票历史数据
   * @returns {Promise<Array>} 股票数据数组
   */
  const fetchStockData = async () => {
    try {
      loading.value = true
      error.value = null
      const data = await getStockHistoricalData()
      stockData.value = data
      return data
    } catch (err) {
      console.error('获取股票数据失败:', err)
      error.value = '获取股票数据失败'
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 计算单个股票的JMA和交易形态
   * @param {Object} stock - 股票数据
   * @returns {Object} 包含JMA和交易形态的股票数据
   */
  const calculateStockIndicators = stock => {
    const priceArr = stock.priceArr
    const jmaArr = calculateJMA(priceArr)

    // 计算最近的交易形态
    let tradingShape = { shape: '-', color: '#999999' }
    if (jmaArr.length >= 3) {
      const prevPrevJma = jmaArr[jmaArr.length - 3]
      const prevJma = jmaArr[jmaArr.length - 2]
      const currentJma = jmaArr[jmaArr.length - 1]
      tradingShape = calculateShape(prevPrevJma, prevJma, currentJma)
    }

    // 计算ATR14
    const atr14 = calculateATR14(stock.highArr, stock.lowArr, stock.priceArr)
    const currentPrice = stock.priceArr[stock.priceArr.length - 1]
    const atrRate = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0

    return {
      ...stock,
      jmaArr,
      tradingShape,
      atr14,
      atrRate,
    }
  }

  /**
   * 计算所有股票的指标
   * @returns {Array} 包含指标的股票数据数组
   */
  const calculateAllIndicators = () => {
    return stockData.value.map(stock => calculateStockIndicators(stock))
  }

  /**
   * 计算策略评估结果
   * @returns {Array} 评估结果数组
   */
  const evaluateStrategies = () => {
    // 计算所有指数的10个维度原始值
    const stockRawValues = stockData.value.map(stock => {
      const recent200Days = Math.min(200, stock.dateArr.length)
      const startIndex = stock.dateArr.length - recent200Days

      const dateArr = stock.dateArr.slice(startIndex)
      const priceArr = stock.priceArr.slice(startIndex)
      const normalizedPrices = normalizePrices(priceArr)

      const n = normalizedPrices.length

      // 下跌倾向：统计近200个交易日中下跌的天数占比
      let downDayCount = 0
      for (let i = 1; i < n; i++) {
        if (normalizedPrices[i] < normalizedPrices[i - 1]) {
          downDayCount++
        }
      }
      const downTrendRatio = downDayCount / (n - 1) // 下跌天数占比（越大越好）

      // 价格波动率
      const returns = []
      for (let i = 1; i < n; i++) {
        returns.push((normalizedPrices[i] - normalizedPrices[i - 1]) / normalizedPrices[i - 1])
      }
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
      const varianceReturn =
        returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length
      const stdReturn = Math.sqrt(varianceReturn)

      // 趋势强度：计算连续相同方向的最长段（衡量趋势持续性）
      let maxConsistentRun = 1
      let currentRun = 1
      for (let i = 2; i < n; i++) {
        const prevDirection = normalizedPrices[i - 1] > normalizedPrices[i - 2] ? 1 : -1
        const currentDirection = normalizedPrices[i] > normalizedPrices[i - 1] ? 1 : -1
        if (currentDirection === prevDirection) {
          currentRun++
        } else {
          maxConsistentRun = Math.max(maxConsistentRun, currentRun)
          currentRun = 1
        }
      }
      maxConsistentRun = Math.max(maxConsistentRun, currentRun)
      const trendStrength = maxConsistentRun / n // 归一化到0-1

      // 计算JMA并获取交易形态（使用全部价格数据）
      const jmaArr = calculateJMA(stock.priceArr)
      let tradingShape = { shape: '-', color: '#999999' }
      if (jmaArr.length >= 3) {
        const prevPrevJma = jmaArr[jmaArr.length - 3]
        const prevJma = jmaArr[jmaArr.length - 2]
        const currentJma = jmaArr[jmaArr.length - 1]
        tradingShape = calculateShape(prevPrevJma, prevJma, currentJma)
      }

      // 计算ATR14和平均真实波动率
      const atr14 = calculateATR14(stock.highArr, stock.lowArr, stock.priceArr)
      const currentPrice = stock.priceArr[stock.priceArr.length - 1]
      const atrRate = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0 // 转换为百分比

      // 计算历史交易信号（用于获取最后一个交易日的信号）
      let lastTradingSignal = { signal: '-', color: '#999999' }
      if (jmaArr.length >= 3) {
        // 构建历史数据（date + shape）
        const historyData = []
        for (let i = startIndex; i < stock.dateArr.length; i++) {
          const jmaIndex = i
          if (jmaIndex >= 2 && jmaIndex < jmaArr.length) {
            const prevPrevJma = jmaArr[jmaIndex - 2]
            const prevJma = jmaArr[jmaIndex - 1]
            const currentJma = jmaArr[jmaIndex]
            const shapeObj = calculateShape(prevPrevJma, prevJma, currentJma)
            historyData.push({
              date: stock.dateArr[i],
              shape: shapeObj.shape,
            })
          }
        }

        if (historyData.length > 0) {
          // 计算交易信号
          const signalData = calculateTradingSignal(historyData)
          // 获取最后一个交易日的信号
          const lastData = signalData[signalData.length - 1]
          lastTradingSignal = { signal: lastData.signal, color: lastData.signalColor }
        }
      }

      return {
        name: stock.plate || stock.stock,
        date: dateArr[dateArr.length - 1],
        tradingShape, // 交易形态
        tradingSignal: lastTradingSignal, // 最后一个交易日的交易信号
        atr14, // ATR14值
        atrRate, // 平均真实波动率（ATR14/收盘价，百分比）
        // 3个维度的原始值
        dim1_trendStrength: trendStrength, // 维度1：趋势强度（越大越好）
        dim2_downwardTrend: downTrendRatio, // 维度2：下跌倾向（越大越好，下跌天数占比）
        dim7_priceVolatility: stdReturn, // 维度7：价格波动率（越大越好）
      }
    })

    // 计算3个维度的评分
    const dim1Scores = rankAndScore(
      stockRawValues.map(v => v.dim1_trendStrength),
      3300,
      165,
      true,
    ) // 趋势强度：3300分，间隔165分，越大越好
    const dim2Scores = rankAndScore(
      stockRawValues.map(v => v.dim2_downwardTrend),
      3200,
      160,
      true,
    ) // 下跌倾向：3200分，间隔160，越大越好（下跌天数占比）
    const dim7Scores = rankAndScore(
      stockRawValues.map(v => v.dim7_priceVolatility),
      3500,
      175,
      true,
    ) // 价格波动：3500分，间隔175，越大越好

    // 计算总分（只包含3个维度）
    const results = stockRawValues.map((stock, index) => {
      const totalScore = dim1Scores[index] + dim2Scores[index] + dim7Scores[index]

      return {
        name: stock.name,
        date: stock.date,
        tradingShape: stock.tradingShape, // 交易形态
        tradingSignal: stock.tradingSignal, // 最后一个交易日的交易信号
        atr14: stock.atr14, // ATR14值
        atrRate: stock.atrRate, // 平均真实波动率（ATR14/收盘价，百分比）
        totalScore,
        trendScores: [dim1Scores[index], dim2Scores[index]],
        volatilityScores: [dim7Scores[index]],
      }
    })

    // 按总分从高到低排序
    results.sort((a, b) => b.totalScore - a.totalScore)

    // 计算前8名的权重（基于平均真实波动率的倒数）
    const top8 = results.slice(0, 8)
    const inverseRates = top8.map(stock => {
      // 避免除零，最小波动率设为0.01%
      const rate = Math.max(stock.atrRate, 0.01)
      return 1 / rate
    })
    const sumInverse = inverseRates.reduce((sum, inv) => sum + inv, 0)

    // 分配权重，保留1位小数
    let weights = results.map((_stock, index) => {
      if (index < 8) {
        const weight = (inverseRates[index] / sumInverse) * 80
        return Math.round(weight * 10) / 10 // 保留1位小数
      }
      return 0
    })

    // 调整权重使总和正好为80（处理四舍五入误差）
    const currentSum = weights.slice(0, 8).reduce((sum, w) => sum + w, 0)
    if (currentSum !== 80 && weights[0] > 0) {
      weights[0] = Math.round((weights[0] + (80 - currentSum)) * 10) / 10
    }

    // 将权重添加到结果中
    results.forEach((stock, index) => {
      stock.weight = weights[index]
      stock.allocation = 0 // 初始化分配资金
    })

    return results
  }

  return {
    loading,
    stockData,
    error,
    fetchStockData,
    calculateStockIndicators,
    calculateAllIndicators,
    evaluateStrategies,
  }
}
