import type { ToolboxCategoryDef } from '../../core/types'

/**
 * C++ 工具箱分類——**按認知意圖分組，不按語法特性分組**
 *
 * 分類回答的是「學生想做什麼？」，不是「這是 C++ 的哪個語法功能？」
 * （見 first-principles §1.3、§2.4）
 *
 * ## 這個檔剩下什麼、不剩什麼
 *
 * | | 誰知道 | 在不在這裡 |
 * |---|---|---|
 * | 分類的順序、標題、顏色 | **人**（教學設計） | ✅ 在 |
 * | 段落的順序（先字串再字元再轉換） | **人** | ✅ 在 |
 * | 段落裡有哪些積木 | **登錄表** | ❌ 導出 |
 * | 帶預設狀態的入口（if / if-else / if-elseif） | **人** | ✅ 在 |
 *
 * 在此之前這裡有 **80 筆手寫積木型別**，加一顆元件要來這裡登記一次——
 * 而 P3 說「系統可以在**不修改既有程式碼**的前提下加入新概念」。
 * 實測有 **7 顆積木使用者拿不到**，全部都是忘了來這裡登記。
 *
 * ## 段落的順序 = 學生看到的順序
 *
 * 一個段落的成員順序，就是該來源 `blocks.json` 的宣告順序。所以
 * **把一顆積木放進 `blocks.json` 的正確位置，它在工具箱裡就會出現在正確的位置**
 * ——不必再來這裡登記。
 */
