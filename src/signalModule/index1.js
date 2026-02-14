/**
 * Jurik移动平均线（JMA）优化实现
 * 基于Mark Jurik的研究和社区最佳实践
 *
 * 优化要点：
 * 1. 使用滑动窗口计算波动性
 * 2. 改进自适应因子计算
 * 3. 添加预热期机制
 * 4. 性能优化
 * 5. 增强边界处理
 * 6. 改进相位补偿
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
  }
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
    length: safeLength,
    phase: safePhase,
    power: safePower,
  }
}

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
  state.del1 = 0
  state.del2 = 0
  state.avgDel = 0
  state.voltyBuffer.reset()
  state.warmupCount = 0
  state.init = true
  return state
}

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

  state.voltyBuffer.push(absChange)
  const avgVolty = state.voltyBuffer.getAverage()

  const voltyRatio = avgVolty > EPSILON ? absChange / avgVolty : 1

  const logRatio = voltyRatio > EPSILON ? Math.log(voltyRatio + 1) : 0
  const adaptivePower = power * (1 + logRatio * 0.5)
  const adaptiveFactor = clamp(adaptivePower, 0.5, 2.0)

  const effectiveLen = Math.max(2, length * adaptiveFactor)
  const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const alpha = beta

  const phaseRatio = phase / 100.0
  const phaseCoeff = clamp(1.0 + phaseRatio, 0.1, 2.0)

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

  let finalJMA = ma9
  if (state.warmupCount < state.warmupNeeded) {
    const warmupProgress = state.warmupCount / state.warmupNeeded
    const warmupFactor = Math.pow(warmupProgress, 2)
    finalJMA = price * (1 - warmupFactor) + ma9 * warmupFactor
  }

  return {
    jma: finalJMA,
    state: state,
  }
}

const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return []
  }

  const validPrices = prices.filter(isValidNumber)
  if (validPrices.length === 0) {
    return []
  }

  const state = createInitialState(period, phase, power)
  const results = new Array(prices.length)

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i]
    if (isValidNumber(price)) {
      const result = computeJMA(state, price)
      results[i] = result.jma
    } else {
      results[i] = state.init ? state.ma9 : results[i - 1] || 0
    }
  }

  return results
}

export default calculateJMA
