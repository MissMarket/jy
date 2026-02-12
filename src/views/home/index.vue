<template>
  <div class="backtest-container">
    <Card shadow="never" class="main-card">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <Histogram />
          </Icon>
          <span class="header-title">交易策略回测系统</span>
        </div>
      </template>

      <Card v-if="loading" style="margin-top: 20px" class="loading-card">
        <Skeleton :rows="5" animated />
      </Card>

      <Space v-else direction="vertical" style="width: 100%" :size="20">
        <!-- 股票选择器 -->
        <StockSelector
          v-model="selectedStockIndex"
          :stocks="stocks"
          title="选择股票"
          @stock-change="handleStockChange"
        />

        <!-- 策略对比 -->
        <Card class="comparison-card">
          <template #header>
            <div class="card-header">
              <span>策略对比 - {{ currentStock?.plate }}</span>
            </div>
          </template>
          <Alert
            :title="backtestResult.comparison?.comparison"
            :type="backtestResult.comparison?.winner === '交易策略' ? 'success' : 'warning'"
            :closable="false"
            show-icon
            class="comparison-alert"
          />
        </Card>

        <!-- 策略结果 -->
        <Row :gutter="20">
          <ElCol :span="12">
            <StrategyResult
              :strategy="backtestResult.strategy"
              :hold="null"
              :comparison="null"
              strategy-title="交易策略（JMA信号）"
            />

            <!-- 交易明细 -->
            <Card v-if="backtestResult.strategy" class="trades-card">
              <template #header>
                <div class="card-header">
                  <span>交易明细</span>
                </div>
              </template>
              <ElTable
                :data="backtestResult.strategy?.trades || []"
                border
                stripe
                max-height="400"
                style="width: 100%"
                class="trades-table"
              >
                <TableColumn prop="type" label="操作" width="100" />
                <TableColumn prop="day" label="交易日" width="100" />
                <TableColumn prop="price" label="价格" width="100" />
                <TableColumn prop="shares" label="股数" width="100" />
                <TableColumn label="金额" width="120">
                  <template #default="{ row }">
                    {{ row.cost || row.proceeds || '-' }}
                  </template>
                </TableColumn>
                <TableColumn prop="cash" label="现金" width="120" />
                <TableColumn prop="position" label="持仓" width="100" />
                <TableColumn prop="signal" label="信号" />
              </ElTable>
            </Card>
          </ElCol>

          <ElCol :span="12">
            <StrategyResult
              :strategy="null"
              :hold="backtestResult.hold"
              :comparison="null"
              hold-title="买入持有策略"
            />
          </ElCol>
        </Row>
      </Space>
    </Card>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { Histogram } from '@element-plus/icons-vue'
  import StockSelector from '@/components/StockSelector.vue'
  import StrategyResult from '@/components/StrategyResult.vue'
  import { useStockData } from '@/composables/useStockData'
  import { useStrategy } from '@/composables/useStrategy'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()
  const { backtestResult, runBacktest } = useStrategy()

  // 响应式数据
  const selectedStockIndex = ref(1)

  // 计算属性
  const stocks = computed(() => stockData.value)
  const currentStock = computed(() => {
    return stockData.value[selectedStockIndex.value] || {}
  })

  // 处理股票选择变化
  const handleStockChange = index => {
    selectedStockIndex.value = index
    const stock = stockData.value[index]
    if (stock) {
      runBacktest(stock)
    }
  }

  // 初始化
  const initialize = async () => {
    await fetchStockData()
    if (stockData.value.length > 0) {
      const stock = stockData.value[selectedStockIndex.value]
      if (stock) {
        runBacktest(stock)
      }
    }
  }

  // 生命周期钩子
  onMounted(() => {
    initialize()
  })
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .backtest-container {
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

  .loading-card {
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;
  }

  .comparison-card {
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;
  }

  .comparison-alert {
    border-radius: $border-radius-sm;
  }

  .trades-card {
    margin-top: 20px;
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;
  }

  .trades-table {
    border-radius: $border-radius-sm;

    :deep(.el-table__header th) {
      background-color: $bg-tertiary;
      font-weight: $font-weight-semibold;
    }

    :deep(.el-table__row:hover) {
      background-color: $bg-accent;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  // 响应式调整
  @media (max-width: $breakpoint-tablet) {
    .backtest-container {
      padding: 0 16px;
    }
  }
</style>
