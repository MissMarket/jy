import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import './styles/global.scss'

// 全局注册Element Plus组件
import {
  ElContainer,
  ElAside,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElIcon,
  ElCard,
  ElSpace,
  ElRadioGroup,
  ElRadioButton,
  ElAlert,
  ElRow,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElTag,
  ElDivider,
  ElTable,
  ElTableColumn,
  ElPageHeader,
  ElSkeleton,
  ElPagination,
  ElLoading,
  ElMessage,
} from 'element-plus'

const app = createApp(App)

app.use(ElementPlus, { locale: zhCn })

app.use(ElContainer)
app.use(ElAside)
app.use(ElMain)
app.use(ElMenu)
app.use(ElMenuItem)
app.use(ElIcon)
app.use(ElCard)
app.use(ElSpace)
app.use(ElRadioGroup)
app.use(ElRadioButton)
app.use(ElAlert)
app.use(ElRow)
app.use(ElCol)
app.use(ElDescriptions)
app.use(ElDescriptionsItem)
app.use(ElTag)
app.use(ElDivider)
app.use(ElTable)
app.use(ElTableColumn)
app.use(ElPageHeader)
app.use(ElSkeleton)
app.use(ElPagination)
app.use(ElLoading.directive)

// 注册组件别名（无El前缀，方便使用）
app.component('Container', ElContainer)
app.component('ElAside', ElAside)
app.component('ElMain', ElMain)
app.component('ElMenu', ElMenu)
app.component('MenuItem', ElMenuItem)
app.component('Icon', ElIcon)
app.component('Card', ElCard)
app.component('Space', ElSpace)
app.component('RadioGroup', ElRadioGroup)
app.component('RadioButton', ElRadioButton)
app.component('Alert', ElAlert)
app.component('Row', ElRow)
app.component('ElCol', ElCol)
app.component('Descriptions', ElDescriptions)
app.component('DescriptionsItem', ElDescriptionsItem)
app.component('Tag', ElTag)
app.component('Divider', ElDivider)
app.component('ElTable', ElTable)
app.component('TableColumn', ElTableColumn)
app.component('PageHeader', ElPageHeader)
app.component('Skeleton', ElSkeleton)
app.component('Pagination', ElPagination)

// 注册全局方法
app.config.globalProperties.$message = ElMessage

app.mount('#app')
