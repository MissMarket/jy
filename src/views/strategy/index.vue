<script setup>
  import { ref, onMounted, computed } from 'vue'
  import { TrendCharts } from '@element-plus/icons-vue'
  import {
    ElMessage,
    ElCard,
    ElPagination,
    ElIcon,
    ElInputNumber,
    ElTable,
    ElTableColumn,
    ElTag,
  } from 'element-plus'
  import { useStockData } from '@/composables/useStockData'
  import { calculateShape, calculateTradingSignal } from '@/utils'
  import calculateJMA from '@/signalModule'
  import TradingSignal from '@/components/TradingSignal.vue'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()

  // 响应式数据
  const evaluationResults = ref([])
  const currentPage = ref(1)
  const pageSize = 10

  // 从 localStorage 读取总资产
  const loadTotalAssetsFromStorage = () => {
    try {
      const stored = localStorage.getItem('strategy_totalAssets')
      if (stored) {
        const value = parseInt(stored, 10)
        return isNaN(value) ? 100000 : value
      }
    } catch (error) {
      // 静默处理错误
    }
    return 100000
  }

  const totalAssets = ref(loadTotalAssetsFromStorage()) // 总资产，优先从 localStorage 读取

  // 计算当前仓位（买入或持有的分配资金之和）
  const currentPosition = computed(() => {
    return evaluationResults.value.reduce((sum, stock) => {
      // 只有低点或上升形态才计入仓位
      if (
        stock.allocation > 0 &&
        (stock.tradingShape?.shape === '低点' || stock.tradingShape?.shape === '上升')
      ) {
        return sum + stock.allocation
      }
      return sum
    }, 0)
  })

  // 保存总资产到 localStorage
  const saveTotalAssetsToStorage = () => {
    try {
      localStorage.setItem('strategy_totalAssets', totalAssets.value.toString())
    } catch (error) {
      // 静默处理错误
    }
  }

  // 计算分配资金
  const calculateAllocation = () => {
    const assets = totalAssets.value

    // 保存总资产到 localStorage
    saveTotalAssetsToStorage()

    evaluationResults.value.forEach((stock, index) => {
      // 只有前8名且有低点/上升形态才分配资金
      const shape = stock.tradingShape?.shape
      const isValidShape = shape === '低点' || shape === '上升'
      const isTop8 = index < 8

      if (isTop8 && isValidShape && stock.weight > 0) {
        stock.allocation = Math.floor((assets * stock.weight) / 100)
      } else {
        stock.allocation = 0
      }
    })
  }

  // 处理总资产输入变化
  const handleAssetsChange = () => {
    // 确保只能输入正整数
    if (totalAssets.value < 0) {
      totalAssets.value = 0
    }
    totalAssets.value = Math.floor(totalAssets.value)
    calculateAllocation()
  }

  /**
   * 统一量纲处理 - 以1000为基点进行归一化
   * @param {Array} priceArr - 价格数组
   * @returns {Array} 归一化后的价格数组
   */
  const normalizePrices = priceArr => {
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
  const calculateATR14 = (highArr, lowArr, closeArr) => {
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
  const rankAndScore = (values, maxScore, interval, isHigherBetter = true) => {
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
   * 批量评估所有股票（使用排名评分方式）
   */
  const evaluateAllStocks = () => {
    // 第一步：计算所有指数的10个维度原始值
    const stockRawValues = stockData.value.map(stock => {
      const recent200Days = Math.min(200, stock.dateArr.length)
      const startIndex = stock.dateArr.length - recent200Days

      const dateArr = stock.dateArr.slice(startIndex)
      const priceArr = stock.priceArr.slice(startIndex)
      const normalizedPrices = normalizePrices(priceArr)

      const n = normalizedPrices.length

      // 下跌倾向：统计近200个交易日中下跌的天数占比
      let downDayCount = 0
      for (let i = 1; i < n; i++) {
        if (normalizedPrices[i] < normalizedPrices[i - 1]) {
          downDayCount++
        }
      }
      const downTrendRatio = downDayCount / (n - 1) // 下跌天数占比（越大越好）

      // 价格波动率
      const returns = []
      for (let i = 1; i < n; i++) {
        returns.push((normalizedPrices[i] - normalizedPrices[i - 1]) / normalizedPrices[i - 1])
      }
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
      const varianceReturn =
        returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length
      const stdReturn = Math.sqrt(varianceReturn)

      // 趋势强度：计算连续相同方向的最长段（衡量趋势持续性）
      let maxConsistentRun = 1
      let currentRun = 1
      for (let i = 2; i < n; i++) {
        const prevDirection = normalizedPrices[i - 1] > normalizedPrices[i - 2] ? 1 : -1
        const currentDirection = normalizedPrices[i] > normalizedPrices[i - 1] ? 1 : -1
        if (currentDirection === prevDirection) {
          currentRun++
        } else {
          maxConsistentRun = Math.max(maxConsistentRun, currentRun)
          currentRun = 1
        }
      }
      maxConsistentRun = Math.max(maxConsistentRun, currentRun)
      const trendStrength = maxConsistentRun / n // 归一化到0-1

      // 计算JMA并获取交易形态（使用全部价格数据）
      const jmaArr = calculateJMA(stock.priceArr)
      let tradingShape = { shape: '-', color: '#999999' }
      if (jmaArr.length >= 3) {
        const prevPrevJma = jmaArr[jmaArr.length - 3]
        const prevJma = jmaArr[jmaArr.length - 2]
        const currentJma = jmaArr[jmaArr.length - 1]
        tradingShape = calculateShape(prevPrevJma, prevJma, currentJma)
      }

      // 计算ATR14和平均真实波动率
      const atr14 = calculateATR14(stock.highArr, stock.lowArr, stock.priceArr)
      const currentPrice = stock.priceArr[stock.priceArr.length - 1]
      const atrRate = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0 // 转换为百分比

      // 计算历史交易信号（用于获取最后一个交易日的信号）
      let lastTradingSignal = { signal: '-', color: '#999999' }
      if (jmaArr.length >= 3) {
        // 构建历史数据（date + shape）
        const historyData = []
        for (let i = startIndex; i < stock.dateArr.length; i++) {
          const jmaIndex = i
          if (jmaIndex >= 2 && jmaIndex < jmaArr.length) {
            const prevPrevJma = jmaArr[jmaIndex - 2]
            const prevJma = jmaArr[jmaIndex - 1]
            const currentJma = jmaArr[jmaIndex]
            const shapeObj = calculateShape(prevPrevJma, prevJma, currentJma)
            historyData.push({
              date: stock.dateArr[i],
              shape: shapeObj.shape,
            })
          }
        }

        if (historyData.length > 0) {
          // 计算交易信号
          const signalData = calculateTradingSignal(historyData)
          // 获取最后一个交易日的信号
          const lastData = signalData[signalData.length - 1]
          lastTradingSignal = { signal: lastData.signal, color: lastData.signalColor }
        }
      }

      return {
        name: stock.plate || stock.stock,
        date: dateArr[dateArr.length - 1],
        tradingShape, // 交易形态
        tradingSignal: lastTradingSignal, // 最后一个交易日的交易信号
        atr14, // ATR14值
        atrRate, // 平均真实波动率（ATR14/收盘价，百分比）
        // 3个维度的原始值
        dim1_trendStrength: trendStrength, // 维度1：趋势强度（越大越好）
        dim2_downwardTrend: downTrendRatio, // 维度2：下跌倾向（越大越好，下跌天数占比）
        dim7_priceVolatility: stdReturn, // 维度7：价格波动率（越大越好）
      }
    })

    // 第二步：只计算3个维度的评分
    const dim1Scores = rankAndScore(
      stockRawValues.map(v => v.dim1_trendStrength),
      3300,
      165,
      true,
    ) // 趋势强度：3300分，间隔165分，越大越好
    const dim2Scores = rankAndScore(
      stockRawValues.map(v => v.dim2_downwardTrend),
      3200,
      160,
      true,
    ) // 下跌倾向：3200分，间隔160，越大越好（下跌天数占比）
    const dim7Scores = rankAndScore(
      stockRawValues.map(v => v.dim7_priceVolatility),
      3500,
      175,
      true,
    ) // 价格波动：3500分，间隔175，越大越好

    // 第三步：计算总分（只包含3个维度）
    const results = stockRawValues.map((stock, index) => {
      const totalScore = dim1Scores[index] + dim2Scores[index] + dim7Scores[index]

      return {
        name: stock.name,
        date: stock.date,
        tradingShape: stock.tradingShape, // 交易形态
        tradingSignal: stock.tradingSignal, // 最后一个交易日的交易信号
        atr14: stock.atr14,
        atrRate: stock.atrRate,
        totalScore,
        trendScores: [dim1Scores[index], dim2Scores[index]],
        volatilityScores: [dim7Scores[index]],
      }
    })

    // 按总分从高到低排序
    results.sort((a, b) => b.totalScore - a.totalScore)

    // 计算前8名的权重（基于平均真实波动率的倒数）
    const top8 = results.slice(0, 8)
    const inverseRates = top8.map(stock => {
      // 避免除零，最小波动率设为0.01%
      const rate = Math.max(stock.atrRate, 0.01)
      return 1 / rate
    })
    const sumInverse = inverseRates.reduce((sum, inv) => sum + inv, 0)

    // 分配权重，保留1位小数
    let weights = results.map((_stock, index) => {
      if (index < 8) {
        const weight = (inverseRates[index] / sumInverse) * 80
        return Math.round(weight * 10) / 10 // 保留1位小数
      }
      return 0
    })

    // 调整权重使总和正好为80（处理四舍五入误差）
    const currentSum = weights.slice(0, 8).reduce((sum, w) => sum + w, 0)
    if (currentSum !== 80 && weights[0] > 0) {
      weights[0] = Math.round((weights[0] + (80 - currentSum)) * 10) / 10
    }

    // 将权重添加到结果中
    results.forEach((stock, index) => {
      stock.weight = weights[index]
      stock.allocation = 0 // 初始化分配资金
    })

    evaluationResults.value = results

    // 初始计算分配资金
    calculateAllocation()

    ElMessage.success('评估完成！')
  }

  /**
   * 获取表格数据
   */
  const tableData = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return evaluationResults.value.slice(start, end)
  })

  /**
   * 获取行样式
   */
  const getRowClassName = ({ rowIndex }) => {
    const globalIndex = (currentPage.value - 1) * pageSize + rowIndex
    if (globalIndex < 8) {
      return 'top-8-row'
    }
    return ''
  }

  /**
   * 分页变化
   */
  const handlePageChange = page => {
    currentPage.value = page
  }

  /**
   * 获取数据
   */
  const fetchData = async () => {
    try {
      await fetchStockData()
      evaluateAllStocks()
    } catch (error) {
      ElMessage.error('获取数据失败')
    }
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <div class="strategy-container">
    <ElCard shadow="never" class="main-card">
      <template #header>
        <div class="page-header">
          <div class="header-left">
            <ElIcon :size="24">
              <TrendCharts />
            </ElIcon>
            <span class="header-title">交易策略评估</span>
          </div>
          <div class="header-right">
            <div class="assets-input-group">
              <span class="label">总资产:</span>
              <ElInputNumber
                v-model="totalAssets"
                :min="0"
                :step="10000"
                :controls="false"
                placeholder="请输入总资产"
                style="width: 150px"
                @change="handleAssetsChange"
              />
              <span class="unit">元</span>
            </div>
            <div class="position-display">
              <span class="label">当前仓位:</span>
              <ElTag type="primary" size="large"> {{ currentPosition.toLocaleString() }} 元 </ElTag>
            </div>
          </div>
        </div>
      </template>

      <div v-if="loading" style="text-align: center; padding: 40px">正在加载数据...</div>

      <div v-else>
        <div class="table-section">
          <ElTable
            :data="tableData"
            border
            :row-class-name="getRowClassName"
            style="width: 100%"
            class="data-table"
            size="small"
          >
            <ElTableColumn prop="name" label="名称" width="100" />
            <ElTableColumn prop="date" label="日期" width="110" />
            <ElTableColumn label="交易形态" width="90">
              <template #default="{ row }">
                <TradingSignal :shape="row.tradingShape" :signal="null" shape-label="" />
              </template>
            </ElTableColumn>
            <ElTableColumn label="交易信号" width="90">
              <template #default="{ row }">
                <TradingSignal :shape="null" :signal="row.tradingSignal" signal-label="" />
              </template>
            </ElTableColumn>
            <ElTableColumn prop="totalScore" label="总分" width="100">
              <template #default="{ row }">
                <ElTag type="success" size="small">
                  {{ row.totalScore }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="价格波动★" width="110">
              <template #default="{ row }">
                <ElTag type="danger" size="small">
                  {{ row.volatilityScores[0] }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="趋势强度★" width="110">
              <template #default="{ row }">
                <ElTag type="danger" size="small">
                  {{ row.trendScores[0] }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="下跌倾向★" width="110">
              <template #default="{ row }">
                <ElTag type="danger" size="small">
                  {{ row.trendScores[1] }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="平均真实波动率" width="130">
              <template #default="{ row }">
                <ElTag
                  :type="row.atrRate > 2 ? 'danger' : row.atrRate > 1 ? 'warning' : 'success'"
                  size="small"
                >
                  {{ row.atrRate.toFixed(2) }}%
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="weight" label="权重" width="70">
              <template #default="{ row }">
                <span
                  :style="{
                    fontWeight: row.weight > 0 ? 'bold' : 'normal',
                    color: row.weight > 0 ? '#1890ff' : '#999',
                  }"
                >
                  {{ row.weight.toFixed(1) }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="allocation" label="分配资金" width="120">
              <template #default="{ row }">
                <ElTag
                  v-if="row.allocation > 0"
                  :type="row.tradingShape?.shape === '低点' ? 'success' : 'warning'"
                  size="small"
                >
                  {{ row.allocation.toLocaleString() }}
                </ElTag>
                <span v-else style="color: #999">-</span>
              </template>
            </ElTableColumn>
          </ElTable>

          <div class="pagination-section">
            <ElPagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="evaluationResults.length"
              layout="total, prev, pager, next"
              class="data-pagination"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .strategy-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 16px;
  }

  .main-card {
    border-radius: $border-radius-lg;
    box-shadow: $shadow-md;
    padding: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $primary-color;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .header-title {
    font-weight: $font-weight-bold;
  }

  .assets-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .assets-input-group .label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .assets-input-group .unit {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .position-display {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .position-display .label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .table-section {
    margin-top: 12px;
  }

  .data-table {
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;

    :deep(.el-table__header th) {
      background-color: $bg-tertiary;
      font-weight: $font-weight-semibold;
      padding: 8px 12px;
      white-space: nowrap;
    }

    :deep(.el-table__row:hover) {
      background-color: $bg-accent;
    }

    :deep(.el-table__cell) {
      padding: 8px 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :deep(.el-table__row) {
      height: 40px;
    }
  }

  .pagination-section {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }

  .data-pagination {
    border-radius: $border-radius-md;
  }

  /* 前8名行高亮样式 */
  :deep(.el-table .top-8-row) {
    background-color: rgba($primary-color, 0.1) !important;
  }

  :deep(.el-table .top-8-row > td) {
    background-color: rgba($primary-color, 0.1) !important;
  }

  :deep(.el-table .top-8-row:hover) {
    background-color: rgba($primary-color, 0.2) !important;
  }

  :deep(.el-table .top-8-row:hover > td) {
    background-color: rgba($primary-color, 0.2) !important;
  }

  // 响应式调整
  @media (max-width: $breakpoint-tablet) {
    .strategy-container {
      padding: 0 16px;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .header-right {
      width: 100%;
      justify-content: space-between;
    }

    .assets-input-group,
    .position-display {
      flex: 1;
    }
  }
</style>
