/**
 * JMA 智能模式切换版 - 基于历史数据的趋势/震荡自适应
 * 核心特性：
 * 1. 仅基于历史与当前数据计算，已绘制值不因后续数据而改变
 * 2. 强趋势模式：优化时效性，减少滞后
 * 3. 震荡模式：保持高平滑性，控制超调
 * 4. 平滑过渡：避免模式切换引入毛刺
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
    getSum: () => sum,
    getCount: () => count,
    getBuffer: () => buffer.slice(),
    reset: () => {
      buffer.fill(0)
      index = count = sum = 0
    },
  }
}

/**
 * 趋势强度计算 - 仅基于历史数据
 * 综合三个指标：
 * 1. 价格动量累积（净变化/总波动）
 * 2. JMA层间一致性（fast/mid/slow的同向性）
 * 3. 波动率趋势（当前波动 vs 历史平均）
 * @returns {number} 0~1，越接近1表示趋势越强
 */
const calculateTrendStrength = (state, price, fastVal, midVal, slowVal) => {
  // 指标1：价格动量累积（基于历史价格缓冲区）
  const priceBuffer = state.priceBuffer.getBuffer()
  const validPrices = priceBuffer.filter(p => p !== 0)
  let momentumScore = 0.5

  if (validPrices.length >= 5) {
    const firstPrice = validPrices[0]
    const lastPrice = validPrices[validPrices.length - 1]
    const netChange = Math.abs(lastPrice - firstPrice)
    let totalVolatility = 0
    for (let i = 1; i < validPrices.length; i++) {
      totalVolatility += Math.abs(validPrices[i] - validPrices[i - 1])
    }
    // 动量比率 = 净变化 / 总波动（趋势强时接近1，震荡时接近0）
    const momentumRatio = totalVolatility > EPSILON ? netChange / totalVolatility : 0
    momentumScore = clamp(momentumRatio, 0, 1)
  }

  // 指标2：JMA层间一致性
  let consistencyScore = 0.5
  if (fastVal !== 0 && midVal !== 0 && slowVal !== 0) {
    const diff1 = fastVal - midVal
    const diff2 = midVal - slowVal
    // 同向性：两者乘积为正表示一致
    const consistency = diff1 * diff2 > 0 ? 1 : 0
    // 偏离度一致性：三层偏离程度相近表示趋势稳定
    const deviation1 = Math.abs(diff1)
    const deviation2 = Math.abs(diff2)
    const avgDev = (deviation1 + deviation2) / 2
    const devConsistency = avgDev > EPSILON ? 1 - Math.abs(deviation1 - deviation2) / avgDev : 0
    consistencyScore = (consistency + devConsistency) / 2
  }

  // 指标3：波动率趋势（当前波动 vs 历史平均）
  let volatilityScore = 0.5
  const currentVolty = state.voltyBuffer.getAverage()
  const historicalVolty = state.historicalVolty.getAverage()
  if (historicalVolty > EPSILON) {
    // 波动率下降通常伴随趋势形成
    const voltyRatio = currentVolty / historicalVolty
    volatilityScore = clamp(1.2 - voltyRatio, 0, 1)
  }

  // 综合评分（加权平均）
  const trendStrength = momentumScore * 0.45 + consistencyScore * 0.35 + volatilityScore * 0.2
  return clamp(trendStrength, 0, 1)
}

/**
 * 计算动态阻尼系数 - 基于趋势强度自适应
 * @param {number} trendStrength 0~1，趋势强度
 * @param {number} baseDamp 基础阻尼
 * @param {number} absDelta 当前变化绝对值
 * @param {number} threshold 阈值
 * @returns {number} 最终阻尼系数
 */
