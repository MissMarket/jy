<template>
  <div class="mobile-strategy-container">
    <!-- iOS风格顶部导航 -->
    <header class="ios-header">
      <div class="header-content">
        <h1 class="header-title">交易策略评估</h1>
        <span v-if="evaluationResults.length > 0" class="header-date">
          {{ evaluationResults[0].date }}
        </span>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="ios-main">
      <!-- 资产设置卡片 -->
      <div class="ios-card assets-card">
        <div class="card-header">
          <h2 class="card-title">资产设置</h2>
        </div>
        <div class="card-content">
          <!-- 总资产输入 -->
          <div class="ios-form-group">
            <label class="ios-label">总资产</label>
            <div class="ios-input-with-unit">
              <input
                v-model="totalAssets"
                type="number"
                class="ios-input"
                placeholder="请输入总资产"
                @input="handleAssetsChange"
              />
              <span class="ios-unit">元</span>
            </div>
          </div>

          <!-- 红利资产输入 -->
          <div class="ios-form-group">
            <label class="ios-label">红利资产</label>
            <div class="ios-input-with-unit">
              <input
                v-model="dividendAssetInput"
                type="number"
                class="ios-input"
                placeholder="请输入红利资产"
                @input="handleDividendAssetChange"
              />
              <span class="ios-unit">元</span>
            </div>
          </div>

          <!-- 仓位信息网格 -->
          <div class="position-grid">
            <div class="position-item">
              <span class="position-label">总仓位</span>
              <span class="position-value">{{ totalPosition }} 元</span>
            </div>
            <div class="position-item">
              <span class="position-label">jin仓位</span>
              <span class="position-value">{{ Math.floor(currentPosition) }} 元</span>
            </div>
            <div class="position-item">
              <span class="position-label">红利仓位</span>
              <span class="position-value">{{ Math.floor(actualDividendPosition) }} 元</span>
            </div>
            <div class="position-item">
              <span class="position-label">红利估值</span>
              <span class="position-value">{{ Math.floor(dividendPosition) }}%</span>
            </div>
          </div>

          <!-- 提示信息 -->
          <div class="ios-hints">
            <div v-if="dividendTradeDayHint.text" class="ios-hint-item">
              <div
                class="ios-hint-tag"
                :class="{
                  'trade-day': dividendTradeDayHint.type === 'trade',
                  'rest-day': dividendTradeDayHint.type === 'rest',
                }"
              >
                {{ dividendTradeDayHint.text }}
              </div>
            </div>
            <div class="ios-hint-item">
              <div
                class="ios-hint-tag"
                :class="{
                  'hint-buy': dividendAssetHint.type === 'buy',
                  'hint-sell': dividendAssetHint.type === 'sell',
                  'hint-neutral': dividendAssetHint.type === 'neutral',
                }"
              >
                {{ dividendAssetHint.text }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="ios-loading">
        <div class="ios-loading-spinner" />
        <p class="ios-loading-text">正在加载数据...</p>
      </div>

      <!-- 策略评估结果卡片 -->
      <div v-else class="ios-card results-card">
        <div class="card-header">
          <h2 class="card-title">策略评估结果</h2>
        </div>
        <div class="card-content">
          <!-- 股票列表 -->
          <div class="ios-stock-list">
            <div
              v-for="(stock, index) in evaluationResults"
              :key="index"
              class="ios-stock-item"
              :class="{ 'top-8': index < 8 }"
            >
              <div class="stock-item-header">
                <span class="stock-name">{{ stock.name }}</span>
                <span class="stock-signal" :style="{ color: stock.tradingSignal.color }">
                  {{ stock.tradingSignal.signal }}
                </span>
              </div>
              <div class="stock-item-footer">
                <span class="allocation-label">资金</span>
                <span
                  v-if="stock.allocation > 0"
                  class="allocation-value"
                  :class="stock.tradingShape.shape === '低点' ? 'success' : 'warning'"
                >
                  {{ stock.allocation.toLocaleString() }} 元
                </span>
                <span v-else class="allocation-value">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useStockData } from '@/composables/useStockData'
  import { useStrategy } from '@/composables/useStrategy'

  // 组合式函数
  const { loading, stockData, fetchStockData, evaluateStrategies } = useStockData()
  const { calculateAllocation } = useStrategy()

  // 响应式数据
  const totalAssets = ref(100000)
  const evaluationResults = ref([])
  const dividendAssetInput = ref(0)

  // 从 localStorage 读取总资产
  const loadTotalAssetsFromStorage = () => {
    try {
      const stored = localStorage.getItem('strategy_totalAssets')
      if (stored) {
        const value = parseInt(stored, 10)
        return isNaN(value) ? 100000 : value
      }
    } catch (error) {
      console.warn('读取总资产缓存失败:', error)
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
      console.warn('读取红利资产缓存失败:', error)
    }
    return 0
  }

  // 保存总资产到 localStorage
  const saveTotalAssetsToStorage = () => {
    try {
      localStorage.setItem('strategy_totalAssets', totalAssets.value.toString())
    } catch (error) {
      console.warn('保存总资产缓存失败:', error)
    }
  }

  // 保存红利资产到 localStorage
  const saveDividendAssetToStorage = () => {
    try {
      localStorage.setItem('strategy_dividendAsset', dividendAssetInput.value.toString())
    } catch (error) {
      console.warn('保存红利资产缓存失败:', error)
    }
  }

  // 计算当前仓位（买入或持有的分配资金之和）
  const currentPosition = computed(() => {
    return evaluationResults.value.reduce((sum, stock) => {
      // 只有买入和持有才计入仓位
      if (
        stock.allocation > 0 &&
        (stock.tradingSignal?.signal === '买入' || stock.tradingSignal?.signal === '持有')
      ) {
        return sum + stock.allocation
      }
      return sum
    }, 0)
  })

  // 计算红利资产最大仓位
  const maxDividendAsset = computed(() => {
    return totalAssets.value - currentPosition.value
  })

  // 计算红利仓位
  const dividendPosition = computed(() => {
    // 从stockData中找到红利板块
    const dividendStock = stockData.value.find(stock => stock.plate === '红利')
    if (!dividendStock || !dividendStock.priceArr || dividendStock.priceArr.length === 0) {
      return 0
    }

    // 获取最近251日的收盘价
    const priceArr = dividendStock.priceArr.slice(-251)
    if (priceArr.length === 0) {
      return 0
    }

    // 排序价格数组
    const sortedPrices = [...priceArr].sort((a, b) => a - b)
    const currentPrice = priceArr[priceArr.length - 1] // 当前收盘价
    const currentIndex = sortedPrices.indexOf(currentPrice)

    let position = 0

    // 检查当前价格是否在前25名范围内
    const isInTop25 = currentPrice <= sortedPrices[24]
    // 检查当前价格是否在后25名范围内
    const isInBottom25 = currentPrice >= sortedPrices[sortedPrices.length - 25]

    if (isInTop25 || currentIndex < 25) {
      // 前25名，最低分位100，依次递减0.4
      // 找到当前价格在排序数组中的实际位置
      const top25Index = sortedPrices.indexOf(currentPrice)
      position = 100 - top25Index * 0.4
    } else if (isInBottom25 || currentIndex >= sortedPrices.length - 25) {
      // 后25名，最高分位0，依次递增0.4
      const bottom25Index = sortedPrices.indexOf(currentPrice)
      const reverseIndex = sortedPrices.length - 1 - bottom25Index
      position = reverseIndex * 0.4
    } else {
      // 中间201个数据
      const a = sortedPrices[24] // 前25名的最大值
      const c = sortedPrices[sortedPrices.length - 25] // 后25名的最小值
      const b = currentPrice

      // 计算M值
      const calculateM = (a, b, c) => {
        return (80 * Math.log(b / a)) / Math.log(c / a)
      }

      const m = calculateM(a, b, c)
      position = 90 - m
    }

    return position
  })

  // 计算红利实际仓位（最大仓位 × 仓位百分比）
  const actualDividendPosition = computed(() => {
    const maxDividend = maxDividendAsset.value
    const positionPercentage = dividendPosition.value / 100
    return maxDividend * positionPercentage
  })

  // 计算红利资产与目标的差值和提示信息
  const dividendAssetDiff = computed(() => {
    const diff = actualDividendPosition.value - dividendAssetInput.value
    return diff
  })

  // 红利资产提示信息
  const dividendAssetHint = computed(() => {
    const diff = dividendAssetDiff.value
    if (Math.abs(diff) < 0.01) {
      return { text: '已达标', type: 'neutral' }
    } else if (diff > 0) {
      // 实际仓位大于输入值，需要买入
      return { text: `买入 ${Math.floor(diff)} 元`, type: 'buy' }
    } else {
      // 实际仓位小于输入值，需要卖出
      return { text: `卖出 ${Math.floor(Math.abs(diff))} 元`, type: 'sell' }
    }
  })

  // 计算总仓位（进攻仓位 + 红利仓位）
  const totalPosition = computed(() => {
    return Math.floor(currentPosition.value) + Math.floor(actualDividendPosition.value)
  })

  // 计算红利交易日/休息日提示
  const dividendTradeDayHint = computed(() => {
    // 从stockData中找到红利板块
    const dividendStock = stockData.value.find(stock => stock.plate === '红利')
    if (!dividendStock || !dividendStock.dateArr) {
      return { text: '', type: '' }
    }

    // 筛选出2026年的数据
    const year2026Data = dividendStock.dateArr.filter(date => {
      // 假设date格式为'YYYY-MM-DD'或类似格式
      return date.toString().includes('2026')
    })

    if (year2026Data.length === 0) {
      return { text: '', type: '' }
    }

    // 检查数据量是否为偶数（不包括0）
    if (year2026Data.length % 2 === 0 && year2026Data.length > 0) {
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

  // 处理总资产输入变化
  const handleAssetsChange = () => {
    // 确保只能输入正整数
    if (totalAssets.value < 0) {
      totalAssets.value = 0
    }
    totalAssets.value = Math.floor(totalAssets.value)
    saveTotalAssetsToStorage()
    calculateAllocationWrapper()
  }

  // 处理红利资产输入变化
  const handleDividendAssetChange = () => {
    // 确保只能输入正整数或0
    if (dividendAssetInput.value < 0) {
      dividendAssetInput.value = 0
    }
    dividendAssetInput.value = Math.floor(dividendAssetInput.value)
    saveDividendAssetToStorage()
  }

  // 初始化
  const initialize = async () => {
    // 加载总资产
    totalAssets.value = loadTotalAssetsFromStorage()
    // 加载红利资产
    dividendAssetInput.value = loadDividendAssetFromStorage()

    // 获取股票数据
    await fetchStockData()

    // 评估策略
    const results = evaluateStrategies()
    evaluationResults.value = results

    // 计算资金分配
    calculateAllocationWrapper()
  }

  // 生命周期钩子
  onMounted(() => {
    initialize()
  })
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  // 高级审美感配色方案
  $primary-color: #0a58ca; // 深蓝色主色调
  $secondary-color: #3b82f6; // 辅助蓝色
  $accent-color: #60a5fa; // 强调色
  $background-color: #f8fafc;
  $card-background: #ffffff;
  $text-primary: #1e293b;
  $text-secondary: #64748b;
  $text-tertiary: #94a3b8;
  $border-color: #e2e8f0;
  $success-color: #10b981;
  $danger-color: #ef4444;
  $warning-color: #f59e0b;
  $neutral-color: #64748b;

  // 设计变量
  $radius: 12px;
  $small-radius: 8px;
  $input-radius: 10px;
  $tag-radius: 16px;
  $shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  $header-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  $transition: all 0.2s ease-in-out;

  .mobile-strategy-container {
    min-height: 100vh;
    background-color: $background-color;
    display: flex;
    flex-direction: column;
    font-family:
      -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
  }

  // 顶部导航
  .ios-header {
    background-color: $primary-color;
    color: #ffffff;
    padding: 16px;
    box-shadow: $header-shadow;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .header-date {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    backdrop-filter: blur(8px);
  }

  // 主内容区
  .ios-main {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  // 卡片样式
  .ios-card {
    background-color: $card-background;
    border-radius: $radius;
    box-shadow: $shadow;
    margin-bottom: 16px;
    overflow: hidden;
    transition: $transition;
  }

  .ios-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  // 资产设置卡片优化
  .assets-card {
    .card-header {
      padding: 12px 16px 8px;
      border-bottom: 1px solid $border-color;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: $text-primary;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .card-content {
      padding: 12px 16px;
    }

    // 表单组优化
    .ios-form-group {
      margin-bottom: 12px;
    }

    .ios-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: $text-secondary;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }

    .ios-input-with-unit {
      position: relative;
      display: flex;
      align-items: center;
    }

    .ios-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid $border-color;
      border-radius: $input-radius;
      font-size: 15px;
      color: $primary-color;
      background-color: $card-background;
      font-weight: 600;
      transition: $transition;
      appearance: none;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .ios-input:focus {
      outline: none;
      border-color: $primary-color;
      box-shadow: 0 0 0 3px rgba(10, 88, 202, 0.1);
    }

    .ios-unit {
      position: absolute;
      right: 14px;
      font-size: 15px;
      color: $text-tertiary;
      font-weight: 500;
    }

    // 仓位信息网格优化
    .position-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 12px 0;
    }

    .position-item {
      background-color: rgba(10, 88, 202, 0.04);
      border-radius: $small-radius;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      transition: $transition;
      border: 1px solid rgba(10, 88, 202, 0.1);
    }

    .position-item:hover {
      background-color: rgba(10, 88, 202, 0.08);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(10, 88, 202, 0.1);
    }

    .position-label {
      font-size: 11px;
      color: $text-tertiary;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .position-value {
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
      letter-spacing: -0.01em;
    }

    // 提示信息优化
    .ios-hints {
      display: flex;
      flex-direction: row;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .ios-hint-item {
      display: flex;
      justify-content: center;
    }

    .ios-hint-tag {
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: $tag-radius;
      transition: $transition;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .ios-hint-tag.trade-day {
      background-color: $danger-color;
      color: #ffffff;
    }

    .ios-hint-tag.rest-day {
      background-color: $success-color;
      color: #ffffff;
    }

    .ios-hint-tag.hint-buy {
      background-color: $success-color;
      color: #ffffff;
    }

    .ios-hint-tag.hint-sell {
      background-color: $danger-color;
      color: #ffffff;
    }

    .ios-hint-tag.hint-neutral {
      background-color: $neutral-color;
      color: #ffffff;
    }

    .ios-hint-tag:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }
  }

  // 加载状态
  .ios-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 16px;
  }

  .ios-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(10, 88, 202, 0.2);
    border-top-color: $primary-color;
    border-right-color: $primary-color;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }

  .ios-loading-text {
    color: $text-tertiary;
    font-size: 14px;
    font-weight: 500;
  }

  // 股票列表
  .ios-stock-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ios-stock-item {
    background-color: #f8f8f8;
    border-radius: $small-radius;
    padding: 14px;
    transition: $transition;
    border: 1px solid transparent;
  }

  .ios-stock-item:hover {
    background-color: #f0f7ff;
    transform: translateY(-1px);
  }

  .ios-stock-item.top-8 {
    border: 1px solid $primary-color;
    background-color: rgba(10, 88, 202, 0.05);
  }

  .stock-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .stock-name {
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: -0.01em;
  }

  .stock-signal {
    font-size: 14px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 8px;
  }

  .stock-item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .allocation-label {
    font-size: 14px;
    color: $text-secondary;
    font-weight: 500;
  }

  .allocation-value {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }

  .allocation-value.success {
    color: $success-color;
  }

  .allocation-value.warning {
    color: $warning-color;
  }

  // 动画
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  // 响应式调整
  @media (max-width: 480px) {
    .ios-main {
      padding: 12px;
    }

    .ios-card {
      margin-bottom: 12px;
    }

    .card-header {
      padding: 12px 14px 8px;
    }

    .card-content {
      padding: 12px 14px;
    }

    .assets-card {
      .card-header {
        padding: 10px 14px 6px;
      }

      .card-content {
        padding: 10px 14px;
      }

      .ios-form-group {
        margin-bottom: 10px;
      }

      .ios-input {
        padding: 9px 12px;
        font-size: 14px;
      }

      .ios-unit {
        right: 12px;
        font-size: 14px;
      }

      .position-grid {
        gap: 6px;
        margin: 10px 0;
      }

      .position-item {
        padding: 8px;
      }

      .position-label {
        font-size: 10px;
      }

      .position-value {
        font-size: 14px;
      }

      .ios-hints {
        gap: 5px;
      }

      .ios-hint-tag {
        padding: 5px 12px;
        font-size: 12px;
      }
    }

    .ios-stock-item {
      padding: 12px;
    }

    .header-title {
      font-size: 17px;
    }

    .card-title {
      font-size: 15px;
    }

    .stock-name {
      font-size: 15px;
    }

    .allocation-value {
      font-size: 14px;
    }
  }

  // iPhone X 系列及以上适配
  @media (max-height: 812px) {
    .ios-main {
      padding-bottom: 24px;
    }
  }
</style>
