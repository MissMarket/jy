<template>
  <div class="basedata-container">
    <Card shadow="never" class="main-card">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <DataLine />
          </Icon>
          <span class="header-title">历史数据查询</span>
        </div>
      </template>

      <!-- 指数选择 -->
      <div class="search-section">
        <div class="search-label">选择指数:</div>
        <RadioGroup v-model="selectedPlate" :disabled="loading" class="plate-radio-group">
          <RadioButton
            v-for="stock in stockList"
            :key="stock.plate"
            :label="stock.plate"
            class="plate-radio"
          >
            {{ stock.plate }}
          </RadioButton>
        </RadioGroup>
      </div>

      <Divider />

      <!-- 数据表格 -->
      <div v-loading="loading" class="table-section">
        <ElTable :data="paginatedData" border style="width: 100%" class="data-table">
          <TableColumn prop="plate" label="名称" width="150" />
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
  import { ref, computed, onMounted, watch } from 'vue'
  import { DataLine } from '@element-plus/icons-vue'
  import { useStockData } from '@/composables/useStockData'
  import { calculateShape, calculateTradingSignal } from '@/utils'
  import calculateJMA from '@/signalModule'
  import TradingSignal from '@/components/TradingSignal.vue'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()

  // 响应式数据
  const selectedPlate = ref('')
  const currentPage = ref(1)
  const pageSize = 10

  // 计算属性
  const stockList = computed(() => stockData.value)

  // 表格数据
  const tableData = computed(() => {
    if (!selectedPlate.value) return []

    const stockDataItem = stockData.value.find(item => item.plate === selectedPlate.value)
    if (!stockDataItem || !stockDataItem.dateArr) return []

    // 计算JMA（使用全部价格数据）
    const priceArr = stockDataItem.priceArr
    const jmaArr = calculateJMA(priceArr)

    // 映射数据，显示所有数据（最近200天）
    const recent200Days = Math.min(200, stockDataItem.dateArr.length)
    const startIndex = stockDataItem.dateArr.length - recent200Days

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

  // 处理指数选择变化
  const handlePlateChange = () => {
    currentPage.value = 1
  }

  // 监听指数变化
  watch(selectedPlate, handlePlateChange)

  // 初始化
  const initialize = async () => {
    await fetchStockData()
    if (stockData.value.length > 0) {
      selectedPlate.value = stockData.value[0].plate
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
  }

  .main-card {
    border-radius: $border-radius-lg;
    box-shadow: $shadow-md;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $primary-color;
  }

  .header-icon {
    font-size: 24px;
  }

  .header-title {
    font-weight: $font-weight-bold;
  }

  .search-section {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .search-label {
    font-weight: $font-weight-medium;
    color: $text-primary;
    white-space: nowrap;
    margin-top: 4px;
  }

  .plate-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .plate-radio {
    margin-right: $spacing-md;
    margin-bottom: $spacing-sm;

    :deep(.el-radio-button__inner) {
      border-radius: $border-radius-md;
      padding: $spacing-sm $spacing-md;
      font-size: $font-size-sm;
      transition: all $transition-fast;

      &:hover {
        border-color: $primary-color;
        color: $primary-color;
      }
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      background-color: $primary-color;
      border-color: $primary-color;
      color: $text-light;
    }
  }

  .table-section {
    min-height: 400px;
  }

  .data-table {
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;

    :deep(.el-table__header th) {
      background-color: $bg-tertiary;
      font-weight: $font-weight-semibold;
    }

    :deep(.el-table__row:hover) {
      background-color: $bg-accent;
    }

    :deep(.el-table__cell) {
      padding: $spacing-sm $spacing-md;
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .data-pagination {
    border-radius: $border-radius-md;
  }

  // 响应式调整
  @media (max-width: $breakpoint-tablet) {
    .basedata-container {
      padding: 0 16px;
    }

    .search-section {
      flex-direction: column;
      align-items: flex-start;
      gap: $spacing-sm;
    }
  }
</style>
