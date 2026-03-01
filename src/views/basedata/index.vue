<template>
  <div class="basedata-container">
    <!-- 指数选择 -->
    <div class="search-section">
      <StockSelector
        v-model="selectedStockIndex"
        :stocks="stockList"
        title="选择指数"
        @stock-change="handleStockChange"
      />
    </div>

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

      <!-- 图表区域 -->
      <div class="chart-section">
        <!-- 日期范围选择器 -->
        <div class="date-range-selector">
          <span class="selector-label">日期范围：</span>
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
          <ElButton size="small" type="primary" style="margin-left: 10px" @click="random60Days">
            随机60日
          </ElButton>
          <ElButton size="small" type="primary" style="margin-left: 10px" @click="random120Days">
            随机120日
          </ElButton>
          <ElButton size="small" type="primary" style="margin-left: 10px" @click="random240Days">
            随机240日
          </ElButton>
        </div>

        <!-- ECharts 图表容器 -->
        <div ref="chartRef" v-loading="chartLoading" class="chart-container" />
      </div>

      <Divider />
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
              <ElTag v-else-if="row.signalAction === '卖出'" type="success" size="small">
                卖出
              </ElTag>
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
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
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
  import * as echarts from 'echarts'
  import dayjs from 'dayjs'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()

  // 响应式数据
  const selectedStockIndex = ref(0)
  const currentPage = ref(1)
  const pageSize = 10

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

  /* 图表区域样式 */
  .chart-section {
    padding: 16px;
    margin-bottom: 20px;
    background-color: #f9f9f9;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }

  .date-range-selector {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    gap: 12px;
  }

  .selector-label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
  }

  .chart-container {
    width: 100%;
    height: 400px;
    min-height: 300px;
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

    .chart-section {
      padding: 12px;
    }

    .date-range-selector {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .chart-container {
      height: 300px;
      min-height: 250px;
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
