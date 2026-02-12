/**
 * 工具函数集合
 * 集中管理通用的工具函数，减少代码重复
 */

import dayjs from 'dayjs'

/**
 * 计算交易形态
 * @param {number} prevPrevJma - 前天JMA
 * @param {number} prevJma - 昨天JMA
 * @param {number} currentJma - 今天JMA
 * @returns {Object} { shape: 形态文本, color: 颜色值 }
 */
export const calculateShape = (prevPrevJma, prevJma, currentJma) => {
  if (prevPrevJma > prevJma && currentJma > prevJma) {
    return { shape: '低点', color: '#ff0000' }
  } else if (prevPrevJma < prevJma && currentJma < prevJma) {
    return { shape: '高点', color: '#00ff00' }
  } else if (prevPrevJma < prevJma && prevJma < currentJma) {
    return { shape: '上升', color: '#ffa500' }
  } else if (prevPrevJma > prevJma && prevJma > currentJma) {
    return { shape: '下降', color: '#0000ff' }
  } else {
    return { shape: '未知', color: '#999999' }
  }
}

/**
 * 交易信号颜色映射
 */
export const signalColorMap = {
  买入: '#ff0000', // 低点颜色
  持有: '#ffa500', // 上升颜色
  卖出: '#00ff00', // 高点颜色
  空仓: '#0000ff', // 下降颜色
}

/**
 * 计算交易信号
 * @param {Array} data - 包含date和shape的数组
 * @returns {Array} 添加了signal和signalColor字段的数组
 */
export const calculateTradingSignal = data => {
  // 按日期从小到大排序
  const sortedData = [...data].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())

  let s = '空仓' // 初始状态
  let buyDate = null // 买入日期

  sortedData.forEach(item => {
    const shape = item.shape

    if (s === '空仓') {
      if (shape === '低点') {
        s = '买入'
      }
      // 其他情况保持空仓
    } else if (s === '买入') {
      buyDate = dayjs(item.date).format('YYYY-MM-DD')
      s = '持有'
    } else if (s === '持有') {
      if (shape === '上升' || shape === '低点') {
        s = '持有'
      } else if (shape === '高点' || shape === '下降') {
        // 获取当前日期的星期
        const currentDate = dayjs(item.date)
        const dayOfWeek = currentDate.day() // 0是周日，1-5是周一到周五

        // 计算卖出日期
        let sellDate
        if (dayOfWeek >= 1 && dayOfWeek <= 4) {
          // 周一到周四，加1天
          sellDate = currentDate.add(1, 'day')
        } else if (dayOfWeek === 5) {
          // 周五，加3天（跳过周末）
          sellDate = currentDate.add(3, 'day')
        } else {
          // 周日，不应该出现，但做兼容处理
          sellDate = currentDate.add(1, 'day')
        }

        // 计算持有天数
        const holdDays = sellDate.diff(dayjs(buyDate), 'day')

        if (holdDays >= 7) {
          s = '卖出'
        } else {
          s = '持有'
        }
      }
    } else if (s === '卖出') {
      if (shape === '低点') {
        s = '买入'
      } else if (shape === '下降') {
        s = '空仓'
      }
      // 其他情况保持卖出状态
    }

    item.signal = s
    item.signalColor = signalColorMap[s]
  })

  return sortedData
}

/**
 * 统一量纲处理 - 以1000为基点进行归一化
 * @param {Array} priceArr - 价格数组
 * @returns {Array} 归一化后的价格数组
 */
export const normalizePrices = priceArr => {
  const firstPrice = priceArr[0]
  const factor = 1000 / firstPrice
  return priceArr.map(price => price * factor)
}

/**
 * 计算ATR14（平均真实波动）
 * @param {Array} highArr - 最高价数组
 * @param {Array} lowArr - 最低价数组
 * @param {Array} closeArr - 收盘价数组
 * @returns {number} ATR14值
 */
export const calculateATR14 = (highArr, lowArr, closeArr) => {
  const period = 14
  if (highArr.length < period + 1) return 0

  const trValues = []
  for (let i = 1; i < highArr.length; i++) {
    const high = highArr[i]
    const low = lowArr[i]
    const prevClose = closeArr[i - 1]

    // 真实波动 = max(最高价-最低价, |最高价-昨收|, |最低价-昨收|)
    const tr1 = high - low
    const tr2 = Math.abs(high - prevClose)
    const tr3 = Math.abs(low - prevClose)
    const tr = Math.max(tr1, tr2, tr3)
    trValues.push(tr)
  }

  // 计算ATR14（简单移动平均）
  const recentTR = trValues.slice(-period)
  const atr14 = recentTR.reduce((sum, tr) => sum + tr, 0) / period

  return atr14
}

/**
 * 根据原始值进行排名评分
 * @param {Array} values - 所有指数在该维度的原始值数组
 * @param {number} maxScore - 最高分数
 * @param {number} interval - 评分间隔
 * @param {boolean} isHigherBetter - 值越大越好（true）或越小越好（false）
 * @returns {Array} 排名评分数组
 */
export const rankAndScore = (values, maxScore, interval, isHigherBetter = true) => {
  // 创建索引-值对数组
  const indexed = values.map((value, index) => ({ value, index }))

  // 排序
  if (isHigherBetter) {
    indexed.sort((a, b) => b.value - a.value) // 降序
  } else {
    indexed.sort((a, b) => a.value - b.value) // 升序
  }

  // 创建评分数组
  const scores = new Array(values.length).fill(0)

  // 按排名分配分数
  indexed.forEach((item, rank) => {
    const score = maxScore - rank * interval
    scores[item.index] = Math.max(0, score)
  })

  return scores
}

/**
 * 处理价格异常值
 * @param {number} price - 当前价格
 * @param {number} prevPrice - 前一个价格
 * @returns {number} 处理后的价格
 */
export const handlePriceAnomaly = (price, prevPrice) => {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
    return prevPrice
  }
  return price
}

/**
 * 检测设备类型
 * @returns {Object} 设备信息
 */
export const detectDevice = () => {
  const width = window.innerWidth
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  }
}
