<template>
  <div class="stock-selector">
    <div class="selector-header">
      <h3 class="selector-title">{{ title }}</h3>
    </div>
    <div class="selector-body">
      <div
        v-for="(stock, index) in stocks"
        :key="index"
        class="stock-item"
        :class="{ active: selectedStockIndex === index }"
        @click="handleStockChange(index)"
      >
        {{ stock.plate || `股票 ${index + 1}` }}
      </div>
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
    width: 100%;
  }

  .stock-item {
    width: 10%;
    text-align: center;
    padding: $spacing-sm 0;
    cursor: pointer;
    transition: all $transition-fast;
    border: 1px solid $border-color;
    box-sizing: border-box;

    &:hover {
      border-color: $primary-color;
      color: $primary-color;
    }

    &.active {
      background-color: $primary-color;
      border-color: $primary-color;
      color: $text-light;
    }
  }

  // 响应式调整
  @media (max-width: $breakpoint-mobile) {
    .stock-item {
      width: 20%;
    }
  }
</style>
