// 简单的 hot-formula-parser 测试
import { Parser } from 'hot-formula-parser'

const parser = new Parser()

// 测试 1: 简单的数字运算
console.log('Test 1: 简单计算')
const result1 = parser.parse('1 + 2')
console.log('1 + 2 =', result1)

// 测试 2: 使用变量
console.log('\nTest 2: 使用变量')
const parser2 = new Parser()
parser2.setVariable('B2', 100)
parser2.setVariable('C2', 150)
const result2 = parser2.parse('B2 + C2')
console.log('B2 + C2 =', result2)

// 测试 3: 使用小写变量
console.log('\nTest 3: 使用小写变量')
const parser3 = new Parser()
parser3.setVariable('b2', 100)
parser3.setVariable('c2', 150)
const result3 = parser3.parse('b2 + c2')
console.log('b2 + c2 =', result3)

// 测试 4: 使用大写变量，小写表达式
console.log('\nTest 4: 大写变量，小写表达式')
const parser4 = new Parser()
parser4.setVariable('B2', 100)
parser4.setVariable('C2', 150)
const result4 = parser4.parse('b2 + c2')
console.log('b2 + c2 (变量是B2, C2) =', result4)

// 测试 5: 混合大小写
console.log('\nTest 5: 混合大小写')
const parser5 = new Parser()
parser5.setVariable('B2', 100)
parser5.setVariable('C2', 150)
const result5 = parser5.parse('B2 + C2')
console.log('B2 + C2 =', result5)
