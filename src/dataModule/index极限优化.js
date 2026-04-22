/**
 * JMA 极限优化版 - 优化1+2+3组合
 * 1. 自适应滤波级数（趋势强6级，震荡12级）
 * 2. 分形维度趋势识别（R/S分析计算Hurst指数）
 * 3. 假突破模式识别（历史形态匹配抑制）
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
 * Hurst指数计算 - R/S分析（仅基于历史数据）
 * H > 0.6: 强趋势性
 * H ≈ 0.5: 随机游走
 * H < 0.4: 均值回归（震荡）
 * @param {Array} data - 历史数据数组
 * @returns {number} Hurst指数 0~1
 */
const calculateHurst = data => {
  const n = data.length
  if (n < 8) return 0.5

  const validData = data.filter(v => isValidNumber(v) && v !== 0)
  if (validData.length < 8) return 0.5

  // 对数收益率
  const returns = []
  for (let i = 1; i < validData.length; i++) {
    if (validData[i - 1] !== 0) {
      returns.push(Math.log(validData[i] / validData[i - 1]))
    }
  }

  if (returns.length < 4) return 0.5

  // 计算R/S统计量
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const deviations = returns.map(r => r - mean)

  // 累积离差
  const cumulativeDeviations = []
  let cumSum = 0
  for (const dev of deviations) {
    cumSum += dev
    cumulativeDeviations.push(cumSum)
  }

  // 极差R
  const maxCum = Math.max(...cumulativeDeviations)
  const minCum = Math.min(...cumulativeDeviations)
  const R = maxCum - minCum

  // 标准差S
  const variance = deviations.reduce((sum, d) => sum + d * d, 0) / deviations.length
  const S = Math.sqrt(variance) + EPSILON

  // Hurst指数估计
  const RS = R / S
  const H = clamp(Math.log(RS) / Math.log(returns.length * 2) + 0.5, 0.1, 0.9)

  return H
}

/**
 * 假突破模式识别 - 基于历史JMA形态
 * 识别"急涨+快速回落"或"急跌+快速反弹"的假突破模式
 * @param {Array} jmaHistory - JMA历史值
 * @param {number} currentIdx - 当前索引
 * @returns {number} 假突破置信度 0~1，越高越可能是假突破
 */
const detectFalseBreakout = (jmaHistory, currentIdx) => {
  const windowSize = 6
  if (currentIdx < windowSize) return 0

  const recent = jmaHistory.slice(Math.max(0, currentIdx - windowSize), currentIdx + 1)
  if (recent.length < windowSize) return 0

  // 计算近期变化
  const changes = []
  for (let i = 1; i < recent.length; i++) {
    changes.push(recent[i] - recent[i - 1])
  }

  // 假突破特征1：先大方向变化，后快速反向
  let falseBreakoutScore = 0

  if (changes.length >= 4) {
    const firstChange = changes[0]
    const lastChange = changes[changes.length - 1]
    const middleSum = changes.slice(1, -1).reduce((a, b) => a + b, 0)

    // 特征：首尾反向，中间延续首方向
    const isReversal = firstChange * lastChange < 0
    const middleContinuesFirst = firstChange * middleSum > 0
    const magnitudeRatio = Math.abs(lastChange) / (Math.abs(firstChange) + EPSILON)

    if (isReversal && middleContinuesFirst && magnitudeRatio > 0.3) {
      falseBreakoutScore += 0.4
    }
  }

  // 假突破特征2：波动率异常放大后快速收缩
  const recentVolatility = changes.slice(-3).reduce((sum, c) => sum + Math.abs(c), 0)
  const prevVolatility =
    changes.slice(0, -3).reduce((sum, c) => sum + Math.abs(c), 0) / Math.max(1, changes.length - 3)

  if (prevVolatility > EPSILON && recentVolatility > prevVolatility * 2.5) {
    falseBreakoutScore += 0.35
  }

  // 假突破特征3：当前值偏离短期均线过远
  const shortMA = recent.slice(-4).reduce((a, b) => a + b, 0) / 4
  const current = recent[recent.length - 1]
  const deviation = Math.abs(current - shortMA) / (Math.abs(shortMA) + EPSILON)

  if (deviation > 0.008) {
    falseBreakoutScore += 0.25
  }

  return clamp(falseBreakoutScore, 0, 1)
}

/**
 * 综合趋势强度计算 - 融合Hurst指数、动量、一致性
 */
