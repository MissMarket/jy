/**
 * 仓位分配模块
 * 基于风险评价和多策略信号分配仓位
 */

/**
 * 基于夏普比率分配策略权重
 * @param {Array} strategyResults - 策略回测结果数组
 * @param {string} metric - 评估指标（默认'sharpeRatio'）
 * @returns {Array} 策略权重数组
 */
export const allocateBySharpeRatio = (strategyResults, metric = 'sharpeRatio') => {
  const validResults = strategyResults.filter(r => !r.error && r.metrics && r.metrics[metric] !== undefined)
  
  if (validResults.length === 0) {
    return strategyResults.map(() => 0)
  }
  
  // 提取指标值并处理负值
  const values = validResults.map(r => Math.max(0, r.metrics[metric]))
  
  // 如果所有值都是0，则均等分配
  const total = values.reduce((sum, val) => sum + val, 0)
  
  if (total === 0) {
    const equalWeight = 1 / validResults.length
    const weightMap = {}
    validResults.forEach(r => {
      weightMap[r.strategyName] = equalWeight
    })
    return strategyResults.map(r => weightMap[r.strategyName] || 0)
  }
  
  // 根据指标值分配权重
  const weightMap = {}
  validResults.forEach((r, i) => {
    weightMap[r.strategyName] = values[i] / total
  })
  
  return strategyResults.map(r => weightMap[r.strategyName] || 0)
}

/**
 * 基于风险平价分配策略权重
 * @param {Array} strategyResults - 策略回测结果数组
 * @param {Array} correlationMatrix - 策略相关性矩阵
 * @returns {Array} 策略权重数组
 */
export const allocateByRiskParity = (strategyResults, correlationMatrix) => {
  const validResults = strategyResults.filter(r => !r.error && r.metrics)
  
  if (validResults.length === 0) {
    return strategyResults.map(() => 0)
  }
  
  // 提取波动率（用最大回撤的绝对值代替）
  const volatilities = validResults.map(r => Math.abs(r.metrics.maxDrawdown) || 0.01)
  
  // 如果没有相关性矩阵，使用简单的倒数分配
  if (!correlationMatrix || correlationMatrix.length === 0) {
    const invVol = volatilities.map(v => 1 / v)
    const total = invVol.reduce((sum, v) => sum + v, 0)
    
    const weightMap = {}
    validResults.forEach((r, i) => {
      weightMap[r.strategyName] = invVol[i] / total
    })
    
    return strategyResults.map(r => weightMap[r.strategyName] || 0)
  }
  
  // 使用风险平价公式：w = Σ^(-1) * 1 / (1^T * Σ^(-1) * 1)
  // 这里简化处理，使用波动率的倒数作为权重
  const invVol = volatilities.map(v => 1 / v)
  const total = invVol.reduce((sum, v) => sum + v, 0)
  
  const weightMap = {}
  validResults.forEach((r, i) => {
    weightMap[r.strategyName] = invVol[i] / total
  })
  
  return strategyResults.map(r => weightMap[r.strategyName] || 0)
}

/**
 * 考虑策略相关性的权重分配
 * @param {Array} strategyResults - 策略回测结果数组
 * @param {Array} correlationMatrix - 策略相关性矩阵
 * @param {number} maxCorrelation - 最大相关性阈值（默认0.8）
 * @returns {Array} 策略权重数组
 */
export const allocateWithCorrelationAdjustment = (strategyResults, correlationMatrix, maxCorrelation = 0.8) => {
  // 先基于夏普比率分配
  const sharpeWeights = allocateBySharpeRatio(strategyResults, 'sharpeRatio')
  
  // 如果没有相关性矩阵，直接返回
  if (!correlationMatrix || correlationMatrix.length === 0) {
    return sharpeWeights
  }
  
  // 调整权重：降低高相关性的策略权重
  const adjustedWeights = sharpeWeights.map((w, i) => {
    let correlationPenalty = 1
    
    for (let j = 0; j < correlationMatrix[i].length; j++) {
      if (i !== j && Math.abs(correlationMatrix[i][j]) > maxCorrelation) {
        correlationPenalty *= (1 - Math.abs(correlationMatrix[i][j]))
      }
    }
    
    return w * correlationPenalty
  })
  
  // 重新归一化
  const total = adjustedWeights.reduce((sum, w) => sum + w, 0)
  
  if (total === 0) {
    const equalWeight = 1 / adjustedWeights.length
    return adjustedWeights.map(() => equalWeight)
  }
  
  return adjustedWeights.map(w => w / total)
}

/**
 * 基于Kelly公式分配仓位
 * @param {Array} strategyResults - 策略回测结果数组
 * @param {number} kellyFraction - Kelly系数（默认0.5，保守策略）
 * @returns {Array} 策略仓位数组
 */
