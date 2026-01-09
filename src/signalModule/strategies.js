/**
 * 策略信号生成模块
 * 基于10种不同的策略生成交易信号
 */

/**
 * 策略基类
 */
class Strategy {
  constructor(name, params = {}) {
    this.name = name
    this.params = params
  }
  
  generateSignal(_data, _hmmPrediction) {
    throw new Error('子类必须实现 generateSignal 方法')
  }
  
  getName() {
    return this.name
  }
}

/**
 * 策略1：状态切换策略
 * 根据HMM状态变化决定仓位
 */
export class StateSwitchStrategy extends Strategy {
  constructor(params = {}) {
    super('状态切换策略', params)
  }
  
  generateSignal(_data, hmmPrediction) {
    const { currentState, prevState } = hmmPrediction
    const { bullishState = 0, bearishState = 2 } = this.params
    
    // 从熊市切换到牛市：全仓买入
    if (prevState === bearishState && currentState === bullishState) {
      return { action: 'buy', position: 1, confidence: 0.8 }
    }
    // 从牛市切换到熊市：清仓
    else if (prevState === bullishState && currentState === bearishState) {
      return { action: 'sell', position: 0, confidence: 0.8 }
    }
    // 震荡状态：减仓
    else if (currentState === 1) {
      return { action: 'reduce', position: 0.3, confidence: 0.6 }
    }
    // 保持当前状态
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
}

/**
 * 策略2：概率阈值策略
 * 基于状态概率分布决定仓位
 */
export class ProbabilityThresholdStrategy extends Strategy {
  constructor(params = {}) {
    super('概率阈值策略', params)
  }
  
  generateSignal(_data, hmmPrediction) {
    const { stateProbs } = hmmPrediction
    const { threshold = 0.6 } = this.params
    
    // 找出概率最大的状态
    const maxProb = Math.max(...stateProbs)
    const maxState = stateProbs.indexOf(maxProb)
    
    // 牛市概率高：重仓
    if (maxState === 0 && maxProb > threshold) {
      return { action: 'buy', position: 0.9, confidence: maxProb }
    }
    // 熊市概率高：空仓
    else if (maxState === 2 && maxProb > threshold) {
      return { action: 'sell', position: 0, confidence: maxProb }
    }
    // 震荡或不确定：中等仓位
    else {
      return { action: 'hold', position: 0.4, confidence: maxProb }
    }
  }
}

/**
 * 策略3：多空策略
 * 根据趋势方向做多或做空
 */
export class LongShortStrategy extends Strategy {
  constructor(params = {}) {
    super('多空策略', params)
  }
  
  generateSignal(data, hmmPrediction) {
    const { currentState } = hmmPrediction
    const prices = data.priceArr || []
    const { lookback = 20 } = this.params
    
    if (prices.length < lookback) {
      return { action: 'hold', position: 0.5, confidence: 0.3 }
    }
    
    // 计算最近收益
    const recentReturn = (prices[prices.length - 1] - prices[prices.length - lookback]) / prices[prices.length - lookback]
    
    // 牛市状态且上涨趋势：做多
    if (currentState === 0 && recentReturn > 0) {
      return { action: 'buy', position: 1, confidence: 0.7 }
    }
    // 熊市状态且下跌趋势：做空（在实际中用空仓代替）
    else if (currentState === 2 && recentReturn < 0) {
      return { action: 'sell', position: 0, confidence: 0.7 }
    }
    // 其他情况：轻仓观望
    else {
      return { action: 'hold', position: 0.2, confidence: 0.5 }
    }
  }
}

/**
 * 策略4：波动率策略
 * 根据波动率调整仓位
 */
export class VolatilityStrategy extends Strategy {
  constructor(params = {}) {
    super('波动率策略', params)
  }
  
