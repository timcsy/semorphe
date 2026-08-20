/**
 * Python 的工具箱分類。
 *
 * ⚠️ **刻意不照抄 C++ 的二十幾個分類**：一個沒有積木的分類是一個空段落，
 * 而空段落與「這個分類就是這麼小」長得一模一樣（可拿性護欄的檔頭寫著這件事）。
 * **分類跟著積木長出來，不是先擺好架子等它。**
 *
 * 🔴 而它有一個對稱的失敗樣態（使用者 2026-08-21 回報）：
 * **積木長出來了而分類沒跟上，於是工具箱裡找不到它**——
 * 那時可拿性護欄會說話，但只在「宣告了卻拿不到」這一側。
 *
 * > **「分類多了沒積木」與「積木多了沒分類」是同一條線的兩端，
 * > 而只有一端有護欄在看。**
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
  {
    key: 'operators',
    nameKey: 'CAT_OPERATORS',
    fallback: '運算',
    colorKey: 'operators',
    sources: [{ from: '(python)', category: 'operators' }],
  },
  {
    key: 'control',
    nameKey: 'CAT_CONTROL',
    fallback: '控制',
    colorKey: 'control',
    sources: [{ from: '(python)', category: 'control' }],
    // 🔴 **同一顆積木用三個不同的預設狀態出現**——那是**教學設計**，
    //    讓學生直接拖到「有 else 的 if」而不必先按齒輪。**登錄表推不出來。**
    //
    // ⚠️ 使用者 2026-08-21：「工具箱不要只有放 if，if-else、if-elif-else 也要」
    //    ——而 C++ 那側**早就是這樣**（`cpp_if` 的三筆）。
    //    這是「跟 C++ 一致」的第三個實例：顏色、互動、**工具箱的入口**。
    //
    // ⚠️ extraState 的鍵沿用命令式那份（`elseifCount`／`hasElse`），
    //    見 `ui/branch-list-block.ts` 的檔頭。
    // ⚠️ **三筆都要列**——`sources` 收不到 `python_if`（它的來源分類與這裡對不上），
    //    所以純的那一顆也得自己列。
    //
    // 🔴 **我兩次都靠數數量判斷而不是【看】**，第一次多一顆、第二次少一顆。
    //    使用者 2026-08-21：「很多問題是你沒有直接在瀏覽器把工具箱截圖」——對的。
    //    > **`getToolboxItems().length` 答得出「有幾個」，答不出「長對了沒」。**
    extraTypes: [
      { type: 'python_if' },
      { type: 'python_if', extraState: { hasElse: true } },
      { type: 'python_if', extraState: { elseifCount: 1, hasElse: true } },
    ],
  },
  {
    key: 'functions',
    nameKey: 'CAT_FUNCTIONS',
    fallback: '函式',
    colorKey: 'functions',
    sources: [{ from: '(python)', category: 'functions' }],
  },
  {
    key: 'special',
    nameKey: 'CAT_SPECIAL',
    fallback: '其他',
    colorKey: 'special',
    sources: [{ from: '(python)', category: 'special' }],
  },
]

declareToolboxCategories('python', pythonCategoryDefs)