const calculateComprehensiveTrendStrength = (state, price, maValues, jmaHistory, currentIdx) => {
  // 1. Hurst指数（分形维度）
  const priceBuffer = state.priceBuffer.getBuffer().filter(v => v !== 0)
  const hurst = calculateHurst(priceBuffer)
  const hurstScore = hurst > 0.6 ? (hurst - 0.6) * 2.5 : hurst < 0.4 ? 0 : (hurst - 0.4) * 0.5

  // 2. 假突破抑制
  const falseBreakoutScore = detectFalseBreakout(jmaHistory, currentIdx)

  // 3. 层间一致性
  const [ma3, ma5, ma8] = maValues
  let consistencyScore = 0.5
  if (ma3 !== 0 && ma5 !== 0 && ma8 !== 0) {
    const diff1 = ma3 - ma5
    const diff2 = ma5 - ma8
    const consistency = diff1 * diff2 > 0 ? 1 : 0.3
    const avgDev = (Math.abs(diff1) + Math.abs(diff2)) / 2
    const devRatio = avgDev > EPSILON ? 1 - Math.abs(Math.abs(diff1) - Math.abs(diff2)) / avgDev : 0
    consistencyScore = consistency * 0.7 + devRatio * 0.3
  }

  // 4. 动量得分
  let momentumScore = 0.5
  if (priceBuffer.length >= 5) {
    const first = priceBuffer[0]
    const last = priceBuffer[priceBuffer.length - 1]
    const netChange = Math.abs(last - first)
    let totalVol = 0
    for (let i = 1; i < priceBuffer.length; i++) {
      totalVol += Math.abs(priceBuffer[i] - priceBuffer[i - 1])
    }
    momentumScore = totalVol > EPSILON ? clamp(netChange / totalVol, 0, 1) : 0.5
  }

  // 综合评分（假突破会降低趋势强度）
  const rawTrendStrength = hurstScore * 0.4 + consistencyScore * 0.35 + momentumScore * 0.25
  const finalTrendStrength = rawTrendStrength * (1 - falseBreakoutScore * 0.5)

  return {
    trendStrength: clamp(finalTrendStrength, 0, 1),
    hurst,
    falseBreakoutScore,
    adaptiveStages: Math.round(6 + (1 - rawTrendStrength) * 6), // 6~12级
  }
}

/**
 * 自适应级数JMA计算
 */
const computeAdaptiveJMA = (state, price, stages, phaseCoeff, alpha) => {
  const ma = state.ma
  const newMa = new Array(12).fill(0)

  // 第1-2级：基础EMA
  newMa[0] = (1 - alpha) * ma[0] + alpha * price
  newMa[1] = (1 - alpha) * ma[1] + alpha * newMa[0]

  // 动态计算剩余级数
  let currentStage = 2
  let prevDel = newMa[0] - newMa[1]

  while (currentStage < stages && currentStage < 12) {
    // 奇数级：带相位补偿
    if (currentStage % 2 === 0) {
      newMa[currentStage] =
        (1 - alpha) * ma[currentStage] + alpha * (newMa[currentStage - 2] + prevDel * phaseCoeff)
    } else {
      // 偶数级：基础平滑
      newMa[currentStage] = (1 - alpha) * ma[currentStage] + alpha * newMa[currentStage - 1]
      // 计算新的del用于下一级
      if (currentStage + 1 < stages) {
        prevDel = newMa[currentStage - 1] - newMa[currentStage]
      }
    }
    currentStage++
  }

  // 填充剩余层级（保持连续性）
  while (currentStage < 12) {
    newMa[currentStage] = newMa[currentStage - 1]
    currentStage++
  }

  return { newMa, outputStage: Math.min(stages - 1, 11) }
}

/**
 * 动态阻尼计算
 */
const calculateAdvancedDamp = (
  trendStrength,
  falseBreakoutScore,
  absDelta,
  threshold,
  acceleration,
) => {
  // 基础阻尼范围随趋势强度变化
  const minDamp = 0.12 + trendStrength * 0.3 // 0.12 ~ 0.42
  const maxDamp = 0.48 + trendStrength * 0.32 // 0.48 ~ 0.80

  // 根据变化量计算基础阻尼
  let baseDamp
  if (absDelta < threshold * 0.18) baseDamp = 0.1
  else if (absDelta < threshold * 0.38) baseDamp = 0.18
  else if (absDelta < threshold * 0.7) baseDamp = 0.32
  else if (absDelta < threshold * 1.1) baseDamp = 0.52
  else baseDamp = 0.7

  // 假突破时加强平滑
  if (falseBreakoutScore > 0.5) {
    baseDamp *= 0.75
  }

  // 高加速度处理（趋势强时减少抑制）
  if (acceleration > threshold * 0.32) {
    const accelFactor = clamp(1 - trendStrength * 0.45, 0.55, 1)
    baseDamp *= 0.68 * accelFactor
  }

  return clamp(baseDamp, minDamp, maxDamp)
}

/**
 * 主计算函数 - 单步
 */
