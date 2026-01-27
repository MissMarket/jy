/**
 * Jurik移动平均线（JMA）JavaScript实现
 * 基于Mark Jurik的研究和社区开源实现
 */

class JurikMovingAverage {
  /**
   * 构造函数
   * @param {number} length - 周期长度（默认值：10）
   * @param {number} phase - 相位参数（-100到+100，默认0）
   * @param {number} power - 功率/自适应因子（默认值：1）
   */
  constructor(length = 10, phase = 0, power = 1) {
    this.length = Math.max(2, length)
    this.phase = Math.max(-100, Math.min(100, phase))
    this.power = Math.max(1, Math.min(10, power))

    // 内部状态变量
    this.init = false
    this.price = 0
    this.volty = 0
    this.vsum = 0
    this.avolty = 0
    this.vsum1 = 0
    this.vsum2 = 0
    this.vsum3 = 0
    this.vsum4 = 0
    this.ma1 = 0
    this.ma2 = 0
    this.ma3 = 0
    this.ma4 = 0
    this.ma5 = 0
    this.ma6 = 0
    this.ma7 = 0
    this.ma8 = 0
    this.ma9 = 0
    this.ma10 = 0
    this.ma11 = 0
    this.ma12 = 0
    this.ma13 = 0
    this.ma14 = 0
    this.ma15 = 0
    this.ma16 = 0
    this.ma17 = 0
    this.ma18 = 0
    this.ma19 = 0
    this.ma20 = 0

    // 缓冲区
    this.buffer = []
    this.jmaValues = []
  }

  /**
   * 计算单个JMA值
   * @param {number} price - 当前价格
   * @returns {number} JMA值
   */
  calculate(price) {
    if (!this.init) {
      this._initialize(price)
      return price
    }

    return this._computeJMA(price)
  }

  /**
   * 批量计算JMA
   * @param {Array} prices - 价格数组
   * @param {string} priceKey - 如果prices是对象数组，指定价格字段
   * @returns {Array} JMA值数组
   */
  calculateBatch(prices, priceKey = null) {
    if (!Array.isArray(prices) || prices.length === 0) {
      return []
    }

    const results = []
    this.reset()

    for (let i = 0; i < prices.length; i++) {
      const price = priceKey ? prices[i][priceKey] : prices[i]
      if (typeof price !== 'number' || isNaN(price)) {
        results.push(NaN)
        continue
      }

      const jma = this.calculate(price)
      results.push(jma)
    }

    return results
  }

  /**
   * 重置内部状态
   */
  reset() {
    this.init = false
    this.buffer = []
    this.jmaValues = []

    // 重置所有内部状态变量
    this.price = 0
    this.volty = 0
    this.vsum = 0
    this.avolty = 0
    this.vsum1 = 0
    this.vsum2 = 0
    this.vsum3 = 0
    this.vsum4 = 0
    this.ma1 = 0
    this.ma2 = 0
    this.ma3 = 0
    this.ma4 = 0
    this.ma5 = 0
    this.ma6 = 0
    this.ma7 = 0
    this.ma8 = 0
    this.ma9 = 0
    this.ma10 = 0
    this.ma11 = 0
    this.ma12 = 0
    this.ma13 = 0
    this.ma14 = 0
    this.ma15 = 0
    this.ma16 = 0
    this.ma17 = 0
    this.ma18 = 0
    this.ma19 = 0
    this.ma20 = 0
  }

