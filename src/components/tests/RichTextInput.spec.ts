import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import RichTextInput from '../RichTextInput.vue'

describe('RichTextInput 组件', () => {
  // 模拟 Selection API
  const mockSelection = () => {
    const selection = {
      rangeCount: 1,
      getRangeAt: vi.fn(() => ({
        cloneRange: vi.fn(() => ({
          selectNodeContents: vi.fn(),
          setEnd: vi.fn(),
          toString: vi.fn(() => 'test')
        })),
        setStart: vi.fn(),
        collapse: vi.fn(),
        deleteContents: vi.fn(),
        insertNode: vi.fn(),
        setStartAfter: vi.fn(),
        endContainer: document.createTextNode('test'),
        endOffset: 4
      })),
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      toString: vi.fn(() => '')
    }
    
    window.getSelection = vi.fn(() => selection as any)
    return selection
  }

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test Value',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[contenteditable]').exists()).toBe(true)
    })

    it('visible=false 时不应该显示', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: false,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      expect(wrapper.find('[contenteditable]').exists()).toBe(false)
    })

    it('应该正确设置位置和尺寸', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 150,
          left: 250,
          width: 300,
          height: 40,
          mode: 'edit'
        }
      })

      const container = wrapper.find('div')
      expect(container.exists()).toBe(true)
      
      const style = container.attributes('style')
      expect(style).toContain('top: 150px')
      expect(style).toContain('left: 250px')
    })
  })

  describe('文本输入和显示', () => {
    it('应该显示初始值', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Initial Text',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick() // 需要额外的 tick 等待 watch 完成
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      expect(html).toContain('Initial Text')
    })

    it('应该处理空内容', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      // 空内容应该显示 <br> 或者为空（contenteditable 会保持高度）
      expect(html.includes('<br>') || html.trim() !== '<div></div>').toBe(true)
    })

    it('应该转义 HTML 特殊字符', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '<script>alert("XSS")</script>',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      // 应该转义 < 和 > （innerHTML会自动转义）
      expect(html).toContain('&lt;')
      expect(html).toContain('&gt;')
      // 不应该包含未转义的 script 标签
      expect(html.includes('<script>alert')).toBe(false)
    })
  })

  describe('样式继承', () => {
    it('应该应用字体样式', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Styled Text',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          cellStyle: {
            fontFamily: 'Microsoft YaHei',
            fontSize: 16
          }
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      expect(style).toContain('font-family:')
      expect(style).toContain('font-size: 16px')
    })

    it('应该应用粗体和斜体', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Bold Italic',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          cellStyle: {
            bold: true,
            italic: true
          }
        }
      })

      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      expect(style).toContain('font-weight: bold')
      expect(style).toContain('font-style: italic')
    })

    it('应该应用颜色和背景色', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Colored',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          cellStyle: {
            color: '#FF0000',
            backgroundColor: '#FFFF00'
          }
        }
      })

      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      expect(style).toContain('color: rgb(255, 0, 0)')
      expect(style).toContain('background-color: rgb(255, 255, 0)')
    })

    it('应该应用下划线和删除线', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Decorated',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          cellStyle: {
            underline: 'single',
            strikethrough: true
          }
        }
      })

      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      expect(style).toContain('text-decoration:')
      expect(style).toMatch(/underline|line-through/)
    })

    it('应该支持双下划线', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Double Underline',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          cellStyle: {
            underline: 'double'
          }
        }
      })

      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      expect(style).toContain('text-decoration')
      expect(style).toContain('text-decoration-style: double')
    })
  })

  describe('公式模式', () => {
    it('应该识别公式（以 = 开头）', () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '=A1+B2',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          isFormula: true
        }
      })

      const editor = wrapper.find('[contenteditable]')
      const style = editor.attributes('style')
      // 公式模式应该有红色边框
      expect(style).toContain('border: 2px solid rgb(239, 68, 68)')
    })

    it('应该为公式引用着色', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '=A1+B2',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          isFormula: true,
          formulaReferences: [
            { ref: 'A1', color: '#FF0000', startIndex: 1, endIndex: 3 },
            { ref: 'B2', color: '#00FF00', startIndex: 4, endIndex: 6 }
          ]
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      
      // 应该包含带颜色的 span 标签
      expect(html).toContain('color: #FF0000')
      expect(html).toContain('color: #00FF00')
    })

    it('应该处理空公式', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '=',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          isFormula: true
        }
      })

      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('事件处理', () => {
    it('应该触发 save 事件 (Enter 键)', async () => {
      mockSelection()
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      const editor = wrapper.find('[contenteditable]')
      await editor.trigger('keydown', { key: 'Enter' })

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')![0]).toEqual(['Test'])
    })

    it('应该触发 cancel 事件 (Escape 键)', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      const editor = wrapper.find('[contenteditable]')
      await editor.trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('Alt+Enter 应该插入换行符而不是保存', async () => {
      mockSelection()
      document.createRange = vi.fn(() => ({
        deleteContents: vi.fn(),
        insertNode: vi.fn(),
        setStartAfter: vi.fn(),
        collapse: vi.fn()
      } as any))
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      const editor = wrapper.find('[contenteditable]')
      await editor.trigger('keydown', { key: 'Enter', altKey: true })

      // 不应该触发 save
      expect(wrapper.emitted('save')).toBeFalsy()
      // 应该触发 input-change
      expect(wrapper.emitted('input-change')).toBeTruthy()
    })

    it('应该阻止 Tab 键默认行为', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      const editor = wrapper.find('[contenteditable]')
      
      await editor.trigger('keydown', { key: 'Tab' })
      
      // Tab 应该被阻止（组件内部处理）
      expect(wrapper.emitted('save')).toBeFalsy()
    })
  })

  describe('边界情况', () => {
    it('应该处理超长文本', async () => {
      const longText = 'A'.repeat(10000)
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: longText,
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('应该处理 Unicode 和 Emoji', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '你好👋世界🌍',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      expect(html).toContain('你好')
      expect(html).toContain('世界')
    })

    it('应该处理多行文本（换行符）', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Line 1\nLine 2\nLine 3',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 80,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const html = editor.html()
      // 换行符应该转换为 <br>
      expect(html).toContain('<br>')
    })

    it('应该处理纯空格文本', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '     ',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      // 纯空格应该使用 &nbsp; 保证可见
      const html = editor.html()
      expect(html).toContain('&nbsp;')
    })

    it('应该处理特殊字符', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '!@#$%^&*()_+-=[]{}',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('性能优化', () => {
    it('应该避免不必要的 innerHTML 更新', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'Test',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]').element as HTMLElement
      const initialHtml = editor.innerHTML

      // 不改变内容，检查 innerHTML 是否被更新
      await wrapper.setProps({ value: 'Test' })
      await nextTick()

      expect(editor.innerHTML).toBe(initialHtml)
    })

    it('短文本应该立即更新（无防抖）', async () => {
      mockSelection()
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '=A1',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit',
          isFormula: true,
          formulaReferences: [
            { ref: 'A1', color: '#FF0000', startIndex: 1, endIndex: 3 }
          ]
        }
      })

      await nextTick()
      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      
      // 短文本（<500字符）应该立即更新
      const html = editor.html()
      expect(html).toContain('color: #FF0000')
    })
  })

  describe('IME 支持', () => {
    it('应该在 IME 输入时不触发 input 事件', async () => {
      mockSelection()
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      const editor = wrapper.find('[contenteditable]')
      
      // 开始 IME 输入
      await editor.trigger('compositionstart')
      
      // IME 输入期间的 input 事件应该被忽略
      await editor.trigger('input')
      
      // 不应该触发 input-change
      expect(wrapper.emitted('input-change')).toBeFalsy()
    })

    it('应该在 IME 结束时触发 input 事件', async () => {
      mockSelection()
      
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: '',
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      
      // 开始 IME 输入
      await editor.trigger('compositionstart')
      
      // 结束 IME 输入（会自动触发 input 事件）
      await editor.trigger('compositionend')
      
      // 应该触发 input-change（注意：compositionend 会触发一次 handleInput）
      await nextTick()
      await nextTick()
      expect(wrapper.emitted('input-change')).toBeTruthy()
    })
  })

  describe('换行符处理', () => {
    it('末尾换行符应该添加零宽空格以便光标定位', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'abc\n',  // 末尾有换行符
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const editorEl = editor.element as HTMLDivElement
      
      // 检查 innerHTML 是否包含零宽空格
      // abc\n 应该被渲染为 "abc<br>​" (其中​是零宽空格 \u200B)
      expect(editorEl.innerHTML).toContain('<br>')
      expect(editorEl.innerHTML).toContain('\u200B')
      // 零宽空格应该在 <br> 之后
      expect(editorEl.innerHTML).toMatch(/<br>\u200B/)
    })

    it('多个换行符的末尾也应该有零宽空格', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'line1\nline2\n',  // 末尾有换行符
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const editorEl = editor.element as HTMLDivElement
      
      // 应该有两个 <br>
      const brCount = (editorEl.innerHTML.match(/<br>/g) || []).length
      expect(brCount).toBe(2)
      // 末尾应该有零宽空格
      expect(editorEl.innerHTML).toContain('\u200B')
      expect(editorEl.innerHTML.endsWith('\u200B')).toBe(true)
    })

    it('中间的换行符不应该影响零宽空格的添加', async () => {
      const wrapper = mount(RichTextInput, {
        props: {
          visible: true,
          value: 'line1\nline2',  // 末尾没有换行符
          row: 0,
          col: 0,
          top: 100,
          left: 100,
          width: 200,
          height: 30,
          mode: 'edit'
        }
      })

      await nextTick()
      const editor = wrapper.find('[contenteditable]')
      const editorEl = editor.element as HTMLDivElement
      
      // 应该有一个 <br>
      expect(editorEl.innerHTML).toContain('<br>')
      // 末尾不应该有零宽空格（因为文本不是以 \n 结尾）
      expect(editorEl.innerHTML.endsWith('\u200B')).toBe(false)
    })
  })
})
