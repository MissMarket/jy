<template>
  <!-- 移动端专用页面 -->
  <div v-if="isMobile" class="mobile-app">
    <MobileStrategy />
  </div>

  <!-- PC端布局 -->
  <Container v-else class="layout-container">
    <ElAside :width="sidebarWidth" class="layout-aside">
      <ElMenu :default-active="activeMenu" class="layout-menu" @select="handleMenuSelect">
        <MenuItem index="home">
          <Icon><Histogram /></Icon>
          <span>交易策略回测</span>
        </MenuItem>
        <MenuItem index="basedata">
          <Icon><DataLine /></Icon>
          <span>历史数据查询</span>
        </MenuItem>
        <MenuItem index="strategy">
          <Icon><TrendCharts /></Icon>
          <span>交易策略评估</span>
        </MenuItem>
      </ElMenu>
    </ElAside>

    <ElMain class="layout-main">
      <component :is="currentComponent" />
    </ElMain>
  </Container>
</template>

<script setup>
  import { ref, shallowRef, computed } from 'vue'
  import { Histogram, DataLine, TrendCharts } from '@element-plus/icons-vue'
  import Home from '@/views/home/index.vue'
  import BaseData from '@/views/basedata/index.vue'
  import Strategy from '@/views/strategy/index.vue'
  import MobileStrategy from '@/views/mobile/Strategy.vue'
  import { useResponsive } from '@/composables/useResponsive'

  // 响应式管理
  const { isMobile, getLayoutConfig } = useResponsive()

  // 侧边栏宽度
  const sidebarWidth = computed(() => {
    const config = getLayoutConfig()
    return config.sidebarWidth || '200px'
  })

  // 导航状态
  const activeMenu = ref('home')
  const currentComponent = shallowRef(Home)

  // 组件映射
  const components = {
    home: Home,
    basedata: BaseData,
    strategy: Strategy,
  }

  // 菜单选择处理
  const handleMenuSelect = index => {
    activeMenu.value = index
    currentComponent.value = components[index]
  }
</script>

<style scoped lang="scss">
  @import '@/styles/variables.scss';

  .mobile-app {
    min-height: 100vh;
    background-color: $bg-primary;
  }

  .layout-container {
    height: 100vh;
  }

  .layout-aside {
    background: linear-gradient(180deg, $primary-color 0%, $secondary-color 100%);
    overflow-x: hidden;
    box-shadow: $shadow-md;
  }

  .layout-menu {
    border-right: none;
    height: 100%;
    background: transparent;
  }

  .layout-menu :deep(.el-menu-item) {
    color: rgba(255, 255, 255, 0.9);
    margin: 8px 12px;
    border-radius: $border-radius-md;
    transition: all $transition-fast;
  }

  .layout-menu :deep(.el-menu-item:hover) {
    background-color: rgba(255, 255, 255, 0.2);
    color: #fff;
    transform: translateX(4px);
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    background-color: rgba(255, 255, 255, 0.3);
    color: #fff;
    font-weight: $font-weight-medium;
  }

  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 12px;
    font-size: 18px;
  }

  .layout-main {
    background-color: $bg-primary;
    height: 100vh;
    overflow-y: auto;
  }
</style>
