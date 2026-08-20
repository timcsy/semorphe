/**
 * Python 的工具箱分類——**目前只有一個**，因為只有一顆積木。
 *
 * ⚠️ **刻意不照抄 C++ 的十幾個分類**：一個沒有積木的分類是一個空段落，
 * 而空段落與「這個分類就是這麼小」長得一模一樣（可拿性護欄的檔頭寫著這件事）。
 * 分類跟著積木長出來，不是先擺好架子等它。
 */
import type { ToolboxCategoryDef } from '../../core/types'
import { declareToolboxCategories } from '../../core/toolbox-categories'

export const pythonCategoryDefs: ToolboxCategoryDef[] = [
  {
    key: 'io',
    nameKey: 'CAT_IO',
    fallback: '輸入輸出',
    colorKey: 'io',
    sources: [{ from: '(python)', category: 'io' }],
  },
  {
    key: 'data',
    nameKey: 'CAT_DATA',
    fallback: '資料',
    colorKey: 'data',
    sources: [{ from: '(python)', category: 'data' }],
  },
]

declareToolboxCategories('python', pythonCategoryDefs)
