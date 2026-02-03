<script setup>
  import { ref, computed, onMounted, watch } from 'vue'
  import { getStockHistoricalData } from '@/dataModule'
  import calculateJMA from '@/signalModule'

  const loading = ref(true)
  const stockList = ref([])
  const selectedPlate = ref('')
  const currentPage = ref(1)
  const pageSize = 10

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
      return { signal: '持有', color: '#ffa500' }
    } else if (a > b && b > c) {
      return { signal: '空仓', color: '#0000ff' }
    } else {
      return { signal: '观望', color: '#999999' }
    }
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
      let signal = { signal: '-', color: '#999999' }

      // 计算在JMA数组中的索引（与原始索引相同）
      const jmaIndex = originalIndex

      // 如果有足够的JMA数据计算信号（需要至少3天）
      if (jmaIndex >= 2 && jmaIndex < jmaArr.length) {
        const a = jmaArr[jmaIndex - 2]
        const b = jmaArr[jmaIndex - 1]
        const c = jmaArr[jmaIndex]
        signal = calculateSignal(a, b, c)
      }

      return {
        plate: stockData.plate,
        date,
        price: stockData.priceArr?.[originalIndex] || 0,
        volumn: stockData.volumnArr?.[originalIndex] || 0,
        jma: jmaArr[jmaIndex] || 0,
        signal: signal.signal,
        signalColor: signal.color,
      }
    })

    return result.reverse()
  })

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
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
