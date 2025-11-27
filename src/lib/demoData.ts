/**
 * Demo data initialization for showcasing cell styles
 */

import type { SheetModel } from './SheetModel'

/**
 * Initialize the sheet with demo data showcasing various cell styles
 */
export function initializeDemoData(model: SheetModel): void {
  // ===== 标题行 =====
  model.setValue(0, 0, '样式功能演示')
  model.setCellStyle(0, 0, {
    fontSize: 20,
    bold: true,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    textAlign: 'center',
    verticalAlign: 'middle'
  })

  // ===== 第 2 行：水平对齐演示 =====
  model.setValue(2, 0, '水平对齐')
  model.setCellStyle(2, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(2, 1, '左对齐')
  model.setCellStyle(2, 1, {
    textAlign: 'left',
    color: '#059669',
    backgroundColor: '#d1fae5'
  })

  model.setValue(2, 2, '居中对齐')
  model.setCellStyle(2, 2, {
    textAlign: 'center',
    color: '#0891b2',
    backgroundColor: '#cffafe'
  })

  model.setValue(2, 3, '右对齐')
  model.setCellStyle(2, 3, {
    textAlign: 'right',
    color: '#c026d3',
    backgroundColor: '#fae8ff'
  })

  // ===== 第 4 行：垂直对齐演示 =====
  model.setValue(4, 0, '垂直对齐')
  model.setCellStyle(4, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(4, 1, '顶部')
  model.setCellStyle(4, 1, {
    verticalAlign: 'top',
    color: '#dc2626',
    backgroundColor: '#fee2e2'
  })

  model.setValue(4, 2, '居中')
  model.setCellStyle(4, 2, {
    verticalAlign: 'middle',
    color: '#ea580c',
    backgroundColor: '#fed7aa'
  })

  model.setValue(4, 3, '底部')
  model.setCellStyle(4, 3, {
    verticalAlign: 'bottom',
    color: '#ca8a04',
    backgroundColor: '#fef3c7'
  })

  // ===== 第 6 行：字体样式组合 =====
  model.setValue(6, 0, '字体样式')
  model.setCellStyle(6, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(6, 1, '粗体')
  model.setCellStyle(6, 1, {
    bold: true,
    fontSize: 16,
    color: '#1e293b'
  })

  model.setValue(6, 2, '斜体')
  model.setCellStyle(6, 2, {
    italic: true,
    fontSize: 14,
    color: '#475569'
  })

  model.setValue(6, 3, '下划线')
  model.setCellStyle(6, 3, {
    underline: 'single',
    color: '#0284c7'
  })

  model.setValue(6, 4, '删除线')
  model.setCellStyle(6, 4, {
    strikethrough: true,
    color: '#64748b'
  })

  // ===== 第 8 行：背景色演示 =====
  model.setValue(8, 0, '背景色')
  model.setCellStyle(8, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(8, 1, '红色')
  model.setCellStyle(8, 1, {
    backgroundColor: '#fecaca',
    color: '#991b1b',
    bold: true,
    textAlign: 'center'
  })

  model.setValue(8, 2, '绿色')
  model.setCellStyle(8, 2, {
    backgroundColor: '#bbf7d0',
    color: '#166534',
    bold: true,
    textAlign: 'center'
  })

  model.setValue(8, 3, '蓝色')
  model.setCellStyle(8, 3, {
    backgroundColor: '#bfdbfe',
    color: '#1e40af',
    bold: true,
    textAlign: 'center'
  })

  model.setValue(8, 4, '黄色')
  model.setCellStyle(8, 4, {
    backgroundColor: '#fef08a',
    color: '#854d0e',
    bold: true,
    textAlign: 'center'
  })

  // ===== 第 10 行：自动换行演示 =====
  model.setValue(10, 0, '自动换行')
  model.setCellStyle(10, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(10, 1, '这是一段很长的文本内容，当开启自动换行后，文本会自动适应单元格宽度进行换行显示')
  model.setCellStyle(10, 1, {
    wrapText: true,
    backgroundColor: '#fef9c3',
    verticalAlign: 'top'
  })

  model.setValue(10, 3, '多行文本演示\n第一行内容\n第二行内容\n第三行内容')
  model.setCellStyle(10, 3, {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    verticalAlign: 'middle'
  })

  // ===== 第 13 行：文字旋转演示 =====
  model.setValue(13, 0, '文字旋转')
  model.setCellStyle(13, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(13, 1, '45°')
  model.setCellStyle(13, 1, {
    textRotation: 45,
    color: '#dc2626',
    bold: true,
    backgroundColor: '#fee2e2'
  })

  model.setValue(13, 2, '90°')
  model.setCellStyle(13, 2, {
    textRotation: 90,
    color: '#0891b2',
    bold: true,
    backgroundColor: '#cffafe'
  })

  model.setValue(13, 3, '-45°')
  model.setCellStyle(13, 3, {
    textRotation: -45,
    color: '#7c3aed',
    bold: true,
    backgroundColor: '#ede9fe'
  })

  // ===== 第 16 行：综合样式演示 =====
  model.setValue(16, 0, '综合样式')
  model.setCellStyle(16, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(16, 1, '高亮标注')
  model.setCellStyle(16, 1, {
    bold: true,
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: '#ef4444',
    textAlign: 'center',
    verticalAlign: 'middle'
  })

  model.setValue(16, 2, '重要提示')
  model.setCellStyle(16, 2, {
    bold: true,
    italic: true,
    underline: 'double',
    fontSize: 15,
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    textAlign: 'center'
  })

  model.setValue(16, 3, '完成项')
  model.setCellStyle(16, 3, {
    strikethrough: true,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    textAlign: 'center'
  })

  // ===== 第 18 行：数据示例 =====
  model.setValue(18, 0, '数据区域')
  model.setCellStyle(18, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  // 表头
  const headers = ['姓名', '部门', '职位', '状态']
  headers.forEach((header, index) => {
    model.setValue(19, index, header)
    model.setCellStyle(19, index, {
      bold: true,
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      textAlign: 'center',
      verticalAlign: 'middle'
    })
  })

  // 数据行
  const data = [
    ['张三', '技术部', '工程师', '在职'],
    ['李四', '销售部', '经理', '在职'],
    ['王五', '人事部', '专员', '离职'],
    ['赵六', '财务部', '会计', '在职']
  ]

  data.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      model.setValue(20 + rowIndex, colIndex, value)
      
      // 设置样式
      const style: any = {
        textAlign: 'center',
        verticalAlign: 'middle'
      }

      // 状态列特殊处理
      if (colIndex === 3) {
        if (value === '在职') {
          style.backgroundColor = '#d1fae5'
          style.color = '#065f46'
          style.bold = true
        } else {
          style.backgroundColor = '#fee2e2'
          style.color = '#991b1b'
          style.strikethrough = true
        }
      } else {
        // 偶数行浅灰背景
        if (rowIndex % 2 === 0) {
          style.backgroundColor = '#f9fafb'
        }
      }

      model.setCellStyle(20 + rowIndex, colIndex, style)
    })
  })

  // ===== 第 26 行：公式示例 =====
  model.setValue(26, 0, '公式计算')
  model.setCellStyle(26, 0, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })

  model.setValue(26, 1, '10')
  model.setValue(26, 2, '20')
  model.setValue(26, 3, '=B27+C27')
  model.setCellStyle(26, 3, {
    bold: true,
    color: '#0891b2',
    backgroundColor: '#ecfeff'
  })

  model.setValue(27, 1, '5')
  model.setValue(27, 2, '15')
  model.setValue(27, 3, '=SUM(B28:C28)')
  model.setCellStyle(27, 3, {
    bold: true,
    color: '#7c3aed',
    backgroundColor: '#f5f3ff'
  })
}
