/**
 * 回测评估模块
 * 计算策略绩效指标：收益率、回撤、夏普比率等
 */

/**
 * 计算累计收益率
 * @param {number[]} returns - 收益率数组
 * @returns {number} 累计收益率
 */
export const calculateCumulativeReturn = (returns) => {
  if (!returns || returns.length === 0) return 0
  
  let cumulative = 1
  for (const ret of returns) {
    cumulative *= (1 + ret)
  }
  
  return cumulative - 1
}

/**
 * 计算年化收益率
 * @param {number[]} returns - 收益率数组
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 年化收益率
 */
export const calculateAnnualizedReturn = (returns, tradingDaysPerYear = 252) => {
  if (!returns || returns.length === 0) return 0
  
  const cumulativeReturn = calculateCumulativeReturn(returns)
  const years = returns.length / tradingDaysPerYear
  
  if (years === 0) return 0
  
  return Math.pow(1 + cumulativeReturn, 1 / years) - 1
}

/**
 * 计算最大回撤
 * @param {number[]} equityCurve - 资金曲线数组
 * @returns {Object} 包含最大回撤和回撤期间信息
 */
export const calculateMaxDrawdown = (equityCurve) => {
  if (!equityCurve || equityCurve.length === 0) return { maxDrawdown: 0, peakIndex: 0, troughIndex: 0 }
  
  let maxDrawdown = 0
  let peakIndex = 0
  let troughIndex = 0
  let peak = equityCurve[0]
  let currentPeakIndex = 0
  
  for (let i = 1; i < equityCurve.length; i++) {
    // 更新峰值
    if (equityCurve[i] > peak) {
      peak = equityCurve[i]
      currentPeakIndex = i
    }
    
    // 计算从峰值到当前点的回撤
    const drawdown = (peak - equityCurve[i]) / peak
    
    // 更新最大回撤
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      peakIndex = currentPeakIndex
      troughIndex = i
    }
  }
  
  return { maxDrawdown, peakIndex, troughIndex }
}

/**
 * 计算波动率
 * @param {number[]} returns - 收益率数组
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 年化波动率
 */
export const calculateVolatility = (returns, tradingDaysPerYear = 252) => {
  if (!returns || returns.length < 2) return 0
  
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)
  
  return Math.sqrt(variance) * Math.sqrt(tradingDaysPerYear)
}

/**
 * 计算夏普比率
 * @param {number[]} returns - 收益率数组
 * @param {number} riskFreeRate - 无风险利率（年化，默认0.03）
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 夏普比率
 */
export const calculateSharpeRatio = (returns, riskFreeRate = 0.03, tradingDaysPerYear = 252) => {
  if (!returns || returns.length === 0) return 0
  
  const annualizedReturn = calculateAnnualizedReturn(returns, tradingDaysPerYear)
  const volatility = calculateVolatility(returns, tradingDaysPerYear)
  
  if (volatility === 0) return 0
  
  return (annualizedReturn - riskFreeRate) / volatility
}

/**
 * 计算索提诺比率
 * @param {number[]} returns - 收益率数组
 * @param {number} riskFreeRate - 无风险利率（年化，默认0.03）
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 索提诺比率
 */
export const calculateSortinoRatio = (returns, riskFreeRate = 0.03, tradingDaysPerYear = 252) => {
  if (!returns || returns.length === 0) return 0
  
  const annualizedReturn = calculateAnnualizedReturn(returns, tradingDaysPerYear)
  
  // 计算下行偏差（只考虑负收益）
  const negativeReturns = returns.filter(ret => ret < 0)
  if (negativeReturns.length === 0) return Infinity
  
  const meanNegative = negativeReturns.reduce((sum, ret) => sum + ret, 0) / negativeReturns.length
  
  // 计算下行偏差
  const downsideDeviation = Math.sqrt(
    negativeReturns.reduce((sum, ret) => sum + Math.pow(ret - Math.min(0, meanNegative), 2), 0) / negativeReturns.length
  )
  
  const annualizedDownside = downsideDeviation * Math.sqrt(tradingDaysPerYear)
  
  if (annualizedDownside === 0) return Infinity
  
  return (annualizedReturn - riskFreeRate) / annualizedDownside
}

/**
 * 计算胜率
 * @param {number[]} returns - 收益率数组
 * @returns {number} 胜率（正收益率占比）
 */
export const calculateWinRate = (returns) => {
  if (!returns || returns.length === 0) return 0
  
  const winCount = returns.filter(ret => ret > 0).length
  return winCount / returns.length
}

/**
 * 计算盈亏比
 * @param {number[]} returns - 收益率数组
 * @returns {number} 盈亏比（平均盈利/平均亏损）
 */