  generateSignal(data, hmmPrediction) {
    const { currentState } = hmmPrediction
    const { volatility = [] } = data.indicators || {}
    const { highVolThreshold = 0.03, lowVolThreshold = 0.01 } = this.params
    
    if (volatility.length === 0) {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
    
    const currentVol = volatility[volatility.length - 1]
    
    // 高波动：降低仓位
    if (currentVol > highVolThreshold) {
      return { action: 'reduce', position: 0.2, confidence: 0.6 }
    }
    // 低波动且牛市：增加仓位
    else if (currentVol < lowVolThreshold && currentState === 0) {
      return { action: 'buy', position: 0.8, confidence: 0.7 }
    }
    // 正常波动：中等仓位
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
}

/**
 * 策略5：均值回归策略
 * 基于价格偏离均值的程度决定仓位
 */
export class MeanReversionStrategy extends Strategy {
  constructor(params = {}) {
    super('均值回归策略', params)
  }
  
  generateSignal(data, _hmmPrediction) {
    const prices = data.priceArr || []
    const { sma20 = [] } = data.indicators || {}
    const { deviationThreshold = 0.02 } = this.params
    
    if (prices.length === 0 || sma20.length === 0) {
      return { action: 'hold', position: 0.5, confidence: 0.3 }
    }
    
    const currentPrice = prices[prices.length - 1]
    const currentSMA = sma20[sma20.length - 1]
    const deviation = (currentPrice - currentSMA) / currentSMA
    
    // 价格低于下轨：超卖，买入
    if (deviation < -deviationThreshold) {
      return { action: 'buy', position: 0.8, confidence: 0.6 }
    }
    // 价格高于上轨：超买，卖出
    else if (deviation > deviationThreshold) {
      return { action: 'sell', position: 0.2, confidence: 0.6 }
    }
    // 价格在均值附近：中等仓位
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
}

/**
 * 策略6：动量策略
 * 追逐趋势方向
 */
export class MomentumStrategy extends Strategy {
  constructor(params = {}) {
    super('动量策略', params)
  }
  
  generateSignal(data, _hmmPrediction) {
    const prices = data.priceArr || []
    const { returns = [] } = data.indicators || {}
    const { momentumWindow = 10, threshold = 0.01 } = this.params
    
    if (prices.length < momentumWindow || returns.length < momentumWindow) {
      return { action: 'hold', position: 0.5, confidence: 0.3 }
    }
    
    // 计算动量（累计收益）
    let cumulativeReturn = 0
    for (let i = returns.length - momentumWindow; i < returns.length; i++) {
      cumulativeReturn += returns[i]
    }
    
    // 强上涨动量：买入
    if (cumulativeReturn > threshold * momentumWindow) {
      return { action: 'buy', position: 0.9, confidence: 0.7 }
    }
    // 强下跌动量：卖出
    else if (cumulativeReturn < -threshold * momentumWindow) {
      return { action: 'sell', position: 0.1, confidence: 0.7 }
    }
    // 动量不强：观望
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
}

/**
 * 策略7：趋势跟踪策略
 * 基于移动平均线配合HMM状态
 */
export class TrendFollowingStrategy extends Strategy {
  constructor(params = {}) {
    super('趋势跟踪策略', params)
  }
  
  generateSignal(data, hmmPrediction) {
    const { currentState } = hmmPrediction
    const prices = data.priceArr || []
    const { sma20 = [], ema20 = [] } = data.indicators || {}
    
    if (prices.length < 20 || sma20.length === 0 || ema20.length === 0) {
      return { action: 'hold', position: 0.5, confidence: 0.3 }
    }
    
    const currentPrice = prices[prices.length - 1]
    const currentSMA = sma20[sma20.length - 1]
    const currentEMA = ema20[ema20.length - 1]
    
    // 价格在均线之上且牛市状态：买入
    if (currentPrice > currentSMA && currentPrice > currentEMA && currentState === 0) {
      return { action: 'buy', position: 1, confidence: 0.8 }
    }
    // 价格在均线之下且熊市状态：卖出
    else if (currentPrice < currentSMA && currentPrice < currentEMA && currentState === 2) {
      return { action: 'sell', position: 0, confidence: 0.8 }
    }
    // 价格位于均线之间：中等仓位
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
}

/**
 * 策略8：风险平价策略
 * 基于风险调整仓位
 */
export class RiskParityStrategy extends Strategy {
  constructor(params = {}) {
    super('风险平价策略', params)
  }
  
  generateSignal(data, hmmPrediction) {
    const { currentState } = hmmPrediction
    const { volatility = [] } = data.indicators || {}
    const { basePosition = 0.5, riskMultiplier = 2 } = this.params
    
    if (volatility.length === 0) {
      return { action: 'hold', position: basePosition, confidence: 0.5 }
    }
    
    const currentVol = volatility[volatility.length - 1]
    const avgVol = volatility.reduce((a, b) => a + b, 0) / volatility.length
    
    // 计算风险调整后的仓位
    const riskAdjustedPosition = basePosition * (avgVol / (currentVol + 1e-10)) * riskMultiplier
    
    // 限制仓位在0-1之间
    const finalPosition = Math.max(0, Math.min(1, riskAdjustedPosition))
    
    // 根据市场状态调整
    const adjustedPosition = currentState === 0 ? finalPosition : finalPosition * 0.5
    
    return {
      action: adjustedPosition > 0.5 ? 'buy' : (adjustedPosition < 0.3 ? 'sell' : 'hold'),
      position: adjustedPosition,
      confidence: 0.6,
    }
  }
}

/**
 * 策略9：择时策略
 * 基于HMM预测信号
 */
export class MarketTimingStrategy extends Strategy {
  constructor(params = {}) {
    super('择时策略', params)
  }
  
  generateSignal(_data, hmmPrediction) {
    const { currentState, nextState, stateProbs } = hmmPrediction
    const { bullishThreshold = 0.7, bearishThreshold = 0.7 } = this.params
    
    const bullishProb = stateProbs[0] || 0
    const bearishProb = stateProbs[2] || 0
    
    // 当前是牛市且预计继续牛市：加仓
    if (currentState === 0 && nextState === 0 && bullishProb > bullishThreshold) {
      return { action: 'buy', position: 1, confidence: bullishProb }
    }
    // 当前是熊市且预计继续熊市：空仓
    else if (currentState === 2 && nextState === 2 && bearishProb > bearishThreshold) {
      return { action: 'sell', position: 0, confidence: bearishProb }
    }
    // 预测从熊市转牛市：提前布局
    else if (currentState === 2 && nextState === 0) {
      return { action: 'buy', position: 0.6, confidence: 0.6 }
    }
    // 预测从牛市转熊市：提前减仓
    else if (currentState === 0 && nextState === 2) {
      return { action: 'reduce', position: 0.3, confidence: 0.6 }
    }
    // 不确定：观望
    else {
      return { action: 'hold', position: 0.5, confidence: 0.4 }
    }
  }
}

/**
 * 策略10：组合优化策略
 * 结合多个信号生成最终决策
 */
export class PortfolioOptimizationStrategy extends Strategy {
  constructor(params = {}) {
    super('组合优化策略', params)
    this.signalHistory = []
  }
  
  generateSignal(data, hmmPrediction) {
    const { currentState, stateProbs } = hmmPrediction
    const { rsi = [] } = data.indicators || {}
    const { historyLength = 5 } = this.params
    
    // 收集信号历史
    this.signalHistory.push(currentState)
    if (this.signalHistory.length > historyLength) {
      this.signalHistory.shift()
    }
    
    // 分析状态趋势
    const stateTrend = this.analyzeStateTrend()
    
    // RSI超卖且趋势向好：买入
    if (rsi.length > 0 && rsi[rsi.length - 1] < 30 && stateTrend === 'up') {
      return { action: 'buy', position: 0.8, confidence: 0.7 }
    }
    // RSI超买且趋势向坏：卖出
    else if (rsi.length > 0 && rsi[rsi.length - 1] > 70 && stateTrend === 'down') {
      return { action: 'sell', position: 0.2, confidence: 0.7 }
    }
    // 持续牛市：重仓
    else if (stateTrend === 'up' && stateProbs[0] > 0.6) {
      return { action: 'buy', position: 0.9, confidence: 0.6 }
    }
    // 持续熊市：空仓
    else if (stateTrend === 'down' && stateProbs[2] > 0.6) {
      return { action: 'sell', position: 0, confidence: 0.6 }
    }
    // 其他：均衡配置
    else {
      return { action: 'hold', position: 0.5, confidence: 0.5 }
    }
  }
  
  analyzeStateTrend() {
    if (this.signalHistory.length < 3) return 'neutral'
    
    let upCount = 0
    let downCount = 0
    
    for (let i = 1; i < this.signalHistory.length; i++) {
      if (this.signalHistory[i] < this.signalHistory[i - 1]) {
        upCount++
      } else if (this.signalHistory[i] > this.signalHistory[i - 1]) {
        downCount++
      }
    }
    
    if (upCount > downCount) return 'up'
    if (downCount > upCount) return 'down'
    return 'neutral'
  }
}

/**
 * 初始化所有策略
 * @param {Object} params - 策略参数
 * @returns {Array} 策略数组
 */
export const initStrategies = (params = {}) => {
  const strategies = [
    new StateSwitchStrategy(params.stateSwitch || {}),
    new ProbabilityThresholdStrategy(params.probabilityThreshold || {}),
    new LongShortStrategy(params.longShort || {}),
    new VolatilityStrategy(params.volatility || {}),
    new MeanReversionStrategy(params.meanReversion || {}),
    new MomentumStrategy(params.momentum || {}),
    new TrendFollowingStrategy(params.trendFollowing || {}),
    new RiskParityStrategy(params.riskParity || {}),
    new MarketTimingStrategy(params.marketTiming || {}),
    new PortfolioOptimizationStrategy(params.portfolioOptimization || {}),
  ]
  
  return strategies
}

/**
 * 为单个股票应用所有策略
 * @param {Object} stockData - 股票数据
 * @param {Object} hmmPrediction - HMM预测结果
 * @param {Array} strategies - 策略数组
 * @returns {Array} 各策略的信号结果
 */
export const applyAllStrategies = (stockData, hmmPrediction, strategies) => {
  const signals = []
  
  for (const strategy of strategies) {
    try {
      const signal = strategy.generateSignal(stockData, hmmPrediction)
      signals.push({
        strategyName: strategy.getName(),
        ...signal,
      })
    } catch (error) {
      console.error(`策略 ${strategy.getName()} 执行失败:`, error)
      signals.push({
        strategyName: strategy.getName(),
        action: 'hold',
        position: 0.5,
        confidence: 0,
        error: error.message,
      })
    }
  }
  
  return signals
}

/**
 * 计算策略间相关性
 * @param {Array} strategyResults - 策略回测结果
 * @returns {Array} 相关性矩阵
 */
export const calculateStrategyCorrelation = (strategyResults) => {
  const numStrategies = strategyResults.length
  const correlationMatrix = []
  
  for (let i = 0; i < numStrategies; i++) {
    correlationMatrix[i] = []
    for (let j = 0; j < numStrategies; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1
      } else {
        // 计算两个策略信号的相关性
        const signals1 = strategyResults[i].signals || []
        const signals2 = strategyResults[j].signals || []
        
        if (signals1.length === 0 || signals2.length === 0 || signals1.length !== signals2.length) {
          correlationMatrix[i][j] = 0
          continue
        }
        
        // 计算皮尔逊相关系数
        const correlation = calculateCorrelation(signals1, signals2)
        correlationMatrix[i][j] = correlation
      }
    }
  }
  
  return correlationMatrix
}

/**
 * 计算两个数组的相关系数
 * @param {Array} arr1 - 数组1
 * @param {Array} arr2 - 数组2
 * @returns {number} 相关系数
 */
const calculateCorrelation = (arr1, arr2) => {
  const n = arr1.length
  if (n !== arr2.length || n === 0) return 0
  
  const mean1 = arr1.reduce((a, b) => a + b, 0) / n
  const mean2 = arr2.reduce((a, b) => a + b, 0) / n
  
  let covariance = 0
  let std1 = 0
  let std2 = 0
  
  for (let i = 0; i < n; i++) {
    const diff1 = arr1[i] - mean1
    const diff2 = arr2[i] - mean2
    covariance += diff1 * diff2
    std1 += diff1 * diff1
    std2 += diff2 * diff2
  }
  
  covariance /= n
  std1 = Math.sqrt(std1 / n)
  std2 = Math.sqrt(std2 / n)
  
  if (std1 === 0 || std2 === 0) return 0
  
  return covariance / (std1 * std2)
}
