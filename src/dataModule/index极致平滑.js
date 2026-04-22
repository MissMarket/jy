/**
 * JMA 极致平滑版 - 以平滑度为最高优先级
 * 特性：
 * 1. 自适应滤波级数 8~14级（震荡时更多级数）
 * 2. 高基准阻尼 + 保守自适应
 * 3. 强制双重后处理
 * 4. 假突破强抑制
 * 核心约束：仅基于历史数据，已绘制值不因未来数据改变
 */

const EPSILON = 1e-10

const isValidNumber = value =>
  typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const createCircularBuffer = size => {
  const buffer = new Array(size).fill(0)
  let index = 0,
    count = 0,
    sum = 0
  return {
    push: value => {
      if (count >= size) sum -= buffer[index]
      else count++
      buffer[index] = value
      sum += value
      index = (index + 1) % size
    },
    getAverage: () => (count > 0 ? sum / count : 0),
    getBuffer: () => buffer.slice(),
    getCount: () => count,
    reset: () => {
      buffer.fill(0)
      index = count = sum = 0
    },
  }
}

/**
 * Hurst指数计算 - R/S分析
 */
const calculateHurst = data => {
  const validData = data.filter(v => isValidNumber(v) && v !== 0)
  if (validData.length < 8) return 0.5

  const returns = []
  for (let i = 1; i < validData.length; i++) {
    if (validData[i - 1] !== 0) {
      returns.push(Math.log(validData[i] / validData[i - 1]))
    }
  }

  if (returns.length < 4) return 0.5

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const deviations = returns.map(r => r - mean)

  const cumulativeDeviations = []
  let cumSum = 0
  for (const dev of deviations) {
    cumSum += dev
    cumulativeDeviations.push(cumSum)
  }

  const R = Math.max(...cumulativeDeviations) - Math.min(...cumulativeDeviations)
  const variance = deviations.reduce((sum, d) => sum + d * d, 0) / deviations.length
  const S = Math.sqrt(variance) + EPSILON

  return clamp(Math.log(R / S) / Math.log(returns.length * 2) + 0.5, 0.1, 0.9)
}

/**
 * 假突破检测 - 强化版
 */
const detectFalseBreakout = (jmaHistory, currentIdx) => {
  const windowSize = 8
  if (currentIdx < windowSize) return 0

  const recent = jmaHistory.slice(Math.max(0, currentIdx - windowSize), currentIdx + 1)
  if (recent.length < windowSize) return 0

  const changes = []
  for (let i = 1; i < recent.length; i++) {
    changes.push(recent[i] - recent[i - 1])
  }

  let score = 0

  // 特征1：方向反转
  if (changes.length >= 4) {
    const first = changes[0]
    const last = changes[changes.length - 1]
    const middle = changes.slice(1, -1).reduce((a, b) => a + b, 0)

    if (first * last < 0 && first * middle > 0) {
      score += 0.5
    }
  }

  // 特征2：波动率突变
  const recentVol = changes.slice(-3).reduce((s, c) => s + Math.abs(c), 0)
  const prevVol =
    changes.slice(0, -3).reduce((s, c) => s + Math.abs(c), 0) / Math.max(1, changes.length - 3)
  if (prevVol > EPSILON && recentVol > prevVol * 2) {
    score += 0.3
  }

  // 特征3：偏离均线
  const ma = recent.slice(-5).reduce((a, b) => a + b, 0) / 5
  const dev = Math.abs(recent[recent.length - 1] - ma) / (Math.abs(ma) + EPSILON)
  if (dev > 0.005) {
    score += 0.2
  }

  return clamp(score, 0, 1)
}

/**
 * 计算趋势强度 - 平滑优先版（趋势识别更保守）
 */
