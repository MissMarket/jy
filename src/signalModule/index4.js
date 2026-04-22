/**
 * 三阶复合 JMA（TJMA）- 兼顾跟踪性与平滑度（含毛刺抑制）
 * 设计：
 * 1. JMA_fast: 快速跟踪，参数 period×0.6, power=1.5
 * 2. JMA_mid: 中速平衡，参数 period, power=2.5
 * 3. JMA_slow: 后向平滑，对 fast 结果二次计算，参数 period×1.5, power=3.5
 * 合成：动态权重 × (fast + mid + slow) + 极值检测后处理
 */

const EPSILON = 1e-10

/**
 * 校验数值有效性
 * @param {number} value - 待校验数值
 * @returns {boolean} 是否为有效数字
 */
const isValidNumber = value => {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
}

/**
 * 数值范围约束
 * @param {number} value - 目标值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 约束后的值
 */
const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value))
}

/**
 * 优化版循环缓冲区
 * @param {number} size - 缓冲区大小
 * @returns {Object} 缓冲区操作对象
 */
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
    getAverage: () => {
      return count > 0 ? sum / count : 0
    },
    getSum: () => sum,
    getCount: () => count,
    reset: () => {
      buffer.fill(0)
      index = 0
      count = 0
      sum = 0
    },
    resize: newSize => {
      if (newSize === buffer.length) return
      const newBuffer = new Array(newSize).fill(0)
      const copyCount = Math.min(count, newSize)
      for (let i = 0; i < copyCount; i++) {
        const srcIndex = (index - copyCount + i + buffer.length) % buffer.length
        newBuffer[i] = buffer[srcIndex]
      }
      buffer.length = 0
      buffer.push(...newBuffer)
      index = copyCount % newSize
      count = copyCount
      sum = buffer.slice(0, copyCount).reduce((a, b) => a + b, 0)
    },
    getInstance: () => ({
      buffer: [...buffer],
      index,
      count,
      sum,
    }),
    restoreInstance: instance => {
      buffer.length = 0
      buffer.push(...instance.buffer)
      index = instance.index
      count = instance.count
      sum = instance.sum
    },
  }
}

/**
 * 官方标准拐点抑制
 * @param {number} current - 当前JMA计算值
 * @param {number} prev - 上一期JMA值
 * @param {number} threshold - 动态阈值
 * @returns {number} 平滑后的JMA值
 */
const inflectionSuppression = (current, prev, threshold) => {
  const delta = current - prev
  if (Math.abs(delta) < threshold) {
    return prev + delta * 0.25
  }
  return prev + delta * 0.9
}

/**
 * Sigmoid 函数 - 用于动态权重的平滑过渡
 * @param {number} x - 输入值
 * @param {number} k - 斜率系数（控制过渡陡峭程度）
 * @returns {number} 0~1 范围的平滑输出
 */
const sigmoid = (x, k = 10) => {
  return 1 / (1 + Math.exp(-k * x))
}

/**
 * 动态权重计算 - 根据偏离度自适应调整三层权重
 * 正常状态:   fast=0.40, mid=0.35, slow=0.25
 * 异常状态:   fast=0.15, mid=0.40, slow=0.45（fast被压低）
 * @param {number} fastVal - Fast层输出值
 * @param {number} midVal - Mid层输出值
 * @returns {{ wFast: number, wMid: number, wSlow: number }} 动态权重
 */
