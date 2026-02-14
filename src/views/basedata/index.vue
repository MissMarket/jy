<template>
  <div class="basedata-container">
    <!-- 历史数据查询卡片 -->
    <Card shadow="never" class="main-card">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <DataLine />
          </Icon>
          <span class="header-title">历史数据查询</span>
        </div>
      </template>

      <Divider />

      <!-- 数据表格 -->
      <div v-loading="loading" class="table-section">
        <ElTable :data="paginatedData" border style="width: 100%" class="data-table">
          <TableColumn prop="plate" label="名称" width="140" />
          <TableColumn prop="date" label="日期" width="120" />
          <TableColumn label="交易形态" width="100">
            <template #default="{ row }">
              <TradingSignal
                :shape="{ shape: row.shape, color: row.shapeColor }"
                :signal="null"
                shape-label=""
              />
            </template>
          </TableColumn>
          <TableColumn label="交易信号" width="100">
            <template #default="{ row }">
              <TradingSignal
                :shape="null"
                :signal="{ signal: row.signal, color: row.signalColor }"
                signal-label=""
              />
            </template>
          </TableColumn>
          <TableColumn prop="jma" label="JMA" width="120">
            <template #default="{ row }">
              {{ row.jma.toFixed(2) }}
            </template>
          </TableColumn>
          <TableColumn prop="price" label="收盘价" width="120">
            <template #default="{ row }">
              {{ row.price.toFixed(2) }}
            </template>
          </TableColumn>
          <TableColumn prop="volumn" label="成交量">
            <template #default="{ row }">
              {{ row.volumn.toLocaleString() }}
            </template>
          </TableColumn>
        </ElTable>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <Pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="totalCount"
            layout="total, prev, pager, next, jumper"
            class="data-pagination"
          />
        </div>
      </div>
    </Card>
    <!-- 指数选择 -->
    <div class="search-section">
      <StockSelector
        v-model="selectedStockIndex"
        :stocks="stockList"
        title="选择指数"
        @stock-change="handleStockChange"
      />
    </div>
    <!-- 回测分析结果 -->
    <Card v-if="backtestResults.length > 0" shadow="never" class="backtest-card">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <TrendCharts />
          </Icon>
          <span class="header-title">量化交易策略回测分析</span>
        </div>
      </template>

      <!-- 策略汇总信息 -->
      <div class="backtest-summary">
        <ElRow :gutter="20">
          <ElCol :span="12">
            <div class="summary-item">
              <div class="summary-label">信号驱动策略最终资产</div>
              <div
                class="summary-value"
                :class="{
                  positive: signalStrategyResult.totalReturn >= 0,
                  negative: signalStrategyResult.totalReturn < 0,
                }"
              >
                ¥{{ signalStrategyResult.finalAsset.toLocaleString() }}
                <span class="return-rate"
                  >({{ signalStrategyResult.totalReturn >= 0 ? '+' : ''
                  }}{{ signalStrategyResult.totalReturn }}%)</span
                >
              </div>
            </div>
          </ElCol>
          <ElCol :span="12">
            <div class="summary-item">
              <div class="summary-label">持有策略最终资产</div>
              <div
                class="summary-value"
                :class="{
                  positive: holdStrategyResult.totalReturn >= 0,
                  negative: holdStrategyResult.totalReturn < 0,
                }"
              >
                ¥{{ holdStrategyResult.finalAsset.toLocaleString() }}
                <span class="return-rate"
                  >({{ holdStrategyResult.totalReturn >= 0 ? '+' : ''
                  }}{{ holdStrategyResult.totalReturn }}%)</span
                >
              </div>
            </div>
          </ElCol>
        </ElRow>
      </div>

      <Divider />

      <!-- 回测明细表格 -->
      <ElTable
        :data="backtestResults"
        border
        style="width: 100%"
        class="backtest-table"
        max-height="500"
      >
        <TableColumn prop="date" label="日期" width="120" />
        <TableColumn prop="price" label="收盘价" width="120">
          <template #default="{ row }">
            {{ row.price.toFixed(2) }}
          </template>
        </TableColumn>
        <TableColumn prop="signal" label="交易信号" width="100">
          <template #default="{ row }">
            <span :style="{ color: getSignalColor(row.signal) }">{{ row.signal }}</span>
          </template>
        </TableColumn>
        <TableColumn prop="signalAction" label="信号策略操作" width="120">
          <template #default="{ row }">
            <ElTag v-if="row.signalAction === '买入'" type="danger" size="small">买入</ElTag>
            <ElTag v-else-if="row.signalAction === '卖出'" type="success" size="small">卖出</ElTag>
            <span v-else>-</span>
          </template>
        </TableColumn>
        <TableColumn prop="signalStrategyAsset" label="信号驱动策略资产" width="160">
          <template #default="{ row }">
            {{
              row.signalStrategyAsset.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }}
          </template>
        </TableColumn>
        <TableColumn prop="holdAction" label="持有策略操作" width="120">
          <template #default="{ row }">
            <ElTag v-if="row.holdAction === '买入'" type="danger" size="small">买入</ElTag>
            <ElTag v-else-if="row.holdAction === '卖出'" type="success" size="small">卖出</ElTag>
            <span v-else>-</span>
          </template>
        </TableColumn>
        <TableColumn prop="holdStrategyAsset" label="持有策略资产" width="160">
          <template #default="{ row }">
            {{
              row.holdStrategyAsset.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }}
          </template>
        </TableColumn>
      </ElTable>
    </Card>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch } from 'vue'
  import { DataLine, TrendCharts } from '@element-plus/icons-vue'
  import { useStockData } from '@/composables/useStockData'
  import { calculateShape, calculateTradingSignal } from '@/utils'
  import calculateJMA from '@/signalModule'
  import TradingSignal from '@/components/TradingSignal.vue'
  import StockSelector from '@/components/StockSelector.vue'
  import {
    backtestSignalStrategy,
    backtestHoldStrategy,
    mergeBacktestResults,
  } from '@/utils/backtest'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()

  // 响应式数据
  const selectedStockIndex = ref(0)
  const currentPage = ref(1)
  const pageSize = 10

  // 计算属性
  const stockList = computed(() => stockData.value)
  const selectedPlate = computed(() => {
    if (stockData.value.length > 0 && selectedStockIndex.value >= 0) {
      return stockData.value[selectedStockIndex.value]?.plate || ''
    }
    return ''
  })

  // 表格数据
  const tableData = computed(() => {
    if (!selectedPlate.value) return []

    const stockDataItem = stockData.value.find(item => item.plate === selectedPlate.value)
    if (!stockDataItem || !stockDataItem.dateArr) return []

    // 计算JMA（使用全部价格数据）
    const priceArr = stockDataItem.priceArr
    const jmaArr = calculateJMA(priceArr)

    // 映射数据，显示所有数据（最近500天）
    const recent500Days = Math.min(500, stockDataItem.dateArr.length)
    const startIndex = stockDataItem.dateArr.length - recent500Days

    const result = stockDataItem.dateArr.slice(startIndex).map((date, sliceIndex) => {
      // sliceIndex 是在切片后的索引（0到199）
      // originalIndex 是在整个数组中的原始索引
      const originalIndex = startIndex + sliceIndex

      // 计算在JMA数组中的索引（与原始索引相同）
      const jmaIndex = originalIndex

      // 如果有足够的JMA数据计算形态（需要至少3天）
      let tradingShape = { shape: '-', color: '#999999' }
      if (jmaIndex >= 2 && jmaIndex < jmaArr.length) {
        const prevPrevJma = jmaArr[jmaIndex - 2]
        const prevJma = jmaArr[jmaIndex - 1]
        const currentJma = jmaArr[jmaIndex]
        tradingShape = calculateShape(prevPrevJma, prevJma, currentJma)
      }
      return {
        plate: stockDataItem.plate,
        date,
        price: stockDataItem.priceArr?.[originalIndex] || 0,
        volumn: stockDataItem.volumnArr?.[originalIndex] || 0,
        jma: jmaArr[jmaIndex] || 0,
        shape: tradingShape.shape,
        shapeColor: tradingShape.color,
      }
    })

    // 计算交易信号
    const resultWithSignal = calculateTradingSignal(result)

    return resultWithSignal.reverse()
  })

  // 分页数据
  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return tableData.value.slice(start, end)
  })

  // 总数据量
  const totalCount = computed(() => tableData.value.length)

  // 回测结果
  const backtestResults = ref([])
  const signalStrategyResult = ref({ finalAsset: 0, totalReturn: 0 })
  const holdStrategyResult = ref({ finalAsset: 0, totalReturn: 0 })

  // 执行回测分析
  const runBacktest = () => {
    if (tableData.value.length === 0) {
      backtestResults.value = []
      return
    }

    // 准备回测数据（按日期从旧到新排序）
    const backtestData = [...tableData.value]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        date: item.date,
        price: item.price,
        signal: item.signal,
      }))

    // 策略一：信号驱动策略
    const signalResult = backtestSignalStrategy(backtestData, 1000000)
    signalStrategyResult.value = {
      finalAsset: signalResult.finalAsset,
      totalReturn: signalResult.totalReturn,
    }

    // 策略二：持有策略
    const holdResult = backtestHoldStrategy(backtestData, 1000000)
    holdStrategyResult.value = {
      finalAsset: holdResult.finalAsset,
      totalReturn: holdResult.totalReturn,
    }

    // 合并结果用于表格展示
    backtestResults.value = mergeBacktestResults(signalResult.results, holdResult.results).reverse() // 倒序显示（最新日期在前）
  }

  // 获取信号颜色
  const getSignalColor = signal => {
    const colorMap = {
      买入: '#ff0000',
      持有: '#ffa500',
      卖出: '#00ff00',
      空仓: '#0000ff',
    }
    return colorMap[signal] || '#999999'
  }

  // 处理指数选择变化
  const handleStockChange = _index => {
    currentPage.value = 1
    // 指数变化时重新执行回测
    setTimeout(() => {
      runBacktest()
    }, 0)
  }

  // 监听指数变化
  watch(selectedPlate, () => {
    currentPage.value = 1
    runBacktest()
  })

  // 监听表格数据变化，重新执行回测
  watch(
    tableData,
    () => {
      runBacktest()
    },
    { deep: true },
  )

  // 初始化
  const initialize = async () => {
    await fetchStockData()
    if (stockData.value.length > 0) {
      selectedStockIndex.value = 0
    }
  }

  // 生命周期钩子
  onMounted(() => {
    initialize()
  })
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .basedata-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }

  .main-card,
  .backtest-card {
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 18px;
    font-weight: 600;
    color: #007aff;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .header-icon {
    font-size: 22px;
  }

  .header-title {
    font-weight: 700;
  }

  .search-section {
    margin-bottom: 16px;
  }

  /* StockSelector组件样式调整 */
  :deep(.stock-selector) {
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  :deep(.selector-header) {
    border-bottom: 1px solid #e0e0e0;
  }

  :deep(.selector-title) {
    color: #007aff;
    font-weight: 600;
  }

  :deep(.stock-item) {
    border-radius: 0;
    border: 1px solid #e0e0e0;
    transition: all 0.2s ease;

    &:hover {
      border-color: #007aff;
      color: #007aff;
    }

    &.active {
      background-color: #007aff;
      border-color: #007aff;
      color: white;
    }
  }

  .table-section {
    min-height: 400px;
    padding: 16px;
  }

  .data-table,
  .backtest-table {
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

    :deep(.el-table__header th) {
      background-color: #f5f5f5;
      font-weight: 600;
      border-bottom: 1px solid #e0e0e0;
      padding: 10px 12px;
    }

    :deep(.el-table__row:hover) {
      background-color: #f8f8f8;
    }

    :deep(.el-table__cell) {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    padding: 12px 16px;
    border-top: 1px solid #e0e0e0;
  }

  .data-pagination {
    :deep(.el-pagination__item) {
      border-radius: 0;
    }
  }

  // 回测分析样式
  .backtest-summary {
    margin-bottom: 16px;
    padding: 16px;
    background-color: #f9f9f9;
    border: 1px solid #e0e0e0;
  }

  .summary-item {
    text-align: center;
    padding: 16px;
    background-color: white;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .summary-label {
    font-size: 14px;
    color: #666666;
    margin-bottom: 8px;
  }

  .summary-value {
    font-size: 18px;
    font-weight: 700;

    &.positive {
      color: #ff3b30;
    }

    &.negative {
      color: #34c759;
    }
  }

  .return-rate {
    font-size: 14px;
    margin-left: 8px;
  }

  // 响应式调整
  @media (max-width: 768px) {
    .basedata-container {
      padding: 8px;
    }

    .search-section {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .backtest-summary {
      .el-row {
        flex-direction: column;
        gap: 12px;
      }
    }

    .summary-item {
      margin-bottom: 8px;
    }

    .table-section {
      padding: 8px;
    }
  }
</style>