export const allocateByKelly = (strategyResults, kellyFraction = 0.5) => {
  const validResults = strategyResults.filter(r => !r.error && r.metrics)
  
  if (validResults.length === 0) {
    return strategyResults.map(() => 0)
  }
  
  // Kelly公式：f* = (bp - q) / b = p - q/b
  // 这里简化使用：f = p - q/b ≈ winRate - lossRate / avgProfit
  const kellyWeights = validResults.map(r => {
    const winRate = r.metrics.winRate || 0
    const profitLossRatio = r.metrics.profitLossRatio || 1
    const lossRate = 1 - winRate
    
    // 保守Kelly：乘以kellyFraction
    return kellyFraction * (winRate - lossRate / profitLossRatio)
  })
  
  // 将负值设为0
  const positiveKellyWeights = kellyWeights.map(w => Math.max(0, w))
  
  // 归一化
  const total = positiveKellyWeights.reduce((sum, w) => sum + w, 0)
  
  if (total === 0) {
    const equalWeight = 1 / validResults.length
    const weightMap = {}
    validResults.forEach(r => {
      weightMap[r.strategyName] = equalWeight
    })
    return strategyResults.map(r => weightMap[r.strategyName] || 0)
  }
  
  const weightMap = {}
  validResults.forEach((r, i) => {
    weightMap[r.strategyName] = positiveKellyWeights[i] / total
  })
  
  return strategyResults.map(r => weightMap[r.strategyName] || 0)
}

/**
 * 综合仓位分配（结合多种方法）
 * @param {Array} strategyResults - 策略回测结果数组
 * @param {Array} correlationMatrix - 策略相关性矩阵
 * @param {Object} params - 参数配置
 * @returns {Array} 策略权重数组
 */
export const allocatePositions = (strategyResults, correlationMatrix, params = {}) => {
  const {
    method = 'combined',  // 'sharpe', 'riskParity', 'correlation', 'kelly', 'combined'
    maxCorrelation = 0.8,
    kellyFraction = 0.5,
    weights = { sharpe: 0.4, riskParity: 0.3, correlation: 0.2, kelly: 0.1 },  // 综合方法的权重
  } = params
  
  let finalWeights
  
  switch (method) {
    case 'sharpe':
      finalWeights = allocateBySharpeRatio(strategyResults, 'sharpeRatio')
      break
    
    case 'riskParity':
      finalWeights = allocateByRiskParity(strategyResults, correlationMatrix)
      break
    
    case 'correlation':
      finalWeights = allocateWithCorrelationAdjustment(strategyResults, correlationMatrix, maxCorrelation)
      break
    
    case 'kelly':
      finalWeights = allocateByKelly(strategyResults, kellyFraction)
      break
    
    case 'combined':
    default:
      // 综合多种方法
      const sharpeWeights = allocateBySharpeRatio(strategyResults, 'sharpeRatio')
      const riskParityWeights = allocateByRiskParity(strategyResults, correlationMatrix)
      const correlationWeights = allocateWithCorrelationAdjustment(strategyResults, correlationMatrix, maxCorrelation)
      const kellyWeights = allocateByKelly(strategyResults, kellyFraction)
      
      finalWeights = sharpeWeights.map((w, i) => 
        w * weights.sharpe + 
        riskParityWeights[i] * weights.riskParity + 
        correlationWeights[i] * weights.correlation + 
        kellyWeights[i] * weights.kelly
      )
      
      // 归一化
      const total = finalWeights.reduce((sum, w) => sum + w, 0)
      if (total > 0) {
        finalWeights = finalWeights.map(w => w / total)
      }
      break
  }
  
  return finalWeights
}

/**
 * 为多个股票分配组合仓位
 * @param {Array} stockDataList - 股票数据列表
 * @param {Array} allStrategyResults - 所有策略的回测结果（每个股票一个数组）
 * @param {Object} params - 参数配置
 * @returns {Array} 每个股票的仓位配置
 */
export const allocatePortfolioPositions = (stockDataList, allStrategyResults, params = {}) => {
  const {
    maxSingleStockWeight = 0.15,  // 单个股票最大权重
    minStockWeight = 0.01,        // 单个股票最小权重
    totalEquityWeight = 0.8,     // 权益类资产总权重
  } = params
  
  // 计算每个股票的平均夏普比率
  const stockSharpeRatios = stockDataList.map((stock, i) => {
    const strategyResults = allStrategyResults[i] || []
    const validResults = strategyResults.filter(r => !r.error && r.metrics)
    
    if (validResults.length === 0) return 0
    
    const avgSharpe = validResults.reduce((sum, r) => sum + r.metrics.sharpeRatio, 0) / validResults.length
    return Math.max(0, avgSharpe)
  })
  
  // 初始化权重
  let weights = stockSharpeRatios.map(s => Math.max(0, s))
  
  // 归一化
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  if (totalWeight > 0) {
    weights = weights.map(w => w / totalWeight)
  }
  
  // 应用总权益权重
  weights = weights.map(w => w * totalEquityWeight)
  
  // 限制单个股票权重
  weights = weights.map(w => Math.min(maxSingleStockWeight, Math.max(minStockWeight, w)))
  
  // 重新归一化
  const adjustedTotal = weights.reduce((sum, w) => sum + w, 0)
  if (adjustedTotal > 0) {
    weights = weights.map(w => w * totalEquityWeight / adjustedTotal)
  }
  
  // 生成仓位配置对象
  const positions = stockDataList.map((stock, i) => ({
    id: stock.id,
    plate: stock.plate,
    stock: stock.stock,
    fund: stock.fund,
    weight: weights[i],
    sharpeRatio: stockSharpeRatios[i],
  }))
  
  return positions
}

