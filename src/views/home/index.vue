<script setup>
  import { getStockHistoricalData } from '@/dataModule'
  import { ref, onMounted } from 'vue'

  defineProps({
    title: {
      type: String,
      default: '多因子策略回测系统',
    },
  })
  const res = ref([])
  const loading = ref(true)
  const trainingProgress = ref('')
  const fetchData = async () => {
    loading.value = true
    trainingProgress.value = '正在获取历史数据...'
    const result = await getStockHistoricalData()
    res.value = result
    console.log('原始数据:', res.value)
  }
  onMounted(() => {
    fetchData()
  })
</script>
<template>
  <div>空空如也</div>
</template>