const computeDynamicWeights = (fastVal, midVal) => {
  // 基础权重
  const baseWFast = 0.4
  const baseWMid = 0.35
  const baseWSlow = 0.25

  // 偏离度计算：fast 相对于 mid 的相对偏差
  const denom = Math.abs(midVal) > EPSILON ? Math.abs(midVal) : EPSILON
  const deviation = Math.abs(fastVal - midVal) / denom

  // 阈值：超过此值开始调整权重（0.5% 偏离）
  const deviationThreshold = 0.005

  if (deviation <= deviationThreshold) {
    // 偏离在正常范围，使用基础权重
    return { wFast: baseWFast, wMid: baseWMid, wSlow: baseWSlow }
  }

  // 使用 sigmoid 实现平滑过渡（避免权重突变引入新毛刺）
  // normalizedDeviation 越大 → transfer 越大 → fast 权重越低
  const maxDeviation = 0.03 // 最大考虑偏离（3%）
  const normalizedDeviation = clamp((deviation - deviationThreshold) / maxDeviation, 0, 1)
  const transfer = sigmoid(normalizedDeviation, 8)

  // 从 fast 向 mid/slow 转移权重（最大转移量 25%）
  const maxTransfer = 0.25
  const actualTransfer = transfer * maxTransfer

  const wFast = baseWFast - actualTransfer
  const wMid = baseWMid + actualTransfer * 0.45 // 45% 转给 mid
  const wSlow = baseWSlow + actualTransfer * 0.55 // 55% 转给 slow

  return { wFast, wMid, wSlow }
}

/**
 * 极值检测后处理 - 扫描序列并消除局部突刺点（兜底防护）
 * 对每个点取前后 N 个点的窗口，判断是否为局部极值
 * 若偏离度超阈值则用窗口加权平均替换
 * @param {Array} data - 输入数据数组
 * @param {number} windowSize - 单侧窗口大小（默认3）
 * @param {number} thresholdRatio - 极值判定阈值比率（默认1.5）
 * @returns {number[]} 处理后的数组
 */
const spikeRemoval = (data, windowSize = 3, thresholdRatio = 1.5) => {
  const len = data.length
  if (len < windowSize * 2 + 1) {
    return data.slice()
  }

  const result = data.slice()

  for (let i = windowSize; i < len - windowSize; i++) {
    const current = data[i]

    // 提取窗口内的有效数据
    let windowSum = 0
    let windowCount = 0
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i && isValidNumber(data[j]) && data[j] !== 0) {
        windowSum += data[j]
        windowCount++
      }
    }

    if (windowCount === 0) continue

    const windowAvg = windowSum / windowCount
    let windowStdBase = 0
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i && isValidNumber(data[j]) && data[j] !== 0) {
        windowStdBase += (data[j] - windowAvg) ** 2
      }
    }
    const windowStd = Math.sqrt(windowStdBase / windowCount)

    // 动态阈值：基于窗口标准差
    const dynamicThreshold = Math.max(windowStd * thresholdRatio, Math.abs(windowAvg) * 0.002)

    const absDiff = Math.abs(current - windowAvg)
    if (absDiff > dynamicThreshold) {
      // 判定为极值/毛刺，用高斯加权平均替换
      // 离当前点越近的点权重越高，但当前点本身权重降低
      let weightedSum = 0
      let totalWeight = 0
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (!isValidNumber(data[j]) || data[j] === 0) continue
        const dist = Math.abs(j - i)
        // 高斯权重：距离越远权重越小
        let weight = Math.exp(-(dist * dist) / (2 * windowSize * windowSize))
        // 当前点自身降权（仅保留30%原始权重）
        if (j === i) weight *= 0.3
        weightedSum += data[j] * weight
        totalWeight += weight
      }
      result[i] = totalWeight > EPSILON ? weightedSum / totalWeight : windowAvg
    }
  }

  return result
}

/**
 * 创建初始状态
 * @param {number} length - 周期长度
 * @param {number} phase - 相位参数
 * @param {number} power - 功率因子
 * @returns {Object} 初始状态对象
 */
const createInitialState = (length, phase, power) => {
  const safeLength = Math.max(2, Math.floor(length))
  const safePhase = clamp(phase, -100, 100)
  const safePower = clamp(power, 1, 10)

  return {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(safeLength * 2, 50),
    price: 0,
    prevPrice: 0,
    voltyBuffer: createCircularBuffer(safeLength),
    del1: 0,
    del2: 0,
    avgDel: 0,
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
    length: safeLength,
    phase: safePhase,
    power: safePower,
  }
}

/**
 * 初始化状态
 * @param {Object} state - 当前状态
 * @param {number} initialPrice - 初始价格
 * @returns {Object} 初始化后的状态
 */
