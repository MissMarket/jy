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

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' })
            }
        }
    })
}



/**
 * 批量存储股票数据
 * @param {Array} stockDataList - 股票数据数组
 * @returns {Promise<boolean>} 存储是否成功
 */
const batchSaveStockData = async (stockDataList) => {
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
 * 获取股票数据，分三次获取5年数据
 * 第一次：5年前1月1日 - 3年前12月31日（2年）
 * 第二次：3年前1月1日 - 1年前12月31日（2年）
 * 第三次：1年前1月1日 - 昨天（约1年）
 * @param {Object} stockInfo - 股票信息对象
 * @returns {Promise<Array>} 获取到的数据数组
 */
const fetchStockDataForYears = async (stockInfo) => {
    const today = dayjs()
    const yesterday = today.subtract(1, 'day')

    // 计算5年前的年份作为起始年
    const startYear = today.subtract(5, 'year').year()

    // 计算三个时间段的年份
    const firstYear = startYear           // 5年前的年份，如2020
    const secondYear = startYear + 2       // 起始年+2，如2022
    const thirdYear = startYear + 4        // 起始年+4，如2024

    // 定义三个时间段的获取计划，按连续年份分配5年数据
    const fetchRanges = [
        {
            start: `${firstYear}-01-01`,
            end: `${firstYear + 1}-12-31`,
            description: `${firstYear}年1月1日至${firstYear + 1}年12月31日`,
        },
        {
            start: `${secondYear}-01-01`,
            end: `${secondYear + 1}-12-31`,
            description: `${secondYear}年1月1日至${secondYear + 1}年12月31日`,
        },
        {
            start: `${thirdYear}-01-01`,
            end: yesterday.format('YYYY-MM-DD'),
            description: `${thirdYear}年1月1日至${yesterday.format('YYYY-MM-DD')}`,
        },
    ]

    const allData = []

    for (let i = 0; i < fetchRanges.length; i++) {
        const range = fetchRanges[i]
        try {
            console.log(`获取${stockInfo.stock}第${i + 1}段数据: ${range.description}`)

            const data = await getData(stockInfo, range.start, range.end)
            allData.push({
                ...data,
                dateRange: range,
                segment: i + 1,
            })

            // 添加延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
            console.error(`获取${stockInfo.stock}第${i + 1}段数据失败:`, error)
            // 继续处理下一段，不中断整个流程
        }
    }

    return allData
}

/**
 * 合并所有时间段的数据为一个完整的时间序列
 * @param {Array} segmentData - 分段数据数组
 * @returns {Object|null} 合并后的数据对象
 */
const mergeSegmentData = (segmentData) => {
    if (segmentData.length === 0) return null

    const baseData = segmentData[0]

    // 合并所有数据
    let allDates = []
    let allPrices = []
    let allVolumes = []

    // 收集所有数据
    segmentData.forEach(segment => {
        allDates.push(...segment.dateArr)
        allPrices.push(...segment.priceArr)
        allVolumes.push(...segment.volumnArr)
    })

    // 创建日期索引数组并按日期排序
    const indexedData = allDates.map((date, index) => ({
        date: date,
        price: allPrices[index],
        volume: allVolumes[index],
        timestamp: dayjs(date).valueOf(),
    }))

    // 按时间戳排序
    indexedData.sort((a, b) => a.timestamp - b.timestamp)

    // 重新提取排序后的数据
    const sortedDates = indexedData.map(item => item.date)
    const sortedPrices = indexedData.map(item => item.price)
    const sortedVolumes = indexedData.map(item => item.volume)

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
const setCacheDate = (date) => {
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
 * 处理股票数据并存储到indexDB
 * @returns {Promise<Object>} 处理结果对象
 */
const processAndStoreStockData = async () => {
    try {
        console.log('开始处理股票数据...')

        const today = dayjs()
        const fiveYearsAgo = today.subtract(5, 'year')
        const yesterday = today.subtract(1, 'day')

        console.log(`数据获取范围: ${fiveYearsAgo.format('YYYY-MM-DD')} 至 ${yesterday.format('YYYY-MM-DD')}`)

        const processedStocks = []

        // 遍历所有股票
        for (const stockInfo of stocks) {
            try {
                console.log(`正在处理: ${stockInfo.stock} (${stockInfo.id})`)

                // 分三次获取5年数据
                const segmentData = await fetchStockDataForYears(stockInfo)

                // 合并所有时间段的数据
                const mergedData = mergeSegmentData(segmentData)

                if (mergedData && mergedData.dateArr.length > 0) {
                    processedStocks.push(mergedData)
                    console.log(`${stockInfo.stock} 数据处理完成，共${mergedData.dateArr.length}条记录，时间范围: ${mergedData.dateRange.start} 至 ${mergedData.dateRange.end}`)
                } else {
                    console.warn(`${stockInfo.stock} 未能获取到有效数据`)
                }

            } catch (error) {
                console.error(`处理${stockInfo.stock}时发生错误:`, error)
                // 继续处理下一只股票
            }
        }

        // 批量存储到indexDB
        if (processedStocks.length > 0) {
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
        console.log(needRefresh ? '检测到新日期，开始刷新股票数据...' : '数据库中暂无数据，开始获取并存储...')

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