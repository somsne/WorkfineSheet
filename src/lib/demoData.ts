/**
 * Demo data initialization for showcasing cell styles
 */

import type { SheetModel } from './SheetModel'
import type { CellFormat } from '../components/sheet/types'

/**
 * Initialize the sheet with demo data showcasing various cell styles
 */
export function initializeDemoData(model: SheetModel): void {
  // ===== 标题行 (合并单元格 A1:E1) =====
  model.setValue(0, 0, '样式功能演示')
  model.setCellStyle(0, 0, {
    fontSize: 20,
    bold: true,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  // 合并标题单元格 A1:E1
  model.mergeCells(0, 0, 0, 4)

  // ===== P3～T12：合并单元格演示区域 =====
  initializeMergeCellsDemo(model)

  // ===== G3～J20：边框样式演示区域 =====
  // 标题
  model.setValue(2, 6, '边框样式演示')
  model.setCellStyle(2, 6, {
    bold: true,
    fontSize: 16,
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    textAlign: 'center',
    verticalAlign: 'middle'
  })

  // 所有边框示例 (G5-H8)
  model.setValue(4, 6, '所有边框')
  model.setCellStyle(4, 6, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 5; row <= 7; row++) {
    for (let col = 6; col <= 7; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle'
      })
      model.setCellBorder(row, col, {
        top: { style: 'thin', color: '#000000' },
        right: { style: 'thin', color: '#000000' },
        bottom: { style: 'thin', color: '#000000' },
        left: { style: 'thin', color: '#000000' }
      })
    }
  }

  // 外边框示例 (I5-J8)
  model.setValue(4, 8, '外边框')
  model.setCellStyle(4, 8, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 5; row <= 7; row++) {
    for (let col = 8; col <= 9; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: '#fef9c3'
      })
    }
  }
  // 只设置外边框
  for (let row = 5; row <= 7; row++) {
    model.setCellBorder(row, 8, {
      top: row === 5 ? { style: 'medium', color: '#0891b2' } : undefined,
      bottom: row === 7 ? { style: 'medium', color: '#0891b2' } : undefined,
      left: { style: 'medium', color: '#0891b2' }
    })
    model.setCellBorder(row, 9, {
      top: row === 5 ? { style: 'medium', color: '#0891b2' } : undefined,
      bottom: row === 7 ? { style: 'medium', color: '#0891b2' } : undefined,
      right: { style: 'medium', color: '#0891b2' }
    })
  }

  // 粗边框示例 (G10-H12)
  model.setValue(9, 6, '粗边框')
  model.setCellStyle(9, 6, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 10; row <= 11; row++) {
    for (let col = 6; col <= 7; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: '#fee2e2'
      })
      model.setCellBorder(row, col, {
        top: { style: 'thick', color: '#dc2626' },
        right: { style: 'thick', color: '#dc2626' },
        bottom: { style: 'thick', color: '#dc2626' },
        left: { style: 'thick', color: '#dc2626' }
      })
    }
  }

  // 虚线边框示例 (I10-J12)
  model.setValue(9, 8, '虚线边框')
  model.setCellStyle(9, 8, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 10; row <= 11; row++) {
    for (let col = 8; col <= 9; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: '#e0e7ff'
      })
      model.setCellBorder(row, col, {
        top: { style: 'dashed', color: '#6366f1' },
        right: { style: 'dashed', color: '#6366f1' },
        bottom: { style: 'dashed', color: '#6366f1' },
        left: { style: 'dashed', color: '#6366f1' }
      })
    }
  }

  // 点线边框示例 (G14-H16)
  model.setValue(13, 6, '点线边框')
  model.setCellStyle(13, 6, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 14; row <= 15; row++) {
    for (let col = 6; col <= 7; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: '#d1fae5'
      })
      model.setCellBorder(row, col, {
        top: { style: 'dotted', color: '#059669' },
        right: { style: 'dotted', color: '#059669' },
        bottom: { style: 'dotted', color: '#059669' },
        left: { style: 'dotted', color: '#059669' }
      })
    }
  }

  // 双线边框示例 (I14-J16)
  model.setValue(13, 8, '双线边框')
  model.setCellStyle(13, 8, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  for (let row = 14; row <= 15; row++) {
    for (let col = 8; col <= 9; col++) {
      model.setValue(row, col, `${String.fromCharCode(65 + col)}${row + 1}`)
      model.setCellStyle(row, col, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: '#fae8ff'
      })
      model.setCellBorder(row, col, {
        top: { style: 'double', color: '#c026d3' },
        right: { style: 'double', color: '#c026d3' },
        bottom: { style: 'double', color: '#c026d3' },
        left: { style: 'double', color: '#c026d3' }
      })
    }
  }

  // 混合边框示例 - 表格效果 (G18-J20)
  model.setValue(17, 6, '表格边框')
  model.setCellStyle(17, 6, {
    bold: true,
    textAlign: 'center',
    backgroundColor: '#f3f4f6'
  })
  
  // 表格表头
  const borderHeaders = ['姓名', '年龄', '城市', '职位']
  borderHeaders.forEach((header, index) => {
    model.setValue(18, 6 + index, header)
    model.setCellStyle(18, 6 + index, {
      bold: true,
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      textAlign: 'center',
      verticalAlign: 'middle'
    })
    // 表头边框
    model.setCellBorder(18, 6 + index, {
      top: { style: 'thick', color: '#1e40af' },
      right: { style: 'thin', color: '#60a5fa' },
      bottom: { style: 'medium', color: '#1e40af' },
      left: { style: 'thin', color: '#60a5fa' }
    })
  })
  
  // 表格数据行
  const borderData = [
    ['张三', '28', '北京', '工程师'],
    ['李四', '32', '上海', '经理']
  ]
  
  borderData.forEach((rowData, rowIndex) => {
    rowData.forEach((value, colIndex) => {
      model.setValue(19 + rowIndex, 6 + colIndex, value)
      model.setCellStyle(19 + rowIndex, 6 + colIndex, {
        textAlign: 'center',
        verticalAlign: 'middle',
        backgroundColor: rowIndex % 2 === 0 ? '#f0f9ff' : '#ffffff'
      })
      // 数据行边框
      model.setCellBorder(19 + rowIndex, 6 + colIndex, {
        top: { style: 'thin', color: '#cbd5e1' },
        right: { style: 'thin', color: '#cbd5e1' },
        bottom: { style: 'thin', color: '#cbd5e1' },
        left: { style: 'thin', color: '#cbd5e1' }
      })
    })
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

  // ===== 第 30-55 行：单元格格式示例 =====
  initializeFormatExamples(model)
}

/**
 * Initialize format examples section
 */
function initializeFormatExamples(model: SheetModel): void {
  const startRow = 30

  // 标题
  model.setValue(startRow, 0, '单元格格式示例')
  model.setCellStyle(startRow, 0, {
    bold: true,
    fontSize: 14,
    backgroundColor: '#1e40af',
    color: '#ffffff'
  })

  // 表头
  const formatHeaders = ['格式类型', '原始值', '格式化结果', '说明']
  formatHeaders.forEach((header, index) => {
    model.setValue(startRow + 1, index, header)
    model.setCellStyle(startRow + 1, index, {
      bold: true,
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      textAlign: 'center'
    })
  })

  let row = startRow + 2

  // ===== 文本格式 =====
  // 身份证
  model.setValue(row, 0, '身份证')
  model.setValue(row, 1, '110101199003076518')
  model.setValue(row, 2, '110101199003076518')
  model.setCellFormat(row, 2, { type: 'idCard' } as CellFormat)
  model.setValue(row, 3, '验证身份证格式是否正确')
  row++

  // 无效身份证
  model.setValue(row, 0, '无效身份证')
  model.setValue(row, 1, '123456789012345678')
  model.setValue(row, 2, '123456789012345678')
  model.setCellFormat(row, 2, { type: 'idCard' } as CellFormat)
  model.setValue(row, 3, '无效身份证会显示红色边框')
  row++

  // 手机号
  model.setValue(row, 0, '手机号')
  model.setValue(row, 1, '13812345678')
  model.setValue(row, 2, '13812345678')
  model.setCellFormat(row, 2, { type: 'phone' } as CellFormat)
  model.setValue(row, 3, '验证手机号格式')
  row++

  // 固定电话
  model.setValue(row, 0, '固定电话')
  model.setValue(row, 1, '02112345678')
  model.setValue(row, 2, '02112345678')
  model.setCellFormat(row, 2, { type: 'telephone' } as CellFormat)
  model.setValue(row, 3, '自动格式化为 021-12345678')
  row++

  // 邮箱
  model.setValue(row, 0, '邮箱')
  model.setValue(row, 1, 'test@example.com')
  model.setValue(row, 2, 'test@example.com')
  model.setCellFormat(row, 2, { type: 'email' } as CellFormat)
  model.setValue(row, 3, '验证邮箱格式')
  row++

  // 超链接
  model.setValue(row, 0, '超链接')
  model.setValue(row, 1, 'https://workfine.com')
  model.setValue(row, 2, 'https://workfine.com')
  model.setCellFormat(row, 2, { type: 'hyperlink' } as CellFormat)
  model.setValue(row, 3, '显示为可点击的链接')
  row++

  row++ // 空行

  // ===== 数字格式 =====
  model.setValue(row, 0, '数字格式')
  model.setCellStyle(row, 0, { bold: true, backgroundColor: '#e0e7ff' })
  row++

  // 保留2位小数
  model.setValue(row, 0, '小数 (2位)')
  model.setValue(row, 1, '1234.5')
  model.setValue(row, 2, '1234.5')
  model.setCellFormat(row, 2, { type: 'decimal2' } as CellFormat)
  model.setValue(row, 3, '显示为 1234.50')
  row++

  // 千分位
  model.setValue(row, 0, '千分位')
  model.setValue(row, 1, '1234567.89')
  model.setValue(row, 2, '1234567.89')
  model.setCellFormat(row, 2, { type: 'thousands' } as CellFormat)
  model.setValue(row, 3, '显示为 1,234,567.89')
  row++

  // 百分比
  model.setValue(row, 0, '百分比')
  model.setValue(row, 1, '0.856')
  model.setValue(row, 2, '0.856')
  model.setCellFormat(row, 2, { type: 'percent' } as CellFormat)
  model.setValue(row, 3, '显示为 85.60%')
  row++

  // 千分率
  model.setValue(row, 0, '千分率')
  model.setValue(row, 1, '0.0356')
  model.setValue(row, 2, '0.0356')
  model.setCellFormat(row, 2, { type: 'permille' } as CellFormat)
  model.setValue(row, 3, '显示为 35.60‰')
  row++

  // 人民币
  model.setValue(row, 0, '人民币')
  model.setValue(row, 1, '1234.56')
  model.setValue(row, 2, '1234.56')
  model.setCellFormat(row, 2, { type: 'currencyCNY' } as CellFormat)
  model.setValue(row, 3, '显示为 ¥1,234.56')
  row++

  // 美元
  model.setValue(row, 0, '美元')
  model.setValue(row, 1, '1234.56')
  model.setValue(row, 2, '1234.56')
  model.setCellFormat(row, 2, { type: 'currencyUSD' } as CellFormat)
  model.setValue(row, 3, '显示为 $1,234.56')
  row++

  // 科学计数法
  model.setValue(row, 0, '科学计数')
  model.setValue(row, 1, '12345678')
  model.setValue(row, 2, '12345678')
  model.setCellFormat(row, 2, { type: 'scientific' } as CellFormat)
  model.setValue(row, 3, '显示为 1.23e+7')
  row++

  // 分数
  model.setValue(row, 0, '分数')
  model.setValue(row, 1, '0.75')
  model.setValue(row, 2, '0.75')
  model.setCellFormat(row, 2, { type: 'fraction' } as CellFormat)
  model.setValue(row, 3, '显示为 3/4')
  row++

  // 负数红色
  model.setValue(row, 0, '负数红色')
  model.setValue(row, 1, '-1234.56')
  model.setValue(row, 2, '-1234.56')
  model.setCellFormat(row, 2, { type: 'negativeRed' } as CellFormat)
  model.setValue(row, 3, '负数以红色显示')
  row++

  // 自定义数字格式
  model.setValue(row, 0, '自定义千分位')
  model.setValue(row, 1, '1234567.891')
  model.setValue(row, 2, '1234567.891')
  model.setCellFormat(row, 2, { type: 'custom', pattern: '#,##0.00' } as CellFormat)
  model.setValue(row, 3, '格式: #,##0.00')
  row++

  model.setValue(row, 0, '自定义货币')
  model.setValue(row, 1, '9876.54')
  model.setValue(row, 2, '9876.54')
  model.setCellFormat(row, 2, { type: 'custom', pattern: '¥#,##0.00元' } as CellFormat)
  model.setValue(row, 3, '格式: ¥#,##0.00元')
  row++

  model.setValue(row, 0, '电话前缀')
  model.setValue(row, 1, '12345678')
  model.setValue(row, 2, '12345678')
  model.setCellFormat(row, 2, { type: 'custom', pattern: '021-########' } as CellFormat)
  model.setValue(row, 3, '格式: 021-########')

  // ===== F32～N49：扩展格式示例区域 =====
  initializeExtendedFormatExamples(model)
}

/**
 * Initialize extended format examples in F32-N49 area
 */
function initializeExtendedFormatExamples(model: SheetModel): void {
  const startRow = 31 // F32 开始 (0-indexed = 31)
  const startCol = 5  // F 列 (0-indexed = 5)

  // ===== 左侧区域 F-I 列：更多数字格式 =====
  // 标题
  model.setValue(startRow, startCol, '更多数字格式')
  model.setCellStyle(startRow, startCol, {
    bold: true,
    fontSize: 14,
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    textAlign: 'center'
  })

  // 表头
  const leftHeaders = ['格式', '值', '结果', '说明']
  leftHeaders.forEach((header, index) => {
    model.setValue(startRow + 1, startCol + index, header)
    model.setCellStyle(startRow + 1, startCol + index, {
      bold: true,
      backgroundColor: '#8b5cf6',
      color: '#ffffff',
      textAlign: 'center'
    })
  })

  let leftRow = startRow + 2

  // 整数格式
  model.setValue(leftRow, startCol, '整数')
  model.setValue(leftRow, startCol + 1, '1234.567')
  model.setValue(leftRow, startCol + 2, '1234.567')
  model.setCellFormat(leftRow, startCol + 2, { type: 'number' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '四舍五入为整数')
  leftRow++

  // 千分位格式
  model.setValue(leftRow, startCol, '千分位大数')
  model.setValue(leftRow, startCol + 1, '9876543.21')
  model.setValue(leftRow, startCol + 2, '9876543.21')
  model.setCellFormat(leftRow, startCol + 2, { type: 'thousands' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 9,876,543.21')
  leftRow++

  // 百分比 - 大于100%
  model.setValue(leftRow, startCol, '百分比>100%')
  model.setValue(leftRow, startCol + 1, '1.5')
  model.setValue(leftRow, startCol + 2, '1.5')
  model.setCellFormat(leftRow, startCol + 2, { type: 'percent' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 150.00%')
  leftRow++

  // 千分率 - 小数值
  model.setValue(leftRow, startCol, '千分率')
  model.setValue(leftRow, startCol + 1, '0.00856')
  model.setValue(leftRow, startCol + 2, '0.00856')
  model.setCellFormat(leftRow, startCol + 2, { type: 'permille' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 8.56‰')
  leftRow++

  // 科学计数法 - 小数
  model.setValue(leftRow, startCol, '科学计数小数')
  model.setValue(leftRow, startCol + 1, '0.00000123')
  model.setValue(leftRow, startCol + 2, '0.00000123')
  model.setCellFormat(leftRow, startCol + 2, { type: 'scientific' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 1.23e-6')
  leftRow++

  // 分数 - 1/3
  model.setValue(leftRow, startCol, '分数 1/3')
  model.setValue(leftRow, startCol + 1, '0.333333')
  model.setValue(leftRow, startCol + 2, '0.333333')
  model.setCellFormat(leftRow, startCol + 2, { type: 'fraction' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 1/3')
  leftRow++

  // 人民币 - 大金额
  model.setValue(leftRow, startCol, '人民币大额')
  model.setValue(leftRow, startCol + 1, '98765.43')
  model.setValue(leftRow, startCol + 2, '98765.43')
  model.setCellFormat(leftRow, startCol + 2, { type: 'currencyCNY' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 ¥98,765.43')
  leftRow++

  // 美元 - 小金额
  model.setValue(leftRow, startCol, '美元小额')
  model.setValue(leftRow, startCol + 1, '0.99')
  model.setValue(leftRow, startCol + 2, '0.99')
  model.setCellFormat(leftRow, startCol + 2, { type: 'currencyUSD' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '显示为 $0.99')
  leftRow++

  leftRow++ // 空行

  // 负数红色 - 实际负数
  model.setValue(leftRow, startCol, '负数红色')
  model.setValue(leftRow, startCol + 1, '-9999.99')
  model.setValue(leftRow, startCol + 2, '-9999.99')
  model.setCellFormat(leftRow, startCol + 2, { type: 'negativeRed' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '负数显示红色')
  leftRow++

  // 正数用负数格式
  model.setValue(leftRow, startCol, '正数(negativeRed)')
  model.setValue(leftRow, startCol + 1, '9999.99')
  model.setValue(leftRow, startCol + 2, '9999.99')
  model.setCellFormat(leftRow, startCol + 2, { type: 'negativeRed' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '正数保持黑色')
  leftRow++

  leftRow++ // 空行

  // 自定义格式补充
  model.setValue(leftRow, startCol, '自定义格式')
  model.setCellStyle(leftRow, startCol, {
    bold: true,
    fontSize: 12,
    backgroundColor: '#10b981',
    color: '#ffffff'
  })
  leftRow++

  // 自定义千分位4位小数
  model.setValue(leftRow, startCol, '千分位4位')
  model.setValue(leftRow, startCol + 1, '1234567.8912')
  model.setValue(leftRow, startCol + 2, '1234567.8912')
  model.setCellFormat(leftRow, startCol + 2, { type: 'custom', pattern: '#,##0.0000' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '格式: #,##0.0000')
  leftRow++

  // 自定义带单位
  model.setValue(leftRow, startCol, '带单位')
  model.setValue(leftRow, startCol + 1, '12345')
  model.setValue(leftRow, startCol + 2, '12345')
  model.setCellFormat(leftRow, startCol + 2, { type: 'custom', pattern: '#,##0 元' } as CellFormat)
  model.setValue(leftRow, startCol + 3, '格式: #,##0 元')
  leftRow++

  // ===== 右侧区域 K-N 列：日期时间格式 =====
  const rightCol = 10 // K 列 (0-indexed = 10)
  let rightRow = startRow

  // 标题
  model.setValue(rightRow, rightCol, '更多日期格式')
  model.setCellStyle(rightRow, rightCol, {
    bold: true,
    fontSize: 14,
    backgroundColor: '#0891b2',
    color: '#ffffff',
    textAlign: 'center'
  })

  // 表头
  const rightHeaders = ['格式', '值', '结果', '说明']
  rightHeaders.forEach((header, index) => {
    model.setValue(rightRow + 1, rightCol + index, header)
    model.setCellStyle(rightRow + 1, rightCol + index, {
      bold: true,
      backgroundColor: '#06b6d4',
      color: '#ffffff',
      textAlign: 'center'
    })
  })

  rightRow = startRow + 2
  // Excel 标准日期格式：2024/12/25
  const excelDateStr = '2024/12/25'
  // 日期时间字符串用于时间格式演示
  const dateTimeStr = '2024-12-25 09:05:30'

  // 年份
  model.setValue(rightRow, rightCol, '年份')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-y' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024')
  rightRow++

  // 年份中文
  model.setValue(rightRow, rightCol, '年份中文')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-y-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024年')
  rightRow++

  // 年月无补零
  model.setValue(rightRow, rightCol, '年月无补零')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-ym' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024-12')
  rightRow++

  // 年月斜杠
  model.setValue(rightRow, rightCol, '年月斜杠')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-ym-slash' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024/12')
  rightRow++

  // 年月中文
  model.setValue(rightRow, rightCol, '年月中文')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-ym-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024年12月')
  rightRow++

  // 月中文
  model.setValue(rightRow, rightCol, '月份中文')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-m-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 12月')
  rightRow++

  // 年月日无补零
  model.setValue(rightRow, rightCol, '日期无补零')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-ymd' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024-12-25')
  rightRow++

  // 年月日斜杠
  model.setValue(rightRow, rightCol, '日期斜杠')
  model.setValue(rightRow, rightCol + 1, excelDateStr)
  model.setValue(rightRow, rightCol + 2, excelDateStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'date-ymd-slash' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 2024/12/25')
  rightRow++

  rightRow++ // 空行

  // 时间区域标题
  model.setValue(rightRow, rightCol, '时间格式')
  model.setCellStyle(rightRow, rightCol, {
    bold: true,
    fontSize: 12,
    backgroundColor: '#f59e0b',
    color: '#ffffff'
  })
  rightRow++

  // 时分
  model.setValue(rightRow, rightCol, '时分')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'time-hm' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 9:05')
  rightRow++

  // 时分中文
  model.setValue(rightRow, rightCol, '时分中文')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'time-hm-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 9时5分')
  rightRow++

  // 时分秒
  model.setValue(rightRow, rightCol, '时分秒')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'time-hms' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 9:05:30')
  rightRow++

  // 时分秒中文
  model.setValue(rightRow, rightCol, '时分秒中文')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'time-hms-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '显示为 9时5分30秒')
  rightRow++

  rightRow++ // 空行

  // 日期时间区域标题
  model.setValue(rightRow, rightCol, '日期时间格式')
  model.setCellStyle(rightRow, rightCol, {
    bold: true,
    fontSize: 12,
    backgroundColor: '#dc2626',
    color: '#ffffff'
  })
  rightRow++

  // 日期时间
  model.setValue(rightRow, rightCol, '日期时间')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'datetime' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '2024-12-25 9:05:30')
  rightRow++

  // 日期时间斜杠
  model.setValue(rightRow, rightCol, '斜杠日期时间')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'datetime-slash' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '2024/12/25 9:05:30')
  rightRow++

  // 中文日期时间
  model.setValue(rightRow, rightCol, '中文日期时间')
  model.setValue(rightRow, rightCol + 1, dateTimeStr)
  model.setValue(rightRow, rightCol + 2, dateTimeStr)
  model.setCellFormat(rightRow, rightCol + 2, { type: 'datetime-cn' } as CellFormat)
  model.setValue(rightRow, rightCol + 3, '2024年12月25日 9时5分')
}

/**
 * Initialize merge cells demo section in P3-T12 area
 */
function initializeMergeCellsDemo(model: SheetModel): void {
  const startRow = 2  // 第3行 (0-indexed = 2)
  const startCol = 15 // P列 (0-indexed = 15)

  // ===== 标题 (合并 P3:T3) =====
  model.setValue(startRow, startCol, '合并单元格演示')
  model.setCellStyle(startRow, startCol, {
    bold: true,
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: '#7c3aed',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow, startCol, startRow, startCol + 4)

  // ===== 水平合并示例 =====
  // 标签
  model.setValue(startRow + 2, startCol, '水平合并')
  model.setCellStyle(startRow + 2, startCol, {
    bold: true,
    backgroundColor: '#f3f4f6',
    textAlign: 'right',
    verticalAlign: 'middle'
  })
  
  // 水平合并 2x1 (Q5:R5)
  model.setValue(startRow + 2, startCol + 1, '2列合并')
  model.setCellStyle(startRow + 2, startCol + 1, {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow + 2, startCol + 1, startRow + 2, startCol + 2)
  
  // 水平合并 3x1 (S5:U5)
  model.setValue(startRow + 2, startCol + 3, '3列合并')
  model.setCellStyle(startRow + 2, startCol + 3, {
    backgroundColor: '#dcfce7',
    color: '#166534',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow + 2, startCol + 3, startRow + 2, startCol + 5)

  // ===== 垂直合并示例 =====
  // 标签
  model.setValue(startRow + 4, startCol, '垂直合并')
  model.setCellStyle(startRow + 4, startCol, {
    bold: true,
    backgroundColor: '#f3f4f6',
    textAlign: 'right',
    verticalAlign: 'middle'
  })
  
  // 垂直合并 1x2 (Q7:Q8)
  model.setValue(startRow + 4, startCol + 1, '2行合并')
  model.setCellStyle(startRow + 4, startCol + 1, {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow + 4, startCol + 1, startRow + 5, startCol + 1)
  
  // 垂直合并 1x3 (R7:R9)
  model.setValue(startRow + 4, startCol + 2, '3行合并')
  model.setCellStyle(startRow + 4, startCol + 2, {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow + 4, startCol + 2, startRow + 6, startCol + 2)

  // ===== 矩形合并示例 =====
  // 标签
  model.setValue(startRow + 8, startCol, '矩形合并')
  model.setCellStyle(startRow + 8, startCol, {
    bold: true,
    backgroundColor: '#f3f4f6',
    textAlign: 'right',
    verticalAlign: 'middle'
  })
  
  // 2x2 合并 (Q11:R12)
  model.setValue(startRow + 8, startCol + 1, '2x2合并')
  model.setCellStyle(startRow + 8, startCol + 1, {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    textAlign: 'center',
    verticalAlign: 'middle',
    bold: true
  })
  model.mergeCells(startRow + 8, startCol + 1, startRow + 9, startCol + 2)
  
  // 2x3 合并 (S11:U12)
  model.setValue(startRow + 8, startCol + 3, '2x3合并')
  model.setCellStyle(startRow + 8, startCol + 3, {
    backgroundColor: '#fae8ff',
    color: '#86198f',
    textAlign: 'center',
    verticalAlign: 'middle',
    bold: true
  })
  model.mergeCells(startRow + 8, startCol + 3, startRow + 9, startCol + 5)

  // ===== 表格样式合并（模拟表头） =====
  // 标题行
  model.setValue(startRow + 11, startCol, '表格合并示例')
  model.setCellStyle(startRow + 11, startCol, {
    bold: true,
    backgroundColor: '#f3f4f6',
    textAlign: 'right',
    verticalAlign: 'middle'
  })
  
  // 模拟表格 - 表头
  model.setValue(startRow + 11, startCol + 1, '姓名')
  model.setCellStyle(startRow + 11, startCol + 1, {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    bold: true,
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  // 联系方式表头（合并2列）
  model.setValue(startRow + 11, startCol + 2, '联系方式')
  model.setCellStyle(startRow + 11, startCol + 2, {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    bold: true,
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow + 11, startCol + 2, startRow + 11, startCol + 3)
  
  // 子表头
  model.setValue(startRow + 12, startCol + 1, '')
  model.setValue(startRow + 12, startCol + 2, '电话')
  model.setValue(startRow + 12, startCol + 3, '邮箱')
  model.setCellStyle(startRow + 12, startCol + 2, {
    backgroundColor: '#60a5fa',
    color: '#ffffff',
    textAlign: 'center'
  })
  model.setCellStyle(startRow + 12, startCol + 3, {
    backgroundColor: '#60a5fa',
    color: '#ffffff',
    textAlign: 'center'
  })
  
  // 姓名列合并两行（对应表头和子表头）
  model.mergeCells(startRow + 11, startCol + 1, startRow + 12, startCol + 1)
  
  // 数据行
  model.setValue(startRow + 13, startCol + 1, '张三')
  model.setValue(startRow + 13, startCol + 2, '13800138000')
  model.setValue(startRow + 13, startCol + 3, 'zhang@test.com')
  model.setCellStyle(startRow + 13, startCol + 1, { textAlign: 'center' })
  model.setCellStyle(startRow + 13, startCol + 2, { textAlign: 'center' })
  model.setCellStyle(startRow + 13, startCol + 3, { textAlign: 'center' })
  
  // 添加边框让表格更清晰
  for (let r = startRow + 11; r <= startRow + 13; r++) {
    for (let c = startCol + 1; c <= startCol + 3; c++) {
      model.setCellBorder(r, c, {
        top: { style: 'thin', color: '#94a3b8' },
        right: { style: 'thin', color: '#94a3b8' },
        bottom: { style: 'thin', color: '#94a3b8' },
        left: { style: 'thin', color: '#94a3b8' }
      })
    }
  }
}