  /**
   * 初始化内部状态
   * @param {number} initialPrice - 初始价格
   */
  _initialize(initialPrice) {
    this.price = initialPrice

    // 初始化所有EMA状态为初始价格
    this.ma1 = initialPrice
    this.ma2 = initialPrice
    this.ma3 = initialPrice
    this.ma4 = initialPrice
    this.ma5 = initialPrice
    this.ma6 = initialPrice
    this.ma7 = initialPrice
    this.ma8 = initialPrice
    this.ma9 = initialPrice
    this.ma10 = initialPrice
    this.ma11 = initialPrice
    this.ma12 = initialPrice
    this.ma13 = initialPrice
    this.ma14 = initialPrice
    this.ma15 = initialPrice
    this.ma16 = initialPrice
    this.ma17 = initialPrice
    this.ma18 = initialPrice
    this.ma19 = initialPrice
    this.ma20 = initialPrice

    // 初始化累积波动
    this.vsum = 0
    this.volty = 0

    this.init = true
  }

  /**
   * 计算JMA的核心算法
   * @param {number} price - 当前价格
   * @returns {number} JMA值
   */
  _computeJMA(price) {
    // 1. 基础参数
    const len = this.length
    const phaseRatio = this.phase / 100.0

    // 2. 更新价格状态
    const prevPrice = this.price
    this.price = price

    // 3. 计算波动性和累积波动
    const priceChange = Math.abs(price - prevPrice)
    this.volty = priceChange
    this.vsum = this.vsum + this.volty

    // 4. 计算自适应因子
    const avgVolty = this.vsum / len
    const voltyRatio = avgVolty > 0 ? this.volty / avgVolty : 1

    // 自适应指数 - 核心机制
    const adaptivePower = this.power * voltyRatio
    const adaptiveFactor = Math.pow(adaptivePower, 2)
    const clampedFactor = Math.max(0.5, Math.min(2.0, adaptiveFactor))

    // 5. 计算滤波系数
    const effectiveLen = len * clampedFactor
    const phaseRatio2 = phaseRatio + 1.0
    const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
    const alpha = beta

    // 6. Jurik级联滤波（标准实现）
    // EMA1
    this.ma1 = (1 - alpha) * this.ma1 + alpha * price

    // EMA2
    this.ma2 = (1 - alpha) * this.ma2 + alpha * this.ma1

    // EMA3 - 带相位补偿
    const ma1Diff = this.ma1 - this.ma2
    this.ma3 = (1 - alpha) * this.ma3 + alpha * (this.ma1 + ma1Diff * phaseRatio2)

    // EMA4
    this.ma4 = (1 - alpha) * this.ma4 + alpha * this.ma3

    // EMA5 - 带相位补偿
    const ma3Diff = this.ma3 - this.ma4
    this.ma5 = (1 - alpha) * this.ma5 + alpha * (this.ma3 + ma3Diff * phaseRatio2)

    // EMA6
    this.ma6 = (1 - alpha) * this.ma6 + alpha * this.ma5

    // EMA7 - 带相位补偿
    const ma5Diff = this.ma5 - this.ma6
    this.ma7 = (1 - alpha) * this.ma7 + alpha * (this.ma5 + ma5Diff * phaseRatio2)

    // EMA8
    this.ma8 = (1 - alpha) * this.ma8 + alpha * this.ma7

    // EMA9 - 带相位补偿
    const ma7Diff = this.ma7 - this.ma8
    this.ma9 = (1 - alpha) * this.ma9 + alpha * (this.ma7 + ma7Diff * phaseRatio2)

    // 7. 最终输出 - Jurik的关键：多级滤波后提取信号
    const finalJMA = this.ma9

    return finalJMA
  }

  /**
   * 获取JMA的历史值
   * @returns {Array} JMA历史值数组
   */
  getValues() {
    return [...this.jmaValues]
  }

  /**
   * 获取最后N个JMA值
   * @param {number} n - 数量
   * @returns {Array} 最后N个JMA值
   */
  getLastValues(n) {
    return this.jmaValues.slice(-n)
  }
}

/**
 * 简化版JMA计算函数（用于快速使用）
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期（默认10）
 * @param {number} phase - 相位（默认0）
 * @param {number} power - 功率（默认1）
 * @returns {Array} JMA值数组
 */
