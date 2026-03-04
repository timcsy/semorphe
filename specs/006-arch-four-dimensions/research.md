# Research: 架構重構 — 四維分離與語義模型

**Feature**: [spec.md](spec.md) | **Date**: 2026-03-04

## 決策摘要

本文件記錄 Phase 0 研究期間做出的技術決策。所有 NEEDS CLARIFICATION 已在 `/speckit.clarify` 階段解決。

---

## R1: Blockly i18n 機制 — `%{BKY_XXX}` 語法

**決策**: 靜態積木使用 `%{BKY_XXX}` key 引用語法；動態積木在 `init()` 時從 `Blockly.Msg` 讀取文字。

**理由**:
- Blockly 原生支援 `%{BKY_XXX}` 語法，會在積木初始化時自動從 `Blockly.Msg` 物件查找對應 key
- 靜態積木（JSON 定義）的 `message0`、`tooltip` 等欄位可直接使用此語法
- 動態積木（在 TypeScript 中用 `Blockly.Blocks[type] = { init() {...} }` 定義的）無法使用 `%{BKY_XXX}` 語法，需改為 `this.setTooltip(Blockly.Msg['KEY'])`

**替代方案**:
- 自建翻譯注入系統 → 重造輪子，Blockly 已有完善機制
- 每次 locale 變更重建所有積木 → 效能差，且 Blockly 的 `%{BKY_XXX}` 已解決此問題

**風險**: 動態積木的 tooltip 需要特別處理，不能用 `%{BKY_XXX}` 直接放在 JSON 中。緩解策略已在 plan.md 風險評估中記錄。

---

## R2: 語義模型設計 — 獨立 SemanticNode 樹

**決策**: 建立獨立的 `SemanticNode` 樹作為程式的中間表示（IR），而非在 Blockly workspace 上加 adapter。

**理由**:
- 用戶在 `/speckit.clarify` 中明確選擇 B 選項（完整實作）
- Adapter 方案只是延後複雜度：workspace 仍然是事實來源，round-trip 正確性難以驗證
- 獨立 SemanticNode 樹使得 `parse(generate(S)) ≡ S` 可以用簡單的深比較測試
- 未來跨語言轉換只需在 SemanticNode 層操作，不涉及 Blockly

**替代方案**:
- Adapter on Blockly workspace → 延後複雜度，不適合長期架構
- 使用 tree-sitter CST 作為語義模型 → 太底層，包含大量語法噪音（括號、分號等）

**設計關鍵決策**:
- SemanticNode 是純資料結構（no behavior），方便序列化和測試
- 每個 node 有 `concept` 欄位（ConceptId），映射到 universal 或 language-specific 概念
- 呈現資訊（metadata）與語義資訊分離存放
- 支援 `children` 和 `properties` 兩種子結構

---

## R3: 型別系統歸屬 — Language Module 提供結構，Locale 提供文字

**決策**: 語言模組提供 `{ value: string, labelKey: string }` 陣列，Locale 翻譯檔提供 labelKey 對應的文字。

**理由**:
- 用戶在 `/speckit.clarify` 中選擇 B 選項
- 型別值（`int`, `double`）是語言特定的語義資訊 → Language Module
- 型別顯示文字（`int（整數）`）是呈現資訊 → Locale
- 符合 P4（語義與呈現分離）和 P2（參數化投影）原則

**替代方案**:
- Language Module 直接提供完整 label → 違反 P4，無法 i18n
- Locale 同時管理型別清單和文字 → 不同語言有不同型別，Locale 不應知道這些

**實作細節**:
- `src/languages/cpp/types.ts` 導出 `CppTypeEntries: TypeEntry[]`
- `src/i18n/zh-TW/types.json` 提供所有 `TYPE_XXX` key 的中文翻譯
- BlocklyEditor 在初始化型別 dropdown 時，從語言模組取得 TypeEntry[]，再從 Blockly.Msg 取得 label

---

## R4: I/O 積木統一方案

**決策**: u_print 和 u_input 統一為 universal 積木，generator 根據 CodingStyle 的 `ioPreference` 參數產出 cout/printf 或 cin/scanf。

**理由**:
- 用戶在 `/speckit.clarify` 中選擇 A 選項
- 避免切換風格時需要替換積木（UX 不佳）
- 符合 P1（語義模型唯一真實）：「輸出」是語義，「cout/printf」是投影
- 符合 P2（投影參數化）：style.ioPreference 控制生成的語法

