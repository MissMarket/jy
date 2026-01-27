<script setup>
  import { getStockHistoricalData } from '@/dataModule'
  import { ref, onMounted } from 'vue'
  import calculateJMA from '@/signalModule'

  defineProps({
    title: {
      type: String,
      default: '多因子策略回测系统',
    },
  })
  const res = ref([])
  const dataObj = ref({})
  const loading = ref(true)
  const trainingProgress = ref('')
  const selectedStockIndex = ref(1)
  const backtestResult = ref({})

  /**
   * 交易策略回测
   * @param {Array} priceArr - 价格数组
   * @param {Array} jmaArr - JMA均线数组
   * @param {number} initialCapital - 初始资金
   * @returns {Object} 交易结果
   */
  const backtestStrategy = (priceArr, jmaArr, initialCapital) => {
    const trades = []
    let cash = initialCapital
    let shares = 0
    let inPosition = false

    for (let i = 2; i < jmaArr.length; i++) {
      const a = jmaArr[i - 2]
      const b = jmaArr[i - 1]
      const c = jmaArr[i]
      const price = priceArr[i]

      // 买入信号: a > b 且 c > b
      const buySignal = a > b && c > b
      // 卖出信号: a < b 且 c < b
      const sellSignal = a < b && c < b

      if (buySignal && !inPosition) {
        // 全仓买入
        const buyShares = Math.floor(cash / price)
        const cost = buyShares * price
        cash = cash - cost
        shares = buyShares
        inPosition = true

        trades.push({
          type: '买入',
          day: i,
          price: price.toFixed(2),
          shares: buyShares,
          cost: cost.toFixed(2),
          cash: cash.toFixed(2),
          position: '持有',
          signal: '买入信号(a>b且c>b)',
        })
      } else if (sellSignal && inPosition) {
        // 全仓卖出
        const proceeds = shares * price
        cash = cash + proceeds
        inPosition = false

        trades.push({
          type: '卖出',
          day: i,
          price: price.toFixed(2),
          shares: shares,
          proceeds: proceeds.toFixed(2),
          cash: cash.toFixed(2),
          position: '空仓',
          signal: '卖出信号(a<b且c<b)',
        })

        shares = 0
      }
      // 处理连续买入或卖出信号的情况（忽略，只执行一次）
    }

    // 最后一个交易日强制清仓
    const lastDay = priceArr.length - 1
    if (inPosition && lastDay >= 0) {
      const lastPrice = priceArr[lastDay]
      const finalProceeds = shares * lastPrice
      cash = cash + finalProceeds

      trades.push({
        type: '强制卖出',
        day: lastDay,
        price: lastPrice.toFixed(2),
        shares: shares,
        proceeds: finalProceeds.toFixed(2),
        cash: cash.toFixed(2),
        position: '空仓',
        signal: '最后一个交易日强制清仓',
      })

      shares = 0
      inPosition = false
    }

    const finalCapital = cash
    const returnRate = (((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2)

    return {
      trades,
      initialCapital,
      finalCapital,
      returnRate,
      totalTrades: trades.filter(t => t.type === '买入' || t.type === '卖出').length,
    }
  }

  /**
   * 买入并持有策略回测
   * @param {Array} priceArr - 价格数组
   * @param {number} initialCapital - 初始资金
   * @returns {Object} 持有策略结果
   */
  const backtestHoldStrategy = (priceArr, initialCapital) => {
    if (priceArr.length < 2) {
      return {
        initialCapital,
        finalCapital: initialCapital,
        returnRate: '0.00',
        buyPrice: 0,
        sellPrice: 0,
        buyDay: 0,
        sellDay: 0,
      }
    }

    const buyPrice = priceArr[0]
    const sellPrice = priceArr[priceArr.length - 1]
    const buyDay = 0
    const sellDay = priceArr.length - 1

    const shares = Math.floor(initialCapital / buyPrice)
    const cost = shares * buyPrice
    const finalProceeds = shares * sellPrice
    const finalCapital = initialCapital - cost + finalProceeds
    const returnRate = (((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2)

    return {
      buyDay,
      buyPrice: buyPrice.toFixed(2),
      shares,
      cost: cost.toFixed(2),
      sellDay,
      sellPrice: sellPrice.toFixed(2),
      proceeds: finalProceeds.toFixed(2),
      initialCapital,
      finalCapital,
      returnRate,
    }
  }

  /**
   * 比较两种策略
   * @param {Object} strategy - 交易策略结果
   * @param {Object} hold - 持有策略结果
   * @returns {Object} 比较结果
   */
  const compareStrategies = (strategy, hold) => {
    const strategyFinal = parseFloat(strategy.finalCapital)
    const holdFinal = parseFloat(hold.finalCapital)
    const difference = strategyFinal - holdFinal
    const diffRate = ((difference / holdFinal) * 100).toFixed(2)

    const winner =
      strategyFinal > holdFinal ? '交易策略' : strategyFinal < holdFinal ? '买入持有' : '持平'

    return {
      winner,
      strategyFinalCapital: strategy.finalCapital,
      holdFinalCapital: hold.finalCapital,
      difference: difference.toFixed(2),
      diffRate,
      comparison: `${winner}更优，差额 ¥${difference.toFixed(2)} (${diffRate}%)`,
    }
  }

  const runBacktest = stockData => {
    const priceArr = stockData.priceArr
    const jma = calculateJMA(priceArr)
    console.log('priceArr:', priceArr)
    console.log('jmaArr:', jma)
    const originArr = priceArr.slice(-500)
    const jmaArr = jma.slice(-500)

    // 交易策略回测
    const initialCapital = 1000000
    const strategyResult = backtestStrategy(originArr, jmaArr, initialCapital)
    const holdResult = backtestHoldStrategy(originArr, initialCapital)

    console.log('交易策略结果:', strategyResult)
    console.log('买入持有策略结果:', holdResult)
    console.log('策略对比:', compareStrategies(strategyResult, holdResult))

    // 更新到响应式数据（不覆盖原始数据）
    backtestResult.value = {
      strategy: strategyResult,
      hold: holdResult,
      comparison: compareStrategies(strategyResult, holdResult),
      priceArr: originArr,
      jmaArr: jmaArr,
      stockInfo: stockData,
    }
  }

  const fetchData = async () => {
    loading.value = true
    trainingProgress.value = '正在获取历史数据...'
    const result = await getStockHistoricalData()
    res.value = result
    console.log('原始数据:', res.value)

    // 选中第一只股票
    dataObj.value = result[selectedStockIndex.value]
    runBacktest(dataObj.value)

    loading.value = false
  }

  const handleStockChange = index => {
    selectedStockIndex.value = parseInt(index)
    dataObj.value = res.value[index]
    runBacktest(dataObj.value)
  }

  onMounted(() => {
    fetchData()
  })
</script>
<template>
  <div class="backtest-container">
    <h2>交易策略回测系统</h2>
    <div v-if="loading">加载中...</div>
    <div v-else>
      <h3>选择股票</h3>
      <div class="stock-selector">
        <label v-for="(stock, index) in res" :key="index" class="stock-option">
          <input
            v-model="selectedStockIndex"
            type="radio"
            :value="index"
            @change="handleStockChange(index)"
          />
          {{ stock.plate || `股票 ${index + 1}` }}
        </label>
      </div>

      <h3>策略对比</h3>
      <h3>{{ dataObj.plate }}</h3>
      <p>{{ backtestResult.comparison?.comparison }}</p>

      <div class="strategy-section">
        <h3>交易策略（JMA信号）</h3>
        <p>初始资金: ¥{{ Number(backtestResult.strategy?.initialCapital).toLocaleString() }}</p>
        <p>最终资金: ¥{{ Number(backtestResult.strategy?.finalCapital).toLocaleString() }}</p>
        <p>收益率: {{ backtestResult.strategy?.returnRate }}%</p>
        <p>总交易次数: {{ backtestResult.strategy?.totalTrades }}</p>

        <h4>交易明细</h4>
        <table>
          <thead>
            <tr>
              <th>操作</th>
              <th>交易日</th>
              <th>价格</th>
              <th>股数</th>
              <th>金额</th>
              <th>现金</th>
              <th>持仓</th>
              <th>信号</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(trade, index) in backtestResult.strategy?.trades" :key="index">
              <td>{{ trade.type }}</td>
              <td>{{ trade.day }}</td>
              <td>{{ trade.price }}</td>
              <td>{{ trade.shares }}</td>
              <td>{{ trade.cost || trade.proceeds || '-' }}</td>
              <td>{{ trade.cash }}</td>
              <td>{{ trade.position }}</td>
              <td>{{ trade.signal }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="strategy-section">
        <h3>买入并持有策略</h3>
        <p>初始资金: ¥{{ Number(backtestResult.hold?.initialCapital).toLocaleString() }}</p>
        <p>
          买入日: 第{{ backtestResult.hold?.buyDay }}天，价格 ¥{{ backtestResult.hold?.buyPrice }}
        </p>
        <p>
          卖出日: 第{{ backtestResult.hold?.sellDay }}天，价格 ¥{{ backtestResult.hold?.sellPrice }}
        </p>
        <p>买入股数: {{ backtestResult.hold?.shares }}</p>
        <p>买入成本: ¥{{ Number(backtestResult.hold?.cost).toLocaleString() }}</p>
        <p>卖出收入: ¥{{ Number(backtestResult.hold?.proceeds).toLocaleString() }}</p>
        <p>最终资金: ¥{{ Number(backtestResult.hold?.finalCapital).toLocaleString() }}</p>
        <p>收益率: {{ backtestResult.hold?.returnRate }}%</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .backtest-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    color: #333;
    border-bottom: 2px solid #1890ff;
    padding-bottom: 10px;
  }

  h3 {
    color: #1890ff;
    margin-top: 30px;
    margin-bottom: 15px;
  }

  h4 {
    color: #666;
    margin-top: 20px;
    margin-bottom: 10px;
  }

  .strategy-section {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 8px;
    margin-top: 20px;
  }

  .stock-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    padding: 15px;
    background: #f9f9f9;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .stock-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 15px;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    border: 1px solid #ddd;
  }

  .stock-option:hover {
    background: #e6f7ff;
    border-color: #1890ff;
  }

  .stock-option input[type='radio'] {
    cursor: pointer;
  }

  p {
    margin: 8px 0;
    font-size: 14px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 13px;
  }

  thead {
    background: #1890ff;
    color: white;
  }

  th,
  td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: center;
  }

  tbody tr:nth-child(even) {
    background: #f9f9f9;
  }

  tbody tr:hover {
    background: #e6f7ff;
  }
</style>