/**
 * 计算组合绩效指标
 * @param {Array} positions - 仓位配置数组
 * @param {Array} stockDataList - 股票数据列表
 * @returns {Object} 组合绩效指标
 */
export const calculatePortfolioMetrics = (positions, stockDataList) => {
  const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0)
  const weightedSharpe = positions.reduce((sum, p) => sum + p.weight * p.sharpeRatio, 0)
  
  // 计算权重分布统计
  const weights = positions.map(p => p.weight)
  const maxWeight = Math.max(...weights)
  const minWeight = Math.min(...weights)
  const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length
  
  // 计算Herfindahl指数（集中度）
  const herfindahl = weights.reduce((sum, w) => sum + w * w, 0)
  
  return {
    totalWeight,
    weightedSharpe,
    maxWeight,
    minWeight,
    avgWeight,
    herfindahl,
    concentration: herfindahl > 0.1 ? 'high' : (herfindahl > 0.05 ? 'medium' : 'low'),
  }
}

/**
 * 生成仓位分配报告
 * @param {Array} positions - 仓位配置数组
 * @param {Object} metrics - 组合绩效指标
 * @returns {string} Markdown格式的报告
 */
export const generatePositionReport = (positions, metrics) => {
  let report = '# 组合仓位配置报告\n\n'
  
  // 添加组合概览
  report += '## 组合概览\n\n'
  report += `- **总权益仓位**: ${(metrics.totalWeight * 100).toFixed(2)}%\n`
  report += `- **加权夏普比率**: ${metrics.weightedSharpe.toFixed(4)}\n`
  report += `- **最大单股权重**: ${(metrics.maxWeight * 100).toFixed(2)}%\n`
  report += `- **最小单股权重**: ${(metrics.minWeight * 100).toFixed(2)}%\n`
  report += `- **平均权重**: ${(metrics.avgWeight * 100).toFixed(2)}%\n`
  report += `- **集中度**: ${metrics.concentration}\n\n`
  
  // 添加仓位配置表
  report += '## 仓位配置详情\n\n'
  report += '| 板块 | 股票 | 基金 | 仓位比例 | 夏普比率 |\n'
  report += '|-----|------|------|---------|---------|\n'
  
  // 按仓位排序
  const sortedPositions = [...positions].sort((a, b) => b.weight - a.weight)
  
  for (const pos of sortedPositions) {
    report += `| ${pos.plate} | ${pos.stock} | ${pos.fund} | ${(pos.weight * 100).toFixed(2)}% | ${pos.sharpeRatio.toFixed(4)} |\n`
  }
  
  return report
}

/**
 * 生成最终持仓建议
 * @param {Array} positions - 仓位配置数组
 * @param {Object} portfolioMetrics - 组合绩效指标
 * @param {Array} strategyResults - 策略回测结果（用于调试）
 * @returns {Object} 最终持仓建议
 */
export const generateFinalPositions = (positions, portfolioMetrics, strategyResults = null) => {
  // 过滤掉权重过小的股票
  const minWeight = 0.005  // 最小0.5%
  const validPositions = positions.filter(p => p.weight >= minWeight)
  
  // 重新归一化权重
  const totalWeight = validPositions.reduce((sum, p) => sum + p.weight, 0)
  const normalizedPositions = validPositions.map(p => ({
    ...p,
    weight: totalWeight > 0 ? p.weight / totalWeight : 0,
  }))
  
  return {
    positions: normalizedPositions,
    portfolioMetrics: {
      ...portfolioMetrics,
      numPositions: normalizedPositions.length,
      effectiveWeight: normalizedPositions.reduce((sum, p) => sum + p.weight, 0),
    },
    timestamp: new Date().toISOString(),
    debugInfo: strategyResults ? {
      strategyCount: strategyResults.length,
      avgSharpeRatio: strategyResults.reduce((sum, r) => sum + (r.metrics?.sharpeRatio || 0), 0) / strategyResults.length,
    } : null,
  }
}
