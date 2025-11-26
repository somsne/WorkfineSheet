/**
 * Demo data for WorkfineSheet
 * Contains sample data and style examples for testing and demonstration
 */

import type { SheetModel } from './SheetModel'

/**
 * Initialize demo data with style examples
 * Each implemented style attribute is demonstrated in a separate cell
 */
export function initializeDemoData(model: SheetModel): void {
  // ==================== 标题行 ====================
  model.setValue(0, 0, '样式演示')
  model.setCellStyle(0, 0, {
    bold: true,
    fontSize: 16,
    color: '#1e40af'
  })

  model.setValue(0, 1, '效果预览')
  model.setCellStyle(0, 1, {
    bold: true,
    fontSize: 16,
    color: '#1e40af'
  })

  // ==================== 字体样式演示 ====================
  
  // 1. 字体名称 (fontFamily)
  model.setValue(1, 0, '字体: Arial')
  model.setValue(1, 1, 'Hello World')
  model.setCellStyle(1, 1, {
    fontFamily: 'Arial'
  })

  // 2. 字号 (fontSize)
  model.setValue(2, 0, '字号: 18px')
  model.setValue(2, 1, '大号文字')
  model.setCellStyle(2, 1, {
    fontSize: 18
  })

  // 3. 粗体 (bold)
  model.setValue(3, 0, '粗体')
  model.setValue(3, 1, '粗体文字')
  model.setCellStyle(3, 1, {
    bold: true
  })

  // 4. 斜体 (italic)
  model.setValue(4, 0, '斜体')
  model.setValue(4, 1, 'Italic Text')
  model.setCellStyle(4, 1, {
    italic: true
  })

  // 5. 粗体+斜体组合
  model.setValue(5, 0, '粗斜体')
  model.setValue(5, 1, 'Bold Italic')
  model.setCellStyle(5, 1, {
    bold: true,
    italic: true
  })

  // ==================== 文本装饰演示 ====================

  // 6. 单下划线 (underline: single)
  model.setValue(6, 0, '单下划线')
  model.setValue(6, 1, '带下划线文字')
  model.setCellStyle(6, 1, {
    underline: 'single'
  })

  // 7. 双下划线 (underline: double)
  model.setValue(7, 0, '双下划线')
  model.setValue(7, 1, 'Double Underline')
  model.setCellStyle(7, 1, {
    underline: 'double'
  })

  // 8. 删除线 (strikethrough)
  model.setValue(8, 0, '删除线')
  model.setValue(8, 1, '已删除内容')
  model.setCellStyle(8, 1, {
    strikethrough: true
  })

  // 9. 下划线+删除线组合
  model.setValue(9, 0, '组合装饰')
  model.setValue(9, 1, '多重装饰')
  model.setCellStyle(9, 1, {
    underline: 'single',
    strikethrough: true
  })

  // ==================== 颜色演示 ====================

  // 10. 红色文字
  model.setValue(10, 0, '红色')
  model.setValue(10, 1, '红色文字')
  model.setCellStyle(10, 1, {
    color: '#dc2626'
  })

  // 11. 蓝色文字
  model.setValue(11, 0, '蓝色')
  model.setValue(11, 1, '蓝色文字')
  model.setCellStyle(11, 1, {
    color: '#2563eb'
  })

  // 12. 绿色文字
  model.setValue(12, 0, '绿色')
  model.setValue(12, 1, '绿色文字')
  model.setCellStyle(12, 1, {
    color: '#16a34a'
  })

  // 13. 紫色文字
  model.setValue(13, 0, '紫色')
  model.setValue(13, 1, '紫色文字')
  model.setCellStyle(13, 1, {
    color: '#9333ea'
  })

  // ==================== 综合样式演示 ====================

  // 14. 大号红色粗体
  model.setValue(14, 0, '综合样式1')
  model.setValue(14, 1, '重要标题')
  model.setCellStyle(14, 1, {
    fontSize: 20,
    bold: true,
    color: '#dc2626'
  })

  // 15. 斜体+下划线+蓝色
  model.setValue(15, 0, '综合样式2')
  model.setValue(15, 1, '强调内容')
  model.setCellStyle(15, 1, {
    italic: true,
    underline: 'single',
    color: '#2563eb',
    fontSize: 14
  })

  // 16. 多行文本样式
  model.setValue(16, 0, '多行文本')
  model.setValue(16, 1, '第一行\n第二行\n第三行')
  model.setCellStyle(16, 1, {
    bold: true,
    color: '#16a34a'
  })

  // 17. 多行+装饰
  model.setValue(17, 0, '多行装饰')
  model.setValue(17, 1, 'Line 1\nLine 2')
  model.setCellStyle(17, 1, {
    underline: 'single',
    color: '#ea580c'
  })

  // ==================== 其他示例数据 ====================

  // 添加一些普通数据
  model.setValue(19, 0, '姓名')
  model.setValue(19, 1, '年龄')
  model.setValue(19, 2, '职位')
  
  model.setValue(20, 0, '张三')
  model.setValue(20, 1, '28')
  model.setValue(20, 2, '工程师')
  
  model.setValue(21, 0, '李四')
  model.setValue(21, 1, '32')
  model.setValue(21, 2, '设计师')
  
  model.setValue(22, 0, '王五')
  model.setValue(22, 1, '25')
  model.setValue(22, 2, '产品经理')

  // 为表头添加样式
  model.setCellStyle(19, 0, { bold: true, color: '#1f2937' })
  model.setCellStyle(19, 1, { bold: true, color: '#1f2937' })
  model.setCellStyle(19, 2, { bold: true, color: '#1f2937' })

  // ==================== 公式示例 ====================
  
  model.setValue(24, 0, '数字1')
  model.setValue(24, 1, '10')
  
  model.setValue(25, 0, '数字2')
  model.setValue(25, 1, '20')
  
  model.setValue(26, 0, '求和')
  model.setValue(26, 1, '=B25+B26')
  
  model.setValue(27, 0, '平均值')
  model.setValue(27, 1, '=AVERAGE(B25:B26)')

  // 为计算结果添加样式
  model.setCellStyle(26, 1, { bold: true, color: '#059669' })
  model.setCellStyle(27, 1, { bold: true, color: '#059669' })
}

/**
 * Get demo data description
 */
export function getDemoDataInfo(): string {
  return `
演示数据说明：
- 行 0-1: 标题（粗体蓝色）
- 行 1-5: 字体样式（fontFamily, fontSize, bold, italic）
- 行 6-9: 文本装饰（underline, strikethrough）
- 行 10-13: 颜色演示（red, blue, green, purple）
- 行 14-15: 综合样式
- 行 16-17: 多行文本样式
- 行 19-22: 普通表格数据
- 行 24-27: 公式计算示例

已实现的 7 个样式属性：
✅ fontFamily - 字体名称
✅ fontSize - 字号
✅ bold - 粗体
✅ italic - 斜体
✅ underline - 下划线（单/双）
✅ strikethrough - 删除线
✅ color - 文字颜色
  `.trim()
}
