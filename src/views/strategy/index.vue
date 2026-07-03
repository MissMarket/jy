<script setup>
  import { ref, onMounted, computed } from 'vue'
  import dayjs from 'dayjs'
  import { TrendCharts } from '@element-plus/icons-vue'
  import { ElMessage, ElIcon, ElInputNumber, ElTable, ElTableColumn } from 'element-plus'
  import { useStockData } from '@/composables/useStockData'
  import { useStrategy } from '@/composables/useStrategy'
  import TradingSignal from '@/components/TradingSignal.vue'

  // 组合式函数
  const { loading, stockData, fetchStockData, evaluateStrategies } = useStockData()
  const { calculateAllocation } = useStrategy()

  // 响应式数据
  const evaluationResults = ref([])

  // 从 localStorage 读取总资产
  const loadTotalAssetsFromStorage = () => {
    try {
      const stored = localStorage.getItem('strategy_totalAssets')
      if (stored) {
        const value = parseInt(stored, 10)
        return isNaN(value) ? 100000 : value
      }
    } catch (error) {
      // 静默处理错误
    }
    return 100000
  }

  // 从 localStorage 读取红利资产
  const loadDividendAssetFromStorage = () => {
    try {
      const stored = localStorage.getItem('strategy_dividendAsset')
      if (stored) {
        const value = parseInt(stored, 10)
        return isNaN(value) ? 0 : value
      }
    } catch (error) {
      // 静默处理错误
    }
    return 0
  }

  const totalAssets = ref(loadTotalAssetsFromStorage())
  const dividendAssetInput = ref(loadDividendAssetFromStorage())

  // 计算进攻仓位（买入或持有的分配资金之和）
  const currentPosition = computed(() => {
    return evaluationResults.value.reduce((sum, stock) => {
      if (
        stock.allocation > 0 &&
        (stock.tradingSignal?.signal === '买入' || stock.tradingSignal?.signal === '持有')
      ) {
        return sum + stock.allocation
      }
      return sum
    }, 0)
  })

  // 保存到 localStorage
  const saveTotalAssetsToStorage = () => {
    try {
      localStorage.setItem('strategy_totalAssets', totalAssets.value.toString())
    } catch (error) {
      // 静默处理错误
    }
  }

  const saveDividendAssetToStorage = () => {
    try {
      localStorage.setItem('strategy_dividendAsset', dividendAssetInput.value.toString())
    } catch (error) {
      // 静默处理错误
    }
  }

  // 计算红利资产最大仓位
  const maxDividendAsset = computed(() => {
    return totalAssets.value - currentPosition.value
  })

  // 计算M值的函数
  const calculateM = (a, b, c) => {
    return (80 * Math.log(b / a)) / Math.log(c / a)
  }

  // 计算红利资产仓位
  const dividendPosition = computed(() => {
    const dividendStock = stockData.value.find(stock => stock.plate === '红利')
    if (!dividendStock || !dividendStock.priceArr || dividendStock.priceArr.length === 0) {
      return 0
    }

    const priceArr = dividendStock.priceArr.slice(-251)
    if (priceArr.length === 0) return 0

    const sortedPrices = [...priceArr].sort((a, b) => a - b)
    const currentPrice = priceArr[priceArr.length - 1]
    const currentIndex = sortedPrices.indexOf(currentPrice)

    let position = 0
    const isInTop25 = currentPrice <= sortedPrices[24]
    const isInBottom25 = currentPrice >= sortedPrices[sortedPrices.length - 25]

    if (isInTop25 || currentIndex < 25) {
      const top25Index = sortedPrices.indexOf(currentPrice)
      position = 100 - top25Index * 0.4
    } else if (isInBottom25 || currentIndex >= sortedPrices.length - 25) {
      const bottom25Index = sortedPrices.indexOf(currentPrice)
      const reverseIndex = sortedPrices.length - 1 - bottom25Index
      position = reverseIndex * 0.4
    } else {
      // 中间201个数据
      const a = sortedPrices[24]
      const c = sortedPrices[sortedPrices.length - 25]
      const b = currentPrice
      const m = calculateM(a, b, c)
      position = 90 - m
    }

    return position
  })

  // 计算红利实际仓位
  const actualDividendPosition = computed(() => {
    const maxDividend = maxDividendAsset.value
    const positionPercentage = dividendPosition.value / 100
    return maxDividend * positionPercentage
  })

  // 红利资产差值
  const dividendAssetDiff = computed(() => {
    return actualDividendPosition.value - dividendAssetInput.value
  })

  // 红利资产提示
  const dividendAssetHint = computed(() => {
    const diff = dividendAssetDiff.value
    if (Math.abs(diff) < 0.01) {
      return { text: '不操作', type: 'neutral' }
    } else if (diff > 0) {
      return { text: `买入 ${Math.floor(diff)} 元`, type: 'buy' }
    } else {
      return { text: `卖出 ${Math.floor(Math.abs(diff))} 元`, type: 'sell' }
    }
  })

  // 总仓位
  const totalPosition = computed(() => {
    return Math.floor(currentPosition.value) + Math.floor(actualDividendPosition.value)
  })

  // 红利交易日/休息日提示
  const dividendTradeDayHint = computed(() => {
    const dividendStock = stockData.value.find(stock => stock.plate === '红利')
    if (!dividendStock || !dividendStock.dateArr) {
      return { text: '', type: '' }
    }

    const currentYear = dayjs().year().toString()
    const currentYearData = dividendStock.dateArr.filter(date => {
      return date.toString().includes(currentYear)
    })

    if (currentYearData.length === 0) {
      return { text: '', type: '' }
    }

    if (currentYearData.length % 2 === 0 && currentYearData.length > 0) {
      return { text: '红利交易日', type: 'trade' }
    } else {
      return { text: '红利休息日', type: 'rest' }
    }
  })

  // 计算分配资金
  const calculateAllocationWrapper = () => {
    const assets = totalAssets.value
    saveTotalAssetsToStorage()
    const updatedResults = calculateAllocation(evaluationResults.value, assets)
    evaluationResults.value = updatedResults
  }

  // 处理总资产输入
  const handleAssetsChange = () => {
    if (totalAssets.value < 0) {
      totalAssets.value = 0
    }
    totalAssets.value = Math.floor(totalAssets.value)
    saveTotalAssetsToStorage()
    calculateAllocationWrapper()
  }

  // 处理红利资产输入
  const handleDividendAssetChange = () => {
    if (dividendAssetInput.value < 0) {
      dividendAssetInput.value = 0
    }
    dividendAssetInput.value = Math.floor(dividendAssetInput.value)
    saveDividendAssetToStorage()
  }

  // 交易信号排序优先级
  const signalPriority = {
    买入: 1,
    卖出: 2,
    持有: 3,
    空仓: 4,
  }

  // 按交易信号 + 分配金额排序
  const sortResults = () => {
    evaluationResults.value.sort((a, b) => {
      const signalA = a.tradingSignal?.signal || '空仓'
      const signalB = b.tradingSignal?.signal || '空仓'
      const priorityA = signalPriority[signalA] || 999
      const priorityB = signalPriority[signalB] || 999

      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      return b.allocation - a.allocation
    })
  }

  // 处理排序点击
  const handleSortClick = () => {
    sortResults()
    calculateAllocationWrapper()
  }

  // 获取数据
  const fetchData = async () => {
    try {
      await fetchStockData()

      const today = new Date().toISOString().split('T')[0]
      let hasValidStoredData = false

      // 尝试从 localStorage 获取缓存的评估结果
      try {
        const storedData = localStorage.getItem('strategyEvaluationResults')
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          if (Array.isArray(parsedData) && parsedData.length === 2) {
            const storedDate = parsedData[0]
            const storedResults = parsedData[1]
            if (storedDate === today) {
              const resultsWithIndex = storedResults.map((stock, index) => ({
                ...stock,
                originalIndex: stock.originalIndex !== undefined ? stock.originalIndex : index,
              }))
              evaluationResults.value = resultsWithIndex
              hasValidStoredData = true
            }
          }
        }
      } catch (error) {
        console.error('读取缓存失败:', error)
      }

      if (!hasValidStoredData) {
        const results = evaluateStrategies()
        const resultsWithIndex = results.map((stock, index) => ({
          ...stock,
          originalIndex: index,
        }))
        evaluationResults.value = resultsWithIndex

        calculateAllocationWrapper()
        sortResults()

        try {
          const storageData = [today, evaluationResults.value]
          localStorage.setItem('strategyEvaluationResults', JSON.stringify(storageData))
        } catch (error) {
          console.error('写入缓存失败:', error)
        }

        ElMessage.success('评估完成！')
      } else {
        calculateAllocationWrapper()
        sortResults()
      }
    } catch (error) {
      ElMessage.error('获取数据失败')
    }
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <div class="strategy-container">
    <ElCard class="main-card" shadow="never">
      <!-- 渐变标题栏 -->
      <template #header>
        <div class="page-header">
          <div class="header-left">
            <ElIcon :size="22" class="header-icon"><TrendCharts /></ElIcon>
            <span class="header-title">交易策略评估</span>
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
        <!-- 资产信息 -->
        <div class="asset-info-section">
          <div class="asset-info-row">
            <div class="asset-info-item">
              <span class="info-label">总资产</span>
              <div class="info-value-row">
                <ElInputNumber
                  v-model="totalAssets"
                  :min="0"
                  :step="10000"
                  :controls="false"
                  placeholder="请输入"
                  class="asset-input"
                  @change="handleAssetsChange"
                />
                <span class="info-unit">元</span>
              </div>
            </div>
            <div class="asset-info-item">
              <span class="info-label">红利资产</span>
              <div class="info-value-row">
                <ElInputNumber
                  v-model="dividendAssetInput"
                  :min="0"
                  :max="maxDividendAsset"
                  :step="10000"
                  :controls="false"
                  placeholder="请输入"
                  class="asset-input"
                  @change="handleDividendAssetChange"
                />
                <span class="info-unit">元</span>
              </div>
            </div>
            <div class="col-divider" />
            <div class="asset-info-item">
              <span class="info-label">总仓位</span>
              <span class="info-value primary">{{ totalPosition }} 元</span>
            </div>
            <div class="asset-info-item">
              <span class="info-label">进攻</span>
              <span class="info-value info">{{ Math.floor(currentPosition) }} 元</span>
            </div>
            <div class="asset-info-item">
              <span class="info-label">红利</span>
              <span class="info-value success">{{ Math.floor(actualDividendPosition) }} 元</span>
            </div>
            <div class="asset-info-item">
              <span class="info-label">估值</span>
              <span class="info-value warning">{{ Math.floor(dividendPosition) }}%</span>
            </div>
            <div class="col-divider" />
            <div class="asset-info-item">
              <span class="info-label">状态</span>
              <div
                class="hint-tag"
                :class="{
                  'hint-buy': dividendTradeDayHint.type === 'trade',
                  'hint-sell': dividendTradeDayHint.type === 'rest',
                }"
              >
                {{ dividendTradeDayHint.text || '--' }}
              </div>
            </div>
            <div class="asset-info-item">
              <span class="info-label">建议</span>
              <div
                class="hint-tag"
                :class="{
                  'hint-buy': dividendAssetHint.type === 'buy',
                  'hint-sell': dividendAssetHint.type === 'sell',
                  'hint-neutral': dividendAssetHint.type === 'neutral',
                }"
                @click="handleSortClick"
              >
                {{ dividendAssetHint.text }}
              </div>
            </div>
          </div>
        </div>

        <!-- 表格区域 -->
        <div class="table-section">
          <div class="trades-header">
            <ElIcon :size="16"><TrendCharts /></ElIcon>
            <span>策略评分排名</span>
            <span class="trades-count">{{ evaluationResults.length }} 条记录</span>
          </div>
          <div class="table-wrapper">
            <ElTable
              :data="evaluationResults"
              border
              height="100%"
              style="width: 100%"
              class="trades-table"
              size="small"
            >
              <ElTableColumn type="index" label="序号" width="60" />
              <ElTableColumn prop="name" label="名称" />
              <ElTableColumn prop="date" label="日期" align="center" />
              <ElTableColumn label="交易形态" align="center">
                <template #default="{ row }">
                  <TradingSignal :shape="row.tradingShape" :signal="null" shape-label="" />
                </template>
              </ElTableColumn>
              <ElTableColumn label="交易信号" align="center">
                <template #default="{ row }">
                  <TradingSignal :shape="null" :signal="row.tradingSignal" signal-label="" />
                </template>
              </ElTableColumn>
              <ElTableColumn prop="totalScore" label="总分" align="center">
                <template #default="{ row }">
                  <span class="score-tag success">{{ row.totalScore }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="价格波动★" align="center">
                <template #default="{ row }">
                  <span class="score-tag danger">{{ row.volatilityScores[0] }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="趋势强度★" align="center">
                <template #default="{ row }">
                  <span class="score-tag danger">{{ row.trendScores[0] }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="下跌倾向★" align="center">
                <template #default="{ row }">
                  <span class="score-tag danger">{{ row.trendScores[1] }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="平均真实波动率" align="center">
                <template #default="{ row }">
                  <span v-if="row.atrRate > 2" class="score-tag danger"
                    >{{ row.atrRate.toFixed(2) }}%</span
                  >
                  <span v-else-if="row.atrRate > 1" class="score-tag warning"
                    >{{ row.atrRate.toFixed(2) }}%</span
                  >
                  <span v-else class="score-tag success">{{ row.atrRate.toFixed(2) }}%</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="weight" label="权重" align="center">
                <template #default="{ row }">
                  <span class="weight-text" :class="{ 'weight-active': row.weight > 0 }">{{
                    row.weight.toFixed(1)
                  }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="allocation" label="分配资金" align="center">
                <template #default="{ row }">
                  <span
                    v-if="row.allocation > 0"
                    class="score-tag"
                    :class="row.tradingShape?.shape === '低点' ? 'success' : 'warning'"
                    >{{ row.allocation.toLocaleString() }}</span
                  >
                  <span v-else class="no-allocation">-</span>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<style scoped lang="scss">
  @use '@/styles/variables.scss' as *;

  // ==============================
  // 容器 - 精确填满 100vh
  // ==============================
  .strategy-container {
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
    padding: 0 $spacing-lg;
  }

  // ==============================
  // 资产信息区域 - 简洁单行
  // ==============================
  .asset-info-section {
    flex-shrink: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    background-color: $bg-secondary;
    box-shadow: $shadow-sm;
    overflow: hidden;
    margin-top: 10px;
  }

  .asset-info-row {
    display: flex;
    align-items: center;
    padding: $spacing-sm $spacing-md;
    gap: 0;
  }

  .asset-info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    padding: 0 $spacing-sm;
  }

  .info-label {
    font-size: 11px;
    color: $text-tertiary;
    white-space: nowrap;
  }

  .info-value-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .info-value {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    font-feature-settings: 'tnum';
    white-space: nowrap;

    &.primary {
      color: $primary-color;
    }
    &.info {
      color: $info-color;
    }
    &.success {
      color: $success-color;
    }
    &.warning {
      color: darken($accent-color, 15%);
    }
  }

  .info-unit {
    font-size: $font-size-xs;
    color: $text-tertiary;
  }

  .col-divider {
    width: 1px;
    height: 36px;
    background-color: $border-color;
    flex-shrink: 0;
    margin: 0 $spacing-sm;
  }

  .asset-input {
    width: 130px;

    :deep(.el-input__wrapper) {
      border-radius: $border-radius-md;
      box-shadow: 0 0 0 1px $border-color inset;
      transition: box-shadow $transition-fast;
      padding: 0 8px;

      &:hover {
        box-shadow: 0 0 0 1px $border-hover inset;
      }

      &.is-focus {
        box-shadow:
          0 0 0 1px $primary-color inset,
          $input-shadow-focus;
      }
    }

    :deep(.el-input__inner) {
      font-feature-settings: 'tnum';
      font-size: $font-size-sm;
      height: 28px;
    }
  }

  // ==============================
  // 提示标签
  // ==============================
  .hint-tag,
  .trade-day-hint {
    display: inline-flex;
    align-items: center;
    padding: 2px $spacing-sm;
    border-radius: $border-radius-sm;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;

    &.hint-buy {
      background-color: rgba($danger-color, 0.1);
      color: $danger-color;
    }

    &.hint-sell {
      background-color: rgba($success-color, 0.1);
      color: $success-color;
    }

    &.hint-neutral {
      background-color: rgba($text-tertiary, 0.1);
      color: $text-tertiary;
    }
  }

  // ==============================
  // 表格区域 - 占满剩余高度
  // ==============================
  .table-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    overflow: hidden;
    background-color: $bg-secondary;
    box-shadow: $shadow-sm;
    margin: 0;
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
  // 表格样式 - 匹配 home 页
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

  // ==============================
  // 分数标签
  // ==============================
  .score-tag {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    font-feature-settings: 'tnum';

    &.success {
      background-color: rgba($success-color, 0.1);
      color: $success-color;
    }

    &.danger {
      background-color: rgba($danger-color, 0.1);
      color: $danger-color;
    }

    &.warning {
      background-color: rgba($accent-color, 0.15);
      color: darken($accent-color, 15%);
    }
  }

  // 权重文字
  .weight-text {
    font-feature-settings: 'tnum';
    color: $text-tertiary;

    &.weight-active {
      color: $primary-color;
      font-weight: $font-weight-bold;
    }
  }

  // 无分配资金
  .no-allocation {
    color: $text-tertiary;
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
      padding: $spacing-md 0;
    }

    .card-body-wrapper {
      gap: $spacing-sm;
      padding: 0 $spacing-md;
    }

    .page-header {
      padding: $spacing-sm $spacing-md;
    }

    .header-title {
      font-size: $font-size-base;
    }

    .asset-info-row {
      flex-wrap: wrap;
      gap: $spacing-sm;
    }

    .asset-info-item {
      flex: none;
      width: calc(50% - 16px);
    }

    .col-divider {
      display: none;
    }

    .asset-info-row {
      gap: $spacing-sm;
    }

    .asset-input {
      width: 120px;
    }
  }
</style>
