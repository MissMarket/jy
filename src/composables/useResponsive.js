/**
 * 响应式布局管理组合式函数
 * 管理设备检测、响应式状态和布局适配
 */

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { detectDevice as detectDeviceUtil } from '@/utils'

/**
 * 响应式布局管理组合式函数
 * @returns {Object} 响应式管理对象
 */
export const useResponsive = () => {
  const device = ref(detectDeviceUtil())
  const isMobile = computed(() => device.value.isMobile)
  const isTablet = computed(() => device.value.isTablet)
  const isDesktop = computed(() => device.value.isDesktop)

  /**
   * 更新设备信息
   */
  const updateDevice = () => {
    device.value = detectDeviceUtil()
  }

  /**
   * 监听窗口大小变化
   */
  const handleResize = () => {
    updateDevice()
  }

  // 生命周期钩子
  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  /**
   * 获取响应式断点
   * @returns {Object} 断点信息
   */
  const getBreakpoints = () => {
    return {
      mobile: 768,
      tablet: 1024,
      desktop: 1200,
    }
  }

  /**
   * 根据设备类型获取布局配置
   * @returns {Object} 布局配置
   */
  const getLayoutConfig = () => {
    if (isMobile.value) {
      return {
        sidebar: false,
        mainWidth: '100%',
        cardPadding: '12px',
        fontSize: {
          title: '18px',
          subtitle: '14px',
          body: '13px',
        },
      }
    } else if (isTablet.value) {
      return {
        sidebar: true,
        sidebarWidth: '180px',
        mainWidth: 'calc(100% - 180px)',
        cardPadding: '16px',
        fontSize: {
          title: '20px',
          subtitle: '15px',
          body: '14px',
        },
      }
    } else {
      return {
        sidebar: true,
        sidebarWidth: '200px',
        mainWidth: 'calc(100% - 200px)',
        cardPadding: '20px',
        fontSize: {
          title: '22px',
          subtitle: '16px',
          body: '14px',
        },
      }
    }
  }

  return {
    device,
    isMobile,
    isTablet,
    isDesktop,
    updateDevice,
    getBreakpoints,
    getLayoutConfig,
  }
}