const calculateTrendStrengthSmooth = (state, price, maValues, jmaHistory, currentIdx) => {
  const priceBuffer = state.priceBuffer.getBuffer().filter(v => v !== 0)

  // Hurst指数
  const hurst = calculateHurst(priceBuffer)
  // 只有Hurst > 0.65才认为是强趋势（更严格）
  const hurstScore = hurst > 0.65 ? (hurst - 0.65) * 2.8 : 0

  // 假突破抑制
  const falseBreakoutScore = detectFalseBreakout(jmaHistory, currentIdx)

  // 层间一致性
  const [ma3, ma5, ma8] = maValues
  let consistencyScore = 0
  if (ma3 !== 0 && ma5 !== 0 && ma8 !== 0) {
    const diff1 = ma3 - ma5
    const diff2 = ma5 - ma8
    if (diff1 * diff2 > 0) {
      const ratio =
        Math.min(Math.abs(diff1), Math.abs(diff2)) /
        Math.max(Math.abs(diff1), Math.abs(diff2), EPSILON)
      consistencyScore = ratio * 0.8
    }
  }

  // 动量得分（更严格的阈值）
  let momentumScore = 0
  if (priceBuffer.length >= 6) {
    const first = priceBuffer[0]
    const last = priceBuffer[priceBuffer.length - 1]
    const netChange = Math.abs(last - first)
    let totalVol = 0
    for (let i = 1; i < priceBuffer.length; i++) {
      totalVol += Math.abs(priceBuffer[i] - priceBuffer[i - 1])
    }
    const ratio = totalVol > EPSILON ? netChange / totalVol : 0
    // 只有ratio > 0.6才算有趋势
    momentumScore = ratio > 0.6 ? (ratio - 0.6) * 2.5 : 0
  }

  // 综合评分（平滑优先，假 breakout 大幅压低趋势分）
  const rawStrength = hurstScore * 0.35 + consistencyScore * 0.35 + momentumScore * 0.3
  const finalStrength = rawStrength * (1 - falseBreakoutScore * 0.6)

  return {
    trendStrength: clamp(finalStrength, 0, 1),
    falseBreakoutScore,
    // 级数 8~14，震荡时更多
    adaptiveStages: Math.round(8 + (1 - rawStrength) * 6),
  }
}

/**
 * 自适应级数JMA计算 - 平滑优先
 */
const computeAdaptiveJMA = (state, price, stages, phaseCoeff, alpha) => {
  const ma = state.ma
  const newMa = new Array(14).fill(0)

  newMa[0] = (1 - alpha) * ma[0] + alpha * price
  newMa[1] = (1 - alpha) * ma[1] + alpha * newMa[0]

  let currentStage = 2
  let prevDel = newMa[0] - newMa[1]

  while (currentStage < stages && currentStage < 14) {
    if (currentStage % 2 === 0) {
      newMa[currentStage] =
        (1 - alpha) * ma[currentStage] + alpha * (newMa[currentStage - 2] + prevDel * phaseCoeff)
    } else {
      newMa[currentStage] = (1 - alpha) * ma[currentStage] + alpha * newMa[currentStage - 1]
      if (currentStage + 1 < stages) {
        prevDel = newMa[currentStage - 1] - newMa[currentStage]
      }
    }
    currentStage++
  }

  while (currentStage < 14) {
    newMa[currentStage] = newMa[currentStage - 1]
    currentStage++
  }

  return { newMa, outputStage: Math.min(stages - 1, 13) }
}

/**
 * 高阻尼计算 - 平滑优先
 */
const calculateSmoothDamp = (trendStrength, falseBreakoutScore, absDelta, threshold) => {
  // 高基准阻尼
  const minDamp = 0.22 + trendStrength * 0.18 // 0.22 ~ 0.40（更高下限）
  const maxDamp = 0.55 + trendStrength * 0.22 // 0.55 ~ 0.77

  // 分段阻尼（整体更高）
  let damp
  if (absDelta < threshold * 0.25) damp = 0.15
  else if (absDelta < threshold * 0.5) damp = 0.28
  else if (absDelta < threshold * 0.9) damp = 0.42
  else if (absDelta < threshold * 1.4) damp = 0.58
  else damp = 0.75

  // 假突破时大幅加强平滑
  if (falseBreakoutScore > 0.3) {
    damp *= 0.7
  }

  return clamp(damp, minDamp, maxDamp)
}

/**
 * 单步计算
 */