const initializeState = (state, initialPrice) => {
  state.price = initialPrice
  state.prevPrice = initialPrice
  state.ma1 = initialPrice
  state.ma2 = initialPrice
  state.ma3 = initialPrice
  state.ma4 = initialPrice
  state.ma5 = initialPrice
  state.ma6 = initialPrice
  state.ma7 = initialPrice
  state.ma8 = initialPrice
  state.ma9 = initialPrice
  state.prevJMA = initialPrice
  state.del1 = 0
  state.del2 = 0
  state.avgDel = 0
  state.voltyBuffer.reset()
  state.warmupCount = 0
  state.init = true
  return state
}

/**
 * 计算单个JMA值
 * @param {Object} state - 当前状态
 * @param {number} price - 当前价格
 * @returns {Object} 包含JMA值和更新后状态的对象
 */
const computeJMA = (state, price) => {
  if (!isValidNumber(price)) {
    return {
      jma: state.init ? state.ma9 : 0,
      state: state,
    }
  }

  if (!state.init) {
    initializeState(state, price)
    return {
      jma: price,
      state: state,
    }
  }

  const { length, phase, power } = state

  const prevPrice = state.price
  state.prevPrice = prevPrice
  state.price = price

  const priceChange = price - prevPrice
  const absChange = Math.abs(priceChange)

  // 波动率计算
  state.voltyBuffer.push(absChange)
  const avgVolty = state.voltyBuffer.getAverage()

  // 波动率比率计算
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const safeVoltyRatio = clamp(voltyRatio, 0.1, 10)

  // 自适应因子计算
  const logRatio = safeVoltyRatio > EPSILON ? Math.log(safeVoltyRatio + 1) : 0
  const adaptivePower = power * (1 + logRatio * 0.5)
  const adaptiveFactor = clamp(adaptivePower, 0.8, 1.8)

  // 有效周期计算
  const effectiveLen = Math.max(4, length * adaptiveFactor)
  const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const alpha = beta

  // 相位系数
  const phaseRatio = phase / 100.0
  const phaseCoeff = clamp(1.0 + phaseRatio, 0.8, 1.5)

  // 9级滤波
  const ma1 = (1 - alpha) * state.ma1 + alpha * price
  const ma2 = (1 - alpha) * state.ma2 + alpha * ma1

  const del1 = ma1 - ma2
  state.del1 = del1

  const ma3 = (1 - alpha) * state.ma3 + alpha * (ma1 + del1 * phaseCoeff)
  const ma4 = (1 - alpha) * state.ma4 + alpha * ma3

  const del2 = ma3 - ma4
  state.del2 = del2
  state.avgDel = (state.avgDel + del2) * 0.5

  const ma5 = (1 - alpha) * state.ma5 + alpha * (ma3 + del2 * phaseCoeff)
  const ma6 = (1 - alpha) * state.ma6 + alpha * ma5

  const del3 = ma5 - ma6
  const ma7 = (1 - alpha) * state.ma7 + alpha * (ma5 + del3 * phaseCoeff)
  const ma8 = (1 - alpha) * state.ma8 + alpha * ma7

  const del4 = ma7 - ma8
  const ma9 = (1 - alpha) * state.ma9 + alpha * (ma7 + del4 * phaseCoeff)

  // 更新滤波值
  state.ma1 = ma1
  state.ma2 = ma2
  state.ma3 = ma3
  state.ma4 = ma4
  state.ma5 = ma5
  state.ma6 = ma6
  state.ma7 = ma7
  state.ma8 = ma8
  state.ma9 = ma9

  // 预热期计数
  state.warmupCount++

  // 预热期逻辑
  let finalJMA = ma9
  if (state.warmupCount < state.warmupNeeded) {
    const warmupProgress = state.warmupCount / state.warmupNeeded
    const warmupFactor = Math.pow(warmupProgress, 3)
    finalJMA = price * (1 - warmupFactor) + ma9 * warmupFactor
  }

  // 拐点抑制
  const volatilityThreshold = avgVolty * 1.5
  finalJMA = inflectionSuppression(finalJMA, state.prevJMA, volatilityThreshold)

  // 更新上一期JMA值
  state.prevJMA = finalJMA

  return {
    jma: finalJMA,
    state: state,
  }
}

