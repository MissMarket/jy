import {
  truncateDataToLength,
  calculateAllIndicators,
  extractHMMFeatures,
  discretizeToStates,
} from './preprocessing.js'

import {
  trainMultipleHMMs,
  predictWithHMM,
} from './hmmCore.js'

import {
  initStrategies,
  applyAllStrategies,
  calculateStrategyCorrelation,
} from './strategies.js'

import {
  backtestMultipleStrategies,
  generateBacktestReport,
} from './backtest.js'

import {
  allocatePositions,
  allocatePortfolioPositions,
  calculatePortfolioMetrics,
  generateFinalPositions,
  generatePositionReport,
} from './positionManager.js'

/**
 * 齐油气保单策略主函数
 * 基于HMM模型的量化策略系统
 * @param {Array} stockData - 从dataModule获取的股票数据数组
 * @returns {Object} 最终持仓建议和绩效指标
 */
export const QiYouHeBaoDan = async (stockData) => {
  console.log('===== 开始执行HMM策略系统 =====')
  const startTime = Date.now()
  
  try {
    // ==================== 1. 数据预处理 ====================
    console.log('\n步骤1: 数据预处理...')
    console.log(`原始数据: ${stockData.length} 个指数`)
    
    // 截取数据为统一长度（最近970条）
    const truncatedData = truncateDataToLength(stockData, 970)
    console.log(`截取后数据: ${truncatedData.length} 个指数，每个${truncatedData[0]?.totalDays || 0}条`)
    
    // 计算所有技术指标
    const processedData = calculateAllIndicators(truncatedData)
    console.log('技术指标计算完成')
    
    // 提取HMM特征并离散化
    const hmmData = processedData.map(stock => {
      const features = extractHMMFeatures(stock)
      const observations = discretizeToStates(features, 10) // 离散化为10个观测状态
      
      return {
        ...stock,
        features,
        observations,
      }
    })
    
    console.log('HMM特征提取和离散化完成')
    
    // ==================== 2. HMM模型训练 ====================
    console.log('\n步骤2: HMM模型训练...')
    const hmmModels = trainMultipleHMMs(
      hmmData,
      3,  // 隐藏状态数量（牛市、震荡、熊市）
      10, // 观测状态数量
      50,  // 最大迭代次数
      {
        baseSeed: 12345,      // 固定基础种子确保可复现性
        numRuns: 3,           // 每个股票训练3次，选择最优
        verbose: true,        // 输出详细日志
      },
    )
    console.log(`HMM模型训练完成: ${hmmModels.length} 个模型`)
    
    // ==================== 3. 初始化策略 ====================
    console.log('\n步骤3: 初始化策略...')
    const strategies = initStrategies({
      stateSwitch: { bullishState: 0, bearishState: 2 },
      probabilityThreshold: { threshold: 0.6 },
      longShort: { lookback: 20 },
      volatility: { highVolThreshold: 0.03, lowVolThreshold: 0.01 },
      meanReversion: { deviationThreshold: 0.02 },
      momentum: { momentumWindow: 10, threshold: 0.01 },
      trendFollowing: {},
      riskParity: { basePosition: 0.5, riskMultiplier: 2 },
      marketTiming: { bullishThreshold: 0.7, bearishThreshold: 0.7 },
      portfolioOptimization: { historyLength: 5 },
    })
    console.log(`策略初始化完成: ${strategies.length} 个策略`)
    
    // ==================== 4. 回测评估 ====================
    console.log('\n步骤4: 策略回测...')
    const allStrategyResults = []
    
    for (let i = 0; i < hmmData.length; i++) {
      const stock = hmmData[i]
      const hmmModel = hmmModels.find(m => m.id === stock.id)

      if (!hmmModel) {
        console.warn(`未找到 ${stock.stock} 的HMM模型，跳过`)
        continue
      }

      if (!hmmModel.model) {
        console.warn(`${stock.stock} 的HMM模型训练失败（model为null），跳过`)
        continue
      }

      // 使用HMM预测
      const hmmPrediction = predictWithHMM(hmmModel.model, stock.observations)
      hmmPrediction.prevState = stock.observations.length > 1 ? stock.observations[stock.observations.length - 2] : 0
      
      // 回测所有策略
      const strategyResults = backtestMultipleStrategies(stock, strategies, hmmPrediction)
      
      allStrategyResults.push({
        stockId: stock.id,
        stockName: stock.stock,
        results: strategyResults,
      })
      
      console.log(`  ${stock.stock}: ${strategyResults.filter(r => !r.error).length}/${strategies.length} 策略回测成功`)
    }
    
    console.log('策略回测完成')
    
    // ==================== 5. 策略筛选 ====================
    console.log('\n步骤5: 策略筛选...')
    
    // 筛选高夏普比率的策略
    const minSharpeRatio = 0.5  // 最小夏普比率阈值
    const selectedStrategyResults = allStrategyResults.map(stockResult => {
      return {
        ...stockResult,
        results: stockResult.results.filter(r => !r.error && r.metrics?.sharpeRatio >= minSharpeRatio),
      }
    })
    
    console.log(`策略筛选完成: 保留夏普比率 >= ${minSharpeRatio} 的策略`)
    
    // ==================== 6. 仓位分配 ====================
    console.log('\n步骤6: 仓位分配...')
    
    // 计算每个股票的策略权重
    const portfolioPositions = allocatePortfolioPositions(
      processedData,
      selectedStrategyResults.map(s => s.results),
      {
        maxSingleStockWeight: 0.15,  // 单个股票最大15%
        minStockWeight: 0.01,        // 单个股票最小1%
        totalEquityWeight: 0.8,     // 权益类资产总权重80%
      },
    )
    
    console.log('仓位分配完成')
    
    // 计算组合绩效指标
    const portfolioMetrics = calculatePortfolioMetrics(portfolioPositions, processedData)
    console.log(`组合加权夏普比率: ${portfolioMetrics.weightedSharpe.toFixed(4)}`)
    console.log(`组合集中度: ${portfolioMetrics.concentration}`)
    
    // ==================== 7. 生成最终结果 ====================
    console.log('\n步骤7: 生成最终结果...')
    
    const finalResult = generateFinalPositions(
      portfolioPositions,
      portfolioMetrics,
      selectedStrategyResults[0]?.results || [],
    )
    
    const endTime = Date.now()
    const executionTime = ((endTime - startTime) / 1000).toFixed(2)
    
    console.log('\n===== HMM策略系统执行完成 =====')
    console.log(`执行时间: ${executionTime}秒`)
    console.log(`配置股票数量: ${finalResult.positions.length}`)
    console.log(`有效权益权重: ${(finalResult.portfolioMetrics.effectiveWeight * 100).toFixed(2)}%`)
    
    // 打印回测报告
    console.log('\n===== 策略回测报告 =====')
    const firstStockResults = selectedStrategyResults[0]?.results || []
    const report = generateBacktestReport(firstStockResults)
    console.log(report)
    
    // 打印仓位分配报告
    console.log('\n===== 仓位分配报告 =====')
    const positionReport = generatePositionReport(
      finalResult.positions,
      finalResult.portfolioMetrics,
    )
    console.log(positionReport)
    
    return finalResult
    
  } catch (error) {
    console.error('HMM策略系统执行失败:', error)
    throw error
  }
}

/**
 * 导出所有模块，便于测试和调试
 */
export {
  // 预处理模块
  truncateDataToLength,
  calculateAllIndicators,
  extractHMMFeatures,
  discretizeToStates,
  
  // HMM模块
  trainMultipleHMMs,
  predictWithHMM,
  
  // 策略模块
  initStrategies,
  applyAllStrategies,
  calculateStrategyCorrelation,
  
  // 回测模块
  backtestMultipleStrategies,
  generateBacktestReport,
  
  // 仓位模块
  allocatePositions,
  allocatePortfolioPositions,
  calculatePortfolioMetrics,
  generateFinalPositions,
}