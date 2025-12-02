/**
 * 根据操作系统获取默认字体配置
 * - macOS: 苹方 (PingFang SC)
 * - Windows: 微软雅黑 (Microsoft YaHei)  
 * - Linux: Noto Sans CJK SC
 * - 其他: 微软雅黑
 */

/**
 * 检测操作系统类型
 */
function detectOS(): { isMac: boolean; isWindows: boolean; isLinux: boolean } {
  if (typeof navigator === 'undefined') {
    return { isMac: false, isWindows: true, isLinux: false }
  }

  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''

  // 优先使用 userAgentData (现代浏览器)
  const uaData = (navigator as any).userAgentData
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase()
    return {
      isMac: p === 'macos',
      isWindows: p === 'windows',
      isLinux: p === 'linux'
    }
  }

  // 回退到 userAgent + platform 检测
  const isMac = /Mac|iPod|iPhone|iPad/.test(platform) || /Macintosh|Mac OS X/.test(ua)
  const isWindows = /Win/.test(platform) || /Windows/.test(ua)
  const isLinux = /Linux/.test(platform) && !/Android/.test(ua)

  return { isMac, isWindows, isLinux }
}

const os = detectOS()

/**
 * 获取当前系统的默认字体
 */
export function getDefaultFontFamily(): string {
  if (os.isMac) return "'PingFang SC', sans-serif"
  if (os.isWindows) return "'Microsoft YaHei', sans-serif"
  if (os.isLinux) return "'Noto Sans CJK SC', 'Noto Sans SC', sans-serif"
  return "'Microsoft YaHei', sans-serif"
}

/**
 * 当前系统是否为 macOS
 */
export const isMac = os.isMac

/**
 * 当前系统是否为 Windows
 */
export const isWindows = os.isWindows

/**
 * 当前系统是否为 Linux
 */
export const isLinux = os.isLinux

/**
 * 默认字体 (运行时确定)
 */
export const DEFAULT_FONT_FAMILY = getDefaultFontFamily()
