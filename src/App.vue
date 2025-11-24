<template>
    <div class="app-container">
        <!-- 应用标题 -->
        <header class="app-header">
            <div class="header-content">
                <h1 class="app-title">健康打卡</h1>
                <div class="date-badge">
                    <span>{{ currentDate }}</span>
                </div>
            </div>
        </header>

        <!-- 打卡卡片 -->
        <div class="cards-container">
            <div
                 v-for="item in checkItems"
                 :key="item.type"
                 :class="['check-card', item.type, { checked: todayChecks[item.type] }]"
                 @click="handleCardClick(item.type)">
                <div class="card-content">
                    <div class="card-icon">
                        <i :class="item.icon"></i>
                        <div class="icon-bg"></div>
                    </div>
                    <div class="card-info">
                        <h2>{{ item.name }}</h2>
                        <p>{{ item.description }}</p>
                    </div>
                    <div class="check-indicator">
                        <div class="check-circle" :class="{ checked: todayChecks[item.type] }">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <span v-if="todayChecks[item.type]" class="checked-text">今日已完成</span>
                    <span v-else class="unchecked-text">点击打卡</span>
                </div>
            </div>
        </div>

        <!-- 统计区域 -->
        <div class="stats-section">
            <div class="stats-card progress-card">
                <div class="stats-header">
                    <h3>今日进度</h3>
                    <span class="progress-value">{{ todayCheckedCount }}/2</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: progressWidth }">
                            <div class="progress-glow"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="stats-card monthly-card">
                <h3>本月统计</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-icon medicine-stat">
                            <i class="fas fa-pills"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">未打卡次数</span>
                            <span class="stat-value">{{ monthlyStats.medicine }}</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon exercise-stat">
                            <i class="fas fa-running"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-label">未打卡次数</span>
                            <span class="stat-value">{{ monthlyStats.exercise }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 浮动操作按钮 -->
        <div class="fab-container">
            <button class="fab-button" @click="resetToday">
                <i class="fas fa-redo"></i>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'

// 打卡项目类型
interface CheckItem {
    type: 'medicine' | 'exercise'
    name: string
    icon: string
    description: string
    color: string
    gradient: string
}

// 打卡项目配置
const checkItems: CheckItem[] = [
    {
        type: 'medicine',
        name: '吃药',
        icon: 'fas fa-pills',
        description: '按时服药，保持健康',
        color: '#FF6B6B',
        gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)'
    },
    {
        type: 'exercise',
        name: '锻炼',
        icon: 'fas fa-running',
        description: '每日运动，活力满满',
        color: '#4ECDC4',
        gradient: 'linear-gradient(135deg, #4ECDC4 0%, #6DECDF 100%)'
    }
]

// 响应式数据
const todayChecks = reactive({
    medicine: false,
    exercise: false
})

const monthlyStats = reactive({
    medicine: 0,
    exercise: 0
})

const lastClickTime = ref(0)
const currentDate = ref('')

// 计算属性
const todayCheckedCount = computed(() => {
    return Object.values(todayChecks).filter(checked => checked).length
})

const progressWidth = computed(() => {
    return `${(todayCheckedCount.value / 2) * 100}%`
})

const isNewMonth = computed(() => {
    const today = new Date()
    return today.getDate() === 1
})

// 方法
const handleCardClick = (type: 'medicine' | 'exercise') => {
    const now = Date.now()
    if (now - lastClickTime.value < 300) { // 双击检测
        toggleCheck(type)
    }
    lastClickTime.value = now
}

const toggleCheck = (type: 'medicine' | 'exercise') => {
    todayChecks[type] = !todayChecks[type]
    saveToLocalStorage()
}

const resetToday = () => {
    todayChecks.medicine = false
    todayChecks.exercise = false
    saveToLocalStorage()
}

const updateCurrentDate = () => {
    const now = new Date()
    const month = now.getMonth() + 1
    const date = now.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[now.getDay()]
    currentDate.value = `${month}月${date}日 ${weekday}`
}

const saveToLocalStorage = () => {
    const todayKey = getTodayKey()
    const monthKey = getMonthKey()

    localStorage.setItem(todayKey, JSON.stringify(todayChecks))

    if (!localStorage.getItem(todayKey + '_processed')) {
        updateMonthlyStats()
        localStorage.setItem(todayKey + '_processed', 'true')
    }

    localStorage.setItem(monthKey, JSON.stringify(monthlyStats))
}

const loadFromLocalStorage = () => {
    const todayKey = getTodayKey()
    const monthKey = getMonthKey()

    const todayData = localStorage.getItem(todayKey)
    if (todayData) {
        const parsedData = JSON.parse(todayData)
        todayChecks.medicine = parsedData.medicine
        todayChecks.exercise = parsedData.exercise
    }

    if (!localStorage.getItem(todayKey + '_processed')) {
        updateMonthlyStats()
        localStorage.setItem(todayKey + '_processed', 'true')
    }

    const monthData = localStorage.getItem(monthKey)
    if (monthData) {
        const parsedData = JSON.parse(monthData)
        monthlyStats.medicine = parsedData.medicine
        monthlyStats.exercise = parsedData.exercise
    }
}

const getTodayKey = (): string => {
    const today = new Date()
    return `check_${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`
}

const getMonthKey = (): string => {
    const today = new Date()
    return `stats_${today.getFullYear()}_${today.getMonth() + 1}`
}