**替代方案**:
- 分開 u_cout_print 和 u_printf → 積木層有風格概念，違反 P4
- 切換風格時自動替換積木 → 複雜且容易出錯

**影響**:
- CppGenerator 的 u_print 分支需根據 style.ioPreference 判斷
- CppParser 解析 cout/printf 時都映射到 u_print 概念
- 工具箱不需根據風格顯示不同的 I/O 積木

---

## R5: CodingStyle 介面設計

**決策**: CodingStyle 為純資料介面，包含 ioPreference、namingConvention、braceStyle、indent、useNamespaceStd、headerStyle 等屬性。提供 3 個預設 preset。

**理由**:
- 每個屬性對應一個正交的格式決策
- 預設 preset 覆蓋台灣教育場景最常見的 3 種風格
- 純資料介面方便序列化（可存入 localStorage）

**三個預設 Preset**:

| 屬性 | APCS | 競賽 | Google Style |
|------|------|------|-------------|
| ioPreference | 'iostream' | 'cstdio' | 'iostream' |
| namingConvention | 'camelCase' | 'snake_case' | 'snake_case' |
| braceStyle | 'K&R' | 'K&R' | 'K&R' |
| indent | 4 | 4 | 2 |
| useNamespaceStd | true | true | false |
| headerStyle | 'iostream' | 'bits' | 'iostream' |

**替代方案**:
- 每個風格做一個 Generator 子類別 → 組合爆炸，不可擴充
- 只做 2 個 preset → 用戶明確要求 3 個

---

## R6: 風格自動偵測策略

**決策**: CppParser 新增 `detectStyle(code: string): Partial<CodingStyle>`，分析程式碼特徵回傳偵測到的風格屬性。

**偵測邏輯**:

| 特徵 | 偵測方法 |
|------|---------|
| ioPreference | 掃描 `cout`/`printf` 出現次數 |
| namingConvention | 分析變數名稱模式（`_` vs camelCase） |
| braceStyle | 分析 `{` 的位置（同行 vs 次行） |
| indent | 分析前導空白數量 |
| useNamespaceStd | 搜尋 `using namespace std` |
| headerStyle | 搜尋 `bits/stdc++.h` vs 具體 header |

**準確率目標**: 常見風格 90%+（SC-005）。主要不確定性來自混合風格的程式碼。

---

## R7: Blockly 動態積木與 i18n 相容性

**決策**: 動態積木（u_var_declare、u_func_def、u_input 等）在 `init()` 方法中直接從 `Blockly.Msg` 讀取文字，不使用 `%{BKY_XXX}` 語法。

**理由**:
- 動態積木使用 JavaScript API（`this.appendDummyInput().appendField(...)` 等）定義結構
- `%{BKY_XXX}` 只在 JSON 定義的 `message0` 欄位中有效
- `Blockly.Msg` 在應用程式啟動時已由 locale loader 注入所有翻譯

**實作方式**:
```typescript
// 動態積木的 init() 中
this.setTooltip(Blockly.Msg['U_VAR_DECLARE_TOOLTIP'] || 'U_VAR_DECLARE_TOOLTIP')
```

**Fallback**: 若 key 不存在於 `Blockly.Msg`，顯示 key 名稱本身（FR-003）。

---

## R8: 現有架構分析 — 需重構的耦合點

**分析結果**: 以下是目前程式碼中需要解耦的主要問題：

| 檔案 | 耦合問題 | 重構方向 |
|------|---------|---------|
| `src/blocks/universal.json` | 中文文字直接寫在 message/tooltip 中 | 改為 `%{BKY_XXX}` key |
| `src/languages/cpp/blocks/*.json` | 同上 | 同上 |
| `src/ui/blockly-editor.ts` | 動態積木的中文文字寫死在程式碼中 | 改為 `Blockly.Msg['KEY']` |
| `src/core/types.ts` | `QUICK_ACCESS_ITEMS` 含中文 label | 改為 i18n key |
| `src/core/types.ts` | `LanguageModule` 介面缺少 types、style 支援 | 擴充介面 |
| `src/languages/cpp/generator.ts` | 硬編碼 iostream 風格 | 接受 CodingStyle 參數 |
| `src/languages/cpp/adapter.ts` | 674 行，處理所有 AST→Block 映射 | 抽出語義模型層 |
| `src/ui/sync-controller.ts` | 直接操作 workspace | 改為經由語義模型 |
| `src/ui/App.ts` | 硬編碼 `languageId = 'cpp'` | 從語言模組動態取得 |
