/**
 * JMA 无重绘版本
 * 核心原则：
 * 1. 逐bar计算，每根K线的输出值一旦确定不再修改
 * 2. 极值确认使用延迟机制（左向确认），不用右侧未来数据
 * 3. 所有判断只基于已收盘的历史K线
 */

const EPSILON = 1e-10

const isValidNumber = value => {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
}

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value))
}

const createCircularBuffer = size => {
  const buffer = new Array(size).fill(0)
  let index = 0
  let count = 0
  let sum = 0

  return {
    push: value => {
      if (count >= size) {
        sum -= buffer[index]
      } else {
        count++
      }
      buffer[index] = value
      sum += value
      index = (index + 1) % size
    },
    getAverage: () => (count > 0 ? sum / count : 0),
    getSum: () => sum,
    getCount: () => count,
    getBuffer: () => buffer,
    reset: () => {
      buffer.fill(0)
      index = 0
      count = 0
      sum = 0
    },
  }
}

/**
 * 标准JMA计算（单层，无修改）- 保持原逻辑
 */
const computeJMA = (state, price) => {
  if (!isValidNumber(price)) {
    return { jma: state.init ? state.ma9 : 0, state }
  }

  if (!state.init) {
    state.price = price
    state.prevPrice = price
    state.ma1 =
      state.ma2 =
      state.ma3 =
      state.ma4 =
      state.ma5 =
      state.ma6 =
      state.ma7 =
      state.ma8 =
      state.ma9 =
        price
    state.prevJMA = price
    state.voltyBuffer.reset()
    state.warmupCount = 0
    state.init = true
    return { jma: price, state }
  }

  const prevPrice = state.price
  state.prevPrice = prevPrice
  state.price = price

  const priceChange = price - prevPrice
  const absChange = Math.abs(priceChange)

  state.voltyBuffer.push(absChange)
  const avgVolty = state.voltyBuffer.getAverage()

  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const safeVoltyRatio = clamp(voltyRatio, 0.1, 10)

  const logRatio = safeVoltyRatio > EPSILON ? Math.log(safeVoltyRatio + 1) : 0
  const adaptivePower = state.power * (1 + logRatio * 0.5)
  const adaptiveFactor = clamp(adaptivePower, 0.8, 1.8)

  const effectiveLen = Math.max(4, state.length * adaptiveFactor)
  const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const alpha = beta

  const phaseRatio = state.phase / 100.0
  const phaseCoeff = clamp(1.0 + phaseRatio, 0.8, 1.5)

  // 9级滤波
  const ma1 = (1 - alpha) * state.ma1 + alpha * price
  const ma2 = (1 - alpha) * state.ma2 + alpha * ma1
  const del1 = ma1 - ma2
  const ma3 = (1 - alpha) * state.ma3 + alpha * (ma1 + del1 * phaseCoeff)
  const ma4 = (1 - alpha) * state.ma4 + alpha * ma3
  const del2 = ma3 - ma4
  const ma5 = (1 - alpha) * state.ma5 + alpha * (ma3 + del2 * phaseCoeff)
  const ma6 = (1 - alpha) * state.ma6 + alpha * ma5
  const del3 = ma5 - ma6
  const ma7 = (1 - alpha) * state.ma7 + alpha * (ma5 + del3 * phaseCoeff)
  const ma8 = (1 - alpha) * state.ma8 + alpha * ma7
  const del4 = ma7 - ma8
  const ma9 = (1 - alpha) * state.ma9 + alpha * (ma7 + del4 * phaseCoeff)

  state.ma1 = ma1
  state.ma2 = ma2
  state.ma3 = ma3
  state.ma4 = ma4
  state.ma5 = ma5
  state.ma6 = ma6
  state.ma7 = ma7
  state.ma8 = ma8
  state.ma9 = ma9

  state.warmupCount++
  let finalJMA = ma9
  if (state.warmupCount < state.warmupNeeded) {
    const warmupProgress = state.warmupCount / state.warmupNeeded
    const warmupFactor = Math.pow(warmupProgress, 3)
    finalJMA = price * (1 - warmupFactor) + ma9 * warmupFactor
  }

  // 标准拐点抑制
  const delta = finalJMA - state.prevJMA
  const threshold = avgVolty * 1.5
  const damp = Math.abs(delta) < threshold ? 0.25 : 0.9
  finalJMA = state.prevJMA + delta * damp

  state.prevJMA = finalJMA
  return { jma: finalJMA, state }
}

