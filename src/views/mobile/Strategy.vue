<template>
  <div class="mobile-strategy-container">
    <!-- iOS风格顶部导航 -->
    <header class="ios-header">
      <div class="header-content">
        <h1 class="header-title">汽油荷包蛋</h1>
        <span v-if="evaluationResults.length > 0" class="header-date">
          {{ evaluationResults[0].date }}
        </span>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="ios-main">
      <!-- 资产设置卡片 -->
      <div class="ios-card assets-card">
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
              <span class="position-label">进攻仓位</span>
              <span class="position-value">{{ Math.floor(currentPosition) }} 元</span>
            </div>
            <div class="position-item">
              <span class="position-label">红利仓位</span>
              <span class="position-value">{{ Math.floor(actualDividendPosition) }} 元</span>
            </div>
            <div class="position-item">
              <span class="position-label">红利仓位百分比</span>
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
                @click="handleSortClick"
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
        <div class="card-content">
          <!-- 股票列表 -->
          <div class="ios-stock-list">
            <div
              v-for="(stock, index) in evaluationResults"
              :key="index"
              class="ios-stock-item"
              :class="{
                'group-a': stock.originalIndex < 5,
                'group-b': stock.originalIndex >= 5 && stock.originalIndex < 10,
                'group-c': stock.originalIndex >= 10 && stock.originalIndex < 19,
                'signal-buy': stock.tradingSignal.signal === '买入',
                'signal-sell': stock.tradingSignal.signal === '卖出',
                'signal-hold': stock.tradingSignal.signal === '持有',
                'signal-empty': stock.tradingSignal.signal === '空仓',
              }"
            >
              <div
                class="group-badge"
                :class="{
                  'badge-diamond': stock.originalIndex < 5,
                  'badge-gold': stock.originalIndex >= 5 && stock.originalIndex < 10,
                  'badge-silver': stock.originalIndex >= 10 && stock.originalIndex < 19,
                }"
              >
                {{ stock.originalIndex < 5 ? 'A' : stock.originalIndex < 10 ? 'B' : 'C' }}
              </div>
              <div class="stock-item-header">
                <span class="stock-name">{{ stock.name }}{{ stock.tradingSignal.signal }}</span>
                <span class="stock-signal" :style="{ color: stock.tradingSignal.color }" />
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
  import dayjs from 'dayjs'
  import { useStockData } from '@/composables/useStockData'
  import { useStrategy } from '@/composables/useStrategy'

  // 组合式函数
  const { loading, stockData, fetchStockData, evaluateStrategies } = useStockData()
  const { calculateAllocation } = useStrategy()

  // 响应式数据
  const totalAssets = ref(100000)
  const evaluationResults = ref([])
  const originalEvaluationResults = ref([])
  const dividendAssetInput = ref(0)
  const isSorted = ref(false)

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
      return { text: '不操作', type: 'neutral' }
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

    // 获取当前年份
    const currentYear = dayjs().year().toString()

    // 筛选出当前年份的数据
    const currentYearData = dividendStock.dateArr.filter(date => {
      return date.toString().includes(currentYear)
    })

    if (currentYearData.length === 0) {
      return { text: '', type: '' }
    }

    // 检查数据量是否为偶数（不包括0）
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

  // 交易信号排序优先级
  const signalPriority = {
    买入: 1,
    卖出: 2,
    持有: 3,
    空仓: 4,
  }

  // 处理排序点击
  const handleSortClick = () => {
    if (!isSorted.value) {
      // 对整个列表进行排序：先按交易信号优先级，再按总分从高到低
      evaluationResults.value.sort((a, b) => {
        const signalA = a.tradingSignal?.signal || '空仓'
        const signalB = b.tradingSignal?.signal || '空仓'
        const priorityA = signalPriority[signalA] || 999
        const priorityB = signalPriority[signalB] || 999

        if (priorityA !== priorityB) {
          return priorityA - priorityB
        }
        // 次级排序：按总分从高到低
        return b.totalScore - a.totalScore
      })
      // 重新计算资金分配
      calculateAllocationWrapper()
      isSorted.value = true
    } else {
      // 恢复原始排序
      evaluationResults.value = JSON.parse(JSON.stringify(originalEvaluationResults.value))
      // 重新计算资金分配
      calculateAllocationWrapper()
      isSorted.value = false
    }
  }

  // 初始化
  const initialize = async () => {
    // 加载总资产
    totalAssets.value = loadTotalAssetsFromStorage()
    // 加载红利资产
    dividendAssetInput.value = loadDividendAssetFromStorage()

    // 获取今天的日期（YYYY-MM-DD格式）
    const today = new Date().toISOString().split('T')[0]
    let hasValidStoredData = false

    // 尝试从localStorage获取存储的评估结果
    try {
      const storedData = localStorage.getItem('strategyEvaluationResults')
      if (storedData) {
        const parsedData = JSON.parse(storedData)
        // 验证数据格式是否正确
        if (Array.isArray(parsedData) && parsedData.length === 2) {
          const storedDate = parsedData[0]
          const storedResults = parsedData[1]
          // 比较日期是否相同
          if (storedDate === today) {
            // 确保数据有originalIndex
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
      console.error('读取localStorage失败:', error)
    }

    // 始终执行fetchStockData()获取最新股票数据
    await fetchStockData()

    // 如果没有有效的存储数据或日期不同，则执行评估策略
    if (!hasValidStoredData) {
      // 评估策略
      const results = evaluateStrategies()
      // 添加原始索引
      const resultsWithIndex = results.map((stock, index) => ({
        ...stock,
        originalIndex: index,
      }))
      evaluationResults.value = resultsWithIndex

      // 先计算资金分配
      calculateAllocationWrapper()

      // 保存包含allocation的原始结果
      originalEvaluationResults.value = JSON.parse(JSON.stringify(evaluationResults.value))

      // 将结果存储到localStorage
      try {
        const storageData = [today, evaluationResults.value]
        localStorage.setItem('strategyEvaluationResults', JSON.stringify(storageData))
      } catch (error) {
        console.error('写入localStorage失败:', error)
      }
    } else {
      // 先计算资金分配
      calculateAllocationWrapper()
      // 保存包含allocation的原始结果
      originalEvaluationResults.value = JSON.parse(JSON.stringify(evaluationResults.value))
    }
  }

  // 生命周期钩子
  onMounted(() => {
    initialize()
  })
</script>

<style scoped lang="scss">
  @use '@/styles/variables.scss' as *;

  // 苹果风格配色方案
  $primary-color: #007aff; // iOS 蓝色主色调
  $secondary-color: #34c759; // iOS 绿色
  $accent-color: #ff9500; // iOS 橙色
  $background-color: #f2f2f7; // iOS 背景色
  $card-background: #ffffff; // iOS 卡片背景
  $text-primary: #000000; // iOS 主文本色
  $text-secondary: #3c3c43; // iOS 次要文本色
  $text-tertiary: #8e8e93; // iOS  tertiary 文本色
  $border-color: #e5e5ea; // iOS 边框色
  $success-color: #34c759; // iOS 成功色
  $danger-color: #ff3b30; // iOS 危险色
  $warning-color: #ff9500; // iOS 警告色
  $neutral-color: #8e8e93; // iOS 中性色

  // 设计变量 - 统一间距为4的倍数
  $spacing: 4px;
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

  // 顶部导航 - 苹果风格
  .ios-header {
    background-color: linear-gradient(135deg, $primary-color, #0056b3);
    color: #ffffff;
    padding: $spacing * 4; // 16px
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(135deg, #007aff, #0056b3);
  }

  .ios-header:active {
    background: linear-gradient(135deg, #0066cc, #004c99);
  }

  .header-content {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    letter-spacing: -0.02em;
    font-family:
      'SF Pro Display',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .header-date {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    padding: $spacing * 1 $spacing * 2.5; // 4px 10px
    background: rgba(255, 255, 255, 0.2);
    border-radius: $spacing * 3; // 12px
    backdrop-filter: blur(8px);
    transition: all 0.2s ease-in-out;
    white-space: nowrap;
    margin-left: auto;
  }

  .header-date:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.02);
  }

  // 主内容区
  .ios-main {
    flex: 1;
    padding: $spacing * 4; // 16px
    overflow-y: auto;
  }

  // 卡片样式
  .ios-card {
    background-color: $card-background;
    border-radius: $radius;
    box-shadow: $shadow;
    margin-bottom: $spacing * 4; // 16px
    overflow: hidden;
    transition: $transition;
  }

  .ios-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  // 资产设置卡片 - 苹果风格
  .assets-card {
    .card-content {
      padding: $spacing * 4 $spacing * 4; // 16px 16px
      background-color: $card-background;
    }

    // 表单组优化
    .ios-form-group {
      margin-bottom: $spacing * 3; // 12px
    }

    .ios-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: $text-secondary;
      margin-bottom: $spacing * 1.5; // 6px
      letter-spacing: -0.01em;
    }

    .ios-input-with-unit {
      position: relative;
      display: flex;
      align-items: center;
    }

    .ios-input {
      flex: 1;
      padding: $spacing * 2.5 $spacing * 3.5; // 10px 14px
      border: 1px solid $border-color;
      border-radius: $input-radius;
      font-size: 15px;
      color: $primary-color;
      background-color: #f9f9f9;
      font-weight: 600;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      appearance: none;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .ios-input:focus {
      outline: none;
      border-color: $primary-color;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      background-color: $card-background;
    }

    .ios-input:active {
      transform: scale(0.995);
    }

    .ios-unit {
      position: absolute;
      right: $spacing * 3.5; // 14px
      font-size: 15px;
      color: $text-tertiary;
      font-weight: 500;
    }

    // 仓位信息网格优化
    .position-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: $spacing * 2; // 8px
      margin: $spacing * 3 0; // 12px 0
    }

    .position-item {
      background-color: rgba(0, 122, 255, 0.04);
      border-radius: $small-radius;
      padding: $spacing * 2.5; // 10px
      display: flex;
      flex-direction: column;
      gap: $spacing * 0.75; // 3px
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(0, 122, 255, 0.1);
    }

    .position-item:hover {
      background-color: rgba(0, 122, 255, 0.08);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 122, 255, 0.1);
    }

    .position-item:active {
      transform: translateY(0) scale(0.98);
    }

    .position-label {
      font-size: 11px;
      color: $text-tertiary;
      font-weight: 700;
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
      gap: $spacing * 2; // 8px
      margin-top: $spacing * 2; // 8px
      flex-wrap: wrap;
      justify-content: center;
    }

    .ios-hint-item {
      display: flex;
      justify-content: center;
    }

    .ios-hint-tag {
      padding: $spacing * 1.5 $spacing * 3.5; // 6px 14px
      font-size: 13px;
      font-weight: 600;
      border-radius: $tag-radius;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      font-family:
        'SF Pro Display',
        -apple-system,
        BlinkMacSystemFont,
        sans-serif;
      cursor: pointer;
      user-select: none;
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
      background-color: $danger-color;
      color: #ffffff;
    }

    .ios-hint-tag.hint-sell {
      background-color: $success-color;
      color: #ffffff;
    }

    .ios-hint-tag.hint-neutral {
      background-color: $neutral-color;
      color: #ffffff;
    }

    .ios-hint-tag:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .ios-hint-tag:active {
      transform: translateY(0) scale(0.97);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
  }

  // 加载状态 - 苹果风格
  .ios-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $spacing * 15 $spacing * 4; // 60px 16px
  }

  .ios-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 122, 255, 0.2);
    border-top-color: $primary-color;
    border-right-color: $primary-color;
    border-radius: 50%;
    animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    margin-bottom: $spacing * 4; // 16px
  }

  .ios-loading-text {
    color: $text-tertiary;
    font-size: 14px;
    font-weight: 500;
    animation: fadeIn 0.5s ease-in-out;
  }

  // 股票列表 - 苹果风格
  .ios-stock-list {
    display: flex;
    flex-direction: column;
    gap: $spacing * 2.5; // 10px
  }

  .ios-stock-item {
    background-color: #f8f8f8;
    border-radius: $small-radius;
    padding: $spacing * 3.5; // 14px
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .ios-stock-item:hover {
    background-color: #f0f7ff;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 122, 255, 0.1);
  }

  .ios-stock-item:active {
    transform: translateY(0) scale(0.99);
  }

  .ios-stock-item.top-8 {
    border: 1px solid $primary-color;
    background-color: rgba(0, 122, 255, 0.05);
    box-shadow: 0 2px 4px rgba(0, 122, 255, 0.1);
  }

  // A组 - 钻石边框
  .ios-stock-item.group-a {
    position: relative;
    border: 3px solid #00bcd4;
  }

  // B组 - 黄金边框
  .ios-stock-item.group-b {
    position: relative;
    border: 3px solid #ffb300;
  }

  // C组 - 白银边框
  .ios-stock-item.group-c {
    position: relative;
    border: 3px solid #757575;
  }

  // 交易信号背景色
  .ios-stock-item.signal-buy {
    background-color: #ffebee;
  }

  .ios-stock-item.signal-sell {
    background-color: #e8f5e8;
  }

  .ios-stock-item.signal-hold {
    background-color: #fff8e1;
  }

  .ios-stock-item.signal-empty {
    background-color: #f5f5f5;
  }

  // 分组徽章
  .group-badge {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .badge-diamond {
    background-color: #00bcd4;
    border: 2px solid #18ffff;
  }

  .badge-gold {
    background-color: #ffb300;
    border: 2px solid #ffd54f;
  }

  .badge-silver {
    background-color: #757575;
    border: 2px solid #bdbdbd;
  }

  .stock-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing * 2; // 8px
  }

  .stock-name {
    font-size: 16px;
    font-weight: 500;
    color: #000000;
    letter-spacing: -0.01em;
    font-family:
      'SF Pro Display',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
  }

  .stock-signal {
    font-size: 14px;
    font-weight: 500;
    padding: $spacing * 1 $spacing * 2; // 4px 8px
    border-radius: $spacing * 2; // 8px
    transition: all 0.2s ease-in-out;
  }

  .stock-signal:hover {
    transform: scale(1.05);
  }

  .stock-item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .allocation-label {
    font-size: 14px;
    color: #000000;
    font-weight: 500;
  }

  .allocation-value {
    font-size: 15px;
    font-weight: 500;
    color: #000000;
    transition: all 0.2s ease-in-out;
  }

  .allocation-value:hover {
    transform: scale(1.02);
  }

  .allocation-value.success {
    color: #000000;
  }

  .allocation-value.warning {
    color: #000000;
  }

  // 动画
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // 苹果风格微交互
  .ios-card {
    animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ios-card:nth-child(1) {
    animation-delay: 0.05s;
  }

  .ios-card:nth-child(2) {
    animation-delay: 0.1s;
  }

  // 滚动时的导航栏效果
  .ios-header {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ios-header.scrolled {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  // 触摸反馈效果
  .ios-button-effect {
    position: relative;
    overflow: hidden;
  }

  .ios-button-effect::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition:
      width 0.6s,
      height 0.6s;
  }

  .ios-button-effect:active::after {
    width: 300px;
    height: 300px;
  }

  // 响应式调整
  @media (max-width: 480px) {
    .ios-main {
      padding: $spacing * 3; // 12px
    }

    .ios-card {
      margin-bottom: $spacing * 3; // 12px
    }

    .card-header {
      padding: $spacing * 3 $spacing * 3.5 $spacing * 2; // 12px 14px 8px
    }

    .card-content {
      padding: $spacing * 3 $spacing * 3.5; // 12px 14px
    }

    .assets-card {
      .card-content {
        padding: $spacing * 3 $spacing * 3.5; // 12px 14px
      }

      .ios-form-group {
        margin-bottom: $spacing * 2.5; // 10px
      }

      .ios-input {
        padding: $spacing * 2.25 $spacing * 3; // 9px 12px
        font-size: 14px;
      }

      .ios-unit {
        right: $spacing * 3; // 12px
        font-size: 14px;
      }

      .position-grid {
        gap: $spacing * 1.5; // 6px
        margin: $spacing * 2.5 0; // 10px 0
      }

      .position-item {
        padding: $spacing * 2; // 8px
      }

      .position-label {
        font-size: 10px;
      }

      .position-value {
        font-size: 14px;
      }

      .ios-hints {
        gap: $spacing * 1.25; // 5px
      }

      .ios-hint-tag {
        padding: $spacing * 1.25 $spacing * 3; // 5px 12px
        font-size: 12px;
      }
    }

    .ios-stock-item {
      padding: $spacing * 3; // 12px
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
      padding-bottom: $spacing * 6; // 24px
    }
  }
</style>
