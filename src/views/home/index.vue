<template>
  <div class="backtest-container">
    <ElCard class="main-card" shadow="never">
      <!-- 渐变标题栏 -->
      <template #header>
        <div class="page-header">
          <div class="header-left">
            <ElIcon :size="22" class="header-icon"><Histogram /></ElIcon>
            <span class="header-title">交易策略回测</span>
          </div>
        </div>
      </template>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-section">
        <div class="loading-spinner" />
        <p class="loading-text">正在加载数据...</p>
      </div>

      <!-- 主体内容 -->
      <div v-else class="card-body-wrapper">
        <!-- 股票选择器 -->
        <div class="selector-section">
          <StockSelector
            v-model="selectedStockIndex"
            :stocks="stocks"
            title="选择指数"
            @stock-change="handleStockChange"
          />
        </div>

        <!-- 策略对比 -->
        <div
          v-if="backtestResult.comparison"
          class="comparison-section"
          :class="backtestResult.comparison.winner === '交易策略' ? 'win-trade' : 'win-hold'"
        >
          <div class="comparison-inner">
            <div class="comparison-icon">
              <ElIcon :size="20"><TrophyBase /></ElIcon>
            </div>
            <div class="comparison-text">
              <span class="comparison-label">策略胜出</span>
              <span class="comparison-value">{{ backtestResult.comparison.comparison }}</span>
            </div>
            <div class="comparison-tag">
              <span class="tag-badge">{{ backtestResult.comparison.winner }}</span>
            </div>
          </div>
        </div>

        <!-- 双策略结果并排 -->
        <div class="strategy-row">
          <div class="strategy-panel">
            <StrategyResult
              :strategy="backtestResult.strategy"
              :hold="null"
              :comparison="null"
              strategy-title="交易策略（JMA信号）"
            />
          </div>
          <div class="strategy-panel">
            <StrategyResult
              :strategy="null"
              :hold="backtestResult.hold"
              :comparison="null"
              hold-title="买入持有策略"
            />
          </div>
        </div>

        <!-- 交易明细 -->
        <div v-if="backtestResult.strategy" class="trades-section">
          <div class="trades-header">
            <ElIcon :size="16"><List /></ElIcon>
            <span>交易明细</span>
            <span class="trades-count">{{ trades.length }} 条记录</span>
          </div>
          <div class="table-wrapper">
            <ElTable
              :data="pagedTrades"
              border
              height="100%"
              style="width: 100%"
              class="trades-table"
              size="small"
            >
              <TableColumn type="index" label="序号" width="60" fixed />
              <TableColumn prop="type" label="操作" width="80">
                <template #default="{ row }">
                  <span :class="['trade-type', row.type === '买入' ? 'buy' : 'sell']">{{
                    row.type
                  }}</span>
                </template>
              </TableColumn>
              <TableColumn prop="day" label="交易日" width="90" />
              <TableColumn prop="price" label="价格" width="90" align="right">
                <template #default="{ row }">
                  <span class="mono-num">¥{{ Number(row.price).toFixed(2) }}</span>
                </template>
              </TableColumn>
              <TableColumn prop="shares" label="股数" width="80" align="right">
                <template #default="{ row }">
                  <span class="mono-num">{{ row.shares }}</span>
                </template>
              </TableColumn>
              <TableColumn label="金额" width="110" align="right">
                <template #default="{ row }">
                  <span class="mono-num"
                    >¥{{ Number(row.cost || row.proceeds || 0).toLocaleString() }}</span
                  >
                </template>
              </TableColumn>
              <TableColumn prop="cash" label="现金" width="110" align="right">
                <template #default="{ row }">
                  <span class="mono-num">¥{{ Number(row.cash).toLocaleString() }}</span>
                </template>
              </TableColumn>
              <TableColumn prop="position" label="持仓" width="80" align="right">
                <template #default="{ row }">
                  <span class="mono-num">{{ row.position }}</span>
                </template>
              </TableColumn>
              <TableColumn prop="signal" label="信号" min-width="100" />
            </ElTable>
          </div>
          <div class="pagination-bar">
            <ElPagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="trades.length"
              layout="total, prev, pager, next"
              small
              background
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { Histogram, TrophyBase, List } from '@element-plus/icons-vue'
  import StockSelector from '@/components/StockSelector.vue'
  import StrategyResult from '@/components/StrategyResult.vue'
  import { useStockData } from '@/composables/useStockData'
  import { useStrategy } from '@/composables/useStrategy'

  // 组合式函数
  const { loading, stockData, fetchStockData } = useStockData()
  const { backtestResult, runBacktest } = useStrategy()

  // 响应式数据
  const selectedStockIndex = ref(0)

  // 分页
  const pageSize = ref(8)
  const currentPage = ref(1)

  // 计算属性
  const stocks = computed(() => stockData.value)
  const trades = computed(() => backtestResult.value.strategy?.trades || [])

  const pagedTrades = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return trades.value.slice(start, end)
  })

  // 处理股票选择变化
  const handleStockChange = index => {
    selectedStockIndex.value = index
    currentPage.value = 1
    const stock = stockData.value[index]
    if (stock) {
      runBacktest(stock)
    }
  }

  const handlePageChange = page => {
    currentPage.value = page
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

  onMounted(() => {
    initialize()
  })
</script>

<style scoped lang="scss">
  @use '@/styles/variables.scss' as *;

  // ==============================
  // 容器 - 精确填满 100vh
  // ==============================
  .backtest-container {
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

  // ==============================
  // 加载状态
  // ==============================
  .loading-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba($primary-color, 0.15);
    border-top-color: $primary-color;
    border-right-color: $secondary-color;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: $spacing-md;
  }

  .loading-text {
    color: $text-tertiary;
    font-size: $font-size-base;
    margin: 0;
  }

  // ==============================
  // 主体内容 - flex column 撑满
  // ==============================
  .card-body-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }

  // ==============================
  // 股票选择器
  // ==============================
  .selector-section {
    flex-shrink: 0;
  }

  // ==============================
  // 策略对比 - 精美卡片
  // ==============================
  .comparison-section {
    flex-shrink: 0;
    border-radius: $border-radius-lg;
    overflow: hidden;
    margin: 0 $spacing-lg;

    &.win-trade {
      background: linear-gradient(
        135deg,
        rgba($primary-color, 0.08) 0%,
        rgba($secondary-color, 0.08) 100%
      );
      border: 1px solid rgba($primary-color, 0.2);
    }

    &.win-hold {
      background: linear-gradient(
        135deg,
        rgba($accent-color, 0.08) 0%,
        rgba($info-color, 0.08) 100%
      );
      border: 1px solid rgba($accent-color, 0.2);
    }
  }

  .comparison-inner {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-sm $spacing-md;
  }

  .comparison-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: $border-radius-full;
    flex-shrink: 0;

    .win-trade & {
      background: linear-gradient(135deg, $primary-color, $secondary-color);
      color: $text-light;
    }

    .win-hold & {
      background: linear-gradient(135deg, $accent-color, $info-color);
      color: $text-light;
    }
  }

  .comparison-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .comparison-label {
    font-size: $font-size-xs;
    color: $text-tertiary;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .comparison-value {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  .comparison-tag {
    flex-shrink: 0;
  }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px $spacing-sm;
    border-radius: $border-radius-full;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    .win-trade & {
      background: linear-gradient(135deg, $primary-color, #e55a5a);
      color: $text-light;
    }

    .win-hold & {
      background: linear-gradient(135deg, $accent-color, #e6bc00);
      color: $text-primary;
    }
  }

  // ==============================
  // 双策略并排 - 等高
  // ==============================
  .strategy-row {
    display: flex;
    gap: $spacing-md;
    flex: 0 0 auto;
  }

  .strategy-panel {
    flex: 1;
    display: flex;
    min-width: 0;

    // 确保 StrategyResult 组件填满父容器宽度
    > :deep(.strategy-result) {
      width: 100%;
    }
  }

  // ==============================
  // 交易明细 - 占满剩余高度
  // ==============================
  .trades-section {
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

  .trades-header {
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

  .trades-count {
    margin-left: auto;
    font-size: $font-size-xs;
    color: $text-tertiary;
    font-weight: $font-weight-normal;
  }

  .table-wrapper {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  // ==============================
  // 表格样式
  // ==============================
  .trades-table {
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

  // 交易类型标签
  .trade-type {
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
    padding: $spacing-sm 0;
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
  // 动画
  // ==============================
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  // ==============================
  // 响应式
  // ==============================
  @media (max-width: $breakpoint-mobile) {
    .main-card :deep(.el-card__body) {
      padding: $spacing-md;
    }

    .card-body-wrapper {
      gap: $spacing-sm;
    }

    .strategy-row {
      flex-direction: column;
    }

    .page-header {
      padding: $spacing-sm 0;
    }

    .header-title {
      font-size: $font-size-base;
    }

    .comparison-inner {
      padding: $spacing-sm 0;
    }
  }
</style>
