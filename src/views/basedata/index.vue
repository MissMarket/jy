<template>
  <div class="basedata-container">
    <ElCard class="main-card" shadow="never">
      <!-- 渐变标题栏 -->
      <template #header>
        <div class="page-header">
          <div class="header-left">
            <ElIcon :size="22" class="header-icon"><DataLine /></ElIcon>
            <span class="header-title">历史数据查询</span>
          </div>
          <div class="header-right">
            <div v-if="backtestResults.length > 0" class="header-summary">
              <div class="header-summary-item">
                <span class="header-summary-label">信号驱动</span>
                <span class="header-summary-value"
                  >¥{{ signalStrategyResult.finalAsset.toLocaleString() }}</span
                >
                <span
                  class="header-summary-return"
                  :class="signalStrategyResult.totalReturn >= 0 ? 'up' : 'down'"
                  >({{ signalStrategyResult.totalReturn >= 0 ? '+' : ''
                  }}{{ signalStrategyResult.totalReturn }}%)</span
                >
              </div>
              <span class="header-summary-divider" />
              <div class="header-summary-item">
                <span class="header-summary-label">持有策略</span>
                <span class="header-summary-value"
                  >¥{{ holdStrategyResult.finalAsset.toLocaleString() }}</span
                >
                <span
                  class="header-summary-return"
                  :class="holdStrategyResult.totalReturn >= 0 ? 'up' : 'down'"
                  >({{ holdStrategyResult.totalReturn >= 0 ? '+' : ''
                  }}{{ holdStrategyResult.totalReturn }}%)</span
                >
              </div>
            </div>
          </div>
        </div>
      </template>

      <div class="card-body-wrapper">
        <!-- 指数选择 -->
        <div class="selector-section">
          <StockSelector
            v-model="selectedStockIndex"
            :stocks="stockList"
            title="选择指数"
            @stock-change="handleStockChange"
          />
        </div>

        <!-- 折线图 -->
        <div class="chart-section">
          <div class="chart-toolbar">
            <span class="chart-label">日期范围</span>
            <ElDatePicker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :disabled-date="disabledDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              size="small"
              @change="handleDateRangeChange"
            />
            <ElButton size="small" class="range-btn" @click="random60Days">随机60日</ElButton>
            <ElButton size="small" class="range-btn" @click="random120Days">随机120日</ElButton>
            <ElButton size="small" class="range-btn" @click="random240Days">随机240日</ElButton>
          </div>
          <div ref="chartRef" v-loading="chartLoading" class="chart-container" />
        </div>

        <!-- 量化交易策略回测分析 -->
        <div v-if="backtestResults.length > 0" class="backtest-section">
          <div class="section-header">
            <ElIcon :size="16"><TrendCharts /></ElIcon>
            <span>量化交易策略回测分析</span>
          </div>

          <div class="table-wrapper">
            <ElTable
              :data="paginatedBacktest"
              border
              height="100%"
              style="width: 100%"
              class="data-table"
              size="small"
            >
              <ElTableColumn prop="date" label="日期" align="center" />
              <ElTableColumn prop="price" label="收盘价" align="center">
                <template #default="{ row }">
                  <span class="mono-num">{{ row.price.toFixed(2) }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="signal" label="交易信号" align="center">
                <template #default="{ row }">
                  <span :style="{ color: getSignalColor(row.signal) }" class="signal-text">{{
                    row.signal
                  }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="signalAction" label="信号操作" align="center">
                <template #default="{ row }">
                  <span v-if="row.signalAction === '买入'" class="trade-label buy">买入</span>
                  <span v-else-if="row.signalAction === '卖出'" class="trade-label sell">卖出</span>
                  <span v-else class="trade-label none">-</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="signalStrategyAsset" label="信号策略资产" align="center">
                <template #default="{ row }">
                  <span class="mono-num">{{
                    row.signalStrategyAsset.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="holdAction" label="持有操作" align="center">
                <template #default="{ row }">
                  <span v-if="row.holdAction === '买入'" class="trade-label buy">买入</span>
                  <span v-else-if="row.holdAction === '卖出'" class="trade-label sell">卖出</span>
                  <span v-else class="trade-label none">-</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="holdStrategyAsset" label="持有策略资产" align="center">
                <template #default="{ row }">
                  <span class="mono-num">{{
                    row.holdStrategyAsset.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>

          <div class="pagination-bar">
            <ElPagination
              v-model:current-page="btPage"
              :page-size="btPageSize"
              :total="backtestResults.length"
              layout="total, prev, pager, next"
              small
              background
            />
          </div>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
  import { DataLine, TrendCharts } from '@element-plus/icons-vue'
  import { useStockData } from '@/composables/useStockData'
  import { calculateShape, calculateTradingSignal } from '@/utils'
  import calculateJMA from '@/signalModule'
  import StockSelector from '@/components/StockSelector.vue'
  import {
    backtestSignalStrategy,
    backtestHoldStrategy,
    mergeBacktestResults,
  } from '@/utils/backtest'
  import * as echarts from 'echarts'
  import dayjs from 'dayjs'

  // 组合式函数
  const { stockData, fetchStockData } = useStockData()

  // 响应式数据
  const selectedStockIndex = ref(0)
  const currentPage = ref(1)

  // 回测表格分页
  const btPage = ref(1)
  const btPageSize = 10

  // ECharts 相关
  const chartRef = ref(null)
  const chartInstance = ref(null)
  const chartLoading = ref(false)
  const dateRange = ref([])
  const minDate = ref(null)
  const maxDate = ref(null)

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

  // 回测表格分页数据
  const paginatedBacktest = computed(() => {
    const start = (btPage.value - 1) * btPageSize
    const end = start + btPageSize
    return backtestResults.value.slice(start, end)
  })

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

  // 日期范围选择器禁用日期
  const disabledDate = time => {
    if (!minDate.value || !maxDate.value) return false

    const selectedTime = dayjs(time).format('YYYY-MM-DD')
    const min = dayjs(minDate.value).format('YYYY-MM-DD')
    const max = dayjs(maxDate.value).format('YYYY-MM-DD')

    return selectedTime < min || selectedTime > max
  }

  // 处理日期范围变化
  const handleDateRangeChange = () => {
    updateChart()
  }

  // 随机获取60日连续的交易数据
  const random60Days = () => {
    if (!selectedPlate.value) return

    const stockDataItem = stockData.value.find(item => item.plate === selectedPlate.value)
    if (!stockDataItem || !stockDataItem.dateArr || stockDataItem.dateArr.length < 60) return

    // 计算可选择的开始索引范围
    const maxStartIndex = stockDataItem.dateArr.length - 60
    const randomStartIndex = Math.floor(Math.random() * (maxStartIndex + 1))
    const randomEndIndex = randomStartIndex + 60 - 1

    // 获取对应的日期
    const startDate = stockDataItem.dateArr[randomStartIndex]
    const endDate = stockDataItem.dateArr[randomEndIndex]

    // 更新日期范围
    dateRange.value = [startDate, endDate]

    // 触发图表更新
    updateChart()
  }

  // 随机获取120日连续的交易数据
  const random120Days = () => {
    if (!selectedPlate.value) return

    const stockDataItem = stockData.value.find(item => item.plate === selectedPlate.value)
    if (!stockDataItem || !stockDataItem.dateArr || stockDataItem.dateArr.length < 120) return

    // 计算可选择的开始索引范围
    const maxStartIndex = stockDataItem.dateArr.length - 120
    const randomStartIndex = Math.floor(Math.random() * (maxStartIndex + 1))
    const randomEndIndex = randomStartIndex + 120 - 1

    // 获取对应的日期
    const startDate = stockDataItem.dateArr[randomStartIndex]
    const endDate = stockDataItem.dateArr[randomEndIndex]

    // 更新日期范围
    dateRange.value = [startDate, endDate]

    // 触发图表更新
    updateChart()
  }

  // 随机获取240日连续的交易数据
  const random240Days = () => {
    if (!selectedPlate.value) return

    const stockDataItem = stockData.value.find(item => item.plate === selectedPlate.value)
    if (!stockDataItem || !stockDataItem.dateArr || stockDataItem.dateArr.length < 240) return

    // 计算可选择的开始索引范围
    const maxStartIndex = stockDataItem.dateArr.length - 240
    const randomStartIndex = Math.floor(Math.random() * (maxStartIndex + 1))
    const randomEndIndex = randomStartIndex + 240 - 1

    // 获取对应的日期
    const startDate = stockDataItem.dateArr[randomStartIndex]
    const endDate = stockDataItem.dateArr[randomEndIndex]

    // 更新日期范围
    dateRange.value = [startDate, endDate]

    // 触发图表更新
    updateChart()
  }

  // 初始化 ECharts
  const initChart = () => {
    if (chartRef.value && !chartInstance.value) {
      chartInstance.value = echarts.init(chartRef.value)

      // 响应式调整
      window.addEventListener('resize', handleResize)
    }
  }

  // 销毁 ECharts
  const destroyChart = () => {
    if (chartInstance.value) {
      chartInstance.value.dispose()
      chartInstance.value = null
      window.removeEventListener('resize', handleResize)
    }
  }

  // 响应式调整
  const handleResize = () => {
    if (chartInstance.value) {
      chartInstance.value.resize()
    }
  }

  // 更新图表数据
  const updateChart = async () => {
    if (!chartInstance.value || tableData.value.length === 0) return

    chartLoading.value = true

    try {
      // 准备数据
      const sortedData = [...tableData.value].sort((a, b) => new Date(a.date) - new Date(b.date))

      // 过滤日期范围
      let filteredData = sortedData
      if (dateRange.value && dateRange.value.length === 2) {
        const [startDate, endDate] = dateRange.value
        if (startDate && endDate) {
          filteredData = sortedData.filter(item => {
            const itemDate = dayjs(item.date).format('YYYY-MM-DD')
            return itemDate >= startDate && itemDate <= endDate
          })
        }
      }

      // 提取数据
      const dates = filteredData.map(item => item.date)
      const jmaValues = filteredData.map(item => item.jma)
      const priceValues = filteredData.map(item => item.price)

      // 提取高低点数据并统计数量
      let highPoints = []
      let lowPoints = []
      let highLowCount = 0

      filteredData.forEach((item, index) => {
        if (item.shape === '高点') {
          highPoints.push({
            name: '高点',
            xAxis: index,
            yAxis: item.jma,
            itemStyle: { color: '#ff0000' },
          })
          highLowCount++
        } else if (item.shape === '低点') {
          lowPoints.push({
            name: '低点',
            xAxis: index,
            yAxis: item.jma,
            itemStyle: { color: '#00ff00' },
          })
          highLowCount++
        }
      })

      // 合并高低点
      const markPoints = [...highPoints, ...lowPoints]

      // 计算最大值和最小值（基于已选择的数据）
      const allValues = [...jmaValues, ...priceValues]
      let maxValue = Math.max(...allValues)
      let minValue = Math.min(...allValues)

      // 图表配置
      const option = {
        title: {
          text: `${selectedPlate.value} JMA走势（高低点: ${highLowCount}个）`,
          left: 'center',
          textStyle: {
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          trigger: 'axis',
          formatter: function (params) {
            let result = `${params[0].axisValue}<br/>`
            params.forEach(item => {
              result += `${item.marker} ${item.seriesName}: ${item.value.toFixed(2)}<br/>`
            })
            result += `<br/>最大值: ${maxValue.toFixed(2)}<br/>最小值: ${minValue.toFixed(2)}`
            return result
          },
        },
        legend: {
          data: ['JMA', '收盘价'],
          top: 30,
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: dates,
          axisLabel: {
            rotate: 45,
            fontSize: 10,
          },
        },
        yAxis: {
          type: 'value',
          min: minValue,
          max: maxValue,
          axisLabel: {
            formatter: '{value}',
          },
        },
        graphic: [
          {
            type: 'text',
            left: 'right',
            top: 'top',
            style: {
              text: `最大值: ${maxValue.toFixed(2)}\n最小值: ${minValue.toFixed(2)}\n高低点: ${highLowCount}个`,
              fontSize: 12,
              fontWeight: 'bold',
              fill: '#333',
            },
          },
        ],
        series: [
          {
            name: 'JMA',
            type: 'line',
            data: jmaValues,
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#5470c6',
              width: 2,
            },
            markPoint: {
              data: markPoints,
              symbolSize: 5,
              symbol: 'circle',
              label: {
                show: false,
              },
            },
          },
          {
            name: '收盘价',
            type: 'line',
            data: priceValues,
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#91cc75',
              width: 2,
              type: 'dashed',
            },
          },
        ],
      }

      // 设置配置
      chartInstance.value.setOption(option)
    } catch (error) {
      console.error('图表更新失败:', error)
    } finally {
      chartLoading.value = false
    }
  }

  // 处理指数选择变化
  const handleStockChange = _index => {
    currentPage.value = 1
    // 指数变化时重新执行回测和更新图表
    setTimeout(() => {
      runBacktest()
      nextTick(() => {
        updateChart()
      })
    }, 0)
  }

  // 监听指数变化
  watch(selectedPlate, () => {
    currentPage.value = 1
    runBacktest()
    nextTick(() => {
      initChart()
      updateChart()
    })
  })

  // 监听表格数据变化，重新执行回测和更新图表
  watch(
    tableData,
    newData => {
      // 更新日期范围
      if (newData.length > 0) {
        const sortedData = [...newData].sort((a, b) => new Date(a.date) - new Date(b.date))
        minDate.value = sortedData[0].date
        maxDate.value = sortedData[sortedData.length - 1].date
      }
      runBacktest()
      nextTick(() => {
        initChart()
        updateChart()
      })
    },
    { deep: true },
  )

  // 初始化
  const initialize = async () => {
    await fetchStockData()
    if (stockData.value.length > 0) {
      selectedStockIndex.value = 0
      nextTick(() => {
        initChart()
        updateChart()
      })
    }
  }

  // 生命周期钩子
  onMounted(() => {
    initialize()
  })

  onUnmounted(() => {
    destroyChart()
  })
</script>

<style scoped lang="scss">
  @use '@/styles/variables.scss' as *;

  // ==============================
  // 容器 - 与 home 一致
  // ==============================
  .basedata-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  // ==============================
  // 主卡片 - flex 撑满
  // ==============================
  .main-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: none;
    border-radius: 0;
    background-color: $bg-secondary;

    :deep(.el-card__body) {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: $spacing-lg 0;
    }
  }

  // ==============================
  // 页面标题 - 渐变色
  // ==============================
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-md $spacing-lg;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: $text-light;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .header-icon {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  }

  .header-title {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    letter-spacing: 1px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .header-right {
    display: flex;
    align-items: center;
  }

  .header-summary {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .header-summary-item {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
  }

  .header-summary-label {
    opacity: 0.7;
    white-space: nowrap;
  }

  .header-summary-value {
    font-weight: $font-weight-semibold;
    font-feature-settings: 'tnum';
  }

  .header-summary-return {
    font-weight: $font-weight-semibold;
    font-feature-settings: 'tnum';

    &.up {
      color: #a8ff78;
    }

    &.down {
      color: #ffb3b3;
    }
  }

  .header-summary-divider {
    width: 1px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  // ==============================
  // 主体内容 - flex column
  // ==============================
  .card-body-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow-y: auto;
  }

  // ==============================
  // 指数选择器
  // ==============================
  .selector-section {
    flex-shrink: 0;
  }

  // ==============================
  // 折线图区域
  // ==============================
  .chart-section {
    flex-shrink: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    overflow: hidden;
    background-color: $bg-secondary;
    box-shadow: $shadow-sm;
    margin: 0 $spacing-lg;
  }

  .chart-toolbar {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    background-color: $bg-tertiary;
    border-bottom: 1px solid $border-color;
    flex-wrap: wrap;
  }

  .chart-label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $text-tertiary;
    white-space: nowrap;
  }

  .range-btn {
    border-radius: $border-radius-md;
    font-size: $font-size-xs;
  }

  .chart-container {
    width: 100%;
    height: 305px;
    min-height: 305px;
  }

  // ==============================
  // 回测分析 - 占满剩余
  // ==============================
  .backtest-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    overflow: hidden;
    background-color: $bg-secondary;
    box-shadow: $shadow-sm;
    margin: 0 $spacing-lg;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    background-color: $bg-tertiary;
    border-bottom: 1px solid $border-color;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    flex-shrink: 0;
  }

  .table-wrapper {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  // ==============================
  // 表格样式 - 匹配 home 页
  // ==============================
  .data-table {
    border: none;
    border-radius: 0;

    :deep(.el-table__header-wrapper) {
      border-radius: 0;
    }

    :deep(.el-table__header th) {
      background-color: rgba($primary-color, 0.06) !important;
      color: $text-primary;
      font-weight: $font-weight-semibold;
      font-size: $font-size-xs;
      padding: 6px 8px;
      border-bottom: 2px solid $primary-color;
    }

    :deep(.el-table__body tr) {
      transition: background-color $transition-fast;
    }

    :deep(.el-table__body tr:hover) {
      background-color: rgba($primary-color, 0.03) !important;
    }

    :deep(.el-table__body tr.current-row) {
      background-color: rgba($primary-color, 0.06) !important;
    }

    :deep(.el-table__body td) {
      padding: 6px 8px;
      border-bottom: 1px solid $border-color;
      font-size: $font-size-xs;
    }

    // 斑马纹
    :deep(.el-table__body tr.el-table__row--striped) {
      background-color: rgba($bg-tertiary, 0.5);
    }

    // 隐藏表格内部滚动条
    :deep(.el-table__body-wrapper) {
      &::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
    }
  }

  // ==============================
  // 交易类型标签
  // ==============================
  .trade-label {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.buy {
      color: $danger-color;
      background-color: rgba($danger-color, 0.08);
    }

    &.sell {
      color: $success-color;
      background-color: rgba($success-color, 0.08);
    }

    &.none {
      color: $text-tertiary;
    }
  }

  .signal-text {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
  }

  // 等宽数字
  .mono-num {
    font-feature-settings: 'tnum';
    font-variant-numeric: tabular-nums;
  }

  // ==============================
  // 分页栏
  // ==============================
  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: $spacing-sm $spacing-md;
    border-top: 1px solid $border-color;
    background-color: $bg-tertiary;
    flex-shrink: 0;

    :deep(.el-pagination) {
      font-weight: $font-weight-normal;

      .el-pagination__total {
        color: $text-tertiary;
        font-size: $font-size-xs;
      }

      .el-pagination button {
        border-radius: $border-radius-sm;
      }

      .el-pager li {
        border-radius: $border-radius-sm;
        font-size: $font-size-xs;
        min-width: 28px;
        height: 28px;
        line-height: 28px;
      }

      .el-pager li.is-active {
        background: linear-gradient(135deg, $primary-color, #e55a5a);
        border: none;
        color: $text-light;
      }
    }
  }

  // ==============================
  // 响应式
  // ==============================
  @media (max-width: $breakpoint-mobile) {
    .main-card :deep(.el-card__body) {
      padding: $spacing-md 0;
    }

    .card-body-wrapper {
      padding: 0 $spacing-md;
    }

    .page-header {
      padding: $spacing-sm $spacing-md;
      flex-wrap: wrap;
      gap: $spacing-sm;
    }

    .header-title {
      font-size: $font-size-base;
    }

    .backtest-section {
      margin: 0 $spacing-md;
    }

    .chart-section {
      margin: 0 $spacing-md;
    }

    .chart-container {
      height: 140px;
    }
  }
</style>
