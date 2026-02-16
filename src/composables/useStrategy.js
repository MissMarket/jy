/**
 * 策略计算管理组合式函数
 * 集中管理策略回测、计算和结果分析
 */

import { ref } from 'vue'
import calculateJMA from '@/signalModule'

/**
 * 策略计算管理组合式函数
 * @returns {Object} 策略管理对象
 */
export const useStrategy = () => {
  const backtestResult = ref({})
  const loading = ref(false)

  /**
   * 交易策略回测
   * @param {Array} priceArr - 价格数组
   * @param {Array} jmaArr - JMA均线数组
   * @param {number} initialCapital - 初始资金
   * @returns {Object} 交易结果
   */
  const backtestStrategy = (priceArr, jmaArr, initialCapital) => {
    const trades = []
    let cash = initialCapital
    let shares = 0
    let inPosition = false

    for (let i = 2; i < jmaArr.length; i++) {
      const a = jmaArr[i - 2]
      const b = jmaArr[i - 1]
      const c = jmaArr[i]
      const price = priceArr[i]

      // 买入信号: a > b 且 c > b
      const buySignal = a > b && c > b
      // 卖出信号: a < b 且 c < b
      const sellSignal = a < b && c < b

      if (buySignal && !inPosition) {
        // 全仓买入
        const buyShares = Math.floor(cash / price)
        const cost = buyShares * price
        cash = cash - cost
        shares = buyShares
        inPosition = true

        trades.push({
          type: '买入',
          day: i,
          price: price.toFixed(2),
          shares: buyShares,
          cost: cost.toFixed(2),
          cash: cash.toFixed(2),
          position: '持有',
          signal: '买入信号(a>b且c>b)',
        })
      } else if (sellSignal && inPosition) {
        // 全仓卖出
        const proceeds = shares * price
        cash = cash + proceeds
        inPosition = false

        trades.push({
          type: '卖出',
          day: i,
          price: price.toFixed(2),
          shares: shares,
          proceeds: proceeds.toFixed(2),
          cash: cash.toFixed(2),
          position: '空仓',
          signal: '卖出信号(a<b且c<b)',
        })

        shares = 0
      }
      // 处理连续买入或卖出信号的情况（忽略，只执行一次）
    }

    // 最后一个交易日强制清仓
    const lastDay = priceArr.length - 1
    if (inPosition && lastDay >= 0) {
      const lastPrice = priceArr[lastDay]
      const finalProceeds = shares * lastPrice
      cash = cash + finalProceeds

      trades.push({
        type: '强制卖出',
        day: lastDay,
        price: lastPrice.toFixed(2),
        shares: shares,
        proceeds: finalProceeds.toFixed(2),
        cash: cash.toFixed(2),
        position: '空仓',
        signal: '最后一个交易日强制清仓',
      })

      shares = 0
      inPosition = false
    }

    const finalCapital = cash
    const returnRate = (((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2)

    return {
      trades,
      initialCapital,
      finalCapital,
      returnRate,
      totalTrades: trades.filter(t => t.type === '买入' || t.type === '卖出').length,
    }
  }

  /**
   * 买入并持有策略回测
   * @param {Array} priceArr - 价格数组
   * @param {number} initialCapital - 初始资金
   * @returns {Object} 持有策略结果
   */
  const backtestHoldStrategy = (priceArr, initialCapital) => {
    if (priceArr.length < 2) {
      return {
        initialCapital,
        finalCapital: initialCapital,
        returnRate: '0.00',
        buyPrice: 0,
        sellPrice: 0,
        buyDay: 0,
        sellDay: 0,
      }
    }

    const buyPrice = priceArr[0]
    const sellPrice = priceArr[priceArr.length - 1]
    const buyDay = 0
    const sellDay = priceArr.length - 1

    const shares = Math.floor(initialCapital / buyPrice)
    const cost = shares * buyPrice
    const finalProceeds = shares * sellPrice
    const finalCapital = initialCapital - cost + finalProceeds
    const returnRate = (((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2)

    return {
      buyDay,
      buyPrice: buyPrice.toFixed(2),
      shares,
      cost: cost.toFixed(2),
      sellDay,
      sellPrice: sellPrice.toFixed(2),
      proceeds: finalProceeds.toFixed(2),
      initialCapital,
      finalCapital,
      returnRate,
    }
  }

  /**
   * 比较两种策略
   * @param {Object} strategy - 交易策略结果
   * @param {Object} hold - 持有策略结果
   * @returns {Object} 比较结果
   */
  const compareStrategies = (strategy, hold) => {
    const strategyFinal = parseFloat(strategy.finalCapital)
    const holdFinal = parseFloat(hold.finalCapital)
    const difference = strategyFinal - holdFinal
    const diffRate = ((difference / holdFinal) * 100).toFixed(2)

    const winner =
      strategyFinal > holdFinal ? '交易策略' : strategyFinal < holdFinal ? '买入持有' : '持平'

    return {
      winner,
      strategyFinalCapital: strategy.finalCapital,
      holdFinalCapital: hold.finalCapital,
      difference: difference.toFixed(2),
      diffRate,
      comparison: `${winner}更优，差额 ¥${difference.toFixed(2)} (${diffRate}%)`,
    }
  }

  /**
   * 运行策略回测
   * @param {Object} stockData - 股票数据
   * @param {number} initialCapital - 初始资金
   * @returns {Object} 回测结果
   */
  const runBacktest = (stockData, initialCapital = 1000000) => {
    try {
      loading.value = true
      const priceArr = stockData.priceArr
      const jma = calculateJMA(priceArr)
      const originArr = priceArr.slice(-500)
      const jmaArr = jma.slice(-500)

      // 交易策略回测
      const strategyResult = backtestStrategy(originArr, jmaArr, initialCapital)
      const holdResult = backtestHoldStrategy(originArr, initialCapital)

      // 计算策略对比
      const comparisonResult = compareStrategies(strategyResult, holdResult)

      // 更新到响应式数据
      backtestResult.value = {
        strategy: strategyResult,
        hold: holdResult,
        comparison: comparisonResult,
        priceArr: originArr,
        jmaArr: jmaArr,
        stockInfo: stockData,
      }

      return backtestResult.value
    } catch (error) {
      console.error('回测失败:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 计算资金分配
   * @param {Array} evaluationResults - 评估结果数组
   * @param {number} totalAssets - 总资产
   * @returns {Array} 包含资金分配的评估结果数组
   */
  const calculateAllocation = (evaluationResults, totalAssets) => {
    const results = [...evaluationResults]

    results.forEach((stock, index) => {
      // 只有前8名且有买入/持有信号才分配资金
      const signal = stock.tradingSignal?.signal
      const isValidSignal = signal === '买入' || signal === '持有'
      const isTop8 = index < 8

      if (isTop8 && isValidSignal && stock.weight > 0) {
        stock.allocation = Math.floor((totalAssets * stock.weight) / 100)
      } else {
        stock.allocation = 0
      }
    })

    return results
  }

  return {
    backtestResult,
    loading,
    backtestStrategy,
    backtestHoldStrategy,
    compareStrategies,
    runBacktest,
    calculateAllocation,
  }
}
