import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StyleToolbar from '../StyleToolbar.vue'
import type { SheetAPI } from '../sheet/api'

describe('StyleToolbar - 边框功能', () => {
  let mockApi: SheetAPI
  
  beforeEach(() => {
    mockApi = {
      getCellStyle: vi.fn(() => ({})),
      setCellStyle: vi.fn(),
      setRangeStyle: vi.fn(),
      getCellBorder: vi.fn(),
      setCellBorder: vi.fn(),
      clearCellBorder: vi.fn(),
      setRangeBorder: vi.fn(),
      setRangeOuterBorder: vi.fn(),
      clearRangeBorder: vi.fn(),
      setAllBorders: vi.fn(),
      setOuterBorder: vi.fn(),
      clearAllBorders: vi.fn(),
      redraw: vi.fn(),
      getShowGridLines: vi.fn(() => true),
      setShowGridLines: vi.fn()
    } as unknown as SheetAPI
  })

  it('应该渲染边框按钮', () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    expect(borderBtn.exists()).toBe(true)
    expect(borderBtn.text()).toContain('▦')
  })

  it('点击边框按钮应该显示菜单', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    
    await wrapper.vm.$nextTick()
    
    const borderMenu = wrapper.find('.border-menu')
    expect(borderMenu.exists()).toBe(true)
  })

  it('应该显示所有边框选项', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const menuItems = wrapper.findAll('.border-menu-item')
    expect(menuItems.length).toBeGreaterThanOrEqual(7) // 至少7个选项

    const itemTexts = menuItems.map(item => item.text())
    expect(itemTexts.some(text => text.includes('所有边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('外边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('上边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('下边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('左边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('右边框'))).toBe(true)
    expect(itemTexts.some(text => text.includes('清除边框'))).toBe(true)
  })

  it('点击所有边框应该调用 setAllBorders', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const allBordersBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('所有边框')
    )
    expect(allBordersBtn).toBeDefined()
    
    await allBordersBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApi.setAllBorders).toHaveBeenCalledWith(
      0, 0, 2, 2,
      { style: 'thin', color: '#000000' }
    )
  })

  it('点击外边框应该调用 setOuterBorder', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const outerBorderBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('外边框')
    )
    
    await outerBorderBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApi.setOuterBorder).toHaveBeenCalledWith(
      0, 0, 2, 2,
      { style: 'thin', color: '#000000' }
    )
  })

  it('点击清除边框应该调用 clearAllBorders', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const clearBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('清除边框')
    )
    
    await clearBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApi.clearAllBorders).toHaveBeenCalledWith(0, 0, 2, 2)
  })

  it('应该能够更改边框样式', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const styleSelect = wrapper.find('.border-style-select')
    expect(styleSelect.exists()).toBe(true)

    await styleSelect.setValue('medium')
    await wrapper.vm.$nextTick()

    const allBordersBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('所有边框')
    )
    await allBordersBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApi.setAllBorders).toHaveBeenCalledWith(
      0, 0, 1, 1,
      { style: 'medium', color: '#000000' }
    )
  })

  it('应该能够更改边框颜色', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const colorInput = wrapper.find('.border-color-input')
    expect(colorInput.exists()).toBe(true)

    await colorInput.setValue('#ff0000')
    await wrapper.vm.$nextTick()

    const allBordersBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('所有边框')
    )
    await allBordersBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApi.setAllBorders).toHaveBeenCalledWith(
      0, 0, 1, 1,
      { style: 'thin', color: '#ff0000' }
    )
  })

  it('应该支持单个单元格边框设置', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 5, col: 5 },
        selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const allBordersBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('所有边框')
    )
    await allBordersBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // 对于单个单元格，应该使用相同的起始和结束坐标
    expect(mockApi.setAllBorders).toHaveBeenCalledWith(
      5, 5, 5, 5,
      { style: 'thin', color: '#000000' }
    )
  })

  it('点击边框选项后应该关闭菜单', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    let borderMenu = wrapper.find('.border-menu')
    expect(borderMenu.exists()).toBe(true)

    const allBordersBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('所有边框')
    )
    await allBordersBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    borderMenu = wrapper.find('.border-menu')
    expect(borderMenu.exists()).toBe(false)
  })

  it('上边框应该只设置选区顶部单元格的上边框', async () => {
    const wrapper = mount(StyleToolbar, {
      props: {
        api: mockApi,
        currentSelection: { row: 0, col: 0 },
        selectionRange: { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }
      }
    })

    const borderBtn = wrapper.find('.border-btn')
    await borderBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const topBorderBtn = wrapper.findAll('.border-menu-item').find(item => 
      item.text().includes('上边框')
    )
    await topBorderBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // 应该只为第一行的单元格设置上边框
    expect(mockApi.setCellBorder).toHaveBeenCalledTimes(3) // 3个单元格
    expect(mockApi.setCellBorder).toHaveBeenCalledWith(1, 1, {
      top: { style: 'thin', color: '#000000' }
    })
    expect(mockApi.setCellBorder).toHaveBeenCalledWith(1, 2, {
      top: { style: 'thin', color: '#000000' }
    })
    expect(mockApi.setCellBorder).toHaveBeenCalledWith(1, 3, {
      top: { style: 'thin', color: '#000000' }
    })
  })
})
