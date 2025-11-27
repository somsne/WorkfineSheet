import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StyleToolbar from '../StyleToolbar.vue'
import type { SheetAPI } from '../sheet/api'
import { DEFAULT_CELL_STYLE } from '../sheet/types'
import type { CellStyle } from '../sheet/types'

describe('StyleToolbar 组件', () => {
  let mockAPI: SheetAPI
  let currentStyle: CellStyle

  beforeEach(() => {
    currentStyle = { ...DEFAULT_CELL_STYLE }
    
    mockAPI = {
      getCellStyle: vi.fn(() => currentStyle),
      setCellStyle: vi.fn((_row, _col, style) => {
        currentStyle = { ...currentStyle, ...style }
      }),
      clearCellStyle: vi.fn(),
      setRangeStyle: vi.fn(),
      setBold: vi.fn(),
      setItalic: vi.fn(),
      setUnderline: vi.fn(),
      setStrikethrough: vi.fn(),
      setFontFamily: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setBackgroundColor: vi.fn(),
      setTextAlign: vi.fn(),
      setVerticalAlign: vi.fn(),
      setWrapText: vi.fn(),
      setTextRotation: vi.fn(),
      getShowGridLines: vi.fn(() => true),
      setShowGridLines: vi.fn()
    } as any
  })

  describe('基础渲染', () => {
    it('应该渲染所有控件', () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      // 字体选择器
      expect(wrapper.find('.font-select').exists()).toBe(true)
      
      // 字号选择器
      expect(wrapper.find('.font-size-select').exists()).toBe(true)
      
      // 样式按钮
      expect(wrapper.findAll('.style-btn').length).toBeGreaterThanOrEqual(5)
      
      // 对齐选择器
      expect(wrapper.findAll('.align-select').length).toBe(2)
    })

    it('应该显示分隔符', () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      expect(wrapper.findAll('.separator').length).toBeGreaterThan(0)
    })
  })

  describe('状态同步', () => {
    it('应该从当前单元格加载样式', () => {
      currentStyle = {
        ...DEFAULT_CELL_STYLE,
        bold: true,
        italic: true,
        fontSize: 16,
        color: '#FF0000'
      }

      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      // 验证粗体按钮被激活
      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )
      expect(boldBtn?.classes()).toContain('active')

      // 验证斜体按钮被激活
      const italicBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('I')
      )
      expect(italicBtn?.classes()).toContain('active')
    })

    it('选区切换时应该更新工具栏状态', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      // 改变选区，切换到粗体单元格
      currentStyle = { ...DEFAULT_CELL_STYLE, bold: true }
      await wrapper.setProps({
        currentSelection: { row: 1, col: 1 }
      })

      await wrapper.vm.$nextTick()

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )
      expect(boldBtn?.classes()).toContain('active')
    })

    it('无效选区应该不调用 getCellStyle', () => {
      mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: -1, col: -1 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      // 初次渲染，row/col为-1，不应该调用
      expect(mockAPI.getCellStyle).not.toHaveBeenCalled()
    })
  })

  describe('样式按钮交互', () => {
    it('点击粗体按钮应该切换粗体', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      await boldBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { bold: true })
    })

    it('点击斜体按钮应该切换斜体', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const italicBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('I')
      )!

      await italicBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { italic: true })
    })

    it('点击下划线按钮应该切换下划线', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const underlineBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('U')
      )!

      await underlineBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { underline: true })
    })

    it('点击删除线按钮应该切换删除线', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const strikethroughBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('S')
      )!

      await strikethroughBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { strikethrough: true })
    })

    it('点击换行按钮应该切换自动换行', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const wrapBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('⏎')
      )!

      await wrapBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { wrapText: true })
    })
  })

  describe('下拉选择器交互', () => {
    it('更改字体应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const fontSelect = wrapper.find('.font-select')
      await fontSelect.setValue('Verdana, sans-serif')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { fontFamily: 'Verdana, sans-serif' })
    })

    it('更改字号应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const fontSizeSelect = wrapper.find('.font-size-select')
      await fontSizeSelect.setValue('16')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { fontSize: 16 })
    })

    it('更改水平对齐应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const alignSelect = wrapper.findAll('.align-select')[0]
      if (alignSelect) {
        await alignSelect.setValue('center')
      }

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { textAlign: 'center' })
    })

    it('更改垂直对齐应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const alignSelects = wrapper.findAll('.align-select')
      const verticalAlignSelect = alignSelects[1]
      if (verticalAlignSelect) {
        await verticalAlignSelect.setValue('top')
      }

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { verticalAlign: 'top' })
    })
  })

  describe('颜色选择器', () => {
    it('更改文字颜色应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const colorInputs = wrapper.findAll('input[type="color"]')
      const textColorInput = colorInputs[0]
      
      if (textColorInput) {
        await textColorInput.setValue('#FF0000')
      }

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { color: '#ff0000' })
    })

    it('更改背景色应该应用样式', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const colorInputs = wrapper.findAll('input[type="color"]')
      const bgColorInput = colorInputs[1]
      
      if (bgColorInput) {
        await bgColorInput.setValue('#FFFF00')
      }

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { backgroundColor: '#ffff00' })
    })
  })

  describe('选区范围支持', () => {
    it('有选区时应该应用样式到整个范围', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      await boldBtn.trigger('click')

      expect(mockAPI.setRangeStyle).toHaveBeenCalledWith(0, 0, 2, 2, { bold: true })
      // 有选区时不应该调用 setCellStyle
      expect(mockAPI.setCellStyle).not.toHaveBeenCalled()
    })

    it('无选区时应该只应用到当前单元格', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 1, col: 1 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      await boldBtn.trigger('click')

      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(1, 1, { bold: true })
      expect(mockAPI.setRangeStyle).not.toHaveBeenCalled()
    })

    it('字体更改应该支持选区', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: 0, startCol: 0, endRow: 3, endCol: 3 }
        }
      })

      const fontSizeSelect = wrapper.find('.font-size-select')
      await fontSizeSelect.setValue('20')

      expect(mockAPI.setRangeStyle).toHaveBeenCalledWith(0, 0, 3, 3, { fontSize: 20 })
    })

    it('颜色更改应该支持选区', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
        }
      })

      const colorInputs = wrapper.findAll('input[type="color"]')
      if (colorInputs[0]) {
        await colorInputs[0].setValue('#00FF00')
      }

      expect(mockAPI.setRangeStyle).toHaveBeenCalledWith(0, 0, 1, 1, { color: '#00ff00' })
    })
  })

  describe('边界情况', () => {
    it('无效单元格选择时不应该触发样式更改', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: -1, col: -1 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      await boldBtn.trigger('click')

      // 不应该调用任何 API
      expect(mockAPI.setCellStyle).not.toHaveBeenCalled()
      expect(mockAPI.setRangeStyle).not.toHaveBeenCalled()
    })

    it('应该处理未定义的样式属性', () => {
      currentStyle = {
        fontFamily: undefined,
        fontSize: undefined,
        bold: undefined,
        italic: undefined,
        underline: undefined,
        strikethrough: undefined,
        color: undefined,
        backgroundColor: undefined,
        textAlign: undefined,
        verticalAlign: undefined,
        wrapText: undefined,
        textRotation: undefined
      } as any

      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      // 应该使用默认值
      const fontSelect = wrapper.find('.font-select')
      expect((fontSelect.element as HTMLSelectElement).value).toBe('Arial, sans-serif')
    })

    it('连续快速点击应该正确切换状态', async () => {
      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      // 第一次点击 - 开启
      await boldBtn.trigger('click')
      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { bold: true })

      // 第二次点击 - 关闭
      await boldBtn.trigger('click')
      expect(mockAPI.setCellStyle).toHaveBeenCalledWith(0, 0, { bold: false })

      // 应该调用两次
      expect(mockAPI.setCellStyle).toHaveBeenCalledTimes(2)
    })
  })

  describe('CSS 类名', () => {
    it('激活状态应该添加 active 类', () => {
      currentStyle = { ...DEFAULT_CELL_STYLE, bold: true, italic: true }

      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!
      const italicBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('I')
      )!

      expect(boldBtn.classes()).toContain('active')
      expect(italicBtn.classes()).toContain('active')
    })

    it('未激活状态不应该有 active 类', () => {
      currentStyle = { ...DEFAULT_CELL_STYLE, bold: false }

      const wrapper = mount(StyleToolbar, {
        props: {
          api: mockAPI,
          currentSelection: { row: 0, col: 0 },
          selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
        }
      })

      const boldBtn = wrapper.findAll('.style-btn').find(btn => 
        btn.text().includes('B')
      )!

      expect(boldBtn.classes()).not.toContain('active')
    })
  })
})
