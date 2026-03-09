# 技術經驗傳承備忘錄

本文件記錄 code-blockly 開發過程中累積的架構知識、設計模式、從第一性原理到實作過程中遇到的真實問題與解法，供後續開發或新語言擴充時參考。

---

## 目錄

**Part I — 從理論到實作的真實碰撞**

1. [語義結構 vs 兩套 SemanticNode 的統一之路](#1-語義結構-vs-兩套-semanticnode-的統一之路)
2. [投影定理碰壁：Blockly 不是純函數](#2-投影定理碰壁blockly-不是純函數)
3. [概念代數的落地：Registry 遺漏連鎖反應](#3-概念代數的落地registry-遺漏連鎖反應)
4. [漸進揭露 vs 工程現實：層級過濾不是免費的](#4-漸進揭露-vs-工程現實層級過濾不是免費的)
5. [開放擴充的代價：雙管線競爭與搶匹配](#5-開放擴充的代價雙管線競爭與搶匹配)
6. [認知鷹架落地：積木文字設計的反覆試錯](#6-認知鷹架落地積木文字設計的反覆試錯)

**Part II — 架構知識與模式**

7. [積木定義的兩層架構](#7-積木定義的兩層架構)
8. [程式碼產生的優先順序](#8-程式碼產生的優先順序)
9. [Lifting（程式碼→積木）](#9-lifting程式碼積木)
10. [積木提取（Blockly→Semantic）](#10-積木提取blocklysemantic)
11. [Concept 與 Registry](#11-concept-與-registry)
12. [i18n 國際化](#12-i18n-國際化)
13. [Toolbox 與認知層級](#13-toolbox-與認知層級)
14. [動態積木常用模式](#14-動態積木常用模式)
15. [加入新語言的完整清單](#15-加入新語言的完整清單)
16. [常見陷阱與解法](#16-常見陷阱與解法)

---

# Part I — 從理論到實作的真實碰撞

## 1. 語義結構 vs 兩套 SemanticNode 的統一之路

### 第一性原理說了什麼

根公理（§1.1）定義了 SemanticNode 的標準形式：

```typescript
interface SemanticNode {
  id: string
  concept: ConceptType
  properties: Record<string, PropertyValue>
  children: Record<string, SemanticNode[]>  // ← 陣列
  // ...
}
```

### 實作中發生了什麼

開發過程中，同時存在兩套不相容的 SemanticNode 定義：

| 檔案 | `id` 欄位 | `children` 型別 | 用途 |
|------|----------|----------------|------|
| `src/core/types.ts` | 有 `id` | `Record<string, SemanticNode[]>` | interpreter、blockly-panel |
| `src/core/semantic-model.ts`（已刪除） | 無 `id` | `Record<string, SemanticNode \| SemanticNode[]>` | 模型工具函式 |

兩套型別在 TypeScript 的 structural typing 下不報錯（因為聯合型別 `A | A[]` 相容於 `A[]` 的某些用法），導致問題在靜態檢查中隱藏，直到 runtime 才爆炸。

### 碰到的具體問題

1. **interpreter 中大量 `as SemanticNode` 型別斷言**：因為 children 可能是 `SemanticNode | SemanticNode[]`，到處需要 `as` 強制轉型和 `Array.isArray()` 判斷。
2. **`nodeEquals()` 和 `walkNodes()` 定義在 semantic-model.ts**，使用的是無 `id` 版本，無法與 interpreter 的節點互操作。
3. **測試檔案混用兩套型別**：有些測試 import `semantic-model`，有些 import `types`，造成同一概念兩種寫法。

### 如何解決

統一為單一版本（保留 `types.ts` 的定義，遷移 `semantic-model.ts` 的工具函式到 `semantic-tree.ts`）：

- 刪除 `src/core/semantic-model.ts`
- 型別定義（`ConceptId`、`SemanticModel`、`ProgramMetadata`）遷入 `src/core/types.ts`
- 工具函式（`nodeEquals`、`semanticEquals`、`walkNodes`、`serializeModel`、`deserializeModel`）遷入 `src/core/semantic-tree.ts`，改為使用陣列版 children
- interpreter 全面改寫 children 存取：`node.children.X as SemanticNode` → `node.children.X[0]`
- 所有 `Array.isArray(body)` guard → `body ?? []`
- 約 15 個檔案的 import 更新 + 所有測試重寫

### 教訓

**第一性原理定義了理想型別，但實作中型別分裂是漸進開發的自然結果。** 關鍵是在分裂被發現時立刻統一，不要因為「兩邊都能跑」就容忍共存。TypeScript 的 structural typing 會隱藏型別不一致，必須靠 code review 或定期掃描發現。

---

## 2. 投影定理碰壁：Blockly 不是純函數

### 第一性原理說了什麼

P1 投影定理（§2.1）：`view = project(structure, scope, viewType, viewParams)`，投影是參數化函數。blocks 投影被定義為 R0（雙射），意味著 `lift(project(T)) ≡ T`。

### 實作中發生了什麼

Blockly 的積木系統有大量**有狀態的副作用**，使得「純函數投影」在實務中必須做大量妥協：

1. **動態積木需要 workspace 上下文**：FieldDropdown 的選項來自即時掃描 workspace 上的其他積木。這不是 `project(tree)` 能覆蓋的——選項列表取決於整個 workspace 的狀態，不只是當前節點。

2. **Mutator 齒輪的狀態管理**：mutator 的 `decompose()`/`compose()` 生命週期由 Blockly 控制，不在我們的投影管線中。積木形狀的改變（如增加 else if 分支）必須透過 `saveExtraState()`/`loadExtraState()` 序列化。

3. **積木的視覺狀態不完全由語義樹決定**：例如積木的 x/y 位置、是否折疊、是否 disabled——這些是呈現資訊（metadata），但 Blockly 把它們和語義資訊混在一起。

### 如何妥協

- **`const self = this` 模式**：在 `registerDynamicBlocks()` 頂層捕獲 App 實例，讓 Blockly 積木的 closure 能存取 workspace 掃描方法。這是把 workspace 狀態「注入」到投影過程中。
- **extraState 作為語義補充**：Blockly 的 `saveExtraState()` 回傳的 JSON 不是純呈現資訊，而是語義結構的一部分（如 mutator 的分支數量、三模式參數的模式狀態）。我們用它來彌補語義樹和 Blockly 積木之間的間隙。
- **extract 而非 project**：從 Blockly workspace 取得語義樹的過程叫 `extractBlockInner()`，而非 `lift()`。命名上承認這不是理論中的純投影反函數，而是一個需要處理大量邊界情況的工程過程。

### 教訓

**R0 雙射是設計目標，不是工程現實。** 在 Blockly 這樣的第三方 UI 框架中，投影管線必須適應框架的狀態模型。正確做法是：承認投影不純，但確保 roundtrip 結果在語義層等價（即使中間經過了有狀態的中介）。

---

## 3. 概念代數的落地：Registry 遺漏連鎖反應

### 第一性原理說了什麼

P2 概念代數（§2.2）要求概念註冊完備性：每個概念必須有四條路徑（lift → render → extract → generate）。

### 實作中發生了什麼

**真實案例：`negate` 概念遺漏**

加入 `u_negate`（取負數）積木時，完成了：
- BlockSpec JSON 定義（blockDef + concept）
- 動態積木覆蓋（FieldDropdown）
- code generator
- 測試

但忘記在 `UNIVERSAL_CONCEPTS` registry 中加入 `'negate'`。結果：
- diagnostics 系統報告「unknown concept: negate」
- code-to-blocks 轉換失敗（因為 registry 查詢回傳 undefined）
- 積木本身能正常使用，容易讓人以為沒問題

**問題根因**：四條路徑分散在不同檔案中，沒有一個統一的檢查點。

### 如何解決

1. 在 `src/core/concept-registry.ts` 的 `UNIVERSAL_CONCEPTS` Map 補上 `'negate'` 條目
2. 建立認知：新增任何概念時，**第一步就是在 registry 註冊**，然後再寫其他程式碼

### 教訓

**P2 的四條路徑完備性在工程上需要自動化驗證。** 靠開發者記憶力不可靠。理想做法是寫一個測試或 lint 規則：遍歷所有 BlockSpec JSON 的 `concept.conceptId`，檢查每個都在 registry 中存在。

---

## 4. 漸進揭露 vs 工程現實：層級過濾不是免費的

### 第一性原理說了什麼

P4 漸進揭露（§2.4）：同一棵語義樹在不同認知層級顯示不同的概念子集。L0 只看到 Universal 概念。

### 實作中遇到的問題

1. **Toolbox 不是簡單的 filter**：理論上只要 `level <= currentLevel` 就能決定是否顯示。但實務上：
   - IO 偏好（iostream vs cstdio）需要額外維度
   - 某些積木在特定 Code Style 下才有意義（APCS 不需要 `bits/stdc++.h`）
   - 語言專屬積木的 level 和 universal 積木的 level 需要協調

2. **層級切換的副作用**：切換到 L0 時，workspace 上可能已存在 L1 積木。理論說「過濾，不刪除」，但使用者看到 toolbox 沒有某個積木卻在 workspace 上看到它，會困惑。

3. **BlockSpec 的 level 值如何決定**：第一性原理只說「L0 初學 → LN 進階」，但具體哪個積木該放 level 0 vs level 1，是教育判斷而非工程判斷。

### 如何處理

- `buildToolbox()` 中實作了多維度過濾：`level` + `category` + `ioPreference` + `language`
- workspace 上的既有積木不受層級切換影響（只影響 toolbox 可用性）
- level 值由教育專業判斷決定，記錄在 BlockSpec JSON 中，工程上只負責正確過濾

### 教訓

**P4 在理論上是一維的（概念層級），但在實作中是多維的（level × ioPreference × codeStyle × language）。** 不要試圖用單一 level 數字解決所有問題，接受 toolbox 的過濾邏輯天然需要多個維度。

---

## 5. 開放擴充的代價：雙管線競爭與搶匹配

### 第一性原理說了什麼

P3 開放擴充（§2.3）：新概念可加入而不破壞既有結構。Pattern Engine 的多層表達（Layer 1 JSON → Layer 2 Transform → Layer 3 Strategy）確保核心引擎只有一條管線。P3 現在也包含「Pattern 歧義偵測」規則：如果兩個 pattern 可能匹配同一個 AST 節點，系統必須在**註冊時**就偵測到歧義並報錯。

### 實作中發生了什麼

**真實案例：`c_pointer_op` 搶匹配**

C++ 指標操作（`*p`、`&x`）的 astPattern 設定為 `nodeType: "unary_expression"`，但 constraints 為空。結果 `++i`（tree-sitter 也分類為 `unary_expression`）被錯誤匹配為 `c_pointer_op`，而不是 `c_increment`。

**根因**：兩個 BlockSpec 都宣告匹配同一個 AST nodeType，但約束條件的嚴格程度不同。Pattern Engine 按登記順序嘗試匹配，先匹配到的就贏了。

**另一個案例：codeTemplate vs hand-written generator**

某些積木的 JSON 有 `codeTemplate`，同時開發者又寫了 hand-written generator。由於 template 優先順序更高，hand-written generator 完全不會被執行，但開發者不知道自己的程式碼根本沒用。

### 如何解決

1. **astPattern 必須有明確的 constraints**：不允許空 constraints（除非該 nodeType 全局唯一對應到該概念）
2. **codeTemplate 和 hand-written generator 互斥**：當積木邏輯複雜到需要 hand-written 時，必須從 JSON 中刪除 `codeTemplate`
3. **測試覆蓋兩條路徑**：每個積木的測試必須明確說明測的是 template 路徑還是 generator 路徑

### 教訓

**P3 說「只加 JSON 不改既有程式碼」，但沒說「加 JSON 不會影響既有行為」。** 這個經驗直接推動了第一性原理的修訂——§2.3 現在包含「Pattern 歧義偵測」規則：禁止歧義比仲裁歧義更安全。如果同一 nodeType 需要根據內容映射到不同概念，應使用 Layer 3 的 hand-written liftStrategy，而非多個互相衝突的 JSON pattern。

---

## 6. 認知鷹架落地：積木文字設計的反覆試錯

### 第一性原理說了什麼

教育學定位（§1.4）：
- Sc3 認知一致性：一個積木 = 一個語法結構
- Sc4 最小驚訝：積木行為和生成的程式碼一致
- CLT：最小化外在認知負荷

積木文字設計準則：Message 用「動詞 + 身份 + 名稱」，串起來像一段中文敘述。

### 實作中的試錯過程

**問題 1：message0 的中文語序不自然**

初版：`"宣告 %1 型別 變數 %2"` → 讀起來像「宣告 int 型別 變數 x」，語序生硬。

修改後：`"宣告 %1 變數 %2"` → 「宣告 int 變數 x」，更自然。但這樣 `%1` 的語義從「型別」變成可能被誤解為其他東西。

最終：把 message 拆成多個 label key，每段都有明確語義：`HEADER_LABEL`（「宣告」）+ TYPE dropdown + `VAR_LABEL`（「變數」）+ NAME field。

**問題 2：FieldTextInput vs FieldDropdown 的認知負荷差異**

最初，變數名稱用 FieldTextInput（自由輸入）。問題：
- 初學者可能輸入不合法的變數名（如 `my var`、`123abc`）
- 沒有提示現有變數，初學者不知道有哪些可用

改為 FieldDropdown（從 workspace 掃描現有變數）後：
- 解決了上述問題
- 但遇到新問題：如果 workspace 上還沒有任何變數宣告，dropdown 是空的 → Blockly 會拋錯
- 解法：fallback 選項 `[['x', 'x']]`

**問題 3：三模式參數的設計演化**

I/O 積木（cout、scanf）的參數設計經歷了三個版本：

1. **V1 純 ValueInput**：只能用積木組合，初學者覺得太複雜
2. **V2 純 FieldDropdown**：只能選現有變數，無法輸入常數或表達式
3. **V3 三模式（select/compose/custom）**：dropdown 中加入特殊選項 `__COMPOSE__`（切換到積木組合）和 `__CUSTOM__`（切換到自由輸入），用 validator + setTimeout 動態切換 input 類型

V3 的 UI 複雜度超出原本預期，但確實實現了 CLT 的目標：簡單情境用 select（最低認知負荷），複雜情境用 compose（完整表達力），特殊情境用 custom（最大自由度）。

### 教訓

**第一性原理提供方向，不提供具體設計。** 「最小化外在負荷」是正確的目標，但「怎麼最小化」需要反覆試錯。積木文字和互動模式的設計本質上是 UX 問題，不能純靠理論推導。

---

# Part II — 架構知識與模式

## 7. 積木定義的兩層架構

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

檔案位置：`src/ui/app.ts` 的 `registerDynamicBlocks()` 方法。

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

## 8. 程式碼產生的優先順序

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

## 9. Lifting（程式碼→積木）

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

### Lossless Lift 原則

Lift 應優先產出**語言特定概念**（如 `cpp_printf`），而非直接壓扁成通用概念（如 `print`）。正規化由 style exception 系統在下游可選執行。

**真實案例：printf format string 丟失**

早期的 `extractPrintf()` 直接回傳 `print { values: [x] }`，丟掉了 format string `"%.2f\n"`。後果：
- `printf("%.2f\n", x)` → blocks → `cout << x`（round-trip 壞掉）
- 借音場景按「保留」後仍丟失格式資訊

修正後的架構：

```
Code → lift → cpp_printf { format: "%.2f\n", args: [x] }   ← 無損
                ↓ style exception（可選）
             print { values: [x] }                           ← 有損但使用者明確選擇
```

**判斷準則**：
- 有結構化資訊（format string、特殊語法）→ lift 為語言特定概念
- 天然映射且無資訊丟失（`cout << x` → `print`）→ 直接 lift 為通用概念
- Style exception 系統 = 正規化提議器（「保留」= no-op，「統一」= normalize）

### 常見陷阱

**空 constraints 會匹配所有同 nodeType 的節點**，可能搶走其他積木的 lifting。

真實案例：`c_pointer_op` 的 astPattern 設定為 `nodeType: "unary_expression"` 且 constraints 為空，結果 `++i`（也是 unary_expression）被錯誤地 lift 為 `c_pointer_op`。

解法：
- 務必加上 constraints 限縮匹配範圍
- 或改用 hand-written lifter 處理需要複雜判斷的 nodeType

---

## 10. 積木提取（Blockly→Semantic）

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

## 11. Concept 與 Registry

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

**遺漏註冊的後果**：diagnostics 報錯、code generation 找不到 generator、extraction 無法正確解析。（見 Part I §3 的 negate 案例）

---

## 12. i18n 國際化

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

動態積木不使用原本的 MSG0。

---

## 13. Toolbox 與認知層級

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

## 14. 動態積木常用模式

### 14.1 `const self = this` 模式

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

### 14.2 動態 FieldDropdown

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

### 14.3 +/- 按鈕模式

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

### 14.4 三模式參數（select/compose/custom）

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

### 14.5 Mutator 齒輪模式

用於結構可變的積木（如 u_if_else 的 else if/else 分支、u_var_declare 的多變數）：

- **Container block**：齒輪 mini-workspace 的頂部容器
- **Item blocks**：可拖入容器的子項目
- `decompose()`：主積木 → mini-workspace
- `compose()`：mini-workspace → 主積木
- `saveConnections()`：記住已連接的子積木

---

## 15. 加入新語言的完整清單

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
| `src/ui/app.ts` | 需要動態行為的積木覆蓋 |
| `src/ui/panels/blockly-panel.ts` | 複雜積木的 extraction case |
| `src/ui/theme/category-colors.ts` | 新類別的顏色 |
| `src/core/types.ts` | 新語言的型別定義（如有） |
| `tests/` | 對應的測試檔案 |

### 檢查清單

- [ ] 所有 concept 已在 registry 註冊（**第一步就做，不要最後才補**）
- [ ] 每個積木都有 code generator（template 或 hand-written，**二擇一不共存**）
- [ ] 每個需要 lifting 的 AST 節點都有對應規則
- [ ] 動態積木的 `extractBlockInner` case 已加入
- [ ] i18n 兩種語言的 key 都已加入
- [ ] toolbox category 和 level 設定正確
- [ ] `saveExtraState`/`loadExtraState` 可正確序列化還原
- [ ] 欄位名稱全鏈路一致（blockDef → extract → generate → lift → adapter）
- [ ] 測試涵蓋 template 和 hand-written 兩條路徑
- [ ] astPattern 的 constraints 足夠具體，不會搶匹配

---

## 16. 常見陷阱與解法

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
| 兩套 SemanticNode 型別衝突 | runtime 型別錯誤或靜態靜默 | children 定義不一致 | 統一為 `Record<string, SemanticNode[]>` 單一定義 |
| concept 未在 registry 註冊 | diagnostics 報 unknown、code-to-blocks 失敗 | 新增積木忘記更新 UNIVERSAL_CONCEPTS | 新增概念的第一步就是 registry |
| Lift 有損正規化 | round-trip 丟失資訊（format string 消失） | lift 時直接壓扁成通用概念 | lift 保留語言特定概念，style exception 做可選正規化 |

---

## 附錄：關鍵檔案速查

| 用途 | 檔案路徑 |
|------|---------|
| 通用積木定義 | `src/blocks/universal.json` |
| C++ 積木定義 | `src/languages/cpp/blocks/*.json` |
| 動態積木 & 工具箱 | `src/ui/app.ts` |
| 積木提取 | `src/ui/panels/blockly-panel.ts` |
| C++ 程式碼產生 | `src/languages/cpp/generators/*.ts` |
| C++ Lifting | `src/languages/cpp/lifters/*.ts` |
| C++ 語義轉接 | `src/languages/cpp/adapter.ts` |
| 類別顏色 | `src/ui/theme/category-colors.ts` |
| 國際化 | `src/i18n/{locale}/blocks.json` |
| 概念 Registry | `src/core/concept-registry.ts` |
| 語義樹型別定義 | `src/core/types.ts` |
| 語義樹工具函式 | `src/core/semantic-tree.ts` |
| Interpreter | `src/interpreter/interpreter.ts` |
| 第一性原理 | `docs/first-principles.md` |