const calculateDynamicDamp = (trendStrength, baseDamp, absDelta, threshold) => {
  // 趋势越强，阻尼下限越高（减少滞后）
  // 震荡时，保持低阻尼（高平滑）
  const trendMinDamp = 0.1 + trendStrength * 0.35 // 0.10 ~ 0.45
  const trendMaxDamp = 0.5 + trendStrength * 0.35 // 0.50 ~ 0.85

  // 根据变化量计算基础阻尼
  let damp
  if (absDelta < threshold * 0.2) damp = 0.08
  else if (absDelta < threshold * 0.4) damp = 0.15
  else if (absDelta < threshold * 0.75) damp = 0.28
  else if (absDelta < threshold * 1.2) damp = 0.48
  else damp = 0.72

  // 应用趋势调整
  damp = clamp(damp, trendMinDamp, trendMaxDamp)

  return damp
}

/**
 * 智能JMA计算 - 单步
 */
const computeJMA = (state, price) => {
  if (!isValidNumber(price)) return { jma: state.init ? state.ma[8] : 0, state }

  if (!state.init) {
    state.price = price
    state.ma = new Array(10).fill(price)
    state.prevJMA = price
    state.prevDelta = 0
    state.voltyBuffer.reset()
    state.historicalVolty.reset()
    state.priceBuffer.reset()
    state.priceBuffer.push(price)
    state.warmupCount = 0
    state.prevTrendStrength = 0.5
    state.init = true
    return { jma: price, state }
  }

  // 更新价格历史缓冲区（用于趋势识别）
  state.priceBuffer.push(price)

  const absChange = Math.abs(price - state.price)
  state.price = price

  // 更新波动率缓冲区
  state.voltyBuffer.push(absChange)

  // 历史波动率更新（每5个点采样一次，避免过度敏感）
  state.historicalSampleCount = (state.historicalSampleCount || 0) + 1
  if (state.historicalSampleCount >= 5) {
    state.historicalVolty.push(state.voltyBuffer.getAverage())
    state.historicalSampleCount = 0
  }

  const avgVolty = state.voltyBuffer.getAverage()

  // 自适应因子
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const adaptiveFactor = clamp(
    state.power * (1 + Math.log(clamp(voltyRatio, 0.1, 10) + 1) * 0.6),
    0.65,
    2.0,
  )

  const effectiveLen = Math.max(5, state.length * adaptiveFactor)
  const alpha = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const phaseCoeff = clamp(1.0 + state.phase / 100, 0.8, 1.5)

  // 10级级联滤波
  const ma = state.ma
  const newMa = new Array(10)

  newMa[0] = (1 - alpha) * ma[0] + alpha * price
  newMa[1] = (1 - alpha) * ma[1] + alpha * newMa[0]
  const del1 = newMa[0] - newMa[1]
  newMa[2] = (1 - alpha) * ma[2] + alpha * (newMa[0] + del1 * phaseCoeff)
  newMa[3] = (1 - alpha) * ma[3] + alpha * newMa[2]
  const del2 = newMa[2] - newMa[3]
  newMa[4] = (1 - alpha) * ma[4] + alpha * (newMa[2] + del2 * phaseCoeff)
  newMa[5] = (1 - alpha) * ma[5] + alpha * newMa[4]
  const del3 = newMa[4] - newMa[5]
  newMa[6] = (1 - alpha) * ma[6] + alpha * (newMa[4] + del3 * phaseCoeff)
  newMa[7] = (1 - alpha) * ma[7] + alpha * newMa[6]
  const del4 = newMa[6] - newMa[7]
  newMa[8] = (1 - alpha) * ma[8] + alpha * (newMa[6] + del4 * phaseCoeff)
  newMa[9] = (1 - alpha) * ma[9] + alpha * newMa[8]

  state.ma = newMa

  // 预热期
  let finalJMA = newMa[9]
  if (++state.warmupCount < state.warmupNeeded) {
    const f = Math.pow(state.warmupCount / state.warmupNeeded, 2.2)
    finalJMA = price * (1 - f) + finalJMA * f
  }

  // 计算趋势强度（仅基于历史数据）
  const trendStrength = calculateTrendStrength(state, price, newMa[3], newMa[5], newMa[8])

  // 平滑过渡趋势强度（避免突变）
  const smoothedTrendStrength = state.prevTrendStrength * 0.3 + trendStrength * 0.7
  state.prevTrendStrength = smoothedTrendStrength

  // 智能阻尼计算
  const delta = finalJMA - state.prevJMA
  const prevDelta = state.prevDelta
  const acceleration = Math.abs(delta - prevDelta)

  const threshold = avgVolty * 1.0
  const absDelta = Math.abs(delta)

  // 基于趋势强度计算动态阻尼
  let damp = calculateDynamicDamp(smoothedTrendStrength, 0.25, absDelta, threshold)

  // 高加速度时加强平滑（但趋势强时减少加强幅度）
  if (acceleration > threshold * 0.35) {
    const accelFactor = clamp(1 - smoothedTrendStrength * 0.5, 0.5, 1)
    damp *= 0.65 * accelFactor
  }

  damp = clamp(damp, 0.08 + smoothedTrendStrength * 0.32, 0.85)

  finalJMA = state.prevJMA + delta * damp
  state.prevJMA = finalJMA
  state.prevDelta = delta

  return { jma: finalJMA, trendStrength: smoothedTrendStrength, state }
}

