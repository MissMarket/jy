/**
 * 量化交易策略回测工具函数
 * 实现信号驱动策略和持有策略的回测计算
 */

/**
 * 策略一：信号驱动策略回测
 * - 当交易信号为"买入"时，在下一交易日以当日收盘价执行买入操作
 * - 当交易信号为"卖出"时，在下一交易日以当日收盘价执行卖出操作
 * @param {Array} data - 包含date, price, signal的数组（按日期从旧到新排序）
 * @param {number} initialCapital - 初始资金，默认1,000,000元
 * @returns {Object} 回测结果
 */
export const backtestSignalStrategy = (data, initialCapital = 1000000) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { results: [], finalAsset: initialCapital }
  }

  // 按日期从旧到新排序
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date))

  const results = []
  let cash = initialCapital
  let position = 0 // 持仓数量
  let isHolding = false
  let pendingAction = null // 待执行的操作（由前一日信号决定）

  sortedData.forEach((item, index) => {
    const currentPrice = item.price
    const signal = item.signal
    let action = '无'
    let asset = cash

    // 执行前一日信号决定的待操作（T+1：前一日信号，当日执行）
    if (pendingAction === '买入' && !isHolding) {
      position = Math.floor(cash / currentPrice)
      cash = cash - position * currentPrice
      isHolding = true
      action = '买入'
    } else if (pendingAction === '卖出' && isHolding) {
      cash = cash + position * currentPrice
      position = 0
      isHolding = false
      action = '卖出'
    }

    // 清空待操作
    pendingAction = null

    // 如果有持仓，计算当前总资产
    if (isHolding && position > 0) {
      asset = cash + position * currentPrice
    }

    // 根据当日信号决定下一交易日的操作
    // 最后一个交易日不生成新的待操作（因为没有下一日）
    if (index < sortedData.length - 1) {
      if (signal === '买入' && !isHolding) {
        pendingAction = '买入'
      } else if (signal === '卖出' && isHolding) {
        pendingAction = '卖出'
      }
    }

    results.push({
      date: item.date,
      price: currentPrice,
      signal: signal,
      action: action,
      cash: cash,
      position: position,
      asset: asset,
      strategy: '信号驱动策略',
    })
  })

  // 最后一个交易日的最终资产
  const lastItem = sortedData[sortedData.length - 1]
  const finalAsset = isHolding ? cash + position * lastItem.price : cash

  return {
    results,
    finalAsset: parseFloat(finalAsset.toFixed(2)),
    initialCapital,
    totalReturn: parseFloat((((finalAsset - initialCapital) / initialCapital) * 100).toFixed(2)),
  }
}

/**
 * 策略二：持有策略回测
 * - 在第一个交易日以当日收盘价执行买入操作
 * - 持有至最后一个交易日，以当日收盘价执行卖出操作
 * @param {Array} data - 包含date, price的数组（按日期从旧到新排序）
 * @param {number} initialCapital - 初始资金，默认1,000,000元
 * @returns {Object} 回测结果
 */
export const backtestHoldStrategy = (data, initialCapital = 1000000) => {
  if (!Array.isArray(data) || data.length === 0) {
    return { results: [], finalAsset: initialCapital }
  }

  // 按日期从旧到新排序
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date))

  const results = []
  let cash = initialCapital
  let position = 0
  let isHolding = false

  sortedData.forEach((item, index) => {
    const currentPrice = item.price
    let action = '无'
    let asset = cash

    // 第一个交易日买入
    if (index === 0) {
      action = '买入'
      position = Math.floor(cash / currentPrice)
      cash = cash - position * currentPrice
      isHolding = true
    }

    // 计算当前资产
    if (isHolding && position > 0) {
      asset = cash + position * currentPrice
    }

    // 最后一个交易日卖出
    if (index === sortedData.length - 1 && isHolding) {
      action = '卖出'
      cash = cash + position * currentPrice
      asset = cash
      position = 0
      isHolding = false
    }

    results.push({
      date: item.date,
      price: currentPrice,
      signal: item.signal || '-',
      action: action,
      cash: cash,
      position: position,
      asset: asset,
      strategy: '持有策略',
    })
  })

  const finalAsset = results[results.length - 1]?.asset || initialCapital

  return {
    results,
    finalAsset: parseFloat(finalAsset.toFixed(2)),
    initialCapital,
    totalReturn: parseFloat((((finalAsset - initialCapital) / initialCapital) * 100).toFixed(2)),
  }
}

/**
 * 合并两个策略的回测结果用于表格展示
 * @param {Array} signalResults - 信号驱动策略结果
 * @param {Array} holdResults - 持有策略结果
 * @returns {Array} 合并后的结果数组
 */
export const mergeBacktestResults = (signalResults, holdResults) => {
  const merged = []
  const maxLength = Math.max(signalResults.length, holdResults.length)

  for (let i = 0; i < maxLength; i++) {
    const signalItem = signalResults[i] || {}
    const holdItem = holdResults[i] || {}

    merged.push({
      date: signalItem.date || holdItem.date,
      price: signalItem.price || holdItem.price,
      signal: signalItem.signal || '-',
      signalStrategyAsset: signalItem.asset || 0,
      holdStrategyAsset: holdItem.asset || 0,
      signalAction: signalItem.action || '-',
      holdAction: holdItem.action || '-',
    })
  }

  return merged
}
