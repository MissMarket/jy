import stocks from './stocks.js'
import { getData } from '../api/index.js'
import dayjs from 'dayjs'

// ==================== 私有方法 ====================

/**
 * 打开或创建indexDB数据库
 * @param {string} dbName - 数据库名称
 * @param {string} storeName - 存储对象名称
 * @param {number} version - 数据库版本
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
const openDB = (dbName, storeName, version = 1) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = event => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
  })
}

/**
 * 清空数据库中的所有数据
 * @returns {Promise<boolean>} 清空是否成功
 */
const clearAllStockData = async () => {
  try {
    const db = await openDB('StockDB', 'stocks')
    const transaction = db.transaction(['stocks'], 'readwrite')
    const store = transaction.objectStore('stocks')

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => {
        console.log('数据库已清空')
        resolve(true)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('清空数据库失败:', error)
    throw error
  }
}

/**
 * 批量存储股票数据
 * @param {Array} stockDataList - 股票数据数组
 * @returns {Promise<boolean>} 存储是否成功
 */
const batchSaveStockData = async stockDataList => {
  try {
    const db = await openDB('StockDB', 'stocks')
    const transaction = db.transaction(['stocks'], 'readwrite')
    const store = transaction.objectStore('stocks')

    const promises = stockDataList.map(data => {
      return new Promise((resolve, reject) => {
        const request = store.put(data)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    })

    await Promise.all(promises)
    return true
  } catch (error) {
    console.error('批量存储数据失败:', error)
    throw error
  }
}

/**
 * 获取股票数据，获取近500日数据
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Promise<Array>} 获取到的数据数组
 */
const fetchStockDataForYears = async stockInfo => {
  const today = dayjs()
  const yesterday = today.subtract(1, 'day')
  const startDate = today.subtract(800, 'day') // 500天前

  const allData = []

  try {
    console.log(
      `获取${stockInfo.stock}数据: ${startDate.format('YYYY-MM-DD')} 至 ${yesterday.format('YYYY-MM-DD')}`,
    )

    const data = await getData(
      stockInfo,
      startDate.format('YYYY-MM-DD'),
      yesterday.format('YYYY-MM-DD'),
    )
    allData.push({
      ...data,
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: yesterday.format('YYYY-MM-DD'),
      },
    })

    // 添加延迟避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 200))
  } catch (error) {
    console.error(`获取${stockInfo.stock}数据失败:`, error)
  }

  return allData
}

/**
 * 合并所有时间段的数据为一个完整的时间序列
 * @param {Array} segmentData - 分段数据数组
 * @returns {Object|null} 合并后的数据对象
 */
const mergeSegmentData = segmentData => {
  if (segmentData.length === 0) return null

  const baseData = segmentData[0]

  // 合并所有数据
  let allDates = []
  let allPrices = []
  let allVolumes = []
  let allOpens = []
  let allHighs = []
  let allLows = []

  // 收集所有数据
  segmentData.forEach(segment => {
    allDates.push(...segment.dateArr)
    allPrices.push(...segment.priceArr)
    allVolumes.push(...segment.volumnArr)
    if (segment.openArr) allOpens.push(...segment.openArr)
    if (segment.highArr) allHighs.push(...segment.highArr)
    if (segment.lowArr) allLows.push(...segment.lowArr)
  })

  // 创建日期索引数组并按日期排序
  const indexedData = allDates.map((date, index) => ({
    date: date,
    price: allPrices[index],
    volume: allVolumes[index],
    open: allOpens[index] || allPrices[index],
    high: allHighs[index] || allPrices[index],
    low: allLows[index] || allPrices[index],
    timestamp: dayjs(date).valueOf(),
  }))

  // 按时间戳排序
  indexedData.sort((a, b) => a.timestamp - b.timestamp)

  // 重新提取排序后的数据
  const sortedDates = indexedData.map(item => item.date)
  const sortedPrices = indexedData.map(item => item.price)
  const sortedVolumes = indexedData.map(item => item.volume)
  const sortedOpens = indexedData.map(item => item.open)
  const sortedHighs = indexedData.map(item => item.high)
  const sortedLows = indexedData.map(item => item.low)

  // 提取涉及的年份
  const years = [...new Set(sortedDates.map(date => dayjs(date).year()))].sort()

  const mergedData = {
    id: baseData.id,
    plate: baseData.plate,
    stock: baseData.stock,
    fund: baseData.fund,
    dateArr: sortedDates,
    priceArr: sortedPrices,
    volumnArr: sortedVolumes,
    openArr: sortedOpens,
    highArr: sortedHighs,
    lowArr: sortedLows,
    years: years,
    dateRange: {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
    },
    totalDays: sortedDates.length,
  }

  return mergedData
}

// ==================== 私有辅助方法 ====================

/**
 * 获取localStorage中的缓存日期标志
 * @returns {string|null} 缓存的日期字符串或null
 */
const getCacheDate = () => {
  try {
    return localStorage.getItem('stockData_cacheDate')
  } catch (error) {
    console.warn('读取localStorage缓存日期失败:', error)
    return null
  }
}

/**
 * 设置localStorage中的缓存日期标志
 * @param {string} date - 日期字符串
 * @returns {boolean} 是否设置成功
 */
const setCacheDate = date => {
  try {
    localStorage.setItem('stockData_cacheDate', date)
    return true
  } catch (error) {
    console.warn('设置localStorage缓存日期失败:', error)
    return false
  }
}

/**
 * 检查是否需要刷新数据
 * @returns {boolean} 是否需要刷新
 */
const shouldRefreshData = () => {
  const cachedDate = getCacheDate()
  const today = dayjs().format('YYYY-MM-DD')

  // 如果没有缓存日期或日期不匹配，则需要刷新
  return !cachedDate || cachedDate !== today
}

/**
 * 获取所有已存储的股票数据
 * @returns {Promise<Array>} 所有股票数据数组
 */
const getAllStockData = async () => {
  try {
    const db = await openDB('StockDB', 'stocks')
    const transaction = db.transaction(['stocks'], 'readonly')
    const store = transaction.objectStore('stocks')

    const request = store.getAll()

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('获取所有数据失败:', error)
    throw error
  }
}

/**
 * 处理单只股票数据获取
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Promise<Object|null>} 处理后的股票数据或null
 */
const processSingleStock = async stockInfo => {
  try {
    console.log(`正在处理: ${stockInfo.stock} (${stockInfo.id})`)

    // 获取近500日数据
    const segmentData = await fetchStockDataForYears(stockInfo)

    // 合并所有时间段的数据
    const mergedData = mergeSegmentData(segmentData)

    if (mergedData && mergedData.dateArr.length > 0) {
      console.log(
        `${stockInfo.stock} 数据处理完成，共${mergedData.dateArr.length}条记录，时间范围: ${mergedData.dateRange.start} 至 ${mergedData.dateRange.end}`,
      )
      return mergedData
    } else {
      console.warn(`${stockInfo.stock} 未能获取到有效数据`)
      return null
    }
  } catch (error) {
    console.error(`处理${stockInfo.stock}时发生错误:`, error)
    return null
  }
}

/**
 * 处理股票数据并存储到indexDB
 * @returns {Promise<Object>} 处理结果对象
 */
const processAndStoreStockData = async () => {
  try {
    console.log('开始处理股票数据...')

    const today = dayjs()
    const startDate = today.subtract(500, 'day')
    const yesterday = today.subtract(1, 'day')

    console.log(
      `数据获取范围: ${startDate.format('YYYY-MM-DD')} 至 ${yesterday.format('YYYY-MM-DD')} (近500日)`,
    )

    // 使用 Promise.all 并行获取所有股票数据
    const stockPromises = stocks.map(stockInfo => processSingleStock(stockInfo))
    const results = await Promise.all(stockPromises)

    // 过滤掉获取失败的股票
    const processedStocks = results.filter(data => data !== null)

    console.log(`成功获取 ${processedStocks.length}/${stocks.length} 只股票数据`)

    // 批量存储到indexDB
    if (processedStocks.length > 0) {
      // 先清空原有数据
      await clearAllStockData()
      // 存储新数据
      await batchSaveStockData(processedStocks)
      console.log(`成功存储${processedStocks.length}只股票数据到indexDB`)
      return {
        success: true,
        count: processedStocks.length,
        message: '数据处理并存储完成',
      }
    } else {
      return {
        success: false,
        message: '未能获取到任何有效数据',
      }
    }
  } catch (error) {
    console.error('处理股票数据时发生严重错误:', error)
    return {
      success: false,
      error: error.message,
      message: '数据处理失败',
    }
  }
}

// ==================== 公共导出方法 ====================

/**
 * 获取所有股票历史数据
 * 实现每日缓存机制：当日首次调用获取最新数据，后续调用直接从indexDB返回
 * @returns {Promise<Array>} 所有股票历史数据数组
 */
export const getStockHistoricalData = async () => {
  try {
    // 检查是否需要刷新数据
    const needRefresh = shouldRefreshData()

    if (!needRefresh) {
      // 不需要刷新，直接从indexDB获取数据
      const existingData = await getAllStockData()
      if (existingData && existingData.length > 0) {
        console.log(`从indexDB获取到 ${existingData.length} 只股票的缓存数据`)
        return existingData
      }
    }

    // 需要刷新或没有数据，重新获取数据
    console.log(
      needRefresh ? '检测到新日期，开始刷新股票数据...' : '数据库中暂无数据，开始获取并存储...',
    )

    // 获取并存储最新数据
    const result = await processAndStoreStockData()

    if (result.success) {
      // 获取最新数据
      const newData = await getAllStockData()

      if (newData && newData.length > 0) {
        // 更新缓存日期标志
        const today = dayjs().format('YYYY-MM-DD')
        const cacheDateSet = setCacheDate(today)

        if (cacheDateSet) {
          console.log(`成功更新缓存日期：${today}，共 ${newData.length} 只股票数据`)
        } else {
          console.warn('缓存日期更新失败，但数据已成功获取')
        }

        console.log(`成功获取并存储了 ${newData.length} 只股票的最新数据`)
        return newData
      } else {
        throw new Error('数据获取成功但结果为空')
      }
    } else {
      throw new Error(result.message || '数据获取失败')
    }
  } catch (error) {
    console.error('获取股票历史数据失败:', error)
    throw error
  }
}
