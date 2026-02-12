<template>
  <div class="stock-selector">
    <div class="selector-header">
      <h3 class="selector-title">{{ title }}</h3>
    </div>
    <div class="selector-body">
      <RadioGroup v-model="selectedStockIndex" @change="handleStockChange">
        <RadioButton
          v-for="(stock, index) in stocks"
          :key="index"
          :label="index"
          class="stock-radio"
        >
          {{ stock.plate || `股票 ${index + 1}` }}
        </RadioButton>
      </RadioGroup>
    </div>
  </div>
</template>

<script setup>
  import { ref, watch } from 'vue'

  // Props
  const props = defineProps({
    title: {
      type: String,
      default: '选择股票',
    },
    stocks: {
      type: Array,
      default: () => [],
    },
    modelValue: {
      type: Number,
      default: 0,
    },
  })

  // Emits
  const emit = defineEmits(['update:modelValue', 'stockChange'])

  // 响应式数据
  const selectedStockIndex = ref(props.modelValue)

  // 监听modelValue变化
  watch(
    () => props.modelValue,
    newValue => {
      selectedStockIndex.value = newValue
    },
  )

  // 处理股票选择变化
  const handleStockChange = index => {
    const selectedIndex = parseInt(index)
    selectedStockIndex.value = selectedIndex
    emit('update:modelValue', selectedIndex)
    emit('stockChange', selectedIndex)
  }
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .stock-selector {
    background-color: $bg-secondary;
    border-radius: $border-radius-lg;
    padding: $spacing-lg;
    box-shadow: $shadow-sm;
  }

  .selector-header {
    margin-bottom: $spacing-md;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid $border-color;
  }

  .selector-title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0;
  }

  .selector-body {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .stock-radio {
    margin-right: $spacing-md;
    margin-bottom: $spacing-sm;

    :deep(.el-radio-button__inner) {
      border-radius: $border-radius-md;
      padding: $spacing-sm $spacing-md;
      font-size: $font-size-sm;
      transition: all $transition-fast;

      &:hover {
        border-color: $primary-color;
        color: $primary-color;
      }
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      background-color: $primary-color;
      border-color: $primary-color;
      color: $text-light;
    }
  }

  // 响应式调整
  @media (max-width: $breakpoint-mobile) {
    .selector-body {
      flex-direction: column;
      gap: $spacing-xs;
    }

    .stock-radio {
      margin-right: 0;
      margin-bottom: $spacing-xs;

      :deep(.el-radio-button__inner) {
        width: 100%;
        text-align: center;
      }
    }
  }
</style>
