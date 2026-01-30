<script setup>
  import { getStockHistoricalData } from '@/dataModule'
  import { ref, onMounted } from 'vue'
  import { Histogram } from '@element-plus/icons-vue'
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
    <Card shadow="never">
      <template #header>
        <div class="page-header">
          <Icon class="header-icon">
            <Histogram />
          </Icon>
          <span class="header-title">交易策略回测系统</span>
        </div>
      </template>

      <Card v-if="loading" style="margin-top: 20px">
        <Skeleton :rows="5" animated />
      </Card>

      <Space v-else direction="vertical" style="width: 100%" :size="20">
        <Card>
          <template #header>
            <div class="card-header">
              <span>选择股票</span>
            </div>
          </template>
          <RadioGroup v-model="selectedStockIndex" @change="handleStockChange">
            <RadioButton v-for="(stock, index) in res" :key="index" :label="index">
              {{ stock.plate || `股票 ${index + 1}` }}
            </RadioButton>
          </RadioGroup>
        </Card>

        <Card>
          <template #header>
            <div class="card-header">
              <span>策略对比 - {{ dataObj.plate }}</span>
            </div>
          </template>
          <Alert
            :title="backtestResult.comparison?.comparison"
            :type="backtestResult.comparison?.winner === '交易策略' ? 'success' : 'warning'"
            :closable="false"
            show-icon
          />
        </Card>

        <Row :gutter="20">
          <ElCol :span="12">
            <Card>
              <template #header>
                <div class="card-header">
                  <span>交易策略（JMA信号）</span>
                </div>
              </template>
              <Descriptions :column="1" border>
                <DescriptionsItem label="初始资金">
                  ¥{{ Number(backtestResult.strategy?.initialCapital).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="最终资金">
                  ¥{{ Number(backtestResult.strategy?.finalCapital).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="收益率">
                  <Tag
                    :type="
                      parseFloat(backtestResult.strategy?.returnRate) > 0 ? 'success' : 'danger'
                    "
                  >
                    {{ backtestResult.strategy?.returnRate }}%
                  </Tag>
                </DescriptionsItem>
                <DescriptionsItem label="总交易次数">
                  {{ backtestResult.strategy?.totalTrades }}
                </DescriptionsItem>
              </Descriptions>

              <Divider content-position="left"> 交易明细 </Divider>
              <ElTable
                :data="backtestResult.strategy?.trades || []"
                border
                stripe
                max-height="400"
                style="width: 100%"
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
            <Card>
              <template #header>
                <div class="card-header">
                  <span>买入并持有策略</span>
                </div>
              </template>
              <Descriptions :column="1" border>
                <DescriptionsItem label="初始资金">
                  ¥{{ Number(backtestResult.hold?.initialCapital).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="买入日">
                  第{{ backtestResult.hold?.buyDay }}天，价格 ¥{{ backtestResult.hold?.buyPrice }}
                </DescriptionsItem>
                <DescriptionsItem label="卖出日">
                  第{{ backtestResult.hold?.sellDay }}天，价格 ¥{{ backtestResult.hold?.sellPrice }}
                </DescriptionsItem>
                <DescriptionsItem label="买入股数">
                  {{ backtestResult.hold?.shares }}
                </DescriptionsItem>
                <DescriptionsItem label="买入成本">
                  ¥{{ Number(backtestResult.hold?.cost).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="卖出收入">
                  ¥{{ Number(backtestResult.hold?.proceeds).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="最终资金">
                  ¥{{ Number(backtestResult.hold?.finalCapital).toLocaleString() }}
                </DescriptionsItem>
                <DescriptionsItem label="收益率">
                  <Tag
                    :type="parseFloat(backtestResult.hold?.returnRate) > 0 ? 'success' : 'danger'"
                  >
                    {{ backtestResult.hold?.returnRate }}%
                  </Tag>
                </DescriptionsItem>
              </Descriptions>
            </Card>
          </ElCol>
        </Row>
      </Space>
    </Card>
  </div>
</template>

<style scoped>
  .backtest-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 500;
    color: #1890ff;
  }

  .header-icon {
    font-size: 20px;
  }

  .header-title {
    font-weight: 600;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
  }
</style>
