<template>
  <div class="strategy-result">
    <div class="result-header">
      <h3 class="result-title">{{ title }}</h3>
    </div>
    <div class="result-body">
      <!-- 策略对比结果 -->
      <div v-if="comparison" class="comparison-section">
        <Alert
          :title="comparison.comparison"
          :type="comparison.winner === '交易策略' ? 'success' : 'warning'"
          :closable="false"
          show-icon
          class="comparison-alert"
        />
      </div>

      <!-- 交易策略结果 -->
      <div v-if="strategy" class="strategy-section">
        <h4 class="section-subtitle">{{ strategyTitle }}</h4>
        <Descriptions :column="1" border class="strategy-descriptions">
          <DescriptionsItem label="初始资金">
            ¥{{ Number(strategy.initialCapital).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="最终资金">
            ¥{{ Number(strategy.finalCapital).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="收益率">
            <Tag :type="parseFloat(strategy.returnRate) > 0 ? 'success' : 'danger'">
              {{ strategy.returnRate }}%
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="总交易次数">
            {{ strategy.totalTrades }}
          </DescriptionsItem>
        </Descriptions>
      </div>

      <!-- 持有策略结果 -->
      <div v-if="hold" class="hold-section">
        <h4 class="section-subtitle">{{ holdTitle }}</h4>
        <Descriptions :column="1" border class="hold-descriptions">
          <DescriptionsItem label="初始资金">
            ¥{{ Number(hold.initialCapital).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="买入日">
            第{{ hold.buyDay }}天，价格 ¥{{ hold.buyPrice }}
          </DescriptionsItem>
          <DescriptionsItem label="卖出日">
            第{{ hold.sellDay }}天，价格 ¥{{ hold.sellPrice }}
          </DescriptionsItem>
          <DescriptionsItem label="买入股数">
            {{ hold.shares }}
          </DescriptionsItem>
          <DescriptionsItem label="买入成本">
            ¥{{ Number(hold.cost).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="卖出收入">
            ¥{{ Number(hold.proceeds).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="最终资金">
            ¥{{ Number(hold.finalCapital).toLocaleString() }}
          </DescriptionsItem>
          <DescriptionsItem label="收益率">
            <Tag :type="parseFloat(hold.returnRate) > 0 ? 'success' : 'danger'">
              {{ hold.returnRate }}%
            </Tag>
          </DescriptionsItem>
        </Descriptions>
      </div>
    </div>
  </div>
</template>

<script setup>
  // Props
  defineProps({
    title: {
      type: String,
      default: '策略结果',
    },
    strategyTitle: {
      type: String,
      default: '交易策略',
    },
    holdTitle: {
      type: String,
      default: '买入持有策略',
    },
    strategy: {
      type: Object,
      default: null,
    },
    hold: {
      type: Object,
      default: null,
    },
    comparison: {
      type: Object,
      default: null,
    },
  })
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .strategy-result {
    background-color: $bg-secondary;
    border-radius: $border-radius-lg;
    padding: $spacing-lg;
    box-shadow: $shadow-sm;
  }

  .result-header {
    margin-bottom: $spacing-md;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid $border-color;
  }

  .result-title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0;
  }

  .result-body {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .comparison-section {
    margin-bottom: $spacing-sm;
  }

  .comparison-alert {
    border-radius: $border-radius-md;
  }

  .strategy-section,
  .hold-section {
    background-color: $bg-tertiary;
    border-radius: $border-radius-md;
    padding: $spacing-md;
  }

  .section-subtitle {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-md 0;
  }

  .strategy-descriptions,
  .hold-descriptions {
    border-radius: $border-radius-sm;

    :deep(.el-descriptions__label) {
      font-weight: $font-weight-medium;
      color: $text-secondary;
    }

    :deep(.el-descriptions__cell) {
      padding: $spacing-sm;
    }
  }

  // 响应式调整
  @media (max-width: $breakpoint-mobile) {
    .strategy-result {
      padding: $spacing-md;
    }

    .strategy-section,
    .hold-section {
      padding: $spacing-sm;
    }
  }
</style>
