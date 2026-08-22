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
 *
 * ## 🔴 2026-08-22：重新規劃（使用者回報「大部分積木都塞在『資料』」）
 *
 * 上面那句「不照抄 C++ 的二十幾個分類」**是對的，而它被讀成了「一直只要六個」**。
 * 元件 24 → 73 之後，`data` 那一格裝了 **36 顆**——占全部的一半。
 *
 * > **一個分類裝了一半的積木，它就不是分類了，是「其餘」。**
 *
 * ### 沿用 C++ 的【判準】，不沿用它的分法
 *
 * `languages/cpp/toolbox-categories.ts` 的檔頭逐字：
 * 「**按認知意圖分組，不按語法特性分組**——分類回答的是『學生想做什麼？』」
 *
 * 照那個判準重排之後，Python 這一份與 C++ 那一份**不一樣**，而那是對的：
 * C++ 需要「指標與記憶體」「堆疊與佇列」，Python 需要「錯誤處理」。
 * **同一個判準套在不同的語言上，本來就會給出不同的分類。**
 *
 * ### 四個與 C++ 不同的決定
 *
 * 1. **「錯誤處理」自己一格**（`try`／`except`／`raise`／`assert`）。
 *    C++ 把它們放在「控制」裡，而「程式出錯了怎麼辦」與「決定跑哪一段」
 *    是兩個意圖——放在一起那個分類就有兩個主題。
 *
 * 2. **積木的顏色 ＝ 它所在分類的顏色**，一顆不例外。
 *    ⚠️ C++ 那份今天有 51 顆不是（第五十二條護欄量出來的，棘輪盯著）。
 *    > **顏色是分類的視覺編碼——它與分類不一致的時候，學生學到的是雜訊。**
 *
 * 3. **「容器」自己一格**（`a[i]`／`d[k]`／`s[i]`／`len`／`in`／切片）。
 *    C++ 把取值切成 `array_at`／`map_at` 兩顆（那邊編譯期就知道型別），
 *    而 Python 的 `a[i]` 在 AST 上分不出目標是什麼——**它就是一顆**。
 *
 *    ⚠️ 第一版想把它同時放進「串列」與「字典」，而工具箱的建構子**不支援**
 *    一顆積木兩個家（它的錯誤訊息逐字：「這顆積木屬於這個分類——登錄表知道」）。
 *    🔴 而那個嘗試是**靜默無效**的：五筆 `extraTypes` 一顆也沒多、也沒有任何訊息
 *    ——已補成丟錯（`toolbox-builder.ts`）。
 *
 *    > **語義上是一顆的東西，硬塞進兩個抽屜之前，先問它是不是自己就該有一個抽屜。**
 *
 * 4. **積木的顏色 ＝ 它所在分類的顏色**——第五十二條護欄在看（Python 硬性零）。
 *
 * ### ⚠️ 順序 ＝ 學生遇到它們的順序
 *
 * 輸入輸出 → 變數與值 → 運算 → 控制流程 → 文字 → 容器 → 串列 → 字典與序對 →
 * 函式 → 類別與物件 → 錯誤處理 → 其他，與課程清單的 L0／L1／L2 對得上。
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
    nameKey: 'CAT_PY_VALUES',
    fallback: '變數與值',
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
    nameKey: 'CAT_PY_CONTROL',
    fallback: '控制流程',
    colorKey: 'control',
    sources: [{ from: '(python)', category: 'control' }],
    // 🔴 **同一顆積木用三個不同的預設狀態出現**——那是**教學設計**，
    //    讓學生直接拖到「有 else 的 if」而不必先按齒輪。**登錄表推不出來。**
    //
    // ⚠️ 使用者 2026-08-21：「工具箱不要只有放 if，if-else、if-elif-else 也要」
    //    ——而 C++ 那側**早就是這樣**（`cpp_if` 的三筆）。
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

  // ── 資料結構：按「學生想操作什麼」分 ──

  {
    key: 'text',
    nameKey: 'CATEGORY_TEXT',
    fallback: '文字',
    colorKey: 'strings',
    sources: [{ from: '(python)', category: 'strings' }],
  },
  {
    key: 'containers',
    nameKey: 'CAT_PY_CONTAINERS',
    fallback: '容器',
    colorKey: 'containers',
    // 🔴 **通用的取用與修改**：`a[i]`／`d[k]`／`s[i]`、`len`、`in`、切片。
    //    它們在 Python 是**同一顆積木**（AST 上分不出目標是串列、字典還是文字），
    //    所以它們有自己的一格——而不是在「串列」與「字典」各放一份。
    sources: [{ from: '(python)', category: 'containers' }],
  },
  {
    key: 'arrays_lists',
    nameKey: 'CAT_PY_LISTS',
    fallback: '串列',
    colorKey: 'arrays',
    sources: [{ from: '(python)', category: 'arrays' }],
  },
  {
    key: 'maps',
    nameKey: 'CAT_PY_MAPS',
    fallback: '字典與序對',
    colorKey: 'maps',
    sources: [{ from: '(python)', category: 'maps' }],
  },

  // ── 抽象：把一段程式包起來 ──

  {
    key: 'functions',
    nameKey: 'CAT_FUNCTIONS',
    fallback: '函式',
    colorKey: 'functions',
    sources: [{ from: '(python)', category: 'functions' }],
  },
  {
    key: 'classes',
    nameKey: 'CAT_PY_CLASSES',
    fallback: '類別與物件',
    colorKey: 'structs',
    sources: [{ from: '(python)', category: 'structs' }],
  },
  {
    key: 'errors',
    nameKey: 'CAT_PY_ERRORS',
    fallback: '錯誤處理',
    colorKey: 'errors',
    sources: [{ from: '(python)', category: 'errors' }],
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
