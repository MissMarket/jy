<template>
  <div class="trading-signal">
    <div v-if="shape" class="signal-item">
      <span class="signal-label">{{ shapeLabel }}</span>
      <span class="signal-value" :style="{ color: shape.color }">
        {{ shape.shape }}
      </span>
    </div>
    <div v-if="signal" class="signal-item">
      <span class="signal-label">{{ signalLabel }}</span>
      <span class="signal-value" :style="{ color: signal.color }">
        {{ signal.signal }}
      </span>
    </div>
  </div>
</template>

<script setup>
  // Props
  defineProps({
    shape: {
      type: Object,
      default: null,
    },
    signal: {
      type: Object,
      default: null,
    },
    shapeLabel: {
      type: String,
      default: '交易形态',
    },
    signalLabel: {
      type: String,
      default: '交易信号',
    },
  })
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .trading-signal {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .signal-item {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: $bg-tertiary;
    border-radius: $border-radius-sm;
  }

  .signal-label {
    font-size: $font-size-sm;
    color: $text-secondary;
    font-weight: $font-weight-medium;
  }

  .signal-value {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
  }

  // 响应式调整
  @media (max-width: $breakpoint-mobile) {
    .signal-item {
      padding: $spacing-xs;
    }

    .signal-label,
    .signal-value {
      font-size: $font-size-xs;
    }
  }
</style>
