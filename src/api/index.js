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
    const {
        fund,
        stock,
        plate,
    } = indexFundInfo
    const url = `/appstock/app/fqkline/get?param=${id},day,${baseDay},${endDay},600,qfq`
    return new Promise((resolve) => {
        instance.get(url).then(res => {
            const allArr = res.data.data[id].day || res.data.data[id].qfqday
            const dateArr = []
            const priceArr = []
            const volumnArr = []
            allArr.forEach((item) => {
                dateArr.push(item[0])
                priceArr.push(parseFloat(item[2]))
                volumnArr.push(parseFloat(item[5]))
            })
            resolve({
                id,
                plate,
                stock,
                fund,
                dateArr,
                priceArr,
                volumnArr,
            })
        })
    })

}

export default { getData }