/**
 * 计算TJMA（三阶复合JMA）主函数
 * TJMA = 0.4×fast + 0.35×mid + 0.25×slow
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期（默认10）
 * @param {number} phase - 相位（默认0）
 * @param {number} power - 功率（默认2， TJMA中作为基准参数）
 * @returns {Array} TJMA值数组
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return []
  }

  const validPrices = prices.filter(isValidNumber)
  if (validPrices.length === 0) {
    return []
  }

  const len = prices.length

  // 三个JMA的参数配置（基于传入的power参数调整）
  // Fast: 快速跟踪，短周期，低power
  const fastPeriod = Math.max(2, Math.floor(period * 0.6))
  const fastPower = power * 0.75

  // Mid: 中速平衡，原始周期，中power
  const midPeriod = period
  const midPower = power * 1.25

  // Slow: 后向平滑，对fast结果进行二次计算，长周期，高power
  const slowPeriod = Math.max(2, Math.floor(period * 1.5))
  const slowPower = power * 1.75

  // 初始化三个JMA的状态
  const fastState = createInitialState(fastPeriod, phase, fastPower)
  const midState = createInitialState(midPeriod, phase, midPower)
  const slowState = createInitialState(slowPeriod, phase, slowPower)

  // 存储各层结果
  const fastResults = new Array(len)
  const midResults = new Array(len)
  const slowResults = new Array(len)
  const tjmaResults = new Array(len)

  // 第一轮：计算 Fast JMA 和 Mid JMA（原始价格输入）
  for (let i = 0; i < len; i++) {
    const price = prices[i]

    if (isValidNumber(price)) {
      // Fast JMA
      const fastResult = computeJMA(fastState, price)
      fastResults[i] = fastResult.jma

      // Mid JMA
      const midResult = computeJMA(midState, price)
      midResults[i] = midResult.jma
    } else {
      // 无效价格，使用前一期值
      fastResults[i] = i > 0 ? fastResults[i - 1] : 0
      midResults[i] = i > 0 ? midResults[i - 1] : 0
    }
  }

  // 第二轮：计算 Slow JMA（以 Fast JMA 结果作为输入）
  for (let i = 0; i < len; i++) {
    const fastValue = fastResults[i]

    if (isValidNumber(fastValue) && fastValue !== 0) {
      const slowResult = computeJMA(slowState, fastValue)
      slowResults[i] = slowResult.jma
    } else {
      slowResults[i] = i > 0 ? slowResults[i - 1] : 0
    }
  }

  // 第三轮：动态权重合成 TJMA
  for (let i = 0; i < len; i++) {
    const fastVal = fastResults[i]
    const midVal = midResults[i]
    const slowVal = slowResults[i]

    // 确保所有分量都有效
    if (fastVal !== 0 && midVal !== 0 && slowVal !== 0) {
      // 动态权重：根据 fast 与 mid 的偏离度自适应调整
      const { wFast, wMid, wSlow } = computeDynamicWeights(fastVal, midVal)
      tjmaResults[i] = wFast * fastVal + wMid * midVal + wSlow * slowVal
    } else if (midVal !== 0) {
      // 预热期使用 mid 作为主值
      tjmaResults[i] = midVal
    } else if (fastVal !== 0) {
      tjmaResults[i] = fastVal
    } else {
      tjmaResults[i] = 0
    }
  }

  // 第四轮：极值检测后处理（消除残留毛刺，兜底防护）
  const finalResult = spikeRemoval(tjmaResults)

  return finalResult
}

// 导出（兼容模块化/非模块化环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = calculateJMA
  module.exports.createCircularBuffer = createCircularBuffer
  module.exports.createInitialState = createInitialState
} else if (typeof window !== 'undefined') {
  window.calculateJMA = calculateJMA
}

export { calculateJMA, createCircularBuffer, createInitialState }
export default calculateJMA
