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
      // HIGH／OUTPUT／A0 是【值】，與 true／false／NULL 同一格——不是硬體操作
      { from: '(arduino)', category: 'data' },
    ],
  },
  {
    key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators',
    sources: [
      { from: '(universal)', category: 'operators' },
      { from: '(core)', category: 'operators' },
      { from: '<cmath>', category: 'math' },
      { from: '<cstdlib>', category: 'stdlib' },
      // `map()` 是數值換算，歸運算而不是硬體——⚠️ 它的擁有者是 (arduino) 而分類是 math
      { from: '(arduino)', category: 'math' },
    ],
  },
  {
    key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control',
    // ⚠️ **明確排除，不是忘了。**「忘了」與「刻意不放」必須分得出來
    // ——與 `skipPaths` 同一種紀律（可拿性護欄會把兩者分成不同的桶）。
    //
    // `cpp_if_else` 被下面三個帶 `extraState` 的 `cpp_if` 入口取代：
    // 光是 if／if-else／if-elseif-else。同時放兩套是給學生兩條路做同一件事。
    excludeTypes: ['cpp_if_else'],
    sources: [
      { from: '(universal)', category: 'control' },
      { from: '(core)', category: 'control' },
      { from: '(core)', category: 'loops' },
      { from: '(core)', category: 'conditions' },
      { from: '<cstdlib>', category: 'stdlib' },
      // `map()` 是數值換算，歸運算而不是硬體——⚠️ 它的擁有者是 (arduino) 而分類是 math
      { from: '(arduino)', category: 'math' },
    ],
    // 同一顆 `cpp_if` 用三個不同的預設狀態出現——那是教學設計
    // （讓學生直接拖到「有 else 的 if」），**登錄表推不出來**，所以留著。
    extraTypes: [
      { type: 'cpp_if' },
      { type: 'cpp_if', extraState: { hasElse: true } },
      { type: 'cpp_if', extraState: { elseifCount: 1, hasElse: true } },
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
    key: 'text', nameKey: 'CATEGORY_TEXT', fallback: '文字', colorKey: 'strings',
    sources: [
      { from: '<cstring>', category: 'strings' },
      { from: '<string>', category: 'containers' },
      { from: '<cctype>', category: 'stdlib' },
      { from: '<cstdlib>', category: 'stdlib' },
      // `map()` 是數值換算，歸運算而不是硬體——⚠️ 它的擁有者是 (arduino) 而分類是 math
      { from: '(arduino)', category: 'math' },
    ],
  },
  {
    key: 'maps_sets', nameKey: 'CATEGORY_MAPS_SETS', fallback: '對應與集合', colorKey: 'containers',
    sources: [
      { from: '<map>', category: 'containers' },
      { from: '<set>', category: 'containers' },
      { from: '<utility>', category: 'containers' },
      { from: '(core)', category: 'containers' },
    ],
  },
  {
    key: 'stacks_queues', nameKey: 'CATEGORY_STACKS_QUEUES', fallback: '堆疊與佇列', colorKey: 'containers',
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
    key: 'pointers_memory', nameKey: 'CATEGORY_POINTERS_MEMORY', fallback: '指標與記憶體', colorKey: 'pointers',
    sources: [
      { from: '(core)', category: 'pointers' },
      // memset / memcpy 宣告在 <cstring> 的 strings 分類，而它們是記憶體操作
      { from: '<cstring>', category: 'strings' },
    ],
  },
  {
    key: 'structs_classes', nameKey: 'CATEGORY_STRUCTS_CLASSES', fallback: '結構與類別', colorKey: 'structs',
    sources: [
      { from: '(core)', category: 'structures' },
      { from: '(core)', category: 'oop' },
    ],
  },

  // ── 硬體（Arduino）──
  //
  // ⚠️ **加這一段是必要的，而它不是「登記積木」**：`toolbox-categories` 早就改成
  // 從**有序來源**導出（`{ from: 擁有者, category: 分類 }`），
  // 而 `(arduino)` 是 2026-08-17 出現的**新擁有者**——
  // 沒有這一段的話，那 11 顆積木宣告了、產得出來、**而使用者拿不到**
  // （第十九條護欄「可拿性」會報，它報過了）。
  //
  // 🔴 **腳位與序列埠分成兩段**，理由與 `pointers_memory` 那段相同：
  // 學生找「怎麼印東西到序列埠」時，不該在一堆腳位積木裡翻。

  {
    key: 'hardware_pins', nameKey: 'CATEGORY_HARDWARE_PINS', fallback: '腳位與時間', colorKey: 'hardware',
    sources: [
      { from: '(arduino)', category: 'hardware' },
    ],
  },

  // 🔴 **零件與模組分成第三段**（2026-08-18，第 2 批）。
  //
  // 觸發它的不是「積木變多了」，是**那一格的名字不成立了**：
  // 第 2 批把伺服／溫濕度／液晶／內建記憶體／無線網路放進「腳位與時間」之後，
  // 那一格有 36 顆——而其中一半**既不是腳位也不是時間**。
  //
  // > **一個分類的名字如果不再描述它的內容，
  // > 那它就不是分類了，它只是一個放不下的地方。**
  //
  // ⚠️ 而第 1 批的報告當時說「不新開分類」是對的——那時候只有兩顆，
  // 而它預留的觸發條件是「零件多到裝不下」。**今天到了，只是形狀不同**：
  // 不是裝不下，是名字對不上。
  //
  // 判準與上面那兩段相同：**學生找「怎麼讓伺服轉」時，不該在一堆腳位積木裡翻。**
  {
    key: 'hardware_modules', nameKey: 'CATEGORY_HARDWARE_MODULES', fallback: '零件與模組', colorKey: 'hardware',
    sources: [
      { from: '(arduino)', category: 'modules' },
    ],
  },
  {
    key: 'hardware_serial', nameKey: 'CATEGORY_HARDWARE_SERIAL', fallback: '序列埠', colorKey: 'hardware',
    sources: [
      { from: '(arduino)', category: 'io' },
    ],
  },

  // ── 程式基礎設施 ──

  {
    key: 'program_config', nameKey: 'CATEGORY_PROGRAM_CONFIG', fallback: '程式設定', colorKey: 'special',
    sources: [
      { from: '(core)', category: 'preprocessor' },
      { from: '(core)', category: 'special' },
      { from: '(core)', category: 'cpp_basic' },
    ],
  },
]
