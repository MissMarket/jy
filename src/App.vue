<template>
  <!-- 移动端专用页面 -->
  <div v-if="isMobile" class="mobile-app">
    <MobileStrategy />
  </div>

  <!-- PC端布局 -->
  <Container v-else class="layout-container">
    <ElAside :width="sidebarWidth" class="layout-aside">
      <ElMenu :default-active="activeMenu" class="layout-menu" @select="handleMenuSelect">
        <MenuItem index="strategy">
          <Icon><TrendCharts /></Icon>
          <span>交易策略评估</span>
        </MenuItem>
        <MenuItem index="home">
          <Icon><Histogram /></Icon>
          <span>交易策略回测</span>
        </MenuItem>
        <MenuItem index="basedata">
          <Icon><DataLine /></Icon>
          <span>历史数据查询</span>
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
  const activeMenu = ref('strategy')
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
    background-color: #f2f2f7;
  }

  .layout-container {
    height: 100vh;
  }

  .layout-aside {
    background-color: #ffffff;
    overflow: hidden;
    border-right: 1px solid #e0e0e0;
  }

  .layout-menu {
    border-right: none;
    background: transparent;
    padding: 16px 0;
  }

  .layout-menu :deep(.el-menu-item) {
    color: #333333;
    margin: 0 12px 8px 12px;
    border-radius: 0;
    transition: all 0.2s ease;
    padding: 12px 16px;
    border: 1px solid transparent;
    font-size: 14px;
    font-weight: 500;
  }

  .layout-menu :deep(.el-menu-item:hover) {
    background-color: #f5f5f5;
    color: #007aff;
    border-color: #007aff;
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    background-color: #007aff;
    color: #ffffff;
    font-weight: 600;
    border-color: #007aff;
  }

  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 10px;
    font-size: 18px;
  }

  .layout-main {
    background-color: #f2f2f7;
    height: 100vh;
    overflow-y: auto;
  }
</style>