export const calculateProfitLossRatio = (returns) => {
  if (!returns || returns.length === 0) return 0
  
  const positiveReturns = returns.filter(ret => ret > 0)
  const negativeReturns = returns.filter(ret => ret < 0)
  
  if (negativeReturns.length === 0) return Infinity
  
  const avgProfit = positiveReturns.length > 0 ? positiveReturns.reduce((sum, ret) => sum + ret, 0) / positiveReturns.length : 0
  const avgLoss = Math.abs(negativeReturns.reduce((sum, ret) => sum + ret, 0) / negativeReturns.length)
  
  if (avgLoss === 0) return Infinity
  
  return avgProfit / avgLoss
}

/**
 * 计算卡玛比率
 * @param {number[]} returns - 收益率数组
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 卡玛比率（年化收益/最大回撤）
 */
export const calculateCalmarRatio = (returns, tradingDaysPerYear = 252) => {
  if (!returns || returns.length === 0) return 0
  
  // 计算资金曲线
  const equityCurve = calculateEquityCurve(returns)
  
  const annualizedReturn = calculateAnnualizedReturn(returns, tradingDaysPerYear)
  const { maxDrawdown } = calculateMaxDrawdown(equityCurve)
  
  if (maxDrawdown === 0) return Infinity
  
  return annualizedReturn / maxDrawdown
}

/**
 * 计算资金曲线
 * @param {number[]} returns - 收益率数组
 * @param {number} initialCapital - 初始资金（默认1）
 * @returns {number[]} 资金曲线
 */
export const calculateEquityCurve = (returns, initialCapital = 1) => {
  if (!returns || returns.length === 0) return []
  
  const equityCurve = [initialCapital]
  for (const ret of returns) {
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + ret))
  }
  
  return equityCurve
}

/**
 * 计算信息比率（相对于基准的超额收益）
 * @param {number[]} portfolioReturns - 组合收益率
 * @param {number[]} benchmarkReturns - 基准收益率
 * @param {number} tradingDaysPerYear - 每年交易日数（默认252）
 * @returns {number} 信息比率
 */
export const calculateInformationRatio = (portfolioReturns, benchmarkReturns, tradingDaysPerYear = 252) => {
  if (!portfolioReturns || !benchmarkReturns || portfolioReturns.length !== benchmarkReturns.length) return 0
  
  // 计算超额收益
  const excessReturns = portfolioReturns.map((ret, i) => ret - benchmarkReturns[i])
  
  const meanExcess = excessReturns.reduce((sum, ret) => sum + ret, 0) / excessReturns.length
  
  // 计算跟踪误差（超额收益的标准差）
  const trackingError = Math.sqrt(
    excessReturns.reduce((sum, ret) => sum + Math.pow(ret - meanExcess, 2), 0) / excessReturns.length
  ) * Math.sqrt(tradingDaysPerYear)
  
  // 年化超额收益
  const annualizedExcess = meanExcess * tradingDaysPerYear
  
  if (trackingError === 0) return 0
  
  return annualizedExcess / trackingError
}

/**
 * 计算月度收益率
 * @param {number[]} dailyReturns - 日收益率
 * @param {string[]} dates - 日期数组
 * @returns {Array} 月度收益率数组
 */
export const calculateMonthlyReturns = (dailyReturns, dates) => {
  if (!dailyReturns || dailyReturns.length === 0 || !dates || dates.length !== dailyReturns.length) return []
  
  const monthlyReturns = []
  let currentMonth = ''
  let cumulative = 0
  
  for (let i = 0; i < dailyReturns.length; i++) {
    const month = dates[i].substring(0, 7) // YYYY-MM
    
    if (currentMonth === '') {
      currentMonth = month
      cumulative = dailyReturns[i]
    } else if (month === currentMonth) {
      cumulative += dailyReturns[i]
    } else {
      monthlyReturns.push(cumulative)
      currentMonth = month
      cumulative = dailyReturns[i]
    }
  }
  
  if (cumulative !== 0) {
    monthlyReturns.push(cumulative)
  }
  
  return monthlyReturns
}

/**
 * 计算所有绩效指标
 * @param {number[]} returns - 收益率数组
 * @param {number[]} benchmarkReturns - 基准收益率数组（可选）
 * @returns {Object} 绩效指标对象
 */
export const calculateAllMetrics = (returns, benchmarkReturns = null) => {
  const metrics = {
    cumulativeReturn: calculateCumulativeReturn(returns),
    annualizedReturn: calculateAnnualizedReturn(returns),
    maxDrawdown: 0,
    volatility: calculateVolatility(returns),
    sharpeRatio: calculateSharpeRatio(returns),
    sortinoRatio: calculateSortinoRatio(returns),
    winRate: calculateWinRate(returns),
    profitLossRatio: calculateProfitLossRatio(returns),
    calmarRatio: calculateCalmarRatio(returns),
  }
  
  // 计算最大回撤
  const equityCurve = calculateEquityCurve(returns)
  metrics.maxDrawdown = calculateMaxDrawdown(equityCurve).maxDrawdown
  
  // 计算信息比率（如果有基准）
  if (benchmarkReturns && benchmarkReturns.length === returns.length) {
    metrics.informationRatio = calculateInformationRatio(returns, benchmarkReturns)
  }
  
  return metrics
}