export const cppCategoryDefs: ToolboxCategoryDef[] = [
  // ── 通用分類（與語言無關的概念）──

  {
    key: 'data', nameKey: 'CATEGORY_DATA', fallback: '資料', colorKey: 'data',
    sources: [
      { from: '(universal)', category: 'data' },
      { from: '(core)', category: 'data' },
      { from: '(core)', category: 'values' },
      { from: '(core)', category: 'variables' },
    ],
  },
  {
    key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators',
    sources: [
      { from: '(universal)', category: 'operators' },
      { from: '(core)', category: 'operators' },
      { from: '<cmath>', category: 'math' },
      { from: '<cstdlib>', category: 'stdlib' },
    ],
  },
  {
    key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control',
    // ⚠️ **明確排除，不是忘了。**「忘了」與「刻意不放」必須分得出來
    // ——與 `skipPaths` 同一種紀律（可拿性護欄會把兩者分成不同的桶）。
    //
    // `u_if_else` 被下面三個帶 `extraState` 的 `u_if` 入口取代：
    // 光是 if／if-else／if-elseif-else。同時放兩套是給學生兩條路做同一件事。
    excludeTypes: ['u_if_else'],
    sources: [
      { from: '(universal)', category: 'control' },
      { from: '(core)', category: 'control' },
      { from: '(core)', category: 'loops' },
      { from: '(core)', category: 'conditions' },
      { from: '<cstdlib>', category: 'stdlib' },
    ],
    // 同一顆 `u_if` 用三個不同的預設狀態出現——那是教學設計
    // （讓學生直接拖到「有 else 的 if」），**登錄表推不出來**，所以留著。
    extraTypes: [
      { type: 'u_if' },
      { type: 'u_if', extraState: { hasElse: true } },
      { type: 'u_if', extraState: { elseifCount: 1, hasElse: true } },
    ],
  },
  {
    key: 'functions', nameKey: 'CATEGORY_FUNCTIONS', fallback: '函式', colorKey: 'functions',
    sources: [
      { from: '(universal)', category: 'functions' },
      { from: '(core)', category: 'functions' },
      { from: '(core)', category: 'templates' },
      // 通用的方法呼叫（語言層級，不綁特定容器）
      { from: '(core)', category: 'containers' },
    ],
  },
  {
    key: 'io', nameKey: 'CATEGORY_IO', fallback: '輸入/輸出', colorKey: 'io',
    isIoCategory: true,
    sources: [
      { from: '(universal)', category: 'io' },
      { from: '(core)', category: 'io' },
      { from: '<cstdio>', category: 'io' },
      { from: '<string>', category: 'io' },
      { from: '<fstream>', category: 'io' },
    ],
  },

  // ── 資料結構分類（按認知意圖分組）──

  {
    key: 'arrays_lists', nameKey: 'CATEGORY_ARRAYS_LISTS', fallback: '陣列與列表', colorKey: 'arrays',
    sources: [
      { from: '(universal)', category: 'arrays' },
      { from: '(core)', category: 'arrays' },
      { from: '<algorithm>', category: 'algorithms' },
      { from: '<numeric>', category: 'algorithms' },
      { from: '<vector>', category: 'containers' },
      { from: '(core)', category: 'containers' },
    ],
  },
  {
    key: 'text', nameKey: 'CATEGORY_TEXT', fallback: '文字', colorKey: 'cpp_strings',
    sources: [
      { from: '<cstring>', category: 'strings' },
      { from: '<string>', category: 'containers' },
      { from: '<cctype>', category: 'stdlib' },
      { from: '<cstdlib>', category: 'stdlib' },
    ],
  },
  {
    key: 'maps_sets', nameKey: 'CATEGORY_MAPS_SETS', fallback: '對應與集合', colorKey: 'cpp_containers',
    sources: [
      { from: '<map>', category: 'containers' },
      { from: '<set>', category: 'containers' },
      { from: '<utility>', category: 'containers' },
      { from: '(core)', category: 'containers' },
    ],
  },
  {
    key: 'stacks_queues', nameKey: 'CATEGORY_STACKS_QUEUES', fallback: '堆疊與佇列', colorKey: 'cpp_containers',
    sources: [
      { from: '<stack>', category: 'containers' },
      { from: '<queue>', category: 'containers' },
      { from: '<sstream>', category: 'containers' },
      // ⚠️ 這裡進來的是**形態**，不是中性版。
      //
      // `container_push` / `container_pop` 是一個身分、多個形態（097）。
      // 學生選得出來的是「推到頂端」與「加到尾端」，而不是型別查不到時的退路。
      //
      // 一名學生回報過「stack 和 queue 的 push 意思不一樣」，而第一版把變體
      // 做出來卻沒放進工具箱——於是他**在工具箱裡找不到那顆積木**，只能拖
      // 中性版出來、接上變數、等它自己變。那比標籤說不清楚更難受。
      //
      // 中性版不進工具箱，是由可拿性護欄**推導**出來的（這個身分有多個形態，
      // 而這一顆沒有 `form` 欄位），不是靠這裡漏掉它。
      { from: '(core)', category: 'containers' },
    ],
  },

  // ── 記憶體與型別 ──

  {
    key: 'pointers_memory', nameKey: 'CATEGORY_POINTERS_MEMORY', fallback: '指標與記憶體', colorKey: 'cpp_pointers',
    sources: [
      { from: '(core)', category: 'pointers' },
      // memset / memcpy 宣告在 <cstring> 的 strings 分類，而它們是記憶體操作
      { from: '<cstring>', category: 'strings' },
    ],
  },
  {
    key: 'structs_classes', nameKey: 'CATEGORY_STRUCTS_CLASSES', fallback: '結構與類別', colorKey: 'cpp_structs',
    sources: [
      { from: '(core)', category: 'structures' },
      { from: '(core)', category: 'oop' },
    ],
  },

  // ── 程式基礎設施 ──

  {
    key: 'program_config', nameKey: 'CATEGORY_PROGRAM_CONFIG', fallback: '程式設定', colorKey: 'cpp_special',
    sources: [
      { from: '(core)', category: 'preprocessor' },
      { from: '(core)', category: 'special' },
      { from: '(core)', category: 'cpp_basic' },
    ],
  },
]
