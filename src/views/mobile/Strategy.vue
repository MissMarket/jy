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

        <!-- 移动端卡片式列表 -->
        <div class="stock-cards">
          <div
            v-for="(stock, index) in evaluationResults"
            :key="index"
            class="stock-card"
            :class="{ 'top-8': index < 8 }"
          >
            <div class="card-body">
              <!-- 只显示名称、信号、分配资金，key-value在同一行 -->
              <div class="simple-grid">
                <div class="simple-row">
                  <span class="simple-key">名称</span>
                  <span class="simple-value name">{{ stock.name }}</span>
                </div>
                <div class="simple-row">
                  <span class="simple-key">信号</span>
                  <span class="simple-value" :style="{ color: stock.tradingSignal.color }">
                    {{ stock.tradingSignal.signal }}
                  </span>
                </div>
                <div class="simple-row">
                  <span class="simple-key">分配资金</span>
                  <span
                    v-if="stock.allocation > 0"
                    class="simple-value allocation"
                    :class="stock.tradingShape.shape === '低点' ? 'success' : 'warning'"
                  >
                    {{ stock.allocation.toLocaleString() }} 元
                  </span>
                  <span v-else class="simple-value">-</span>
                </div>
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
    background-color: $bg-primary;
    display: flex;
    flex-direction: column;
  }

  .mobile-header {
    background: linear-gradient(135deg, #1677ff 0%, #4096ff 50%, #1677ff 100%);
    color: #ffffff;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(22, 119, 255, 0.4);
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .header-title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    margin: 0;
  }

  .header-date {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 500;
    padding: 3px 10px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .mobile-main {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
  }

  .assets-section {
    background-color: $bg-secondary;
    border-radius: $border-radius-md;
    padding: 12px;
    margin-bottom: 16px;
    box-shadow: $shadow-sm;
  }

  .section-title {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: #1677ff;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 2px solid #1677ff;
    text-shadow: 0 0 8px rgba(22, 119, 255, 0.3);
  }

  .assets-input-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }

  .label {
    font-size: $font-size-xs;
    color: $text-secondary;
    white-space: nowrap;
  }

  .assets-input {
    flex: 1;
    padding: 6px 10px;
    border: 2px solid rgba(22, 119, 255, 0.3);
    border-radius: 8px;
    font-size: $font-size-sm;
    color: #1677ff;
    background-color: #ffffff;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .assets-input:focus {
    outline: none;
    border-color: #1677ff;
    box-shadow: 0 0 8px rgba(22, 119, 255, 0.4);
  }

  .unit {
    font-size: $font-size-xs;
    color: $text-secondary;
  }

  .position-display {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .position-tag {
    background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
    color: #ffffff;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    box-shadow: 0 2px 8px rgba(22, 119, 255, 0.4);
  }

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(22, 119, 255, 0.2);
    border-top-color: #1677ff;
    border-right-color: #4096ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
    box-shadow: 0 0 10px rgba(22, 119, 255, 0.3);
  }

  .loading-text {
    color: $text-secondary;
    font-size: $font-size-sm;
  }

  .results-section {
    background-color: $bg-secondary;
    border-radius: $border-radius-md;
    padding: 12px;
    box-shadow: $shadow-sm;
  }

  .stock-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stock-card {
    background: linear-gradient(145deg, #ffffff 0%, #f0f7ff 100%);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 2px 12px rgba(22, 119, 255, 0.1);
    transition: all 0.3s ease;
    border: 1px solid rgba(22, 119, 255, 0.15);
  }

  .stock-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(22, 119, 255, 0.25);
    border-color: rgba(22, 119, 255, 0.3);
  }

  .stock-card.top-8 {
    border: 2px solid #1677ff;
    background: linear-gradient(145deg, #ffffff 0%, #e6f2ff 100%);
    box-shadow:
      0 0 15px rgba(22, 119, 255, 0.3),
      0 2px 12px rgba(22, 119, 255, 0.15);
  }

  .card-header {
    display: none;
  }

  .card-body {
    padding: 0;
  }

  /* 简化布局 - 3行，key-value在同一行 */
  .simple-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .simple-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(22, 119, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(22, 119, 255, 0.1);
  }

  .simple-key {
    font-size: 12px;
    color: #1677ff;
    font-weight: 600;
    opacity: 0.85;
  }

  .simple-value {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .simple-value.name {
    color: #1677ff;
    font-weight: 700;
  }

  .simple-value.allocation {
    font-weight: 700;
  }

  .simple-value.allocation.success {
    color: #52c41a;
  }

  .simple-value.allocation.warning {
    color: #fa8c16;
  }

  /* 旧样式清理 */
  .card-date,
  .kv-grid,
  .kv-row,
  .kv-item,
  .kv-key,
  .kv-value,
  .signal-section,
  .allocation-section,
  .signal-item,
  .allocation-item,
  .signal-value,
  .allocation-label,
  .allocation-value,
  .allocation-tag {
    display: none;
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

    .simple-row {
      padding: 5px 6px;
    }

    .simple-key {
      font-size: 11px;
    }

    .simple-value {
      font-size: 12px;
    }
  }
</style>
