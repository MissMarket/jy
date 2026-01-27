/**
 * Jurik移动平均线（JMA）函数式实现
 * 基于Mark Jurik的研究和社区开源实现
 */

/**
 * 创建初始状态
 * @param {number} length - 周期长度
 * @param {number} phase - 相位参数
 * @param {number} power - 功率/自适应因子
 * @returns {Object} 初始状态对象
 */
const createInitialState = (length, phase, power) => ({
  init: false,
  price: 0,
  volty: 0,
  vsum: 0,
  ma1: 0,
  ma2: 0,
  ma3: 0,
  ma4: 0,
  ma5: 0,
  ma6: 0,
  ma7: 0,
  ma8: 0,
  ma9: 0,
  length: Math.max(2, length),
  phase: Math.max(-100, Math.min(100, phase)),
  power: Math.max(1, Math.min(10, power)),
})

/**
 * 初始化状态
 * @param {Object} state - 当前状态
 * @param {number} initialPrice - 初始价格
 * @returns {Object} 初始化后的状态
 */
const initializeState = (state, initialPrice) => ({
  ...state,
  price: initialPrice,
  ma1: initialPrice,
  ma2: initialPrice,
  ma3: initialPrice,
  ma4: initialPrice,
  ma5: initialPrice,
  ma6: initialPrice,
  ma7: initialPrice,
  ma8: initialPrice,
  ma9: initialPrice,
  vsum: 0,
  volty: 0,
  init: true,
})

/**
 * 计算单个JMA值
 * @param {Object} state - 当前状态
 * @param {number} price - 当前价格
 * @returns {Object} 包含新JMA值和更新后状态的对象
 */
const computeJMA = (state, price) => {
  if (!state.init) {
    const initializedState = initializeState(state, price)
    return {
      jma: price,
      state: initializedState,
    }
  }

  // 基础参数
  const { length, phase, power } = state
  const phaseRatio = phase / 100.0

  // 更新价格状态
  const prevPrice = state.price

  // 计算波动性和累积波动
  const priceChange = Math.abs(price - prevPrice)
  const volty = priceChange
  const vsum = state.vsum + volty

  // 计算自适应因子
  const avgVolty = vsum / length
  const voltyRatio = avgVolty > 0 ? volty / avgVolty : 1

  // 自适应指数 - 核心机制
  const adaptivePower = power * voltyRatio
  const adaptiveFactor = Math.pow(adaptivePower, 2)
  const clampedFactor = Math.max(0.5, Math.min(2.0, adaptiveFactor))

  // 计算滤波系数
  const effectiveLen = length * clampedFactor
  const phaseRatio2 = phaseRatio + 1.0
  const beta = (0.45 * (effectiveLen - 1)) / (0.45 * (effectiveLen - 1) + 2)
  const alpha = beta

  // Jurik级联滤波（标准实现）
  // EMA1
  const ma1 = (1 - alpha) * state.ma1 + alpha * price

  // EMA2
  const ma2 = (1 - alpha) * state.ma2 + alpha * ma1

  // EMA3 - 带相位补偿
  const ma1Diff = ma1 - ma2
  const ma3 = (1 - alpha) * state.ma3 + alpha * (ma1 + ma1Diff * phaseRatio2)

  // EMA4
  const ma4 = (1 - alpha) * state.ma4 + alpha * ma3

  // EMA5 - 带相位补偿
  const ma3Diff = ma3 - ma4
  const ma5 = (1 - alpha) * state.ma5 + alpha * (ma3 + ma3Diff * phaseRatio2)

  // EMA6
  const ma6 = (1 - alpha) * state.ma6 + alpha * ma5

  // EMA7 - 带相位补偿
  const ma5Diff = ma5 - ma6
  const ma7 = (1 - alpha) * state.ma7 + alpha * (ma5 + ma5Diff * phaseRatio2)

  // EMA8
  const ma8 = (1 - alpha) * state.ma8 + alpha * ma7

  // EMA9 - 带相位补偿
  const ma7Diff = ma7 - ma8
  const ma9 = (1 - alpha) * state.ma9 + alpha * (ma7 + ma7Diff * phaseRatio2)

  // 最终输出 - Jurik的关键：多级滤波后提取信号
  const finalJMA = ma9

  const newState = {
    ...state,
    price,
    volty,
    vsum,
    ma1,
    ma2,
    ma3,
    ma4,
    ma5,
    ma6,
    ma7,
    ma8,
    ma9,
  }

  return {
    jma: finalJMA,
    state: newState,
  }
}

/**
 * 批量计算JMA
 * @param {Object} state - 初始状态
 * @param {Array} prices - 价格数组
 * @returns {Object} 包含JMA值数组和最终状态的对象
 */
const calculateBatchJMA = (state, prices) => {
  const results = []
  let currentState = state

  for (const price of prices) {
    const { jma } = computeJMA(currentState, price)
    results.push(jma)
    currentState = computeJMA(currentState, price).state
  }

  return {
    jmaValues: results,
    finalState: currentState,
  }
}

/**
 * 计算JMA主函数
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期（默认10）
 * @param {number} phase - 相位（默认0）
 * @param {number} power - 功率（默认1）
 * @returns {Array} JMA值数组
 */
const calculateJMA = (prices, period = 10, phase = 0, power = 1) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return []
  }

  const initialState = createInitialState(period, phase, power)
  const { jmaValues } = calculateBatchJMA(initialState, prices)

  return jmaValues
}

// 导出模块
export default calculateJMA