/**
 * 创建延迟趋势确认过滤器（无重绘）
 * 核心机制：
 * 1. 使用环形缓冲区存储最近N根K线的JMA值（未确认区域）
 * 2. 只有当K线离开确认窗口时，才输出最终值
 * 3. 输出的值永远不会再被修改
 */
const createDelayedTrendFilter = (confirmBars = 3) => {
  // 环形缓冲区存储原始JMA值
  const jmaBuffer = createCircularBuffer(confirmBars + 2)
  // 存储已确认的历史值（这些值不会再修改）
  const confirmedHistory = []
  let barCount = 0

  return {
    /**
     * 处理新bar的JMA值
     * @param {number} rawJMA - 当前bar计算出的原始JMA值
     * @param {number} trendJMA - 当前bar的趋势JMA值（用于判断方向）
     * @returns {Object} 输出结果
     */
    process: (rawJMA, trendJMA) => {
      barCount++

      // 将当前原始JMA存入缓冲区
      jmaBuffer.push(rawJMA)

      // 如果历史数据不足，直接返回原始值（但标记为未确认）
      if (barCount <= confirmBars) {
        confirmedHistory.push({
          value: rawJMA,
          confirmed: false,
          barIndex: barCount - 1,
        })
        return {
          output: rawJMA,
          isConfirmed: false,
          confirmedHistory: confirmedHistory.slice(),
        }
      }

      // 找到需要确认的延迟位置（confirmBars 根之前）
      // buffer[0] 是最早的，buffer[size-1] 是最新的
      const confirmIndex = barCount - confirmBars - 1

      // 获取待确认位置的历史值
      // 这个位置现在已经在缓冲区中属于"历史"了
      const pendingRawJMA = confirmedHistory[confirmIndex]?.value || rawJMA

      // 使用纯历史数据进行趋势确认（只用左侧数据）
      // 获取 confirmBars 根之前的历史趋势
      let trendSlope = 0
      if (confirmIndex >= confirmBars) {
        const oldTrend = confirmedHistory[confirmIndex - confirmBars]?.value || pendingRawJMA
        trendSlope = trendJMA - oldTrend
      }

      // 极值检测：只用左侧确认过的数据
      // 由于我们不能访问"未来"数据，这里使用单边平滑逻辑
      const isStrongTrend = Math.abs(trendSlope) > 50 // 阈值可调

      let confirmedValue = pendingRawJMA

      // 如果趋势很强且当前值与趋势方向相反，进行平滑
      // 但平滑只用历史数据（延迟确认）
      if (isStrongTrend && confirmIndex >= 2) {
        const prev1 = confirmedHistory[confirmIndex - 1]?.value || pendingRawJMA
        const prev2 = confirmedHistory[confirmIndex - 2]?.value || pendingRawJMA

        // 简单平均（只用历史数据）
        const historicalAvg = (prev1 + prev2) / 2

        // 如果当前值偏离历史均值太远，向均值回归
        const deviation = Math.abs(pendingRawJMA - historicalAvg)
        if (deviation > Math.abs(trendSlope) * 0.3) {
          confirmedValue = pendingRawJMA * 0.6 + historicalAvg * 0.4
        }
      }

      // 更新确认历史（一旦确认，不再修改）
      if (confirmedHistory[confirmIndex]) {
        confirmedHistory[confirmIndex] = {
          value: confirmedValue,
          confirmed: true,
          barIndex: confirmIndex,
        }
      }

      // 返回当前最新bar的输出（未确认的原始值）
      // 以及已确认的历史
      return {
        output: rawJMA, // 当前bar输出原始值（尚未确认）
        confirmedOutput: confirmedValue, // 延迟确认的输出
        isConfirmed: false,
        confirmedHistory: confirmedHistory.slice(),
        lastConfirmedIndex: confirmIndex,
      }
    },

    /**
     * 获取最终确认的所有值（用于序列结束时的完整输出）
     */
    finalize: () => {
      // 将剩余的未确认值标记为已确认
      for (let i = 0; i < confirmedHistory.length; i++) {
        if (!confirmedHistory[i].confirmed) {
          confirmedHistory[i].confirmed = true
        }
      }
      return confirmedHistory.map(h => h.value)
    },

    getConfirmedHistory: () => confirmedHistory.slice(),
  }
}