/**
 * 回测单个策略
 * @param {Object} stockData - 股票数据
 * @param {Function} strategyFunction - 策略函数
 * @param {Object} hmmPrediction - HMM预测结果
 * @param {number} initialCapital - 初始资金（默认1）
 * @returns {Object} 回测结果
 */
export const backtestStrategy = (stockData, strategyFunction, hmmPrediction, initialCapital = 1) => {
  const prices = stockData.priceArr || []
  const returns = stockData.indicators?.returns || []
  const signals = []
  const portfolioReturns = []
  const equityCurve = [initialCapital]
  let position = 0.5 // 初始仓位50%
  
  for (let i = 0; i < prices.length; i++) {
    // 生成策略信号
    const signal = strategyFunction(
      {
        ...stockData,
        priceArr: prices.slice(0, i + 1),
        indicators: {
          ...stockData.indicators,
          returns: returns.slice(0, i),
        },
      },
      hmmPrediction
    )
    
    signals.push(signal.position)
    
    // 调整仓位
    position = signal.position
    
    // 计算当日收益（假设当日收盘调整仓位）
    if (i > 0) {
      const dailyReturn = returns[i - 1] || 0
      const portfolioReturn = position * dailyReturn
      portfolioReturns.push(portfolioReturn)
      equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + portfolioReturn))
    } else {
      portfolioReturns.push(0)
    }
  }
  
  // 计算绩效指标
  const metrics = calculateAllMetrics(portfolioReturns)
  
  return {
    equityCurve,
    portfolioReturns,
    signals,
    metrics,
    finalCapital: equityCurve[equityCurve.length - 1],
  }
}

/**
 * 回测多个策略
 * @param {Object} stockData - 股票数据
 * @param {Array} strategies - 策略数组
 * @param {Object} hmmPrediction - HMM预测结果
 * @returns {Array} 所有策略的回测结果
 */
export const backtestMultipleStrategies = (stockData, strategies, hmmPrediction) => {
  const results = []
  
  for (const strategy of strategies) {
    try {
      const result = backtestStrategy(
        stockData,
        (data, pred) => strategy.generateSignal(data, pred),
        hmmPrediction
      )
      
      results.push({
        strategyName: strategy.getName(),
        ...result,
      })
    } catch (error) {
      console.error(`回测策略 ${strategy.getName()} 失败:`, error)
      results.push({
        strategyName: strategy.getName(),
        error: error.message,
        metrics: {},
      })
    }
  }
  
  return results
}

/**
 * 生成回测报告
 * @param {Array} backtestResults - 回测结果数组
 * @returns {string} Markdown格式的报告
 */
export const generateBacktestReport = (backtestResults) => {
  let report = '# 策略回测报告\n\n'
  
  // 添加总体概览
  report += '## 策略绩效对比\n\n'
  report += '| 策略名称 | 年化收益率 | 夏普比率 | 最大回撤 | 胜率 | 卡玛比率 |\n'
  report += '|---------|-----------|---------|---------|------|---------|\n'
  
  for (const result of backtestResults) {
    if (result.error) continue
    
    const { metrics } = result
    report += `| ${result.strategyName} | ${(metrics.annualizedReturn * 100).toFixed(2)}% | ${metrics.sharpeRatio.toFixed(2)} | ${-(metrics.maxDrawdown * 100).toFixed(2)}% | ${(metrics.winRate * 100).toFixed(2)}% | ${metrics.calmarRatio.toFixed(2)} |\n`
  }
  
  // 找出最佳策略
  const validResults = backtestResults.filter(r => !r.error)
  if (validResults.length > 0) {
    const bestBySharpe = validResults.reduce((best, current) => 
      current.metrics.sharpeRatio > best.metrics.sharpeRatio ? current : best
    )
    
    report += `\n## 最佳策略（按夏普比率）\n\n`
    report += `- **策略名称**: ${bestBySharpe.strategyName}\n`
    report += `- **夏普比率**: ${bestBySharpe.metrics.sharpeRatio.toFixed(4)}\n`
    report += `- **年化收益率**: ${(bestBySharpe.metrics.annualizedReturn * 100).toFixed(2)}%\n`
    report += `- **最大回撤**: ${-(bestBySharpe.metrics.maxDrawdown * 100).toFixed(2)}%\n`
  }
  
  return report
}
