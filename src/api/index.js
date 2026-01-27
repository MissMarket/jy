import axios from 'axios'

const instance = axios.create({
  baseURL: import.meta.env.DEV ? '' : 'https://web.ifzq.gtimg.cn',
  timeout: 10000,
})

instance.interceptors.request.use(config => {
  if (import.meta.env.DEV && !config.url.startsWith('/api')) {
    config.url = '/api' + config.url
  }
  return config
})

export const getData = (indexFundInfo, baseDay, endDay) => {
  const id = indexFundInfo.id.toLowerCase()
  const { fund, stock, plate } = indexFundInfo
  const url = `/appstock/app/fqkline/get?param=${id},day,${baseDay},${endDay},600,qfq`
  return new Promise(resolve => {
    instance.get(url).then(res => {
      const allArr = res.data.data[id].day || res.data.data[id].qfqday
      const dateArr = []
      const openArr = []
      const priceArr = []
      const highArr = []
      const lowArr = []
      const volumnArr = []
      allArr.forEach(item => {
        dateArr.push(item[0])
        openArr.push(parseFloat(item[1]))
        priceArr.push(parseFloat(item[2]))
        highArr.push(parseFloat(item[3]))
        lowArr.push(parseFloat(item[4]))
        volumnArr.push(parseFloat(item[5]))
      })
      resolve({
        id,
        plate,
        stock,
        fund,
        dateArr,
        priceArr,
        openArr,
        highArr,
        lowArr,
        volumnArr,
      })
    })
  })
}

export default { getData }