function calculateJMA(prices, period = 10, phase = 0, power = 1) {
  const jma = new JurikMovingAverage(period, phase, power)
  return jma.calculateBatch(prices)
}

/**
 * 计算JMA并返回带时间戳的结果
 * @param {Array} data - 数据数组，每个元素需包含price和timestamp
 * @param {Object} options - 配置选项
 * @returns {Array} 带时间戳的JMA结果
 */
function calculateJMAWithTimestamps(data, options = {}) {
  const {
    period = 14,
    phase = 0,
    power = 2,
    priceKey = 'price',
    timestampKey = 'timestamp',
  } = options

  const prices = data.map(item => item[priceKey])
  const jmaValues = calculateJMA(prices, period, phase, power)

  return data.map((item, index) => ({
    timestamp: item[timestampKey],
    price: item[priceKey],
    jma: jmaValues[index],
    diff: item[priceKey] - jmaValues[index],
    diffPercent: ((item[priceKey] - jmaValues[index]) / item[priceKey]) * 100,
  }))
}

/**
 * 示例：比较JMA与SMA、EMA
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期
 * @returns {Object} 包含不同均线的结果
 */
function compareMovingAverages(prices, period = 10) {
  const jma = calculateJMA(prices, period, 0, 1)

  // 计算SMA
  const sma = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN)
      continue
    }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }

  // 计算EMA
  const ema = []
  const k = 2 / (period + 1)
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      ema.push(prices[i])
    } else {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k))
    }
  }

  // 计算HMA（赫尔均线）作为对比
  const hma = calculateHMA(prices, period)

  return {
    prices,
    jma,
    sma,
    ema,
    hma,
  }
}

/**
 * 赫尔均线（HMA）计算函数
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期
 * @returns {Array} HMA值数组
 */
function calculateHMA(prices, period) {
  const result = []
  const halfPeriod = Math.floor(period / 2)
  const sqrtPeriod = Math.floor(Math.sqrt(period))

  // 计算WMA（加权移动平均）
  const calculateWMA = (data, length) => {
    if (data.length < length) return null

    let sum = 0
    let weightSum = 0

    for (let i = 0; i < length; i++) {
      const weight = length - i
      sum += data[data.length - 1 - i] * weight
      weightSum += weight
    }

    return sum / weightSum
  }

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
      continue
    }

    const wma1 = calculateWMA(prices.slice(0, i + 1), period)
    const wma2 = calculateWMA(prices.slice(0, i + 1), halfPeriod)

    if (wma1 === null || wma2 === null) {
      result.push(NaN)
      continue
    }

    if (i < period + sqrtPeriod - 2) {
      result.push(NaN)
    } else {
      const hmaWMA = calculateWMA(
        prices
          .slice(0, i + 1)
          .map((price, idx, arr) => {
            if (idx < period - 1) return NaN
            const wma1Inner = calculateWMA(arr.slice(0, idx + 1), period)
            const wma2Inner = calculateWMA(arr.slice(0, idx + 1), halfPeriod)
            return 2 * wma2Inner - wma1Inner
          })
          .filter(val => !isNaN(val)),
        sqrtPeriod,
      )

      result.push(hmaWMA)
    }
  }

  return result
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JurikMovingAverage,
    calculateJMA,
    calculateJMAWithTimestamps,
    compareMovingAverages,
    calculateHMA,
  }
}

// ES6 模块导出
export {
  JurikMovingAverage,
  calculateJMA,
  calculateJMAWithTimestamps,
  compareMovingAverages,
  calculateHMA,
}

// 浏览器环境下的全局导出
if (typeof window !== 'undefined') {
  window.JurikMovingAverage = JurikMovingAverage
  window.calculateJMA = calculateJMA
  window.calculateJMAWithTimestamps = calculateJMAWithTimestamps
  window.compareMovingAverages = compareMovingAverages
  window.calculateHMA = calculateHMA
}
