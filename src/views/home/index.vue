<script setup>
import { getStockHistoricalData } from '@/dataModule/index.js'
import { ref, onMounted } from 'vue'

defineProps({
  title: {
    type: String,
    default: '默认标题',
  },
})

const res = ref([])
const loading = ref(true)

const fetchData = async () => {
  try {
    loading.value = true
    const result = await getStockHistoricalData()
    res.value = result
    console.log('result', res.value)
  } catch (error) {
    console.error('获取数据失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <h1 v-if="!loading && res.length > 0">
      {{ res[0].plate }}
    </h1>
    <p v-else-if="loading">
      Loading data...
    </p>
    <p v-else>
      No data available
    </p>
  </div>
</template>