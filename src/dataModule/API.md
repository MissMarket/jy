# 股票数据模块 API 文档

## 概述

本模块提供股票数据的获取、处理、存储功能。所有数据存储在浏览器的 indexDB 中，数据库名为 `StockDB`，存储对象名为 `stocks`。使用 localStorage 存储日期标志实现每日缓存机制。

## 主要导出方法

### getStockHistoricalData()

**功能**：获取所有股票历史数据。实现每日缓存机制，当日首次调用获取最新数据，后续调用直接从indexDB返回

**参数**：无

**返回值**：
```javascript
Promise<Array> [
  {
    id: string,              // 股票ID
    plate: string,           // 板块名称
    stock: string,           // 股票名称
    fund: string,            // 基金名称
    dateArr: string[],       // 日期数组
    priceArr: number[],      // 价格数组
    volumnArr: number[],     // 成交量数组
    years: number[],         // 数据年份
    dateRange: {
      start: string,         // 数据起始日期
      end: string           // 数据结束日期
    },
    totalDays: number,       // 数据总条数
    lastUpdated: string      // 最后更新时间
  },
  // ... 更多股票数据
]
```

**使用示例**：
```javascript
import { getStockHistoricalData } from './dataModule/index.js';

try {
    const stockData = await getStockHistoricalData();
    console.log(`获取到 ${stockData.length} 只股票的数据`);
    
    // 遍历所有股票数据
    stockData.forEach(stock => {
        console.log(`${stock.stock} (${stock.id}) - ${stock.dateArr.length} 条记录`);
        console.log(`数据年份: ${stock.years.join(', ')}`);
        console.log(`时间范围: ${stock.dateRange.start} 至 ${stock.dateRange.end}`);
    });
} catch (error) {
    console.error('获取股票数据失败:', error.message);
}
```

**工作流程**：
1. 检查localStorage中的日期标志，判断是否需要刷新数据
2. 如果当日已缓存且数据存在，直接从indexDB返回数据
3. 如果是新日期或数据不存在，从API获取最新数据并存储到indexDB
4. 获取成功后更新localStorage中的日期标志
5. 返回获取到的所有股票数据

**缓存机制**：
- **每日缓存**：当日首次调用获取数据，后续调用直接返回indexDB数据
- **日期标志**：使用`stockData_cacheDate`记录缓存日期（localStorage）
- **数据存储**：股票数据存储在indexDB中，不占用localStorage空间
- **自动刷新**：检测到新日期自动刷新数据
- **容错处理**：localStorage读写异常时有完整的错误处理

**数据获取逻辑**：
- 动态计算时间范围：从5年前1月1日到昨天
- 分三次获取：
  - 第一次：5年前1月1日至3年前12月31日
  - 第二次：3年前1月1日至1年前12月31日
  - 第三次：1年前1月1日至昨天
- 获取后按日期排序合并，形成完整时间序列

## 数据结构说明

### 股票数据对象格式
```javascript
{
  id: string,              // 股票唯一标识
  plate: string,           // 所属板块
  stock: string,           // 股票名称
  fund: string,            // 关联基金
  dateArr: string[],       // 日期数组 (格式: YYYY-MM-DD)
  priceArr: number[],      // 收盘价数组
  volumnArr: number[],     // 成交量数组
  years: number[],         // 包含的年份列表
  dateRange: {            // 数据时间范围
    start: string,         // 起始日期
    end: string           // 结束日期
  },
  totalDays: number,       // 数据总条数
  lastUpdated: string      // 数据最后更新时间 (ISO格式)
}
```

## 使用注意事项

1. **存储分离**：
   - 股票数据存储在indexDB中，支持大量数据存储
   - 日期标志存储在localStorage中，用于缓存判断

2. **缓存逻辑**：
   - 每日首次访问会重新获取数据
   - 同一天内的多次调用直接从indexDB返回，性能优秀

3. **错误处理**：
   - localStorage读写异常不会中断程序执行
   - 单个股票获取失败不影响其他股票处理

4. **性能考虑**：
   - 首次处理需要时间，根据股票数量和网络状况
   - 后续调用几乎零延迟
   - 数据存储在浏览器本地，无需网络请求

## 完整使用示例

```javascript
import { getStockHistoricalData } from './dataModule/index.js';

// 获取股票数据
async function displayStockData() {
    try {
        // 每日首次调用会获取最新数据，后续调用直接返回缓存
        const stockData = await getStockHistoricalData();
        
        console.log('=== 股票数据概览 ===');
        stockData.forEach((stock, index) => {
            console.log(`${index + 1}. ${stock.stock}`);
            console.log(`   ID: ${stock.id}`);
            console.log(`   板块: ${stock.plate}`);
            console.log(`   基金: ${stock.fund}`);
            console.log(`   数据量: ${stock.totalDays} 条记录`);
            console.log(`   时间范围: ${stock.dateRange.start} 至 ${stock.dateRange.end}`);
            console.log(`   最新价格: ${stock.priceArr[stock.priceArr.length - 1]}`);
            console.log('---');
        });
        
        // 可以进一步处理数据，如计算收益率、绘制图表等
        return stockData;
        
    } catch (error) {
        console.error('获取股票数据失败:', error.message);
        // 可以在这里添加错误处理逻辑，如显示错误提示等
    }
}

// 执行数据获取
displayStockData();
```