const computeJMA = (state, price, currentIdx) => {
  if (!isValidNumber(price)) {
    return { jma: state.init ? state.ma[state.lastOutputStage || 10] : 0, state }
  }

  if (!state.init) {
    state.price = price
    state.ma = new Array(14).fill(price)
    state.prevJMA = price
    state.prevDelta = 0
    state.jmaHistory = [price]
    state.voltyBuffer.reset()
    state.priceBuffer.reset()
    state.priceBuffer.push(price)
    state.warmupCount = 0
    state.prevTrendStrength = 0
    state.lastOutputStage = 10
    state.init = true
    return { jma: price, trendInfo: { trendStrength: 0, stages: 11 }, state }
  }

  state.priceBuffer.push(price)
  const absChange = Math.abs(price - state.price)
  state.price = price
  state.voltyBuffer.push(absChange)

  const avgVolty = state.voltyBuffer.getAverage()

  // 保守自适应
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const adaptiveFactor = clamp(
    state.power * (1 + Math.log(clamp(voltyRatio, 0.1, 10) + 1) * 0.45),
    0.7,
    1.6,
  )

  const effectiveLen = Math.max(6, state.length * adaptiveFactor)
  const alpha = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const phaseCoeff = clamp(1.0 + state.phase / 100, 0.8, 1.5)

  // 预计算
  const tempResult = computeAdaptiveJMA(state, price, 11, phaseCoeff, alpha)
  const ma3 = tempResult.newMa[3]
  const ma5 = tempResult.newMa[5]
  const ma8 = tempResult.newMa[8]

  const trendInfo = calculateTrendStrengthSmooth(
    state,
    price,
    [ma3, ma5, ma8],
    state.jmaHistory,
    currentIdx,
  )

  // 实际计算
  const adaptiveResult = computeAdaptiveJMA(
    state,
    price,
    trendInfo.adaptiveStages,
    phaseCoeff,
    alpha,
  )
  state.ma = adaptiveResult.newMa
  state.lastOutputStage = adaptiveResult.outputStage

  let finalJMA = adaptiveResult.newMa[adaptiveResult.outputStage]

  // 更长预热期
  if (++state.warmupCount < state.warmupNeeded) {
    const f = Math.pow(state.warmupCount / state.warmupNeeded, 2.5)
    finalJMA = price * (1 - f) + finalJMA * f
  }

  // 高阻尼
  const delta = finalJMA - state.prevJMA
  const acceleration = Math.abs(delta - state.prevDelta)
  const threshold = avgVolty * 0.88

  const damp = calculateSmoothDamp(
    trendInfo.trendStrength,
    trendInfo.falseBreakoutScore,
    Math.abs(delta),
    threshold,
  )

  finalJMA = state.prevJMA + delta * damp

  // 加速度额外平滑
  if (acceleration > threshold * 0.28) {
    const accelDamp = clamp(0.82 - trendInfo.trendStrength * 0.15, 0.67, 0.82)
    finalJMA = state.prevJMA + (finalJMA - state.prevJMA) * accelDamp
  }

  // 更新状态
  state.prevJMA = finalJMA
  state.prevDelta = delta
  state.jmaHistory.push(finalJMA)
  if (state.jmaHistory.length > 25) state.jmaHistory.shift()

  trendInfo.trendStrength = state.prevTrendStrength * 0.35 + trendInfo.trendStrength * 0.65
  state.prevTrendStrength = trendInfo.trendStrength

  return { jma: finalJMA, trendInfo, state }
}

/**
 * 实时因果后处理 - 在计算时即时平滑，不使用未来数据
 * 使用单边高斯权重（仅历史）
 */
const applyCausalSmooth = (rawValue, history, depth = 4) => {
  if (history.length === 0) return rawValue

  let weightedSum = rawValue * 0.5 // 当前值权重50%
  let totalWeight = 0.5

  // 只使用历史数据（j <= 0）
  for (let j = 0; j < depth && j < history.length; j++) {
    const histValue = history[history.length - 1 - j]
    const dist = j + 1 // 距离当前点的距离
    const weight = Math.exp(-(dist * dist) / 6) * 0.5 // 缩放权重
    weightedSum += histValue * weight
    totalWeight += weight
  }

  return totalWeight > EPSILON ? weightedSum / totalWeight : rawValue
}

/**
 * 主函数 - 实时因果平滑
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length
  const state = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 40),
    price: 0,
    ma: new Array(14).fill(0),
    prevJMA: 0,
    prevDelta: 0,
    prevTrendStrength: 0,
    jmaHistory: [],
    lastOutputStage: 10,
    voltyBuffer: createCircularBuffer(period),
    priceBuffer: createCircularBuffer(22),
    length: period,
    phase,
    power: power * 0.95,
  }

  const results = new Array(len)
  const smoothHistory = [] // 用于实时平滑的历史

  for (let i = 0; i < len; i++) {
    let jmaValue

    if (isValidNumber(prices[i])) {
      // 计算原始JMA
      const result = computeJMA(state, prices[i], i)
      const rawJMA = result.jma

      // 实时因果平滑（仅使用已输出的历史）
      jmaValue = applyCausalSmooth(rawJMA, smoothHistory, 4)

      // 更新平滑历史
      smoothHistory.push(jmaValue)
      if (smoothHistory.length > 6) smoothHistory.shift()
    } else {
      jmaValue = i > 0 ? results[i - 1] : 0
    }

    results[i] = jmaValue
  }

  return results
}

// 导出
if (typeof module !== 'undefined' && module.exports) module.exports = calculateJMA
else if (typeof window !== 'undefined') window.calculateJMA = calculateJMA

export { calculateJMA }
export default calculateJMA
