<template>
  <div class="mobile-strategy-container">
    <!-- 移动端顶部导航 -->
    <header class="mobile-header">
      <div class="header-content">
        <h1 class="header-title">交易策略评估</h1>
        <span v-if="evaluationResults.length > 0" class="header-date">
          {{ evaluationResults[0].date }}
        </span>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="mobile-main">
      <!-- 总资产输入 -->
      <div class="assets-section">
        <div class="section-title">总资产设置</div>
        <div class="assets-input-group">
          <span class="label">总资产:</span>
          <input
            v-model="totalAssets"
            type="number"
            class="assets-input"
            placeholder="请输入总资产"
            @input="handleAssetsChange"
          />
          <span class="unit">元</span>
        </div>
        <div class="position-display">
          <span class="label">当前仓位:</span>
          <div class="position-tag">{{ currentPosition.toLocaleString() }} 元</div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-section">
        <div class="loading-spinner" />
        <p class="loading-text">正在加载数据...</p>
      </div>

      <!-- 策略评估结果 -->
      <div v-else class="results-section">
        <div class="section-title">策略评估结果</div>

        <!-- 移动端列表 -->
        <div class="stock-list">
          <div
            v-for="(stock, index) in evaluationResults"
            :key="index"
            class="stock-item"
            :class="{ 'top-8': index < 8 }"
          >
            <!-- 只显示名称、信号、分配资金，key-value在同一行 -->
            <div class="item-row">
              <span class="item-label">{{ stock.name }}</span>
              <span class="item-value" :style="{ color: stock.tradingSignal.color }">
                {{ stock.tradingSignal.signal }}
              </span>
            </div>
            <div class="item-row">
              <span class="item-label">资金</span>
              <span
                v-if="stock.allocation > 0"
                class="item-value allocation"
                :class="stock.tradingShape.shape === '低点' ? 'success' : 'warning'"
              >
                {{ stock.allocation.toLocaleString() }} 元
              </span>
              <span v-else class="item-value">-</span>
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
  const { loading, fetchStockData, evaluateStrategies } = useStockData()
  const { calculateAllocation } = useStrategy()

  // 响应式数据
  const totalAssets = ref(100000)
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
      console.warn('读取总资产缓存失败:', error)
    }
    return 100000
  }

  // 保存总资产到 localStorage
  const saveTotalAssetsToStorage = () => {
    try {
      localStorage.setItem('strategy_totalAssets', totalAssets.value.toString())
    } catch (error) {
      console.warn('保存总资产缓存失败:', error)
    }
  }

  // 计算当前仓位
  const currentPosition = computed(() => {
    return evaluationResults.value.reduce((sum, stock) => {
      if (
        stock.allocation > 0 &&
        (stock.tradingShape?.shape === '低点' || stock.tradingShape?.shape === '上升')
      ) {
        return sum + stock.allocation
      }
      return sum
    }, 0)
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
    calculateAllocationWrapper()
  }

  // 初始化
  const initialize = async () => {
    // 加载总资产
    totalAssets.value = loadTotalAssetsFromStorage()

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

  .mobile-strategy-container {
    min-height: 100vh;
    background-color: #f2f2f7;
    display: flex;
    flex-direction: column;
  }

  .mobile-header {
    background-color: #007aff;
    color: #ffffff;
    padding: 12px 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .header-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .header-date {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 500;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .mobile-main {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
  }

  .assets-section {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    padding: 12px;
    margin-bottom: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #007aff;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
  }

  .assets-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .label {
    font-size: 14px;
    color: #666666;
    white-space: nowrap;
  }

  .assets-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #d0d0d0;
    font-size: 14px;
    color: #007aff;
    background-color: #ffffff;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .assets-input:focus {
    outline: none;
    border-color: #007aff;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
  }

  .unit {
    font-size: 14px;
    color: #666666;
  }

  .position-display {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .position-tag {
    background-color: #007aff;
    color: #ffffff;
    padding: 4px 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 122, 255, 0.3);
  }

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
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

  .results-section {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    padding: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .stock-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stock-item {
    background-color: #f9f9f9;
    border: 1px solid #e0e0e0;
    padding: 10px;
    transition: all 0.2s ease;
  }

  .stock-item:hover {
    background-color: #f0f7ff;
    border-color: #007aff;
  }

  .stock-item.top-8 {
    border: 1px solid #007aff;
    background-color: #f0f7ff;
    box-shadow: 0 1px 2px rgba(0, 122, 255, 0.2);
  }

  .item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }

  .item-row:last-child {
    border-bottom: none;
  }

  .item-label {
    font-size: 14px;
    color: #666666;
    font-weight: 500;
  }

  .item-value {
    font-size: 14px;
    font-weight: 600;
    color: #333333;
  }

  .item-value.name {
    color: #007aff;
    font-weight: 700;
  }

  .item-value.allocation {
    font-weight: 700;
  }

  .item-value.allocation.success {
    color: #34c759;
  }

  .item-value.allocation.warning {
    color: #ff9500;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* 响应式调整 */
  @media (max-width: 480px) {
    .mobile-main {
      padding: 8px;
    }

    .assets-section,
    .results-section {
      padding: 10px;
    }

    .item-row {
      padding: 5px 0;
    }

    .item-label {
      font-size: 13px;
    }

    .item-value {
      font-size: 13px;
    }
  }
</style>
