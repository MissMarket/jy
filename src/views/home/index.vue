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

      <div v-if="loading" class="loading-section">
        <div class="loading-spinner" />
        <p class="loading-text">正在加载数据...</p>
      </div>

      <div v-else class="content-section">
        <!-- 股票选择器 -->
        <div class="selector-section">
          <StockSelector
            v-model="selectedStockIndex"
            :stocks="stocks"
            title="选择股票"
            @stock-change="handleStockChange"
          />
        </div>

        <!-- 策略对比 -->
        <div class="comparison-section">
          <div class="section-header">
            <span>策略对比 - {{ currentStock?.plate }}</span>
          </div>
          <div class="comparison-content">
            <Alert
              :title="backtestResult.comparison?.comparison"
              :type="backtestResult.comparison?.winner === '交易策略' ? 'success' : 'warning'"
              :closable="false"
              show-icon
            />
          </div>
        </div>

        <!-- 策略结果 -->
        <Row :gutter="16">
          <ElCol :span="12">
            <div class="strategy-card">
              <StrategyResult
                :strategy="backtestResult.strategy"
                :hold="null"
                :comparison="null"
                strategy-title="交易策略（JMA信号）"
              />
            </div>

            <!-- 交易明细 -->
            <div v-if="backtestResult.strategy" class="trades-section">
              <div class="section-header">
                <span>交易明细</span>
              </div>
              <ElTable
                :data="backtestResult.strategy?.trades || []"
                border
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
            </div>
          </ElCol>

          <ElCol :span="12">
            <div class="strategy-card">
              <StrategyResult
                :strategy="null"
                :hold="backtestResult.hold"
                :comparison="null"
                hold-title="买入持有策略"
              />
            </div>
          </ElCol>
        </Row>
      </div>
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
  @use '@/styles/variables.scss' as *;

  .backtest-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }

  .main-card {
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
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

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(0, 122, 255, 0.2);
    border-top-color: #007aff;
    border-right-color: #007aff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }

  .loading-text {
    color: #666666;
    font-size: 14px;
  }

  .content-section {
    padding: 16px;
  }

  .selector-section {
    margin-bottom: 16px;
  }

  .comparison-section {
    margin-bottom: 16px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .section-header {
    display: flex;
    align-items: center;
    font-weight: 600;
    color: #333333;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    background-color: #f9f9f9;
  }

  .comparison-content {
    padding: 16px;
  }

  .strategy-card {
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    margin-bottom: 16px;
  }

  .trades-section {
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .trades-table {
    border: 1px solid #e0e0e0;

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

  // 响应式调整
  @media (max-width: 768px) {
    .backtest-container {
      padding: 8px;
    }

    .content-section {
      padding: 8px;
    }

    .comparison-content {
      padding: 12px;
    }

    .section-header {
      padding: 10px 12px;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