/**
 * 条件后处理 - 只在震荡模式下启用
 */
const conditionalPostSmooth = (data, trendStrengths) => {
  const len = data.length
  if (len < 5) return data.slice()

  const result = data.slice()

  // 计算平均趋势强度
  const avgTrendStrength = trendStrengths.reduce((a, b) => a + b, 0) / trendStrengths.length

  // 强趋势时：跳过后处理（保持时效性）
  if (avgTrendStrength > 0.65) {
    return result
  }

  // 震荡时：轻度毛刺消除
  for (let i = 2; i < len; i++) {
    const localTrendStrength = trendStrengths[i] || 0.5

    // 局部趋势强时不处理
    if (localTrendStrength > 0.6) continue

    const change1 = result[i - 1] - result[i - 2]
    const change2 = result[i] - result[i - 1]

    // 方向反转且幅度增大时进行平滑
    if (Math.sign(change1) !== Math.sign(change2) && Math.abs(change2) > Math.abs(change1) * 1.15) {
      const avg = result[i - 1] * 0.55 + result[i - 2] * 0.45
      result[i] = result[i] * 0.55 + avg * 0.45
    }
  }

  return result
}

/**
 * 主函数 - 智能模式切换JMA
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length
  const state = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 35),
    price: 0,
    ma: new Array(10).fill(0),
    prevJMA: 0,
    prevDelta: 0,
    prevTrendStrength: 0.5,
    voltyBuffer: createCircularBuffer(period),
    historicalVolty: createCircularBuffer(Math.max(20, period * 2)),
    historicalSampleCount: 0,
    priceBuffer: createCircularBuffer(15), // 15个历史价格用于趋势识别
    length: period,
    phase,
    power: power * 1.05,
  }

  const results = new Array(len)
  const trendStrengths = new Array(len)

  for (let i = 0; i < len; i++) {
    if (isValidNumber(prices[i])) {
      const result = computeJMA(state, prices[i])
      results[i] = result.jma
      trendStrengths[i] = result.trendStrength || 0.5
    } else {
      results[i] = i > 0 ? results[i - 1] : 0
      trendStrengths[i] = i > 0 ? trendStrengths[i - 1] : 0.5
    }
  }

  // 条件后处理（基于历史趋势强度决定是否启用）
  return conditionalPostSmooth(results, trendStrengths)
}

// 导出
if (typeof module !== 'undefined' && module.exports) module.exports = calculateJMA
else if (typeof window !== 'undefined') window.calculateJMA = calculateJMA

export { calculateJMA }
export default calculateJMA
