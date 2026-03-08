# 技術經驗傳承備忘錄

本文件記錄 code-blockly 開發過程中累積的架構知識、設計模式與常見陷阱，供後續開發或新語言擴充時參考。

---

## 目錄

1. [積木定義的兩層架構](#1-積木定義的兩層架構)
2. [程式碼產生的優先順序](#2-程式碼產生的優先順序)
3. [Lifting（程式碼→積木）](#3-lifting程式碼積木)
4. [積木提取（Blockly→Semantic）](#4-積木提取blocklysemantic)
5. [Concept 與 Registry](#5-concept-與-registry)
6. [i18n 國際化](#6-i18n-國際化)
7. [Toolbox 與認知層級](#7-toolbox-與認知層級)
8. [動態積木常用模式](#8-動態積木常用模式)
9. [加入新語言的完整清單](#9-加入新語言的完整清單)
10. [常見陷阱與解法](#10-常見陷阱與解法)

---

## 1. 積木定義的兩層架構

積木的定義分為 **JSON 宣告層** 與 **動態覆蓋層**，兩者有明確的分工與覆蓋關係。

### JSON 宣告層

檔案位置：
- `src/blocks/universal.json` — 跨語言通用積木
- `src/languages/{lang}/blocks/*.json` — 語言專屬積木（如 `basic.json`、`advanced.json`、`special.json`）

每個 BlockSpec 包含：

```jsonc
{
  "id": "c_increment",
  "language": "cpp",
  "category": "operators",     // toolbox 分類
  "level": 1,                  // 認知層級（0=beginner）
  "concept": { ... },          // semantic 概念定義
  "blockDef": { ... },         // Blockly 積木外觀（message0/args0）
  "codeTemplate": { ... },     // 簡單的程式碼產生模板（可選）
  "astPattern": { ... }        // AST→積木的 lifting 規則（可選）
}
```

### 動態覆蓋層

檔案位置：`src/ui/app.new.ts` 的 `registerDynamicBlocks()` 方法。

```typescript
Blockly.Blocks['block_type'] = {
  init: function (this: Blockly.Block) { ... },
  saveExtraState: function () { ... },
  loadExtraState: function (state) { ... },
}
```

### 覆蓋規則

- 動態層的 `init()` 會**完全取代** JSON 的 `blockDef`（`message0`、`args0` 全部失效）
- 但 JSON 的 `concept`、`codeTemplate`、`astPattern`、`level`、`category` **仍然有效**
- 何時需要動態覆蓋：
  - 需要 FieldDropdown 動態選項（如變數列表）
  - 需要 mutator 齒輪（如 u_if_else、u_var_declare）
  - 需要 +/- 按鈕動態增減欄位（如 u_func_call、u_input）
  - 需要三模式參數（select/compose/custom）

---

## 2. 程式碼產生的優先順序

程式碼產生有兩條路徑，按優先順序執行：

```
TemplateGenerator.generate(node)   ← 1. 先嘗試 codeTemplate（JSON 定義）
        ↓ 回傳 null
GeneratorContext.generators.get()  ← 2. 後備：hand-written generator
```

### codeTemplate（適合簡單情境）

```jsonc
{
  "codeTemplate": {
    "pattern": "${NAME} ${OP} ${VALUE};",
    "imports": ["<iostream>"],
    "order": 0
  }
}
```

- 直接用 `${FIELD}` 插值產生程式碼
- 適合一對一對應、無條件邏輯的積木

### hand-written generator（適合複雜情境）

檔案位置：`src/languages/{lang}/generators/*.ts`

```typescript
export function registerStatementGenerators(g: Map<string, NodeGenerator>) {
  g.set('cpp_increment', (node, ctx) => {
    // 可以有條件邏輯
    const prefix = node.properties.position === 'prefix'
    return prefix ? `++${name};\n` : `${name}++;\n`
  })
}
```

### 重要注意事項

- 如果 `codeTemplate` 存在且能產生非 null 結果，hand-written generator **永遠不會被呼叫**
- 當積木邏輯變複雜需要改用 hand-written 時，**必須移除 JSON 中的 codeTemplate**
- 測試時注意：`generator.generate()` 只測 template 路徑；要測完整管線需用 `generateNode()` + `GeneratorContext`

---

## 3. Lifting（程式碼→積木）

Lifting 是把 AST 節點轉換為積木（SemanticNode）的過程，也有兩條路徑：

### astPattern（JSON 宣告式）

```jsonc
{
  "astPattern": {
    "nodeType": "update_expression",
    "constraints": [
      { "field": "$operator", "value": "++" }
    ],
    "fieldMappings": [
      { "semantic": "name", "ast": "argument", "extract": "text" },
      { "semantic": "operator", "ast": "$operator", "extract": "text" }
    ]
  }
}
```

- `nodeType`：匹配的 tree-sitter AST 節點類型
- `constraints`：篩選條件，用來區分同類型節點
- `fieldMappings`：欄位對應（`$` 前綴表示 AST 屬性而非子節點；`extract: "text"` 取文字、`"lift"` 遞迴提升）

### hand-written lifter

檔案位置：`src/languages/{lang}/lifters/*.ts`

適合一個 AST 節點要根據內容產生不同 concept 的情境（如 `unary_expression` 可能是 `-x`、`&x`、`*p`、`!flag`）。

### 常見陷阱

**空 constraints 會匹配所有同 nodeType 的節點**，可能搶走其他積木的 lifting。

真實案例：`c_pointer_op` 的 astPattern 設定為 `nodeType: "unary_expression"` 且 constraints 為空，結果 `++i`（也是 unary_expression）被錯誤地 lift 為 `c_pointer_op`。

解法：
- 務必加上 constraints 限縮匹配範圍
- 或改用 hand-written lifter 處理需要複雜判斷的 nodeType

---

## 4. 積木提取（Blockly→Semantic）

積木提取是把 Blockly workspace 的積木轉換為 SemanticNode 的過程。

檔案位置：`src/ui/panels/blockly-panel.ts` 的 `extractBlockInner()` 方法。

### 兩種提取方式

1. **通用 JSON-driven 提取**（`extractFromSpec`）：根據 BlockSpec 的 concept 定義自動提取 fields 和 inputs
2. **手寫 case**：在 `extractBlockInner` 的 switch 中加入特定 block type 的處理

### 何時需要手寫 case

- 積木有動態數量的欄位（如 `NAME_0`、`NAME_1`...）
- 積木使用三模式參數（需要 `extractThreeModeArgs`）
- 積木需要特殊的語義轉換邏輯（如 scanf 的 `noAddr` 標記）
- mutator 產生的動態結構

### 重要原則

欄位名稱改動必須**全鏈路同步**：

```
blockDef (init)  →  extractBlockInner  →  generator  →  lifter  →  adapter
   NAME_0             NAME_0              NAME_0        NAME_0     NAME_0
```

任何一環沒改到都會造成資料丟失或產生錯誤。

---

## 5. Concept 與 Registry

### 概念模型

```typescript
interface ConceptDef {
  conceptId: string        // 具體 ID，如 "cpp_increment"
  abstractConcept: string  // 跨語言抽象概念，如 "increment"
  properties: string[]     // 純值欄位，如 ["name", "operator"]
  children: Record<string, string>  // 子節點插槽，如 { value: "expression" }
  role: "statement" | "expression"
}
```

### Registry 註冊

- `UNIVERSAL_CONCEPTS`：通用概念（如 `var_assign`、`print`、`input`）
- 語言專屬 registry：從 BlockSpec JSON 自動載入

**遺漏註冊的後果**：diagnostics 報錯、code generation 找不到 generator、extraction 無法正確解析。

---

## 6. i18n 國際化

### 檔案位置

```
src/i18n/en/blocks.json      ← 英文
src/i18n/zh-TW/blocks.json   ← 繁體中文
```

### 兩種引用方式

1. **JSON blockDef**：使用 `%{BKY_KEY}` 語法
   ```jsonc
   { "message0": "%{BKY_C_INCREMENT_MSG0}" }
   ```

2. **動態積木**：使用 `Blockly.Msg['KEY'] || '預設值'`
   ```typescript
   .appendField(Blockly.Msg['C_INCREMENT_VAR_LABEL'] || '變數')
   ```

### 從 JSON 改為動態積木時的 i18n 處理

JSON 的 `message0` 格式是 `"把變數 %1 設成 %2"`，所有文字和欄位混在一起。改成動態積木後，需要拆成獨立的 label key：

```
MSG0: "把變數 %1 設成 %2"
  → LABEL: "把變數"
  → SET_LABEL: "設成"
```

原本的 MSG0 可以保留（向後相容），但動態積木不會使用它。

---

## 7. Toolbox 與認知層級

### Registry-driven 工具箱

```typescript
const specs = this.blockSpecRegistry.listByCategory(category, level)
```

- 依據 BlockSpec 的 `category` 和 `level` 自動篩選
- `isBlockAvailable(blockType, level)` 決定積木是否在當前層級顯示

### 新增積木到工具箱

1. 在 JSON 設定正確的 `category` 和 `level`
2. 確認 `buildToolbox()` 有處理該 category
3. 如果是新 category：
   - 在 `src/ui/theme/category-colors.ts` 的 `CATEGORY_COLORS` 加顏色
   - 在 `buildToolbox()` 加入新分類區塊

### IO 偏好切換

toolbox 支援 `ioPreference`（`'iostream'` 或 `'cstdio'`），影響 I/O 類積木的顯示：
- iostream：顯示 cout/cin 積木
- cstdio：顯示 printf/scanf 積木

---

## 8. 動態積木常用模式

### 8.1 `const self = this` 模式

```typescript
registerDynamicBlocks() {
  const self = this  // 必須在最頂層定義

  Blockly.Blocks['my_block'] = {
    init: function () {
      // 這裡的 this 是 Blockly.Block，不是 App
      // 用 self 存取 App 的方法
      new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions())
    }
  }
}
```

**陷阱**：如果 `const self = this` 定義在某個 block 的 scope 內，其他 block 的 closure 抓不到。必須放在 `registerDynamicBlocks()` 的最頂層。

### 8.2 動態 FieldDropdown

```typescript
new Blockly.FieldDropdown(() => self.getWorkspaceVarOptions())
```

- 使用箭頭函式包裝，每次展開下拉選單時即時掃描 workspace
- **Blockly 不允許空選項陣列**，必須至少有一個 fallback：
  ```typescript
  if (options.length === 0) {
    options.push(['x', 'x'])  // fallback
  }
  ```

### 8.3 +/- 按鈕模式

```typescript
{
  argCount_: 0,
  init() { ... },
  plusArg_() {
    this.appendValueInput(`ARG_${this.argCount_}`)
    this.moveInputBefore(`ARG_${this.argCount_}`, 'TAIL')
    this.argCount_++
  },
  minusArg_() {
    if (this.argCount_ <= 0) return
    this.argCount_--
    this.removeInput(`ARG_${this.argCount_}`)
  },
  saveExtraState() { return { argCount: this.argCount_ } },
  loadExtraState(state) { while (this.argCount_ < state.argCount) this.plusArg_() },
}
```

關鍵點：
- `moveInputBefore` 確保新參數插在 TAIL（+/- 按鈕）之前
- `saveExtraState`/`loadExtraState` 保證序列化還原
- 重建 labels 時要先儲存再還原 field value（`savedName = getFieldValue('NAME')`）

### 8.4 三模式參數（select/compose/custom）

每個參數槽支援三種模式：

| 模式 | UI 元件 | 用途 |
|------|---------|------|
| select | FieldDropdown | 從 workspace 變數清單選擇 |
| compose | ValueInput | 用積木組合複雜表達式 |
| custom | FieldTextInput | 直接輸入文字 |

透過 `buildArgSlot()` 和 `rebuildArgSlot()` 共用邏輯，可配置：
- `getVarOptions`：動態選項來源
- `separator`：參數間分隔符（`>>`、`,`）
- `inputPrefix`：input 名稱前綴
- `defaultVar`、`customDefault`：各模式預設值

切換機制：dropdown validator 攔截特殊值（`__COMPOSE__`、`__CUSTOM__`），用 `setTimeout` 觸發 rebuild。

### 8.5 Mutator 齒輪模式

用於結構可變的積木（如 u_if_else 的 else if/else 分支、u_var_declare 的多變數）：

- **Container block**：齒輪 mini-workspace 的頂部容器
- **Item blocks**：可拖入容器的子項目
- `decompose()`：主積木 → mini-workspace
- `compose()`：mini-workspace → 主積木
- `saveConnections()`：記住已連接的子積木

---

## 9. 加入新語言的完整清單

以加入 Python 為例，需要建立/修改的檔案：

### 必要檔案

```
src/languages/python/
  blocks/
    basic.json              ← 基本積木 BlockSpec 定義
    advanced.json           ← 進階積木
  generators/
    statements.ts           ← 陳述式 code generator
    expressions.ts          ← 表達式 code generator
    io.ts                   ← I/O code generator
  lifters/
    statements.ts           ← AST→積木 lifting
    expressions.ts
  adapter.ts                ← semantic↔block 雙向轉換
```

### 需要修改的現有檔案

| 檔案 | 修改內容 |
|------|---------|
| `src/i18n/*/blocks.json` | 所有新積木的文字 key |
| `src/ui/app.new.ts` | 需要動態行為的積木覆蓋 |
| `src/ui/panels/blockly-panel.ts` | 複雜積木的 extraction case |
| `src/ui/theme/category-colors.ts` | 新類別的顏色 |
| `src/core/types.ts` | 新語言的型別定義（如有） |
| `tests/` | 對應的測試檔案 |

### 檢查清單

- [ ] 所有 concept 已在 registry 註冊
- [ ] 每個積木都有 code generator（template 或 hand-written）
- [ ] 每個需要 lifting 的 AST 節點都有對應規則
- [ ] 動態積木的 `extractBlockInner` case 已加入
- [ ] i18n 兩種語言的 key 都已加入
- [ ] toolbox category 和 level 設定正確
- [ ] `saveExtraState`/`loadExtraState` 可正確序列化還原
- [ ] 欄位名稱全鏈路一致（blockDef → extract → generate → lift → adapter）
- [ ] 測試涵蓋 template 和 hand-written 兩條路徑
- [ ] astPattern 的 constraints 足夠具體，不會搶匹配

---

## 10. 常見陷阱與解法

| 陷阱 | 症狀 | 原因 | 解法 |
|------|------|------|------|
| `self.xxx is not a function` | runtime error | `const self = this` 定義位置不在 closure 可及範圍 | 移到 `registerDynamicBlocks()` 最頂層 |
| template 和 hand-written 衝突 | 產生錯誤或不完整的程式碼 | 兩者同時存在，template 優先 | 移除 JSON 中的 `codeTemplate` |
| astPattern 搶匹配 | 錯誤的積木類型被 lift 出來 | 空 `constraints` 匹配太廣 | 加上 constraints 或改用 hand-written lifter |
| FieldDropdown 空選項 | Blockly 拋出錯誤 | 動態選項函式回傳空陣列 | 加 fallback 選項 |
| mutator extraState 格式不相容 | 舊存檔載入後積木形狀錯誤 | `loadExtraState` 無法解析新格式 | 做向後相容處理（`??` 預設值） |
| 欄位名稱不同步 | 資料丟失或產生錯誤碼 | 某一環用 `NAME` 另一環用 `NAME_0` | 全鏈路搜尋確認一致 |
| rebuildArgLabels_ 丟失 field value | 重建後 dropdown 選項重置 | 移除再重建 input 時 field value 消失 | 先 `getFieldValue` 儲存，重建後 `setFieldValue` 還原 |
| 重複的積木概念 | 語義衝突、lifter 不確定用哪個 | 不同 JSON 檔定義了功能相同的積木 | 合併為一個，移除重複的 |
| 積木不出現在 toolbox | 使用者看不到新積木 | `level` 設太高或 `category` 未在 `buildToolbox` 處理 | 檢查 level 和 category 設定 |

---

## 附錄：關鍵檔案速查

| 用途 | 檔案路徑 |
|------|---------|
| 通用積木定義 | `src/blocks/universal.json` |
| C++ 積木定義 | `src/languages/cpp/blocks/*.json` |
| 動態積木 & 工具箱 | `src/ui/app.new.ts` |
| 積木提取 | `src/ui/panels/blockly-panel.ts` |
| C++ 程式碼產生 | `src/languages/cpp/generators/*.ts` |
| C++ Lifting | `src/languages/cpp/lifters/*.ts` |
| C++ 語義轉接 | `src/languages/cpp/adapter.ts` |
| 類別顏色 | `src/ui/theme/category-colors.ts` |
| 國際化 | `src/i18n/{locale}/blocks.json` |
| 概念 Registry | `src/core/concept-registry.ts` |
| 第一性原理 | `docs/first-principles.md` |
