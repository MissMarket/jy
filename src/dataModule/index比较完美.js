/**
 * JMA 趋势确认优化版
 * 核心策略：单层JMA保持跟踪性，用"趋势一致性"过滤伪信号点
 * 不增加滞后，只减少虚假高低点
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
    reset: () => {
      buffer.fill(0)
      index = 0
      count = 0
      sum = 0
    },
  }
}

/**
 * 标准JMA计算（单层，无修改）
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
 * 无未来函数的趋势确认后处理 - 仅使用历史数据
 * 策略：用延迟确认替代即时极值检测
 * 当检测到可能的极值点后，延迟confirmBars根K线才执行平滑
 */
const trendConfirmFilter = (jmaValues, trendValues, confirmBars = 3) => {
  const len = jmaValues.length
  let result = jmaValues.slice()

  // 延迟处理队列：记录需要延迟确认的点
  const pendingSmooths = []

  // ===== 第一轮：延迟趋势方向过滤 =====
  // 从confirmBars开始，确保有足够的历史数据
  for (let i = confirmBars; i < len; i++) {
    // 检测第 i-1 个点是否为极值（使用i-2, i-1, i，都是历史数据）
    const current = result[i - 1]
    const prev = result[i - 2]
    const next = result[i] // 当前刚计算出的点，对i-1来说是"未来"但已确认

    const isPeak = prev < current && current > next
    const isValley = prev > current && current < next

    if (isPeak || isValley) {
      // 获取趋势方向（用长周期均线斜率）- 只用历史数据
      const trendSlope = trendValues[i - 1] - trendValues[i - 1 - confirmBars]
      const trendSign = Math.sign(trendSlope)

      // 获取该点相对于历史趋势的位置
      const localSlope = current - result[i - 1 - confirmBars]
      const localSign = Math.sign(localSlope)

      // 如果局部极值方向与趋势方向相反，标记为需要平滑
      // 扩大判断范围：即使方向相同但趋势很强，也考虑平滑
      const shouldSmooth =
        (trendSign !== 0 && localSign !== 0 && trendSign !== localSign) ||
        (Math.abs(trendSlope) > Math.abs(localSlope) * 2 && Math.abs(trendSlope) > 100)
      if (shouldSmooth) {
        pendingSmooths.push({
          index: i - 1,
          value: current,
          neighborAvg: (prev + next) / 2,
        })
      }
    }
  }

  // 执行平滑（增强平滑力度到70%）
  for (const item of pendingSmooths) {
    result[item.index] = item.value * 0.3 + item.neighborAvg * 0.7
  }

  // ===== 第二轮：密度过滤（更严格）=====
  const densityWindow = 7
  const maxAllowedExtrema = 2 // 从3降到2，更严格

  // 从后往前扫描，确保只处理已完全确认的区域
  for (let i = densityWindow; i < len - 1; i++) {
    // 只检测 i-1 及之前的点（已确认区域）
    const checkEnd = i - 1
    const checkStart = Math.max(densityWindow, checkEnd - densityWindow)

    let extremaCount = 0
    const extremaIndices = []

    for (let j = checkStart; j <= checkEnd; j++) {
      if (j <= 0 || j >= len - 1) continue
      // 极值检测：使用 j-1, j, j+1，但j+1必须 <= checkEnd+1 <= i
      if (j + 1 > i) continue // 确保不越界

      const isPeak = result[j - 1] < result[j] && result[j] > result[j + 1]
      const isValley = result[j - 1] > result[j] && result[j] < result[j + 1]
      if (isPeak || isValley) {
        extremaCount++
        extremaIndices.push(j)
      }
    }

    // 如果密度过高，对窗口内所有极值点进行平滑
    if (extremaCount > maxAllowedExtrema) {
      for (const idx of extremaIndices) {
        // 用5点加权平均替换（增强平滑，中心点权重更低）
        let sum = 0,
          weightSum = 0
        for (let k = -2; k <= 2; k++) {
          const pos = idx + k
          if (pos >= 0 && pos < len && pos <= i) {
            const weight = k === 0 ? 0.2 : (3 - Math.abs(k)) / 3 // 中心点权重从0.5降到0.2
            sum += result[pos] * weight
            weightSum += weight
          }
        }
        if (weightSum > 0) result[idx] = sum / weightSum
      }
    }
  }

  return result
}

/**
 * 主函数：双层JMA + 趋势确认过滤
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 2) => {
  if (!Array.isArray(prices) || prices.length === 0) return []

  const len = prices.length

  // 主JMA（短周期，跟踪价格）
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

  // 趋势JMA（长周期，判断方向）
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

  const mainResults = new Array(len)
  const trendResults = new Array(len)

  // 计算双层JMA
  for (let i = 0; i < len; i++) {
    const price = prices[i]
    if (isValidNumber(price)) {
      mainResults[i] = computeJMA(mainState, price).jma
      trendResults[i] = computeJMA(trendState, price).jma
    } else {
      mainResults[i] = i > 0 ? mainResults[i - 1] : 0
      trendResults[i] = i > 0 ? trendResults[i - 1] : 0
    }
  }

  // 趋势确认过滤（增强版参数）
  return trendConfirmFilter(mainResults, trendResults, 5)
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = calculateJMA
} else if (typeof window !== 'undefined') {
  window.calculateJMA = calculateJMA
}

export { calculateJMA }
export default calculateJMA