/**
 * 无重绘JMA计算 - 逐bar处理版本
 * @param {number[]} prices - 价格数组
 * @param {number} period - JMA周期
 * @param {number} phase - JMA相位
 * @param {number} power - JMA强度
 * @param {number} confirmBars - 趋势确认延迟（默认3）
 * @returns {number[]} JMA值数组（无重绘）
 */
const calculateJMANoRepaint = (prices, period = 10, phase = 0, power = 2, confirmBars = 3) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length

  // 主JMA状态
  const mainState = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 50),
    price: 0,
    prevPrice: 0,
    voltyBuffer: createCircularBuffer(period),
    ma1: 0,
    ma2: 0,
    ma3: 0,
    ma4: 0,
    ma5: 0,
    ma6: 0,
    ma7: 0,
    ma8: 0,
    ma9: 0,
    prevJMA: 0,
    length: period,
    phase,
    power,
  }

  // 趋势JMA状态（长周期）
  const trendPeriod = Math.floor(period * 2.5)
  const trendState = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(trendPeriod * 2, 50),
    price: 0,
    prevPrice: 0,
    voltyBuffer: createCircularBuffer(trendPeriod),
    ma1: 0,
    ma2: 0,
    ma3: 0,
    ma4: 0,
    ma5: 0,
    ma6: 0,
    ma7: 0,
    ma8: 0,
    ma9: 0,
    prevJMA: 0,
    length: trendPeriod,
    phase,
    power: power * 1.2,
  }

  // 创建延迟确认过滤器
  const trendFilter = createDelayedTrendFilter(confirmBars)

  // 存储最终输出值
  const finalOutputs = []

  // 逐bar计算
  for (let i = 0; i < len; i++) {
    const price = prices[i]

    if (!isValidNumber(price)) {
      // 无效价格，复用上一个值
      const lastValue = finalOutputs.length > 0 ? finalOutputs[finalOutputs.length - 1] : 0
      finalOutputs.push(lastValue)
      continue
    }

    // 计算原始JMA值
    const mainResult = computeJMA(mainState, price)
    const trendResult = computeJMA(trendState, price)

    // 通过延迟确认过滤器
    const filterResult = trendFilter.process(mainResult.jma, trendResult.jma)

    // 获取该bar的最终输出值
    // 如果该bar已经经过确认延迟期，使用确认值；否则使用原始值
    const confirmedIndex = i - confirmBars
    if (confirmedIndex >= 0 && confirmedIndex < filterResult.confirmedHistory.length) {
      finalOutputs.push(filterResult.confirmedHistory[confirmedIndex].value)
    } else {
      finalOutputs.push(mainResult.jma) // 尚未确认，使用原始值
    }
  }

  return finalOutputs
}

/**
 * 简化版：纯JMA无趋势确认（最保守，绝对无重绘）
 * 如果不需要趋势确认，用这个版本
 */
const calculateJMASimple = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const state = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 50),
    price: 0,
    prevPrice: 0,
    voltyBuffer: createCircularBuffer(period),
    ma1: 0,
    ma2: 0,
    ma3: 0,
    ma4: 0,
    ma5: 0,
    ma6: 0,
    ma7: 0,
    ma8: 0,
    ma9: 0,
    prevJMA: 0,
    length: period,
    phase,
    power,
  }

  return prices.map(price => {
    if (!isValidNumber(price)) {
      return state.init ? state.prevJMA : 0
    }
    return computeJMA(state, price).jma
  })
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateJMANoRepaint,
    calculateJMASimple,
    createDelayedTrendFilter,
    computeJMA,
  }
} else if (typeof window !== 'undefined') {
  window.calculateJMANoRepaint = calculateJMANoRepaint
  window.calculateJMASimple = calculateJMASimple
}

export { calculateJMANoRepaint, calculateJMASimple, createDelayedTrendFilter, computeJMA }
export default calculateJMANoRepaint
