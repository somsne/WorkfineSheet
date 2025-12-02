/**
 * Demo data initialization for showcasing cell styles and formats
 */

import type { SheetModel } from './SheetModel'
import type { Workbook } from './Workbook'
import type { CellFormat } from '../components/sheet/types'

// 示例图片 - 一个简单的表格图标 (SVG 转 Base64)
const DEMO_IMAGE_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+CiAgPCEtLSDog4zmma/lnIYgLS0+CiAgPGNpcmNsZSBjeD0iNjAiIGN5PSI2MCIgcj0iNTUiIGZpbGw9IiMzYjgyZjYiLz4KICA8IS0tIOihqOagvOWbvuaghyAtLT4KICA8cmVjdCB4PSIyNSIgeT0iMjUiIHdpZHRoPSI3MCIgaGVpZ2h0PSI3MCIgcng9IjgiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSDooajmoLznur/mnaEgLS0+CiAgPGxpbmUgeDE9IjI1IiB5MT0iNDUiIHgyPSI5NSIgeTI9IjQ1IiBzdHJva2U9IiNlMmU4ZjAiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxsaW5lIHgxPSIyNSIgeTE9IjY1IiB4Mj0iOTUiIHkyPSI2NSIgc3Ryb2tlPSIjZTJlOGYwIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8bGluZSB4MT0iNTAiIHkxPSIyNSIgeDI9IjUwIiB5Mj0iOTUiIHN0cm9rZT0iI2UyZThmMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPCEtLSDnhJ/lip/moIforrAgLS0+CiAgPGNpcmNsZSBjeD0iMzciIGN5PSI1NSIgcj0iNiIgZmlsbD0iIzIyYzU1ZSIvPgogIDxwYXRoIGQ9Ik0zNCA1NUwzNiA1N0w0MCA1MiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+CiAgPCEtLSDmlbDlrZfmoIforrAgLS0+CiAgPHRleHQgeD0iNzIiIHk9IjU4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjM2I4MmY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4xMjM8L3RleHQ+CiAgPCEtLSDlupXpg6jmloflrZcgLS0+CiAgPHRleHQgeD0iNjAiIHk9IjgyIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NGI1ZjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlNoZWV0PC90ZXh0Pgo8L3N2Zz4='

/**
 * Initialize demo data for the workbook
 * - Renames Sheet1 to "样式示例" and populates with style demos
 * - Creates a new sheet "格式示例" and populates with format demos
 */
export function initializeDemoData(workbook: Workbook): void {
  // 获取第一个工作表并重命名
  const sheets = workbook.getAllSheets()
  if (sheets.length === 0) return
  
  const firstSheet = sheets[0]
  if (!firstSheet) return
  
  workbook.renameSheet(firstSheet.metadata.id, '样式示例')
  
  // 填充样式示例数据
  initializeStyleDemoData(firstSheet.model)
  
  // 创建第二个工作表：格式示例
  const formatSheetId = workbook.addSheet('格式示例')
  const formatSheet = workbook.getSheetById(formatSheetId)
  if (formatSheet) {
    initializeFormatDemoData(formatSheet.model)
  }
  
  // 切换回第一个工作表
  workbook.setActiveSheet(firstSheet.metadata.id)
}

/**
 * Initialize the sheet with style demo data
 */
function initializeStyleDemoData(model: SheetModel): void {
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

  // ===== K1～P14：合并单元格演示区域 =====
  initializeMergeCellsDemo(model)

  // ===== L17～N22：单元格内嵌图片演示 =====
  initializeCellImagesDemo(model,16)

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

  // ===== 浮动图片演示 =====
  initializeDemoImage(model)
}

/**
 * Initialize merge cells demo section in K1-P14 area
 */
