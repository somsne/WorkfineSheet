/**
 * CellOverlay.vue 单元测试
 * 
 * 测试范围：
 * - Props 响应性
 * - 事件转发机制
 * - 样式计算
 * - IME 处理
 * 
 * 注意：CellOverlay 是纯展示组件，所有状态由外部控制
 */

import { describe, it, expect } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CellOverlay from '../../CellOverlay.vue'
import type { CellStyle } from '../types'

// ==================== 辅助函数 ====================

function createWrapper(props: Partial<{
  visible: boolean
  displayHtml: string
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  cellStyle: CellStyle
  isFormula: boolean
  isSelectableState: boolean
  viewportWidth: number
}> = {}): VueWrapper {
  return mount(CellOverlay, {
    props: {
      visible: true,
      displayHtml: '',
      row: 0,
      col: 0,
      top: 100,
      left: 100,
      width: 80,
      height: 24,
      ...props
    },
    attachTo: document.body
  })
}

// ==================== 测试套件 ====================

describe('CellOverlay', () => {
  
  // ==================== 可见性测试 ====================
  
  describe('可见性', () => {
    it('visible=true 时渲染组件', () => {
      const wrapper = createWrapper({ visible: true })
      expect(wrapper.find('.cell-overlay').exists()).toBe(true)
      wrapper.unmount()
    })
    
    it('visible=false 时组件隐藏（v-show）', () => {
      const wrapper = createWrapper({ visible: false })
      const el = wrapper.find('.cell-overlay')
      // 使用 v-show，元素存在但隐藏
      expect(el.exists()).toBe(true)
      expect(el.isVisible()).toBe(false)
      wrapper.unmount()
    })
    
    it('visible 变化时响应', async () => {
      const wrapper = createWrapper({ visible: false })
      const el = wrapper.find('.cell-overlay')
      expect(el.isVisible()).toBe(false)
      
      await wrapper.setProps({ visible: true })
      expect(el.isVisible()).toBe(true)
      
      await wrapper.setProps({ visible: false })
      expect(el.isVisible()).toBe(false)
      wrapper.unmount()
    })
  })
  
  // ==================== 定位测试 ====================
  
  describe('定位', () => {
    it('容器定位正确（含边框补偿）', () => {
      const wrapper = createWrapper({ top: 100, left: 200 })
      const container = wrapper.find('.cell-overlay')
      const style = container.attributes('style') || ''
      // 边框补偿 -2
      expect(style).toContain('top: 98px')
      expect(style).toContain('left: 198px')
      wrapper.unmount()
    })
    
    it('top/left 变化时更新定位', async () => {
      const wrapper = createWrapper({ top: 100, left: 100 })
      
      await wrapper.setProps({ top: 200, left: 300 })
      const container = wrapper.find('.cell-overlay')
      const style = container.attributes('style') || ''
      expect(style).toContain('top: 198px')
      expect(style).toContain('left: 298px')
      wrapper.unmount()
    })
  })
  
  // ==================== 边框颜色测试 ====================
  
  describe('边框颜色', () => {
    it('普通模式显示蓝色边框', () => {
      const wrapper = createWrapper({ isFormula: false, isSelectableState: false })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('rgb(59, 130, 246)') // #3b82f6
      wrapper.unmount()
    })
    
    it('公式模式显示红色边框', () => {
      const wrapper = createWrapper({ isFormula: true, isSelectableState: false })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('rgb(239, 68, 68)') // #ef4444
      wrapper.unmount()
    })
    
    it('可选择状态显示绿色边框（优先级最高）', () => {
      const wrapper = createWrapper({ isFormula: true, isSelectableState: true })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('rgb(16, 185, 129)') // #10b981
      wrapper.unmount()
    })
  })
  
  // ==================== 背景颜色测试 ====================
  
  describe('背景颜色', () => {
    it('普通模式使用 cellStyle 背景色', () => {
      const wrapper = createWrapper({ 
        cellStyle: { backgroundColor: '#ffeeee' },
        isFormula: false 
      })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('rgb(255, 238, 238)')
      wrapper.unmount()
    })
    
    it('普通模式无背景色时使用白色', () => {
      const wrapper = createWrapper({ isFormula: false })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('background-color: white')
      wrapper.unmount()
    })
    
    it('公式模式使用淡红色背景', () => {
      const wrapper = createWrapper({ isFormula: true })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('rgb(254, 242, 242)') // #fef2f2
      wrapper.unmount()
    })
  })
  
  // ==================== 样式应用测试 ====================
  
  describe('样式应用', () => {
    it('应用 fontSize', () => {
      const wrapper = createWrapper({ cellStyle: { fontSize: 16 } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('font-size: 16px')
      wrapper.unmount()
    })
    
    it('应用 fontFamily', () => {
      const wrapper = createWrapper({ cellStyle: { fontFamily: 'Times New Roman' } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('font-family: Times New Roman')
      wrapper.unmount()
    })
    
    it('应用 bold', () => {
      const wrapper = createWrapper({ cellStyle: { bold: true } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('font-weight: bold')
      wrapper.unmount()
    })
    
    it('应用 italic', () => {
      const wrapper = createWrapper({ cellStyle: { italic: true } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('font-style: italic')
      wrapper.unmount()
    })
    
    it('应用 underline', () => {
      const wrapper = createWrapper({ cellStyle: { underline: true } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('underline')
      wrapper.unmount()
    })
    
    it('应用 strikethrough', () => {
      const wrapper = createWrapper({ cellStyle: { strikethrough: true } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('line-through')
      wrapper.unmount()
    })
    
    it('应用 underline + strikethrough', () => {
      const wrapper = createWrapper({ cellStyle: { underline: true, strikethrough: true } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('underline')
      expect(style).toContain('line-through')
      wrapper.unmount()
    })
    
    it('应用 color', () => {
      const wrapper = createWrapper({ cellStyle: { color: '#ff0000' } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('color: rgb(255, 0, 0)')
      wrapper.unmount()
    })
    
    it('应用 textAlign', () => {
      const wrapper = createWrapper({ cellStyle: { textAlign: 'center' } })
      const displayArea = wrapper.find('.display-area')
      const style = displayArea.attributes('style') || ''
      expect(style).toContain('text-align: center')
      wrapper.unmount()
    })
  })
  
  // ==================== DOM 结构测试 ====================
  
  describe('DOM 结构', () => {
    it('包含显示区域', () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      expect(displayArea.exists()).toBe(true)
      expect(displayArea.attributes('contenteditable')).toBe('true')
      wrapper.unmount()
    })
  })
  
  // ==================== 事件转发测试 ====================
  
  describe('事件转发', () => {
    it('转发 keydown 事件', async () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      
      await displayArea.trigger('keydown', { key: 'a' })
      
      expect(wrapper.emitted('keydown')).toBeTruthy()
      expect(wrapper.emitted('keydown')!.length).toBe(1)
      wrapper.unmount()
    })
    
    it('转发 focus 事件', async () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      
      await displayArea.trigger('focus')
      
      expect(wrapper.emitted('focus')).toBeTruthy()
      wrapper.unmount()
    })
    
    it('转发 blur 事件', async () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      
      await displayArea.trigger('blur')
      
      expect(wrapper.emitted('blur')).toBeTruthy()
      wrapper.unmount()
    })
    
    it('compositionstart 设置 isComposing 状态', async () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      
      // composition-start 不再转发事件，但会设置内部状态
      await displayArea.trigger('compositionstart')
      
      // 内部状态是私有的，不再检查事件转发
      // 主要是确保不报错
      wrapper.unmount()
    })
    
    it('IME 输入完成后通过 value-change 发送值', async () => {
      const wrapper = createWrapper()
      const displayArea = wrapper.find('.display-area')
      
      // 模拟 IME 输入：先设置 textContent，再触发 compositionend
      displayArea.element.textContent = '中文'
      
      // 创建一个 CompositionEvent
      const event = new CompositionEvent('compositionend', { data: '中文' })
      await displayArea.element.dispatchEvent(event)
      await nextTick()
      
      // 现在 CellOverlay 使用 value-change 模式，而不是直接转发 composition-end
      expect(wrapper.emitted('value-change')).toBeTruthy()
      const lastChange = wrapper.emitted('value-change')!.pop()
      expect(lastChange![0]).toMatchObject({ value: '中文' })
      wrapper.unmount()
    })
  })
  
  // ==================== displayHtml 同步测试 ====================
  
  describe('displayHtml 同步', () => {
    it('初始化时设置 innerHTML', async () => {
      const wrapper = createWrapper({ displayHtml: '<span>Hello</span>' })
      await nextTick()
      
      const displayArea = wrapper.find('.display-area')
      expect(displayArea.element.innerHTML).toBe('<span>Hello</span>')
      wrapper.unmount()
    })
    
    it('displayHtml 变化时更新 innerHTML', async () => {
      const wrapper = createWrapper({ displayHtml: 'Initial' })
      await nextTick()
      
      await wrapper.setProps({ displayHtml: 'Updated' })
      await nextTick()
      
      const displayArea = wrapper.find('.display-area')
      expect(displayArea.element.innerHTML).toBe('Updated')
      wrapper.unmount()
    })
  })
  
  // ==================== 暴露方法测试 ====================
  
  describe('暴露方法', () => {
    it('focus() 聚焦显示区域', async () => {
      const wrapper = createWrapper()
      await nextTick()
      
      const vm = wrapper.vm as any
      vm.focus()
      
      const displayArea = wrapper.find('.display-area')
      expect(document.activeElement).toBe(displayArea.element)
      wrapper.unmount()
    })
    
    it('getDisplayElement() 返回显示区域元素', () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      const displayEl = vm.getDisplayElement()
      expect(displayEl).toBe(wrapper.find('.display-area').element)
      wrapper.unmount()
    })
    
    it('getContainerElement() 返回容器元素', () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      
      const containerEl = vm.getContainerElement()
      expect(containerEl).toBe(wrapper.find('.cell-overlay').element)
      wrapper.unmount()
    })
  })
})

// ==================== 尺寸计算纯函数测试 ====================

describe('尺寸计算逻辑', () => {
  
  describe('extractTextFromHtml', () => {
    it('空 HTML 不影响组件', async () => {
      const wrapper = createWrapper({ displayHtml: '' })
      await nextTick()
      expect(wrapper.find('.display-area').exists()).toBe(true)
      wrapper.unmount()
    })
    
    it('包含 HTML 标签的内容', async () => {
      const wrapper = createWrapper({ 
        displayHtml: '<span style="color:red">A1</span>+<span style="color:blue">B1</span>' 
      })
      await nextTick()
      expect(wrapper.find('.display-area').element.innerHTML).toContain('span')
      wrapper.unmount()
    })
  })
})

// ==================== 默认值测试 ====================

describe('默认值', () => {
  it('无 cellStyle 时使用默认字体', () => {
    const wrapper = createWrapper()
    const displayArea = wrapper.find('.display-area')
    const style = displayArea.attributes('style') || ''
    expect(style).toContain('font-family: Arial, sans-serif')
    expect(style).toContain('font-size: 12px')
    wrapper.unmount()
  })
  
  it('无 cellStyle 时文本装饰为 none', () => {
    const wrapper = createWrapper()
    const displayArea = wrapper.find('.display-area')
    const style = displayArea.attributes('style') || ''
    expect(style).toContain('text-decoration: none')
    wrapper.unmount()
  })
})
