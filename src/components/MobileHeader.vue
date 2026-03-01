<template>
  <header class="mobile-header">
    <div class="header-content">
      <button v-if="showBack" class="back-button" @click="handleBack">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 class="header-title">{{ title }}</h1>
      <div v-if="showActions" class="header-actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup>
  // Props
  defineProps({
    title: {
      type: String,
      default: '交易策略',
    },
    showBack: {
      type: Boolean,
      default: false,
    },
    showActions: {
      type: Boolean,
      default: false,
    },
  })

  // Emits
  const emit = defineEmits(['back'])

  // 处理返回按钮点击
  const handleBack = () => {
    emit('back')
  }
</script>

<style scoped lang="scss">
  @use '@/styles/variables.scss' as *;

  .mobile-header {
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: $text-light;
    padding: 16px;
    box-shadow: $shadow-md;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .back-button {
    background: transparent;
    border: none;
    color: $text-light;
    cursor: pointer;
    padding: $spacing-xs;
    border-radius: $border-radius-full;
    transition: background-color $transition-fast;

    &:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  }

  .header-title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .header-actions {
    display: flex;
    gap: $spacing-sm;
  }
</style>
