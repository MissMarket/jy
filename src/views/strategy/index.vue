<script setup>
  import { ref, onMounted, computed } from 'vue'
  import { getStockHistoricalData } from '@/dataModule'
  import { TrendCharts } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import calculateJMA from '@/signalModule'

  const loading = ref(true)
  const stockData = ref([])
  const evaluationResults = ref([])
  const currentPage = ref(1)
  const pageSize = 10

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
   * 计算线性回归（用于趋势强度评估）
   * @param {Array} y - Y值数组
   * @returns {Object} { slope: 斜率, r2: 拟合优度 }
   */
  const linearRegression = y => {
    const n = y.length
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0

    for (let i = 0; i < n; i++) {
      sumX += i
      sumY += y[i]
      sumXY += i * y[i]
      sumXX += i * i
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // 计算拟合优度R²
    let ssTotal = 0,
      ssResidual = 0
    const meanY = sumY / n

    for (let i = 0; i < n; i++) {
      ssTotal += Math.pow(y[i] - meanY, 2)
      ssResidual += Math.pow(y[i] - (slope * i + intercept), 2)
    }

    const r2 = 1 - ssResidual / ssTotal

    return { slope, r2, intercept }
  }

  /**
   * 根据原始值进行排名评分（1-20分，20分最好）
   * @param {Array} values - 所有指数在该维度的原始值数组
   * @param {boolean} isHigherBetter - 值越大越好（true）或越小越好（false）
   * @returns {Array} 排名评分数组
   */
  const rankAndScore = (values, isHigherBetter = true) => {
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

    // 按排名分配分数（第1名20分，第2名19分...第20名1分）
    indexed.forEach((item, rank) => {
      scores[item.index] = 20 - rank
    })

    return scores
  }

  /**
   * 计算交易信号
   * @param {number} a - 前天JMA
   * @param {number} b - 昨天JMA
   * @param {number} c - 今天JMA
   * @returns {Object} { signal: 信号文本, color: 颜色值 }
   */
  const calculateSignal = (a, b, c) => {
    if (a > b && c > b) {
      return { signal: '买入', color: '#ff0000' }
    } else if (a < b && c < b) {
      return { signal: '卖出', color: '#00ff00' }
    } else if (a < b && b < c) {
      return { signal: '空仓', color: '#0000ff' }
    } else if (a > b && b > c) {
      return { signal: '持有', color: '#ffa500' }
    } else {
      return { signal: '观望', color: '#999999' }
    }
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
      const volumeArr = stock.volumnArr.slice(startIndex)
      const normalizedPrices = normalizePrices(priceArr)

      const regression = linearRegression(normalizedPrices)
      const n = normalizedPrices.length
      const mean = normalizedPrices.reduce((a, b) => a + b, 0) / n
      const variance = normalizedPrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n
      const stdDev = Math.sqrt(variance)

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

      // 波动幅度
      const maxPrice = Math.max(...normalizedPrices)
      const minPrice = Math.min(...normalizedPrices)

      // 成交量波动性
      const meanVolume = volumeArr.reduce((a, b) => a + b, 0) / volumeArr.length
      const volumeVariance =
        volumeArr.reduce((a, b) => a + Math.pow(b - meanVolume, 2), 0) / volumeArr.length
      const volumeStd = Math.sqrt(volumeVariance)

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

      // 震荡频率
      let directionChangeCount = 0
      let lastDirectionOsc = null
      for (let i = 1; i < n; i++) {
        const direction = normalizedPrices[i] > normalizedPrices[i - 1] ? 1 : -1
        if (lastDirectionOsc !== null && direction !== lastDirectionOsc) {
          directionChangeCount++
        }
        lastDirectionOsc = direction
      }

      // 终点与起点偏差幅度
      const startEndDiff =
        Math.abs(normalizedPrices[n - 1] - normalizedPrices[0]) / normalizedPrices[0]

      // 移动平均线乖离率
      const ma5 = normalizedPrices.slice(-5).reduce((a, b) => a + b, 0) / 5
      const ma10 = normalizedPrices.slice(-10).reduce((a, b) => a + b, 0) / 10
      const ma20 = normalizedPrices.slice(-20).reduce((a, b) => a + b, 0) / 20
      const current = normalizedPrices[n - 1]
      const deviation5 = Math.abs(current - ma5) / ma5
      const deviation10 = Math.abs(current - ma10) / ma10
      const deviation20 = Math.abs(current - ma20) / ma20
      const maDeviation = deviation5 + deviation10 + deviation20

      // 计算JMA并获取交易信号（使用全部价格数据）
      const jmaArr = calculateJMA(stock.priceArr)
      let tradingSignal = { signal: '-', color: '#999999' }
      if (jmaArr.length >= 3) {
        const a = jmaArr[jmaArr.length - 3]
        const b = jmaArr[jmaArr.length - 2]
        const c = jmaArr[jmaArr.length - 1]
        tradingSignal = calculateSignal(a, b, c)
      }

      return {
        name: stock.plate || stock.stock,
        date: `${dateArr[0]} 至 ${dateArr[dateArr.length - 1]}`,
        tradingSignal, // 交易信号
        // 10个维度的原始值
        dim1_trendStrength: trendStrength, // 维度1：趋势强度（越大越好）
        dim2_downwardTrend: downTrendRatio, // 维度2：下跌倾向（越大越好，下跌天数占比）
        dim3_stability: stdDev, // 维度3：价格稳定性（标准差越小越好）
        dim4_consistency: regression.r2, // 维度4：拟合优度（越大越好）
        dim5_deviation: startEndDiff, // 维度5：偏差幅度（越大越好）
        dim6_maDeviation: maDeviation, // 维度6：均线乖离率（越小越好）
        dim7_priceVolatility: stdReturn, // 维度7：价格波动率（越大越好）
        dim8_amplitude: (maxPrice - minPrice) / minPrice, // 维度8：波动幅度（越大越好）
        dim9_volumeVolatility: volumeStd / meanVolume, // 维度9：成交量波动性（越大越好）
        dim10_oscillation: directionChangeCount / n, // 维度10：震荡频率（越小越好）
      }
    })

    // 第二步：对每个维度进行排名评分（1-20分）
    const dim1Scores = rankAndScore(
      stockRawValues.map(v => v.dim1_trendStrength),
      true,
    ) // 趋势强度：越大越好
    const dim2Scores = rankAndScore(
      stockRawValues.map(v => v.dim2_downwardTrend),
      true,
    ) // 下跌倾向：越大越好（下跌天数占比）
    const dim3Scores = rankAndScore(
      stockRawValues.map(v => v.dim3_stability),
      false,
    ) // 价格稳定：越小越好
    const dim4Scores = rankAndScore(
      stockRawValues.map(v => v.dim4_consistency),
      true,
    ) // 趋势一致：越大越好
    const dim5Scores = rankAndScore(
      stockRawValues.map(v => v.dim5_deviation),
      true,
    ) // 偏差幅度：越大越好
    const dim6Scores = rankAndScore(
      stockRawValues.map(v => v.dim6_maDeviation),
      false,
    ) // 均线乖离：越小越好
    const dim7Scores = rankAndScore(
      stockRawValues.map(v => v.dim7_priceVolatility),
      true,
    ) // 价格波动：越大越好
    const dim8Scores = rankAndScore(
      stockRawValues.map(v => v.dim8_amplitude),
      true,
    ) // 波动幅度：越大越好
    const dim9Scores = rankAndScore(
      stockRawValues.map(v => v.dim9_volumeVolatility),
      true,
    ) // 成交量波动：越大越好
    const dim10Scores = rankAndScore(
      stockRawValues.map(v => v.dim10_oscillation),
      false,
    ) // 震荡频率：越小越好

    // 第三步：计算加权总分
    // 权重配置：趋势强度(3x)、波动性得分(2x)、下跌倾向(3x)，其他维度(1x)
    const results = stockRawValues.map((stock, index) => {
      // 各维度得分
      const trendScores = [
        dim1Scores[index],
        dim2Scores[index],
        dim3Scores[index],
        dim4Scores[index],
        dim5Scores[index],
        dim6Scores[index],
      ]
      const volatilityScores = [
        dim7Scores[index],
        dim8Scores[index],
        dim9Scores[index],
        dim10Scores[index],
      ]

      // 加权计算总分
      // 趋势强度（维度1）权重3
      // 下跌倾向（维度2）权重3
      // 波动性得分：价格波动（维度7）权重2
      // 其他维度权重各为1
      const weightedScore =
        dim1Scores[index] * 3 + // 趋势强度 3倍权重
        dim2Scores[index] * 3 + // 下跌倾向 3倍权重
        dim3Scores[index] * 1 + // 价格稳定性
        dim4Scores[index] * 1 + // 趋势一致性
        dim5Scores[index] * 1 + // 偏差幅度
        dim6Scores[index] * 1 + // 均线乖离率
        dim7Scores[index] * 2 + // 价格波动率 2倍权重
        dim8Scores[index] * 1 + // 波动幅度
        dim9Scores[index] * 1 + // 成交量波动性
        dim10Scores[index] * 1 // 震荡频率

      return {
        name: stock.name,
        date: stock.date,
        tradingSignal: stock.tradingSignal, // 交易信号
        totalScore: weightedScore,
        trendScores,
        volatilityScores,
        // 单独计算趋势和波动性的平均分（用于显示）
        trendTotal:
          (dim1Scores[index] * 3 +
            dim2Scores[index] * 3 +
            dim3Scores[index] +
            dim4Scores[index] +
            dim5Scores[index] +
            dim6Scores[index]) /
          (3 + 3 + 1 + 1 + 1 + 1),
        volatilityTotal:
          (dim7Scores[index] * 2 + dim8Scores[index] + dim9Scores[index] + dim10Scores[index]) /
          (2 + 1 + 1 + 1),
      }
    })

    // 按总分从高到低排序
    results.sort((a, b) => b.totalScore - a.totalScore)

    evaluationResults.value = results

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
    loading.value = true
    try {
      const result = await getStockHistoricalData()
      stockData.value = result
      evaluateAllStocks()
    } catch (error) {
      console.error('获取数据失败:', error)
      ElMessage.error('获取数据失败')
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <div class="strategy-container">
    <Card shadow="never">
      <template #header>
        <div class="page-header">
          <Icon :size="22">
            <TrendCharts />
          </Icon>
          <span class="header-title">交易策略评估</span>
        </div>
      </template>

      <div v-if="loading" style="text-align: center; padding: 40px">正在加载数据...</div>

      <div v-else>
        <div class="table-section">
          <ElTable :data="tableData" border :row-class-name="getRowClassName" style="width: 100%">
            <ElTableColumn prop="name" label="名称" width="180" />
            <ElTableColumn prop="date" label="日期" width="200" />
            <ElTableColumn label="交易信号" width="100">
              <template #default="{ row }">
                <span :style="{ color: row.tradingSignal?.color || '#999', fontWeight: 'bold' }">
                  {{ row.tradingSignal?.signal || '-' }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="totalScore" label="总分" width="100" sortable>
              <template #default="{ row }">
                <el-tag :type="row.totalScore >= 100 ? 'success' : 'warning'">
                  {{ row.totalScore }}
                </el-tag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="趋势强度★" width="90">
              <template #default="{ row }">
                <el-tag type="danger">
                  {{ row.trendScores[0] }}
                </el-tag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="下跌倾向★" width="90">
              <template #default="{ row }">
                <el-tag type="danger">
                  {{ row.trendScores[1] }}
                </el-tag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="价格波动★" width="90">
              <template #default="{ row }">
                <el-tag type="warning">
                  {{ row.volatilityScores[0] }}
                </el-tag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="价格稳定" width="90">
              <template #default="{ row }">
                {{ row.trendScores[2] }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="趋势一致" width="90">
              <template #default="{ row }">
                {{ row.trendScores[3] }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="偏差幅度" width="90">
              <template #default="{ row }">
                {{ row.trendScores[4] }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="均线乖离" width="90">
              <template #default="{ row }">
                {{ row.trendScores[5] }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="波动幅度" width="90">
              <template #default="{ row }">
                {{ row.volatilityScores[1] }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="成交量波动" width="100">
              <template #default="{ row }">
                {{ row.volatilityScores[2] }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="震荡频率" width="90">
              <template #default="{ row }">
                {{ row.volatilityScores[3] }}
              </template>
            </ElTableColumn>
          </ElTable>

          <div class="pagination-section">
            <Pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="evaluationResults.length"
              layout="total, prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
  .strategy-container {
    max-width: 1600px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 500;
    color: #1890ff;
  }

  .header-title {
    font-weight: 600;
  }

  .table-section {
    margin-top: 20px;
  }

  .pagination-section {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }

  /* 前8名行高亮样式 */
  :deep(.el-table .top-8-row) {
    background-color: #ffc0cb !important;
  }

  :deep(.el-table .top-8-row > td) {
    background-color: #ffc0cb !important;
  }

  :deep(.el-table .top-8-row:hover) {
    background-color: #ffb6c1 !important;
  }

  :deep(.el-table .top-8-row:hover > td) {
    background-color: #ffb6c1 !important;
  }
</style>
