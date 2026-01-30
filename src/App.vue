<template>
  <Container class="layout-container">
    <ElAside width="200px" class="layout-aside">
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
  import { ref, shallowRef } from 'vue'
  import { Histogram, DataLine, TrendCharts } from '@element-plus/icons-vue'
  import Home from '@/views/home/index.vue'
  import BaseData from '@/views/basedata/index.vue'
  import Strategy from '@/views/strategy/index.vue'

  const activeMenu = ref('home')
  const currentComponent = shallowRef(Home)

  const components = {
    home: Home,
    basedata: BaseData,
    strategy: Strategy,
  }

  const handleMenuSelect = index => {
    activeMenu.value = index
    currentComponent.value = components[index]
  }
</script>

<style scoped>
  .layout-container {
    height: 100vh;
  }

  .layout-aside {
    background-color: #001529;
    overflow-x: hidden;
  }

  .layout-menu {
    border-right: none;
    height: 100%;
    background-color: #001529;
  }

  .layout-menu :deep(.el-menu-item) {
    color: rgba(255, 255, 255, 0.65);
  }

  .layout-menu :deep(.el-menu-item:hover) {
    background-color: #1890ff;
    color: #fff;
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    background-color: #1890ff;
    color: #fff;
  }

  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 8px;
  }

  .layout-main {
    background-color: #f0f2f5;
    padding: 20px;
    height: 100vh;
    overflow-y: auto;
  }
</style>
