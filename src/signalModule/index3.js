/**
 * Jurik移动平均线 JMA 终极增强版
 * 超低滞后 + 无毛刺 + 稳定不跳 + 比官方更实战
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
    reset: () => {
      buffer.fill(0)
      index = 0
      count = 0
      sum = 0
    },
  }
}

// 终极拐点抑制：彻底消灭相邻高低点
const inflectionSuppression = (current, prev, threshold) => {
  const delta = current - prev
  const absDelta = Math.abs(delta)

  if (absDelta < threshold * 0.5) {
    return prev
  }
  if (absDelta < threshold) {
    return prev + delta * 0.15
  }
  return prev + delta * 0.85
}

// 终极轻平滑：不滞后、只去毛刺
const ultraSmooth = (current, prev) => {
  return prev + (current - prev) * 0.7
}

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
    prevFinal: 0, // 终极平滑专用
    length: safeLength,
    phase: safePhase,
    power: safePower,
  }
}

const initializeState = (state, initialPrice) => {
  state.price = initialPrice
  state.prevPrice = initialPrice
  state.ma1 =
    state.ma2 =
    state.ma3 =
    state.ma4 =
    state.ma5 =
    state.ma6 =
    state.ma7 =
    state.ma8 =
    state.ma9 =
      initialPrice
  state.prevJMA = initialPrice
  state.prevFinal = initialPrice
  state.del1 = state.del2 = state.avgDel = 0
  state.voltyBuffer.reset()
  state.warmupCount = 0
  state.init = true
  return state
}

const computeJMA = (state, price) => {
  if (!isValidNumber(price)) {
    return { jma: state.init ? state.prevFinal : 0, state }
  }

  if (!state.init) {
    initializeState(state, price)
    return { jma: price, state }
  }

  const { length, phase, power } = state
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
  const adaptivePower = power * (1 + logRatio * 0.5)
  const adaptiveFactor = clamp(adaptivePower, 0.8, 1.8)

  const effectiveLen = Math.max(4, length * adaptiveFactor)
  const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const alpha = beta

  const phaseRatio = phase / 100.0
  const phaseCoeff = clamp(1.0 + phaseRatio, 0.8, 1.5)

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
  let jmaRaw = ma9

  if (state.warmupCount < state.warmupNeeded) {
    const w = state.warmupCount / state.warmupNeeded
    const f = w ** 3
    jmaRaw = price * (1 - f) + ma9 * f
  }

  // 一级：毛刺过滤
  const threshold = avgVolty * 1.5
  const jmaSuppressed = inflectionSuppression(jmaRaw, state.prevJMA, threshold)
  state.prevJMA = jmaSuppressed

  // 二级：终极轻平滑 → 干掉相邻高低点
  const jmaFinal = ultraSmooth(jmaSuppressed, state.prevFinal)
  state.prevFinal = jmaFinal

  return { jma: jmaFinal, state }
}

const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []
  const valid = prices.filter(isValidNumber)
  if (valid.length === 0) return []

  const state = createInitialState(period, phase, power)
  const res = new Array(prices.length)

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i]
    if (isValidNumber(p)) {
      const r = computeJMA(state, p)
      res[i] = r.jma
    } else {
      res[i] = i > 0 ? res[i - 1] : 0
    }
  }
  return res
}

export default calculateJMA
