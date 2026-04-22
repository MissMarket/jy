/**
 * JMA 平衡平滑版 - 平滑度介于"第二完美"和"极致平滑"之间
 * 特性：
 * 1. 固定12级级联（中间值）
 * 2. 中等阻尼 0.12 ~ 0.75
 * 3. 轻度实时后处理（无未来函数）
 * 4. 简化的趋势识别
 * 核心约束：仅基于历史数据，已绘制值不因未来数据而改变
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
 * 简化的趋势识别 - 基于动量方向一致性
 */
const calculateSimpleTrendStrength = (state, _price) => {
  const priceBuffer = state.priceBuffer.getBuffer().filter(v => v !== 0)

  if (priceBuffer.length < 5) return 0.5

  // 计算近期变化方向一致性
  const changes = []
  for (let i = 1; i < priceBuffer.length; i++) {
    changes.push(priceBuffer[i] - priceBuffer[i - 1])
  }

  let consistentCount = 0
  for (let i = 1; i < changes.length; i++) {
    if (changes[i] * changes[i - 1] > 0) {
      consistentCount++
    }
  }

  // 一致性比率越高，趋势越强
  const consistencyRatio = changes.length > 1 ? consistentCount / (changes.length - 1) : 0.5

  // 净变化占比
  const first = priceBuffer[0]
  const last = priceBuffer[priceBuffer.length - 1]
  const netChange = Math.abs(last - first)
  let totalVol = 0
  for (let i = 1; i < priceBuffer.length; i++) {
    totalVol += Math.abs(priceBuffer[i] - priceBuffer[i - 1])
  }
  const momentumRatio = totalVol > EPSILON ? netChange / totalVol : 0.5

  // 综合评分
  return clamp(consistencyRatio * 0.4 + momentumRatio * 0.6, 0, 1)
}

/**
 * 12级级联JMA计算
 */
const computeJMA = (state, price) => {
  if (!isValidNumber(price)) return { jma: state.init ? state.ma[11] : 0, state }

  if (!state.init) {
    state.price = price
    state.ma = new Array(12).fill(price)
    state.prevJMA = price
    state.prevDelta = 0
    state.voltyBuffer.reset()
    state.priceBuffer.reset()
    state.priceBuffer.push(price)
    state.warmupCount = 0
    state.init = true
    return { jma: price, state }
  }

  state.priceBuffer.push(price)
  const absChange = Math.abs(price - state.price)
  state.price = price
  state.voltyBuffer.push(absChange)

  const avgVolty = state.voltyBuffer.getAverage()

  // 中等自适应
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const adaptiveFactor = clamp(
    state.power * (1 + Math.log(clamp(voltyRatio, 0.1, 10) + 1) * 0.6),
    0.65,
    1.9,
  )

  const effectiveLen = Math.max(5, state.length * adaptiveFactor)
  const alpha = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const phaseCoeff = clamp(1.0 + state.phase / 100, 0.8, 1.5)

  // 12级级联（介于10和14之间）
  const ma = state.ma
  const newMa = new Array(12)

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
  const del5 = newMa[8] - newMa[9]
  newMa[10] = (1 - alpha) * ma[10] + alpha * (newMa[8] + del5 * phaseCoeff)
  newMa[11] = (1 - alpha) * ma[11] + alpha * newMa[10]

  state.ma = newMa

  // 预热期
  let finalJMA = newMa[11]
  if (++state.warmupCount < state.warmupNeeded) {
    const f = Math.pow(state.warmupCount / state.warmupNeeded, 2.3)
    finalJMA = price * (1 - f) + finalJMA * f
  }

  // 中等阻尼（介于第二完美和极致平滑之间）
  const delta = finalJMA - state.prevJMA
  const acceleration = Math.abs(delta - state.prevDelta)

  const threshold = avgVolty * 0.92
  const absDelta = Math.abs(delta)

  // 简化的趋势识别
  const trendStrength = calculateSimpleTrendStrength(state, price)

  // 中等阻尼曲线
  let damp
  if (absDelta < threshold * 0.2) damp = 0.12
  else if (absDelta < threshold * 0.42) damp = 0.22
  else if (absDelta < threshold * 0.85) damp = 0.36
  else if (absDelta < threshold * 1.3) damp = 0.55
  else damp = 0.72

  // 高加速度时加强平滑（趋势强时减少加强）
  if (acceleration > threshold * 0.32) {
    const accelFactor = clamp(1 - trendStrength * 0.4, 0.6, 1)
    damp *= 0.72 * accelFactor
  }

  // 阻尼范围：0.12 ~ 0.75（中间值）
  damp = clamp(damp, 0.12 + trendStrength * 0.18, 0.75)

  finalJMA = state.prevJMA + delta * damp

  // 更新状态
  state.prevJMA = finalJMA
  state.prevDelta = delta

  return { jma: finalJMA, trendStrength, state }
}

/**
 * 轻度实时因果平滑 - 仅历史数据
 */
const applyLightCausalSmooth = (rawValue, history) => {
  if (history.length < 2) return rawValue

  // 使用最近2个历史值进行轻度加权
  const prev1 = history[history.length - 1]
  const prev2 = history.length > 1 ? history[history.length - 2] : prev1

  // 当前70%，历史30%
  return rawValue * 0.7 + prev1 * 0.2 + prev2 * 0.1
}

/**
 * 主函数 - 平衡平滑
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length
  const state = {
    init: false,
    warmupCount: 0,
    warmupNeeded: Math.min(period * 2, 36),
    price: 0,
    ma: new Array(12).fill(0),
    prevJMA: 0,
    prevDelta: 0,
    voltyBuffer: createCircularBuffer(period),
    priceBuffer: createCircularBuffer(12),
    length: period,
    phase,
    power: power * 1.02,
  }

  const results = new Array(len)
  const smoothHistory = []

  for (let i = 0; i < len; i++) {
    let jmaValue

    if (isValidNumber(prices[i])) {
      const result = computeJMA(state, prices[i])
      const rawJMA = result.jma

      // 轻度实时平滑
      jmaValue = applyLightCausalSmooth(rawJMA, smoothHistory)

      smoothHistory.push(jmaValue)
      if (smoothHistory.length > 4) smoothHistory.shift()
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