const updateMonthlyStats = () => {
    if (isNewMonth.value) {
        monthlyStats.medicine = 0
        monthlyStats.exercise = 0
        return
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    if (yesterday.getDate() !== 0) {
        const yesterdayKey = `check_${yesterday.getFullYear()}_${yesterday.getMonth() + 1}_${yesterday.getDate()}`
        const yesterdayData = localStorage.getItem(yesterdayKey)

        if (yesterdayData) {
            const yesterdayChecks = JSON.parse(yesterdayData)
            checkItems.forEach(item => {
                if (!yesterdayChecks[item.type]) {
                    monthlyStats[item.type]++
                }
            })
        } else {
            checkItems.forEach(item => {
                monthlyStats[item.type]++
            })
        }
    }
}

// 生命周期
onMounted(() => {
    updateCurrentDate()
    loadFromLocalStorage()

    setInterval(updateCurrentDate, 60000)
    setInterval(() => {
        const todayKey = getTodayKey()
        if (!localStorage.getItem(todayKey + '_processed')) {
            loadFromLocalStorage()
        }
    }, 60000)
})
</script>

<style scoped>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
}

:root {
    --primary-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --card-bg: rgba(255, 255, 255, 0.95);
    --text-primary: #2D3748;
    --text-secondary: #718096;
    --text-light: #A0AEC0;
    --shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    --shadow-hover: 0 25px 50px rgba(0, 0, 0, 0.15);
    --border-radius: 20px;
    --border-radius-lg: 28px;
}

.app-container {
    min-height: 100vh;
    background: var(--primary-bg);
    padding: 20px;
    position: relative;
}

.app-header {
    margin-bottom: 30px;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.app-title {
    font-size: 32px;
    font-weight: 800;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.date-badge {
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 20px;
    color: white;
    font-weight: 600;
    font-size: 14px;
}

.cards-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
}

.check-card {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.check-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transition: left 0.6s;
}

.check-card:hover::before {
    left: 100%;
}

.check-card.checked {
    transform: translateY(-5px);
    box-shadow: var(--shadow-hover);
}

.medicine.checked {
    border-left: 6px solid #FF6B6B;
}

.exercise.checked {
    border-left: 6px solid #4ECDC4;
}

.card-content {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
}

.card-icon {
    position: relative;
    width: 60px;
    height: 60px;
    margin-right: 20px;
}

.card-icon i {
    position: relative;
    z-index: 2;
    font-size: 24px;
}

.medicine .card-icon i {
    color: #FF6B6B;
}

.exercise .card-icon i {
    color: #4ECDC4;
}

.icon-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 16px;
    opacity: 0.1;
}

.medicine .icon-bg {
    background: #FF6B6B;
}

.exercise .icon-bg {
    background: #4ECDC4;
}

.card-info h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
}

.card-info p {
    font-size: 14px;
    color: var(--text-secondary);
}

.check-indicator {
    margin-left: auto;
}

.check-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #E2E8F0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.check-circle.checked {
    background: #48BB78;
    border-color: #48BB78;
}

.check-circle i {
    color: white;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.check-circle.checked i {
    opacity: 1;
}

.card-footer {
    border-top: 1px solid #EDF2F7;
    padding-top: 12px;
}

.checked-text {
    color: #48BB78;
    font-weight: 600;
    font-size: 14px;
}

.unchecked-text {
    color: var(--text-light);
    font-size: 14px;
}

.stats-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.stats-card {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    padding: 24px;
    box-shadow: var(--shadow);
}

.stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.stats-header h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.progress-value {
    font-size: 18px;
    font-weight: 700;
    color: #4ECDC4;
}

.progress-container {
    margin-top: 8px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #EDF2F7;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FF6B6B, #4ECDC4);
    border-radius: 4px;
    transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
}

.progress-glow {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
    animation: shimmer 2s infinite;
}

@keyframes shimmer {
    0% {
        transform: translateX(-100%);
    }

    100% {
        transform: translateX(100%);
    }
}

.stats-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.stat-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background: #F7FAFC;
    border-radius: 12px;
}

.stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    font-size: 16px;
}

.medicine-stat {
    background: rgba(255, 107, 107, 0.1);
    color: #FF6B6B;
}

.exercise-stat {
    background: rgba(78, 205, 196, 0.1);
    color: #4ECDC4;
}

.stat-info {
    flex: 1;
}

.stat-label {
    font-size: 12px;
    color: var(--text-light);
    display: block;
}

.stat-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
}

.fab-container {
    position: fixed;
    bottom: 30px;
    right: 30px;
}

.fab-button {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
    border: none;
    color: white;
    font-size: 18px;
    box-shadow: 0 10px 30px rgba(255, 107, 107, 0.4);
    cursor: pointer;
    transition: all 0.3s ease;
}

.fab-button:hover {
    transform: scale(1.1);
    box-shadow: 0 15px 40px rgba(255, 107, 107, 0.6);
}

/* 动画效果 */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.check-card {
    animation: fadeInUp 0.6s ease-out;
}

.check-card:nth-child(2) {
    animation-delay: 0.1s;
}

.stats-card {
    animation: fadeInUp 0.6s ease-out 0.2s both;
}

/* 响应式设计 */
@media (max-width: 380px) {
    .app-container {
        padding: 16px;
    }

    .app-title {
        font-size: 28px;
    }

    .check-card {
        padding: 20px;
    }

    .card-icon {
        width: 50px;
        height: 50px;
        margin-right: 16px;
    }
}

/* 适配iPhone 15 */
@media (max-width: 430px) and (max-height: 932px) {
    .app-container {
        min-height: 100vh;
        max-height: 100vh;
        overflow: hidden;
    }
}
</style>