<script setup>
  import { ref, computed, onMounted, watch } from 'vue'
  import { getStockHistoricalData } from '@/dataModule'
  import calculateJMA from '@/signalModule'
  import dayjs from 'dayjs'

  const loading = ref(true)
  const stockList = ref([])
  const selectedPlate = ref('')
  const currentPage = ref(1)
  const pageSize = 10

  /**
   * 计算交易形态
   * @param {number} prevPrevJma - 前天JMA
   * @param {number} prevJma - 昨天JMA
   * @param {number} currentJma - 今天JMA
   * @returns {Object} { shape: 形态文本, color: 颜色值 }
   */
  const calculateShape = (prevPrevJma, prevJma, currentJma) => {
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

  // 交易信号颜色映射
  const signalColorMap = {
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
  const calculateTradingSignal = data => {
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
        // 其他情况保持卖出状态？根据需求，应该继续判断
      }

      item.signal = s
      item.signalColor = signalColorMap[s]
    })

    return sortedData
  }

  const tableData = computed(() => {
    if (!selectedPlate.value) return []

    const stockData = stockList.value.find(item => item.plate === selectedPlate.value)
    if (!stockData || !stockData.dateArr) return []

    // 计算JMA（使用全部价格数据）
    const priceArr = stockData.priceArr
    const jmaArr = calculateJMA(priceArr)

    // 映射数据，显示所有数据（最近200天）
    const recent200Days = Math.min(200, stockData.dateArr.length)
    const startIndex = stockData.dateArr.length - recent200Days

    const result = stockData.dateArr.slice(startIndex).map((date, sliceIndex) => {
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
        plate: stockData.plate,
        date,
        price: stockData.priceArr?.[originalIndex] || 0,
        volumn: stockData.volumnArr?.[originalIndex] || 0,
        jma: jmaArr[jmaIndex] || 0,
        shape: tradingShape.shape,
        shapeColor: tradingShape.color,
      }
    })

    // 计算交易信号
    const resultWithSignal = calculateTradingSignal(result)

    return resultWithSignal.reverse()
  })

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    console.log('paginatedData', tableData.value)
    return tableData.value.slice(start, end)
  })

  const totalCount = computed(() => tableData.value.length)

  const fetchData = async () => {
    loading.value = true
    try {
      const result = await getStockHistoricalData()
      stockList.value = result
      if (result.length > 0) {
        selectedPlate.value = result[0].plate
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      loading.value = false
    }
  }

  const handlePlateChange = () => {
    currentPage.value = 1
  }

  watch(selectedPlate, handlePlateChange)

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <div class="basedata-container">
    <Card shadow="never">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <DataLine />
          </Icon>
          <span class="header-title">历史数据查询</span>
        </div>
      </template>

      <div class="search-section">
        <div class="search-label">选择指数:</div>
        <RadioGroup v-model="selectedPlate" :disabled="loading">
          <RadioButton v-for="stock in stockList" :key="stock.plate" :label="stock.plate">
            {{ stock.plate }}
          </RadioButton>
        </RadioGroup>
      </div>

      <Divider />

      <div v-loading="loading" class="table-section">
        <ElTable :data="paginatedData" border style="width: 100%">
          <TableColumn prop="plate" label="名称" width="150" />
          <TableColumn prop="date" label="日期" width="120" />
          <TableColumn label="交易形态" width="100">
            <template #default="{ row }">
              <span :style="{ color: row.shapeColor, fontWeight: 'bold' }">
                {{ row.shape }}
              </span>
            </template>
          </TableColumn>
          <TableColumn label="交易信号" width="100">
            <template #default="{ row }">
              <span :style="{ color: row.signalColor, fontWeight: 'bold' }">
                {{ row.signal }}
              </span>
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

        <div class="pagination-wrapper">
          <Pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="totalCount"
            layout="total, prev, pager, next, jumper"
          />
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
  .basedata-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 500;
    color: #1890ff;
  }

  .header-icon {
    font-size: 20px;
  }

  .header-title {
    font-weight: 600;
  }

  .search-section {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 10px;
  }

  .search-label {
    font-weight: 500;
    color: #333;
    white-space: nowrap;
  }

  .table-section {
    min-height: 400px;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
</style>