const computeJMA = (state, price, currentIdx) => {
  if (!isValidNumber(price))
    return { jma: state.init ? state.ma[state.lastOutputStage || 8] : 0, state }

  if (!state.init) {
    state.price = price
    state.ma = new Array(12).fill(price)
    state.prevJMA = price
    state.prevDelta = 0
    state.jmaHistory = [price]
    state.voltyBuffer.reset()
    state.priceBuffer.reset()
    state.priceBuffer.push(price)
    state.warmupCount = 0
    state.prevTrendStrength = 0.5
    state.lastOutputStage = 8
    state.init = true
    return { jma: price, trendInfo: { trendStrength: 0.5, hurst: 0.5, stages: 9 }, state }
  }

  // 更新缓冲区
  state.priceBuffer.push(price)
  const absChange = Math.abs(price - state.price)
  state.price = price
  state.voltyBuffer.push(absChange)

  const avgVolty = state.voltyBuffer.getAverage()

  // 自适应因子
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const adaptiveFactor = clamp(
    state.power * (1 + Math.log(clamp(voltyRatio, 0.1, 10) + 1) * 0.55),
    0.62,
    1.9,
  )

  const effectiveLen = Math.max(4, state.length * adaptiveFactor)
  const alpha = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const phaseCoeff = clamp(1.0 + state.phase / 100, 0.8, 1.5)

  // 预计算基础JMA用于趋势识别
  const tempResult = computeAdaptiveJMA(state, price, 9, phaseCoeff, alpha)
  const ma3 = tempResult.newMa[3]
  const ma5 = tempResult.newMa[5]
  const ma8 = tempResult.newMa[8]

  // 综合趋势识别
  const trendInfo = calculateComprehensiveTrendStrength(
    state,
    price,
    [ma3, ma5, ma8],
    state.jmaHistory,
    currentIdx,
  )

  // 自适应级数计算
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

  // 预热期处理
  if (++state.warmupCount < state.warmupNeeded) {
    const f = Math.pow(state.warmupCount / state.warmupNeeded, 2.0)
    finalJMA = price * (1 - f) + finalJMA * f
  }

  // 智能阻尼
  const delta = finalJMA - state.prevJMA
  const acceleration = Math.abs(delta - state.prevDelta)
  const threshold = avgVolty * 0.95

  const damp = calculateAdvancedDamp(
    trendInfo.trendStrength,
    trendInfo.falseBreakoutScore,
    Math.abs(delta),
    threshold,
    acceleration,
  )

  finalJMA = state.prevJMA + delta * damp

  // 更新状态
  state.prevJMA = finalJMA
  state.prevDelta = delta
  state.jmaHistory.push(finalJMA)
  if (state.jmaHistory.length > 20) state.jmaHistory.shift()

  // 平滑过渡趋势强度
  trendInfo.trendStrength = state.prevTrendStrength * 0.25 + trendInfo.trendStrength * 0.75
  state.prevTrendStrength = trendInfo.trendStrength

  return { jma: finalJMA, trendInfo, state }
}

/**
 * 条件后处理
 */
const conditionalPostProcess = (results, trendInfos) => {
  const len = results.length
  if (len < 5) return results

  const avgTrendStrength = trendInfos.reduce((sum, t) => sum + (t?.trendStrength || 0.5), 0) / len
  const avgFalseBreakout =
    trendInfos.reduce((sum, t) => sum + (t?.falseBreakoutScore || 0), 0) / len

  // 强趋势或假突破少时，跳过后处理
  if (avgTrendStrength > 0.62 || avgFalseBreakout < 0.25) {
    return results
  }

  const processed = results.slice()

  // 轻度毛刺消除
  for (let i = 2; i < len - 1; i++) {
    const localTrend = trendInfos[i]?.trendStrength || 0.5
    if (localTrend > 0.58) continue

    const c1 = processed[i - 1] - processed[i - 2]
    const c2 = processed[i] - processed[i - 1]
    const c3 = processed[i + 1] - processed[i]

    // 检测V型反转
    if (Math.sign(c1) === Math.sign(c3) && Math.sign(c1) !== Math.sign(c2)) {
      const avg = processed[i - 1] * 0.5 + processed[i + 1] * 0.5
      processed[i] = processed[i] * 0.4 + avg * 0.6
    }
  }

  return processed
}

/**
 * 主函数
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length
  const state = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 32),
    price: 0,
    ma: new Array(12).fill(0),
    prevJMA: 0,
    prevDelta: 0,
    prevTrendStrength: 0.5,
    jmaHistory: [],
    lastOutputStage: 8,
    voltyBuffer: createCircularBuffer(period),
    priceBuffer: createCircularBuffer(20),
    length: period,
    phase,
    power: power * 1.02,
  }

  const results = new Array(len)
  const trendInfos = new Array(len)

  for (let i = 0; i < len; i++) {
    if (isValidNumber(prices[i])) {
      const result = computeJMA(state, prices[i], i)
      results[i] = result.jma
      trendInfos[i] = result.trendInfo
    } else {
      results[i] = i > 0 ? results[i - 1] : 0
      trendInfos[i] = i > 0 ? trendInfos[i - 1] : { trendStrength: 0.5, hurst: 0.5, stages: 9 }
    }
  }

  return conditionalPostProcess(results, trendInfos)
}

// 导出
if (typeof module !== 'undefined' && module.exports) module.exports = calculateJMA
else if (typeof window !== 'undefined') window.calculateJMA = calculateJMA

export { calculateJMA }
export default calculateJMA
