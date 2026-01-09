<script setup>
import { getStockHistoricalData } from '@/dataModule'
import { ref, onMounted } from 'vue'
import { QiYouHeBaoDan } from '@/signalModule'

defineProps({
  title: {
    type: String,
    default: 'HMM策略回测系统',
  },
})

const res = ref([])
const loading = ref(true)
const strategyResult = ref(null)

const fetchData = async () => {
  try {
    loading.value = true
    const result = await getStockHistoricalData()
    res.value = result
    console.log('原始数据:', res.value)
    
    // 执行HMM策略
    const positions = await QiYouHeBaoDan(res.value)
    strategyResult.value = positions

    console.log('策略执行完成:', positions)
  } catch (error) {
    console.error('获取数据或执行策略失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="container">
    <h1 class="title">{{ title }}</h1>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      正在执行HMM策略系统，请稍候...
    </div>
    
    <!-- 结果展示 -->
    <div v-else-if="strategyResult" class="result">
      <!-- 组合概览 -->
      <div class="section">
        <h2 class="section-title">组合概览</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">配置股票数量</div>
            <div class="metric-value">{{ strategyResult.portfolioMetrics.numPositions }}</div>
          </div>
          <div class="metric">
            <div class="metric-label">有效权益权重</div>
            <div class="metric-value">{{ (strategyResult.portfolioMetrics.effectiveWeight * 100).toFixed(2) }}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">加权夏普比率</div>
            <div class="metric-value">{{ strategyResult.portfolioMetrics.weightedSharpe.toFixed(4) }}</div>
          </div>
          <div class="metric">
            <div class="metric-label">集中度</div>
            <div class="metric-value">{{ strategyResult.portfolioMetrics.concentration }}</div>
          </div>
        </div>
      </div>
      
      <!-- 仓位配置详情 -->
      <div class="section">
        <h2 class="section-title">仓位配置详情</h2>
        <table class="table">
          <thead>
            <tr>
              <th>板块</th>
              <th>股票</th>
              <th>基金</th>
              <th>仓位比例</th>
              <th>夏普比率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pos in strategyResult.positions" :key="pos.id">
              <td>{{ pos.plate }}</td>
              <td>{{ pos.stock }}</td>
              <td>{{ pos.fund }}</td>
              <td class="weight">{{ (pos.weight * 100).toFixed(2) }}%</td>
              <td class="sharpe">{{ pos.sharpeRatio.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 原始数据信息 -->
      <div class="section">
        <h2 class="section-title">原始数据信息</h2>
        <div class="info">
          <p>数据来源: {{ res.length }} 个指数</p>
          <p>数据范围: {{ res[0]?.dateRange?.start }} 至 {{ res[0]?.dateRange?.end }}</p>
          <p>数据长度: {{ res[0]?.totalDays }} 条记录</p>
        </div>
      </div>
    </div>
    
    <!-- 无数据状态 -->
    <div v-else class="no-data">
      暂无数据可用
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.title {
  font-size: 28px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 30px;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: #64748b;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #3b82f6;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.metric {
  background: #f8fafc;
  border-radius: 6px;
  padding: 16px;
  text-align: center;
}

.metric-label {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #3b82f6;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.table thead {
  background: #f1f5f9;
}

.table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #1e293b;
  border-bottom: 2px solid #cbd5e1;
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.table tbody tr:hover {
  background: #f8fafc;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.weight {
  font-weight: 600;
  color: #3b82f6;
}

.sharpe {
  font-weight: 600;
  color: #10b981;
}

.info {
  line-height: 1.8;
  color: #475569;
}

.info p {
  margin: 8px 0;
}

.no-data {
  text-align: center;
  padding: 60px 20px;
  font-size: 18px;
  color: #64748b;
}
</style>