function initializeMergeCellsDemo(model: SheetModel): void {
  const startRow = 0  // 第1行 (0-indexed = 0)
  const startCol = 11 // K列 (0-indexed = 11)

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

/**
 * Initialize demo floating image
 */
function initializeDemoImage(model: SheetModel): void {
  // 在 L3 位置 (0-indexed: row=2, col=11) 添加示例图片
  // 放在边框演示区域右侧
  model.addFloatingImage({
    src: DEMO_IMAGE_DATA_URL,
    naturalWidth: 120,
    naturalHeight: 120,
    anchorRow: 16,
    anchorCol: 15, // L 列
    offsetX: 10,
    offsetY: 10,
    width: 120,
    height: 120,
    lockAspectRatio: true,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false
  })
  
}

/**
 * Initialize format demo data for the format sheet (从 A1 开始)
 */
function initializeFormatDemoData(model: SheetModel): void {
  // ===== 标题行 =====
  model.setValue(0, 0, '单元格格式示例')
  model.setCellStyle(0, 0, {
    bold: true,
    fontSize: 20,
    backgroundColor: '#1e40af',
    color: '#ffffff',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(0, 0, 0, 3)

  // 表头
  const formatHeaders = ['格式类型', '原始值', '格式化结果', '说明']
  formatHeaders.forEach((header, index) => {
    model.setValue(1, index, header)
    model.setCellStyle(1, index, {
      bold: true,
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      textAlign: 'center'
    })
  })

  let row = 2

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
  // ===== 日期时间格式 =====
  model.setValue(row, 0, '日期时间格式')
  model.setCellStyle(row, 0, { bold: true, backgroundColor: '#fef3c7' })
  model.mergeCells(row, 0, row, 3)
  row++

  const excelDateStr = '2024/12/25'
  const dateTimeStr = '2024-12-25 09:05:30'

  // 年份
  model.setValue(row, 0, '年份')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-y' } as CellFormat)
  model.setValue(row, 3, '显示为 2024')
  row++

  // 年份中文
  model.setValue(row, 0, '年份中文')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-y-cn' } as CellFormat)
  model.setValue(row, 3, '显示为 2024年')
  row++

  // 年月
  model.setValue(row, 0, '年月')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-ym' } as CellFormat)
  model.setValue(row, 3, '显示为 2024-12')
  row++

  // 年月中文
  model.setValue(row, 0, '年月中文')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-ym-cn' } as CellFormat)
  model.setValue(row, 3, '显示为 2024年12月')
  row++

  // 年月日
  model.setValue(row, 0, '年月日')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-ymd' } as CellFormat)
  model.setValue(row, 3, '显示为 2024-12-25')
  row++

  // 年月日斜杠
  model.setValue(row, 0, '年月日斜杠')
  model.setValue(row, 1, excelDateStr)
  model.setValue(row, 2, excelDateStr)
  model.setCellFormat(row, 2, { type: 'date-ymd-slash' } as CellFormat)
  model.setValue(row, 3, '显示为 2024/12/25')
  row++

  // 时分
  model.setValue(row, 0, '时分')
  model.setValue(row, 1, dateTimeStr)
  model.setValue(row, 2, dateTimeStr)
  model.setCellFormat(row, 2, { type: 'time-hm' } as CellFormat)
  model.setValue(row, 3, '显示为 9:05')
  row++

  // 时分秒
  model.setValue(row, 0, '时分秒')
  model.setValue(row, 1, dateTimeStr)
  model.setValue(row, 2, dateTimeStr)
  model.setCellFormat(row, 2, { type: 'time-hms' } as CellFormat)
  model.setValue(row, 3, '显示为 9:05:30')
  row++

  // 日期时间
  model.setValue(row, 0, '日期时间')
  model.setValue(row, 1, dateTimeStr)
  model.setValue(row, 2, dateTimeStr)
  model.setCellFormat(row, 2, { type: 'datetime' } as CellFormat)
  model.setValue(row, 3, '显示为 2024-12-25 9:05:30')
  row++

  // 中文日期时间
  model.setValue(row, 0, '中文日期时间')
  model.setValue(row, 1, dateTimeStr)
  model.setValue(row, 2, dateTimeStr)
  model.setCellFormat(row, 2, { type: 'datetime-cn' } as CellFormat)
  model.setValue(row, 3, '显示为 2024年12月25日 9时5分')
  row++
  
  row=1

  let col=5
  // ===== 数字格式 =====
  model.setValue(row, col + 0, '数字格式')
  model.setCellStyle(row, col + 0, { bold: true, backgroundColor: '#e0e7ff' })
  model.mergeCells(row, col + 0, row, col + 3)
  row++

  // 保留2位小数
  model.setValue(row, col + 0, '小数 (2位)')
  model.setValue(row, col + 1, '1234.5')
  model.setValue(row, col + 2, '1234.5')
  model.setCellFormat(row, col + 2, { type: 'decimal2' } as CellFormat)
  model.setValue(row, col + 3, '显示为 1234.50')
  row++

  // 千分位
  model.setValue(row, col + 0, '千分位')
  model.setValue(row, col + 1, '1234567.89')
  model.setValue(row, col + 2, '1234567.89')
  model.setCellFormat(row, col + 2, { type: 'thousands' } as CellFormat)
  model.setValue(row, col + 3, '显示为 1,234,567.89')
  row++

  // 百分比
  model.setValue(row, col + 0, '百分比')
  model.setValue(row, col + 1, '0.856')
  model.setValue(row, col + 2, '0.856')
  model.setCellFormat(row, col + 2, { type: 'percent' } as CellFormat)
  model.setValue(row, col + 3, '显示为 85.60%')
  row++

  // 千分率
  model.setValue(row, col + 0, '千分率')
  model.setValue(row, col + 1, '0.0356')
  model.setValue(row, col + 2, '0.0356')
  model.setCellFormat(row, col + 2, { type: 'permille' } as CellFormat)
  model.setValue(row, col + 3, '显示为 35.60‰')
  row++

  // 人民币
  model.setValue(row, col + 0, '人民币')
  model.setValue(row, col + 1, '1234.56')
  model.setValue(row, col + 2, '1234.56')
  model.setCellFormat(row, col + 2, { type: 'currencyCNY' } as CellFormat)
  model.setValue(row, col + 3, '显示为 ¥1,234.56')
  row++

  // 美元
  model.setValue(row, col + 0, '美元')
  model.setValue(row, col + 1, '1234.56')
  model.setValue(row, col + 2, '1234.56')
  model.setCellFormat(row, col + 2, { type: 'currencyUSD' } as CellFormat)
  model.setValue(row, col + 3, '显示为 $1,234.56')
  row++

  // 科学计数法
  model.setValue(row, col + 0, '科学计数')
  model.setValue(row, col + 1, '12345678')
  model.setValue(row, col + 2, '12345678')
  model.setCellFormat(row, col + 2, { type: 'scientific' } as CellFormat)
  model.setValue(row, col + 3, '显示为 1.23e+7')
  row++

  // 分数
  model.setValue(row, col + 0, '分数')
  model.setValue(row, col + 1, '0.75')
  model.setValue(row, col + 2, '0.75')
  model.setCellFormat(row, col + 2, { type: 'fraction' } as CellFormat)
  model.setValue(row, col + 3, '显示为 3/4')
  row++

  // 负数红色
  model.setValue(row, col + 0, '负数红色')
  model.setValue(row, col + 1, '-1234.56')
  model.setValue(row, col + 2, '-1234.56')
  model.setCellFormat(row, col + 2, { type: 'negativeRed' } as CellFormat)
  model.setValue(row, col + 3, '负数以红色显示')
  row++

  // 自定义数字格式
  model.setValue(row, col + 0, '自定义千分位')
  model.setValue(row, col + 1, '1234567.891')
  model.setValue(row, col + 2, '1234567.891')
  model.setCellFormat(row, col + 2, { type: 'custom', pattern: '#,##0.00' } as CellFormat)
  model.setValue(row, col + 3, '格式: #,##0.00')
  row++

  model.setValue(row, col + 0, '自定义货币')
  model.setValue(row, col + 1, '9876.54')
  model.setValue(row, col + 2, '9876.54')
  model.setCellFormat(row, col + 2, { type: 'custom', pattern: '¥#,##0.00元' } as CellFormat)
  model.setValue(row, col + 3, '格式: ¥#,##0.00元')
  row++

  model.setValue(row, col + 0, '电话前缀')
  model.setValue(row, col + 1, '12345678')
  model.setValue(row, col + 2, '12345678')
  model.setCellFormat(row, col + 2, { type: 'custom', pattern: '021-########' } as CellFormat)
  model.setValue(row, col + 3, '格式: 021-########')
  row++

}


/**
 * Initialize cell embedded images demo
 * @param model SheetModel 实例
 * @param baseRow 起始行 (可选，默认为 0)
 */
function initializeCellImagesDemo(model: SheetModel, baseRow: number = 0): void {
  const startRow = baseRow
  const startCol = 11 // L列

  // ===== 标题 =====
  model.setValue(startRow, startCol, '单元格内嵌图片')
  model.setCellStyle(startRow, startCol, {
    bold: true,
    fontSize: 14,
    color: '#ffffff',
    backgroundColor: '#0891b2',
    textAlign: 'center',
    verticalAlign: 'middle'
  })
  model.mergeCells(startRow, startCol, startRow, startCol + 2)

  // ===== 说明行 =====
  model.setValue(startRow + 1, startCol, '点击图片可预览')
  model.setCellStyle(startRow + 1, startCol, {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center'
  })
  model.mergeCells(startRow + 1, startCol, startRow + 1, startCol + 2)

  // ===== 不同对齐方式的图片演示 =====
  // 左对齐
  model.setValue(startRow + 2, startCol, '')
  model.setCellStyle(startRow + 2, startCol, {
    textAlign: 'left',
    verticalAlign: 'middle',
    backgroundColor: '#ecfeff'
  })
  model.addCellImage(startRow + 2, startCol, {
    src: DEMO_IMAGE_DATA_URL,
    naturalWidth: 120,
    naturalHeight: 120,
    horizontalAlign: 'left',
    verticalAlign: 'middle'
  })

  // 居中对齐
  model.setValue(startRow + 2, startCol + 1, '')
  model.setCellStyle(startRow + 2, startCol + 1, {
    textAlign: 'center',
    verticalAlign: 'middle',
    backgroundColor: '#cffafe'
  })
  model.addCellImage(startRow + 2, startCol + 1, {
    src: DEMO_IMAGE_DATA_URL,
    naturalWidth: 120,
    naturalHeight: 120,
    horizontalAlign: 'center',
    verticalAlign: 'middle'
  })

  // 右对齐
  model.setValue(startRow + 2, startCol + 2, '')
  model.setCellStyle(startRow + 2, startCol + 2, {
    textAlign: 'right',
    verticalAlign: 'middle',
    backgroundColor: '#a5f3fc'
  })
  model.addCellImage(startRow + 2, startCol + 2, {
    src: DEMO_IMAGE_DATA_URL,
    naturalWidth: 120,
    naturalHeight: 120,
    horizontalAlign: 'right',
    verticalAlign: 'middle'
  })

  // 对齐说明
  model.setValue(startRow + 3, startCol, '左对齐')
  model.setValue(startRow + 3, startCol + 1, '居中')
  model.setValue(startRow + 3, startCol + 2, '右对齐')
  for (let c = startCol; c <= startCol + 2; c++) {
    model.setCellStyle(startRow + 3, c, {
      textAlign: 'center',
      color: '#374151',
      fontSize: 11,
      backgroundColor: '#f0fdfa'
    })
  }

  // ===== 功能说明 =====
  model.setValue(startRow + 5, startCol, '功能说明')
  model.setCellStyle(startRow + 5, startCol, {
    bold: true,
    backgroundColor: '#f3f4f6'
  })
  
  model.setValue(startRow + 5, startCol + 1, '• 点击图片打开预览\n• 支持多图显示最新\n• 图片跟随单元格对齐')
  model.setCellStyle(startRow + 5, startCol + 1, {
    verticalAlign: 'top',
    fontSize: 11,
    color: '#4b5563'
  })
  model.mergeCells(startRow + 5, startCol + 1, startRow + 5, startCol + 2)
}
