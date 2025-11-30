import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StyleToolbar from '../StyleToolbar.vue'
import type { SheetAPI } from '../sheet/api'

describe('网格线功能测试', () => {
  let mockApi: SheetAPI
  let gridLinesState: boolean
  
  beforeEach(() => {
    gridLinesState = true
    
    mockApi = {
      getCellStyle: vi.fn(() => ({})),
      setCellStyle: vi.fn(),
      setRangeStyle: vi.fn(),
      getShowGridLines: vi.fn(() => gridLinesState),
      setShowGridLines: vi.fn((show: boolean) => {
        gridLinesState = show
      }),
      // 撤销还原相关
      undo: vi.fn(() => false),
      redo: vi.fn(() => false),
      canUndo: vi.fn(() => false),
      canRedo: vi.fn(() => false),
      // 格式刷相关
      getFormatPainterMode: vi.fn(() => 'off'),
      startFormatPainter: vi.fn(),
      startFormatPainterContinuous: vi.fn(),
      stopFormatPainter: vi.fn(),
      applyFormatPainter: vi.fn()
    } as unknown as SheetAPI
  })

  it('应该渲染网格线切换按钮', () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const gridBtn = wrapper.find('button[title="显示/隐藏网格线"]')
    expect(gridBtn.exists()).toBe(true)
    expect(gridBtn.text()).toContain('⊞')
  })

  it('初始化时应该从 API 加载网格线状态', () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    expect(mockApi.getShowGridLines).toHaveBeenCalled()
    
    const gridBtn = wrapper.find('button[title="显示/隐藏网格线"]')
    expect(gridBtn.classes()).toContain('active')
  })

  it('点击网格线按钮应该切换状态', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const gridBtn = wrapper.find('button[title="显示/隐藏网格线"]')
    
    // 初始状态为 true (显示)
    expect(gridBtn.classes()).toContain('active')
    
    // 点击切换到隐藏
    await gridBtn.trigger('click')
    expect(mockApi.setShowGridLines).toHaveBeenCalledWith(false)
    
    // 更新状态并重新渲染
    gridLinesState = false
    await wrapper.vm.$nextTick()
    
    // 点击切换回显示
    await gridBtn.trigger('click')
    expect(mockApi.setShowGridLines).toHaveBeenCalledWith(true)
  })

  it('网格线隐藏时按钮不应该有 active 类', async () => {
    gridLinesState = false
    
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    await wrapper.vm.$nextTick()
    
    const gridBtn = wrapper.find('button[title="显示/隐藏网格线"]')
    expect(gridBtn.classes()).not.toContain('active')
  })
})
