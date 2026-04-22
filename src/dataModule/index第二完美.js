/**
 * JMA 强平滑版 - 高低点70个以内
 * 加强平滑力度，控制抖动
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
    reset: () => {
      buffer.fill(0)
      index = count = sum = 0
    },
  }
}

/**
 * 强平滑JMA - 9级级联 + 强阻尼
 */
const computeJMA = (state, price) => {
  if (!isValidNumber(price)) return { jma: state.init ? state.ma[8] : 0, state }

  if (!state.init) {
    state.price = price
    state.ma = new Array(10).fill(price)
    state.prevJMA = price
    state.prevDelta = 0
    state.voltyBuffer.reset()
    state.warmupCount = 0
    state.init = true
    return { jma: price, state }
  }

  const absChange = Math.abs(price - state.price)
  state.price = price
  state.voltyBuffer.push(absChange)
  const avgVolty = state.voltyBuffer.getAverage()

  // 强自适应 - 高波动时极大平滑
  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1
  const adaptiveFactor = clamp(
    state.power * (1 + Math.log(clamp(voltyRatio, 0.1, 10) + 1) * 0.7),
    0.6,
    2.2,
  )

  const effectiveLen = Math.max(5, state.length * adaptiveFactor)
  const alpha = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const phaseCoeff = clamp(1.0 + state.phase / 100, 0.8, 1.5)

  // 10级级联
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
    const f = Math.pow(state.warmupCount / state.warmupNeeded, 2.5)
    finalJMA = price * (1 - f) + finalJMA * f
  }

  // 强阻尼 - 减少高低点
  const delta = finalJMA - state.prevJMA
  const prevDelta = state.prevDelta
  const acceleration = Math.abs(delta - prevDelta)

  const threshold = avgVolty * 0.98 // 微调：更低阈值
  const absDelta = Math.abs(delta)

  // 微调阻尼曲线
  let damp
  if (absDelta < threshold * 0.22) damp = 0.08
  else if (absDelta < threshold * 0.45) damp = 0.16
  else if (absDelta < threshold) damp = 0.3
  else if (absDelta < threshold * 1.4) damp = 0.52
  else damp = 0.75

  // 高加速度时加强平滑
  if (acceleration > threshold * 0.3) {
    damp *= 0.68
  }

  damp = clamp(damp, 0.06, 0.78)

  finalJMA = state.prevJMA + delta * damp
  state.prevJMA = finalJMA
  state.prevDelta = delta

  return { jma: finalJMA, state }
}

/**
 * 后处理 - 消除密集抖动
 */
const postSmooth = data => {
  const len = data.length
  if (len < 4) return data.slice()

  const result = data.slice()

  // 第一轮：消除明显毛刺（微调）
  for (let i = 2; i < len; i++) {
    const change1 = result[i - 1] - result[i - 2]
    const change2 = result[i] - result[i - 1]
    if (Math.sign(change1) !== Math.sign(change2) && Math.abs(change2) > Math.abs(change1) * 1.1) {
      const avg = result[i - 1] * 0.5 + result[i - 2] * 0.5
      result[i] = result[i] * 0.5 + avg * 0.5
    }
  }

  // 第二轮：轻度整体平滑（微调）
  for (let i = 3; i < len; i++) {
    const avg = (result[i - 1] + result[i - 2] + result[i - 3]) / 3
    result[i] = result[i] * 0.68 + avg * 0.32
  }

  return result
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
    warmupNeeded: Math.min(period * 2, 40),
    price: 0,
    ma: new Array(10).fill(0),
    prevJMA: 0,
    prevDelta: 0,
    voltyBuffer: createCircularBuffer(period),
    length: period,
    phase,
    power: power * 1.1,
  }

  const results = new Array(len)
  for (let i = 0; i < len; i++) {
    results[i] = isValidNumber(prices[i])
      ? computeJMA(state, prices[i]).jma
      : i > 0
        ? results[i - 1]
        : 0
  }

  return postSmooth(results)
}

// 导出
if (typeof module !== 'undefined' && module.exports) module.exports = calculateJMA
else if (typeof window !== 'undefined') window.calculateJMA = calculateJMA

export { calculateJMA }
export default calculateJMA
