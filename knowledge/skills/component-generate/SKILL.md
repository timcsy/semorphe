---
name: component-generate
description: >
  為概念探索報告中定義的概念產生一顆**元件膠囊**——`component.json` 宣告
  ＋ 五路實作 ＋ 積木形態 ＋ 標籤 ＋ 測試，全部住在
  `src/components/<scope>/<name>/`。在 /component-discover 之後使用。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

## ⛔ 調用要求

此 skill **必須透過 Skill tool 調用**，不可手動替代。當由 `/component-pipeline` 編排時，pipeline 會使用 Skill tool 調用此 skill。

**完成時必須輸出完成標記**（見最後一節）。

# 概念產生

## 使用者輸入

```text
$ARGUMENTS
```

參數應為概念探索報告的路徑（來自 `/component-discover`），或 `{lang} {component_name}` 格式（例如 `cpp do_while`、`python list_comprehension`）。

## 背景——⚠️ 一顆新元件今天的家是**膠囊**，不是共用檔

階段 6.5 的 F 步已經完成，`component-locality` 基線的 `notEncapsulated` 是 **0**。
`src/core/component/registry.ts` 的檔頭逐字說明了為什麼：

> 「手寫清單的話『加一顆元件』＝編輯一個既有的共用檔，而那正是這整個階段要治的病：
> **碎裂的痛不在「碰幾個檔」，在碰幾個既有的共用檔。**
> 掃描之後，加一顆元件＝**新增一個資料夾，零編輯**。」

所以本 skill 的產出是**一個資料夾**：

```
src/components/<scope>/<name>/
  component.json      宣告（身分／屬性／接點／角色／五路位置）
  lift.ts             AST → 語義樹      ⎫
  generate.ts         語義樹 → 原始碼    ⎬ 五路（render／extract 由 forms/ 提供）
  execute.ts          語義樹 → 執行行為  ⎭
  forms/blocks.json   積木形態（可多個——見 form 軸）
  labels/{zh-TW,en}.json   i18n 標籤
  spec.test.ts        這顆自己的測試
```

⚠️ **`<scope>` 不是語言，是套件擁有者**。今天有 `cpp` 與 `python`，
而 `hw` 已在白名單裡——硬體元件用同一個形狀。
🔴 **而 scope 決定資料夾，`owner` 決定工具箱看不看得到它——兩者【不是】同一件事**（見步驟零）。

## 前置作業

- `src/core/component/types.ts` — `ComponentManifest` 契約與 `FIVE_PATHS`
- `src/core/component/registry.ts` — 膠囊怎麼被找到（**檔頭寫了為什麼是掃描**）
- `src/core/component/paths.ts` — 五路的組裝點，**匯出函式名是契約**
- `knowledge/concepts/元件.md` — 五槽（身分／接點／參數＝真實；形態／行為＝投影）
- `knowledge/concepts/元件代數.md` — P2 的屬性結構化邊界規則

**照抄一顆既有的**，而挑選有講究：

| 你要做的 | 抄這顆 | 它示範什麼 |
|---|---|---|
| 一般語句／運算式 | `cpp/vector_declare/` | 最完整的五路 |
| lift 是純資料 | 任一有 `lift-pattern.json` 的 | **不寫程式的 lift** |
| lift 要跑真邏輯 | 任一有 `lift-strategy.ts` 的 | 具名策略 |
| 一個身分多種形態 | `cpp/increment/` | `form: {axis, value}` ＋ `expressionCounterpart` |
| 可增減的插槽／欄位／分支 | `python/print`／`python/func_def`／`python/if` | 三種 mutation |
| 少一路 | 任一 `paths` 裡有 `null` 的 | **顯式的空** |

⚠️ **不寫數字**（「44 顆」那種）——每加一顆就過期一次，而 2026-08-21 的健檢發現
**這份文件裡每一個數字都錯了**（177→255、44→67、11→16、28→31…）。
要數量就去數，不要相信文件。

> 🔴 **而「照抄一顆既有的」有一個前提：被抄的那顆是對的——而沒有人驗過它。**
> 實測（2026-08-21）：`cpp:func_call` 宣告了兩個形態卻**漏了 `expressionCounterpart`**，
> 於是 `x = f(1)` 渲染成灰色方塊。**抄它的人會抄到同一個洞。**
> → 抄完之後**跑一次比對護欄**（`audit-block-def-parity`），別只看它「看起來完整」。

## 工作流程

### 步驟零：建資料夾與 `component.json`

```jsonc
{
  "componentId": "cpp:vector_declare",     // 必要：身分（資料夾要對得上，否則契約 throw）
  "properties": [                          // 必要：參數（積木上的欄位）
    { "name": "type", "kind": "enum", "default": "int" },
    { "name": "name", "kind": "identifier", "default": "vec" }
  ],
  "children": {                            // 必要：接點
    "values": "expression"
  },
  "role": "statement",                     // 必要：statement / expression / both
  "owner": "(core)",                       // 🔴 見下面「owner 蓋哪個章」——蓋錯會讓積木【不存在】
  "paths": {                               // 🔴 必要：五路【全部列出】，沒有的寫 null ＋ _why
    "lift": "./lift-pattern.json",
    "generate": "./generate.ts",
    "render": "./forms/blocks.json",
    "extract": "./forms/blocks.json",
    "execute": null,
    "_execute_why": "**顯式的空，不是遺漏。** 宣告性概念執行起來沒有行為。"
  },

  "abstractComponent": "cpp:var_declare",  // 選用：抽象元件
  "requires": ["<vector>"],                // 選用：相依標頭
  "traits": { "precedence": 14 }           // 選用：這顆自己的性質
}
```

**`kind`**：`enum`／`identifier`／`number`／`string`／`literal`／`type`。
`required: true` 表示沒有預設值。

🔴 **`enum` 不要寫 `values`。** 第二十六條護欄（`audit-declared-enum-values`）逐字：
「**宣告了 values 而沒有人讀它的元件**」——真正的清單住在
`forms/blocks.json` 的下拉選項裡，**那是有人讀的那一份**。

> **一個沒有人讀的宣告，與一個寫錯的宣告長得一模一樣。**

⚠️ **`layer` 已於 spec 152 退場**（實測 255 顆裡 0 顆有它）。不要寫。

#### 🔴 `paths` 的五路全列，與 `skipPaths` **不是同一件事**

這一條撞過（2026-08-21）：只寫了 `skipPaths` 就在載入時 throw。

| | 誰檢查 | 意思 |
|---|---|---|
| `paths.X: null` ＋ `_X_why` | **契約 C3**（`registry.ts` 的 `verifyContract`） | **沒有這個檔** |
| `skipPaths` ＋ `skipReasons` | `skip-declarations` 登記處（直譯器讀） | **別為這顆抱怨「沒有執行器」** |

**兩者正交**——實測 22 顆兩者都有、11 顆只有 `null`、9 顆只有 `skipPaths`
（那 9 顆有真的 `execute.ts`，只是直譯器被告知跳過）。

⚠️ `skipReasons` 的值是**封閉詞彙**：`declarative`／`consumed-by-parent`／`degradation-target`。
**刻意沒有「還沒做」**。

#### 🔴 `owner` 蓋哪個章——蓋錯的症狀是**積木在工具箱裡不存在**

```
(core)        核心層的元件
(universal)   universal 層（⚠️ 蓋成 (core) 會讓工具箱那一段變成【零筆】）
(python) 等   🔴 【該語言自己的元件】——第二個語言的每一顆都是這個
<vector> 等   std 模組
```

實測（2026-08-21）：當時 20 顆 Python 元件裡有 **16 顆**蓋成 `(core)`，而工具箱的來源段落
寫的是 `{ from: '(python)' }`——**查無此章就整批回傳空**。
測試全綠、積木畫得出來、來回轉換一字不差，**而使用者打開工具箱看不到任何一顆**。

#### ⚠️ 非顯然的宣告要附 `_why`——這是慣例，不是裝飾

`_why` 的慣例在整個膠囊庫裡有數百筆——`_traits_why`／`_lift_why`／`_execute_why`／
`_owner_why`／`_requires_why`／`_generate_why` 都是常見的。

實例（`cpp:address_of`）：

```jsonc
"traits": { "precedence": 14, "prefixOperator": true },
"_traits_why": "**優先級與「我是前綴符號」是我自己的性質**，不是共用排版表該列的身分。"
```

判準：**如果一個宣告會讓下一個讀到它的人問「為什麼是這個值」，就附 `_why`。**
`skipPaths` **一律要附 `skipReasons`**——否則「顯式的空」與「忘了寫」分不出來。

### 步驟一：解析概念定義

從探索報告或使用者輸入中提取（命名慣例見 `/component-discover` 階段四）：
概念名稱、建議歸屬的 Topic 層級樹節點、目標語言的語法模式、
屬性、接點、工具箱分類。

### 步驟二：產生積木形態（`forms/blocks.json`）

```json
[{
  "id": "cpp:vector_declare",
  "componentId": "cpp:vector_declare",
  "language": "cpp",
  "category": "containers",
  "version": "1.0.0",
  "blockDef": {
    "type": "cpp_vector_declare",
    "message0": "%{BKY_CPP_VECTOR_DECLARE_MSG0}",
    "args0": [
      { "type": "field_dropdown", "name": "TYPE", "options": [["%{BKY_..._INT}", "int"]] },
      { "type": "input_value", "name": "VALUES" }
    ],
    "previousStatement": null, "nextStatement": null, "colour": 260
  },
  "renderMapping": {
    "fields": { "TYPE": "type" },
    "inputs": { "VALUES": "values" }
  }
}]
```

⚠️ **這是一個陣列**——同一個身分可以有多個形態。

#### 一個身分多種形態：`form: {axis, value}`

`cpp/increment/forms/blocks.json` 有兩筆：

```
cpp_increment              form 未標 → 該軸的預設形態
cpp_increment_expression   form: { "axis": "role", "value": "expression" }
```

> **位置不是身分，是形態**（`history` 的 B 項結論）。
> 同概念的 statement／expression 版本 **extraState 格式必須完全相同**——
> `STATEMENT_TO_EXPRESSION` 直接搬移 extraState。

⚠️ expression 形態**必須有完整的 `blockDef`（含 `args0`）**，不可只寫 `{type: "…"}`，
否則 PatternExtractor 的 auto-derive 會失敗。

#### Render／Extract 兩路都由這個檔提供

`extract` 由 PatternExtractor **從 `blockDef.args0` ＋ `children` 自動推導**，無需手寫。
若概念有動態結構（repeat inputs、multi-mode slots、if-elseif chains），
在 `renderMapping` 加 `dynamicRules`。

規則：
- `blockDef.type` 由身分**導出**（`cpp:vector_declare` → `cpp_vector_declare`），
  見 `src/core/component/derive-block-type.ts`——**不要自己編一個**
- 最小化 args 數量 — 認知負載原則
- 語句積木設 `previousStatement`/`nextStatement`；運算式積木設 `output`
- 如果此概念在不同 Topic 下需不同積木形狀，在 Topic JSON 加 `blockOverrides`（§2.4）

#### 🔴 顏色：**照同族的既有元件抄，不要自己挑**

這一節原本一個字都沒有，而 2026-08-21 使用者第二件回報就是「顏色與 C++ 那邊不一致」。

```bash
# 找同族那顆的顏色——這是唯一該用的來源
python3 -c "import json;print([b['blockDef'].get('colour') for b in json.load(open('src/components/cpp/<同族那顆>/forms/blocks.json'))])"
```

> **顏色是分類的視覺編碼**——學生靠它認「這是同一種東西」。
> 自己挑一個「看起來合理」的顏色，等於在兩個語言之間製造一條假的分界。

⚠️ 灰色（`#888888`）是**降級的視覺約定**，跨語言必須一致。

#### 🔴 可增減的插槽／欄位／分支——**三種建構子，選錯會弄丟欄位**

```
builder: "variadic"   加減【值插槽】       EXPR0、EXPR1…      每格接一顆積木
paramList             加減【欄位組】       PARAM_0…           每格是文字／下拉欄位
branchList            加減【成對的插槽】   COND_i ＋ BODY_i    ＋ 一個可有可無的尾巴
```

⚠️ **`dynamicRules` 是一個【陣列】**，不是物件——寫成物件的症狀是
`rules is not iterable`（2026-08-21 撞到）：

```jsonc
"renderMapping": {
  "fields": { "NAME": "name" },
  "dynamicRules": [
    { "countSource": "itemCount", "childSlot": "values", "inputPattern": "EXPR{i}" }
  ]
}
```

`countSource` 是 **extraState 的鍵**，而它是**存檔契約**——
與命令式那份一字不差（`itemCount`／`paramCount`／`elseifCount`＋`hasElse`）。
換一個鍵名等於讓使用者的舊檔打不開，**也等於讓命令式那顆退不了場**。

⚠️ 語句插槽要加 `"isStatementInput": true`。

#### 🔴 一個身分多種形態 → **還要宣告「什麼時候用哪一種」**

`form: { axis, value }` 說的是「**有幾種**」。而運算式位置要用哪一顆，
是**語句那一份**宣告的：

```jsonc
"renderMapping": { "expressionCounterpart": "cpp_func_call_expression" }
```

⚠️ 少了它的症狀：`x = f(1)` 的 lift 是對的、樹裡有這顆元件，
而**渲染時挑不到運算式那個形態 → 一顆灰色方塊**。
🔴 **`cpp:func_call` 漏了它一直到 2026-08-21**——被 Python 那顆同族的元件比出來的。

### 步驟二之二：i18n 標籤（`labels/zh-TW.json`、`labels/en.json`）

**i18n 必須使用 `%{BKY_...}` key**：`message0`、`tooltip`、以及 `field_dropdown` 的
options 顯示文字，一律使用 `%{BKY_KEY_NAME}` 格式引用，不可硬編碼任何語言的文字。
標籤住在**膠囊自己的 `labels/`**，由 `src/core/component/labels.ts` glob 直讀。

**i18n 標籤風格規範（強制遵守）**：

積木標籤的目的是讓學生**不看文件就能理解積木的語義**。以下規則確保跨概念的一致性：

| 規則 | 正確 ✅ | 錯誤 ❌ | 說明 |
|------|---------|---------|------|
| 中文用**描述式動詞短語** | `排序 %1` | `sort( %1 )` | 不抄語法，用語義描述 |
| 英文用**動詞開頭短語** | `Sort %1` | `sort( begin, end )` | 首字母大寫，不加括號 |
| 函式名**不直接當標籤** | `取絕對值 %1` | `abs( %1 )` | 函式名放 tooltip，標籤用語義 |
| **語言關鍵字不當標籤** | `宣告常數 %1 %2 = %3` | `const %1 %2 = %3` | 任何語言的關鍵字（C++ 的 const/auto/virtual；Python 的 def/class/lambda；Java 的 abstract/synchronized 等）都用中文/英文語義描述取代 |
| **語法符號不當標籤** | `靜態轉型為 %1（%2）` | `static_cast < %1 > ( %2 )` | 語言特殊語法（C++ 的 `<>`, `[]()`, `~`；Python 的 `@`；Java 的 `<T>` 等）不可出現在標籤中 |
| **方法呼叫語法不當標籤** | `清空 %1` | `%1 .clear()` | `.method()` 語法不可出現，用動詞描述 |
| 容器操作統一格式 | `將 %2 推入 %1` | `%1 .push( %2 )` | 動詞在前，物件與參數用自然語序 |
| tooltip 必須**補充說明** | tooltip: `對範圍 [begin, end) 進行升序排列` | tooltip: `排序` | tooltip 不可只是重複 message0 |
| 同類概念用**相同句式** | 所有數學函式：`{動詞} %1` | `取絕對值 %1` vs `sqrt( %1 )` | 同 category 的標籤必須風格統一 |
| 型別/參數名不出現在標籤中 | `宣告變數 %1` | `int %1 = %2` | 型別資訊放 dropdown 或 tooltip |

**常見違規模式速查表**（以下模式在標籤中一律禁止，適用所有語言）：

| 模式 | 範例 | 應改為 |
|------|------|--------|
| `.method()` | `%1 .push_back( %2 )`, `%1.append(%2)` | `在 %1 末端加入 %2` |
| `func()` | `sizeof( %1 )`, `abs( %1 )`, `len(%1)` | `取得 %1 的大小`, `取絕對值 %1`, `%1 的長度` |
| 語言關鍵字 | `const %1`, `auto %1`, `virtual %1`, `def %1`, `class %1` | `宣告常數 %1`, `自動推斷 %1`, `虛擬方法 %1`, `定義函式 %1`, `定義類別 %1` |
| C++ cast 語法 | `static_cast < %1 > ( %2 )` | `靜態轉型為 %1（%2）` |
| Lambda/閉包語法 | `[ %1 ] ( %2 )`, `lambda %1: %2` | `匿名函式 擷取 %1 參數 %2` |
| 解構子語法 | `~ %1 ()` | `解構子 ~%1()` |
| 運算子語法 | `%1 operator %2 ( %3 )` | `運算子多載 %2 回傳 %1（%3）` |
| 裝飾器語法 | `@%1` | `套用裝飾器 %1` |
| 泛型語法 | `%1<%2>` | `%1（型別 %2）` |

**產生 i18n 條目時的檢查清單**：
1. 讀取同 category 的現有標籤，確保新標籤與既有風格一致
2. 中文標籤是否為描述式？（動詞 + 名詞，如「排序範圍」「取得長度」「插入元素」）
3. 英文標籤是否為動詞短語？（如「Sort range」「Get length」「Insert element」）
4. tooltip 是否提供了 message0 以外的額外資訊？（參數說明、行為細節、注意事項）
5. 同一批次產生的多個概念之間，標籤句式是否一致？
6. 標籤中是否殘留任何目標語言的關鍵字、語法符號或方法呼叫語法？（對照上方速查表逐一檢查）

### 步驟三：`generate.ts`

```typescript
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:vector_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const values = node.children.values ?? []
    if (values.length > 0) {
      const items = values.map((v) => generateExpression(v, ctx)).join(', ')
      return `${indent(ctx)}vector<${type}> ${name} = {${items}};\n`
    }
    return `${indent(ctx)}vector<${type}> ${name};\n`
  })
}
```

⚠️ **匯出的函式名是契約**：`registerGenerate`。名字不對就 throw
——`paths.ts` 的檔頭逐字：「**不是安靜地少一路**」。

規則：語句層級輸出用 `indent(ctx)`；子運算式用 `generateExpression()`；
子語句列表用 `generateBody()`；缺失的子節點要有處置；遵循 `ctx.style`。

### 步驟四：`lift.ts`——⚠️ 先問「這一路是程式還是資料」

**三種形狀，選錯會多寫一個檔**：

| 形狀 | 檔案 | 什麼時候 |
|---|---|---|
| **純資料** | `lift-pattern.json` | AST 樣式對得上就成——**不寫程式** |
| **登錄一筆到共用分派表** | `lift.ts` | 判別邏輯共用，回家的是「這個名字屬於我」 |
| **具名策略** | `lift-strategy.ts` | 判別要跑真邏輯，而由 lift-pattern 以名字引用 |

#### 🔴 用具名策略時，**兩個宣告都要**（各撞過一次，2026-08-21）

```jsonc
// component.json —— 少了它：「有實作卻沒宣告，那是孤兒實作」（載入時 throw）
"paths": { …, "liftStrategy": "./lift-strategy.ts" }

// lift-pattern.json —— 少了 component：
//   「樣式說不出它產生哪個概念——它 lift 出來的東西沒有身分」
{ "id": "…", "grammar": "…", "astNodeType": "…",
  "liftStrategy": "python:liftIf", "component": { "componentId": "python:if" },
  "fieldMappings": [], "priority": 10 }
```

> **策略函式產出什麼，靜態掃不到——所以要在旁邊說一次。**

#### 🔴 `grammar` 是必填，而 `constraints` 的鍵是**封閉集合**

```jsonc
{ "grammar": "tree-sitter-python", "astNodeType": "if_statement", … }
```

⚠️ 少了 `grammar`：護欄指名它。而**寫錯鍵名不會報錯，它會被靜默忽略**——
2026-08-21 寫了 `constraints: [{ field, textIn: [...] }]`，
`textIn` 不是合法的鍵，於是那個限制**完全沒有生效**而測試照樣綠。

```
AstConstraint 的合法鍵    field · text · nodeType · match · absent
FieldMapping 的合法鍵     semantic · ast · extract · transform
```

> **一個不存在的欄位不會報錯，它只會讓你以為那個限制生效了。**

🟢 已有護欄在擋（`audit-lift-grammar` 的「不得有不存在的鍵」），而**寫的時候就對比較便宜**。

⚠️ **要排除某個 case 時先問「`routes` 做得到嗎」**：`operatorDispatch` 的
`routes` 沒列到的運算子**自然走降級**，那比 constraint 可靠。

第二種的樣子（`cpp/vector_declare/lift.ts` 全文）：

```typescript
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('vector', 'cpp:vector_declare', 'cpp/vector_declare')
}
```

> ⚠️ **判別邏輯留在共用檔是對的**（找 `template_type`、拆樣板引數本來就共用）；
> **要回家的是宣告**——「`vector` 這個樣板名屬於我」。

#### ⚠️ 資料不需要被登錄，它需要被找到

`lift-pattern.json` 由 `import.meta.glob` **直讀**，沒有登錄呼叫。
這條是付過學費的（2026-08-10，第三顆膠囊整批回退兩次）：

> **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
> 判準：**這個東西有沒有人要「查」它？**
> 有（「`vector` 這個名字屬於我」）→ 登錄。沒有（一整筆資料）→ **glob 直讀**。

**Layer 引導**：Layer 1 純 JSON（astPattern）、Layer 2 JSON + transform（TransformRegistry）、
Layer 3 JSON + strategy（LiftStrategyRegistry）。見 §2.3。

**信心等級設定規則**（P1 §2.1，強制遵守）：

| 信心等級 | 使用時機 | 範例 |
|----------|---------|------|
| `high` | 結構完全匹配**且**通過語義驗證的直接映射 | `number_literal` → `number_literal` |
| `warning` | 結構匹配但語義**可能不準確**（一對多映射） | `binary_expression` 可能是算術/比較/位元運算 |
| `inferred` | 推測性對應（從上下文推斷） | 從使用位置推斷變數型別 |
| `raw_code` | 無法結構化的降級 | 不支援的語法 |

**關鍵規則**：
- **composite pattern 不可直接設 `high`**——必須先通過語義驗證
- **一對多 AST 映射必須設 `warning`**
- **每個 lifter 必須有降級路徑**——無法識別時降級為 `raw_code` 而非靜默丟棄

### 步驟五：`execute.ts`

```typescript
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(
  register: (component: string, executor: ComponentExecutor) => void,
): void {
  register('cpp:vector_declare', async (node, ctx) => { /* … */ })
}
```

**宣告性概念**（`#include`、`using namespace`、註解）**不要寫 noop**——
在 `component.json` 宣告 `"skipPaths": ["execute"]` ＋ `"skipReasons": {"execute": "declarative"}`。

> **顯式的空與遺漏的空要分得出來**，而一個 noop 函式兩者長得一樣。

規則：子節點求值用 `ctx.evaluate()`；轉換用 `ctx.toNumber()`/`ctx.toBool()`；
回傳 `RuntimeValue`（`{ type, value }`）；語句型不回傳值。
⚠️ **絕不靜默跳過概念**——未註冊的概念會觸發 `unknownComponentHandler`。

⚠️ **不要靜默回退**：多層 fallback 都用同一預設值會掩蓋真正的資料遺失
（第三十三條護欄在看這個）。判不出來就丟錯，不要回 0。

### 步驟六：`spec.test.ts`——⚠️ 每條負向前面先釘一個正向

```typescript
it('lift', () => {
  const ids = componentsIn(lift('vector<int> v = {3,1,4};'))
  expect(ids).toContain('cpp:vector_declare')      // ← 正向錨點，先證明量到了東西
  expect(ids).not.toContain('cpp:raw_code')        // ← 負向才有意義
})
```

> `lift` 回傳 `null` 時集合是空的，**負向斷言會空過**——
> 而一支空過的測試與健康的長得一模一樣。

至少三支：lift、generate、round-trip。**執行那一路也要有實際輸出的斷言**
（第一顆膠囊的基準把執行全錄成空字串，等於完全沒被覆蓋）。

### 步驟六之二：五路完備性驗證（強制阻擋）

`FIVE_PATHS = ['lift', 'generate', 'render', 'extract', 'execute']`。
逐一確認，缺任何一路就不可繼續：

| # | 路徑 | 驗證方式 | 缺失後果 |
|---|------|---------|---------|
| 1 | **Lift** | `lift.ts` 匯出 `registerLift`，或 `lift-pattern.json` 存在 | ❌ 阻擋 |
| 2 | **Render** | `forms/blocks.json` 有條目，`renderMapping` 覆蓋所有屬性與接點 | ❌ 阻擋 |
| 3 | **Extract** | PatternExtractor 能 auto-derive；動態結構須有 `dynamicRules` | ❌ 阻擋 |
| 4 | **Generate** | `generate.ts` 匯出 `registerGenerate` | ❌ 阻擋 |
| 5 | **Execute** | `execute.ts` 匯出 `registerExecute` | ❌ 阻擋 |
| 6 | **Test** | `spec.test.ts` 含 lift／generate／round-trip | ❌ 阻擋 |

**一路刻意不做時**：在 `skipPaths` 宣告 ＋ `skipReasons` 寫理由。
**那算通過，但理由必須是理由**——「還沒做」不是理由。

**驗證用護欄，不要自己 grep**：

```bash
npx vitest run tests/integration/audit-component-locality.test.ts \
             tests/integration/audit-locality.test.ts \
             tests/integration/audit-completeness.test.ts
```

⚠️ **不要用「grep 身分、期望是空的」當驗收**（2026-08-13 實測，這條指令被寫進來過又拿掉）。
它有**三類合法命中**，而一個看到非零就緊張的人會去改不該改的東西：

| 合法命中 | 例 |
|---|---|
| **凍結的歷史明表** | `src/migrations/id-migrations.ts:130` `'lang:if': 'cpp:if'`——**一個字都不准改** |
| **課程清單** | `topics/*.json` 的 `components[]`——本 skill 步驟八**自己叫你加的** |
| **註解裡的提及** | `generators/statements.ts:54` 的 `* g.set('cpp:if', ifGenerator)` |

`cpp:if` 這樣一顆**已經正確膠囊化**的元件，那條 grep 給出 **21 筆**。

⚠️ 而在 zsh 裡 `--include=*.ts` **不加引號會被 glob 吃掉**，指令直接不執行
——而輸出看起來就是「0 筆，乾淨」。**一個失敗的檢查與一個通過的檢查長得一樣。**

### 步驟七：🪦 ~~`layer: "universal"` 的概念~~——**`layer` 已退場**

⚠️ **這一段原本教人「照實填 `layer`」，而 `layer` 於 spec `152` 退場**
（實測：255 顆膠囊裡 **0 顆**有它）。
🔴 而更糟的是**同一份文件的步驟零也把它列為「必要」**——
**一份文件裡兩個相反的指示，讀的人會照著先看到的那個做。**

它退場的理由值得留著：**「某個東西是不是通用的」在固定觀察集之前是不良定義的**
——通解是**算子**的性質，不是**解**的性質。
見 `draft/2026-08-20-通解與特解和小世界模型.md` 與 `vision` 階段 7。

🟢 **今天問「這顆跨不跨語言」的方式是等價邊**（`traits` 上宣告同一個角色，
例如兩個語言的輸出元件宣告同一個 `ioRole`），而**那是一個可以被護欄印出來的東西**
（`cross-language-equivalence.test.ts`）。

> **一個「宣告它是通用的」欄位，與一條「量得出它們落在同一類」的邊，
> 差別在後者答得出「在什麼觀察集底下」。**

⚠️ 而 `forms/blocks.json` 的 `language: "universal"` **是另一回事**（27 筆，仍在用）
——那說的是**這顆積木的形態跨語言共用**，不是「這個概念是通用的」。

### 步驟八：更新註冊——**幾乎沒有**

膠囊被 `import.meta.glob` 掃到，所以：

| 要做的 | 在哪 |
|---|---|
| ✅ **加進課程清單** | `src/languages/{lang}/topics/*.json` 的 `levelTree` 節點 `components[]` |
| 🟡 **工具箱分類** | **看情況**——見下面那一節。「不用」只對**已經有分類的語言**成立 |
| ❌ ~~component registry~~ | **不用**——`registry.ts` 掃 `component.json` |
| ❌ ~~五路的 import~~ | **不用**——`paths.ts` glob 直讀 |

### 🔴 「第二個語言的第一顆」——這一節整個不一樣

上面那句「工具箱分類不用改」**只對 C++ 成立**，因為它的 15 段分類早就在了。
一個**新語言**的 `toolbox-categories.ts` 是空的，而症狀是：

> **積木全部做好了、測試全綠、來回轉換一字不差——而工具箱裡一顆都看不到。**

實測 2026-08-21：一整批 Python 元件做完，使用者打開工具箱**看不到任何一顆**。

加一個語言的第一顆元件時，這四樣**都要**：

```
① src/languages/<lang>/toolbox-categories.ts   分類要自己建，來源寫 { from: '(<lang>)' }
② 每顆 component.json 的 owner                  蓋 (<lang>)，不是 (core)
③ 每顆 blocks.json 的 language                  寫 <lang>
④ 顏色                                          抄同族的既有元件（見步驟二）
```

⚠️ **分類跟著積木長出來，不要先擺好架子等它**——一個沒有積木的分類是一個空段落，
而空段落與「這個分類就是這麼小」長得一模一樣。

🔴 **而它有一個對稱的失敗樣態，只有一端有護欄在看**：

```
分類多了沒積木   🟢 可拿性護欄會說話
積木多了沒分類   🔴 沒有任何東西在看 —— 就是上面那 23 顆
```

#### 同一顆積木要在工具箱出現**多次**（不同預設狀態）

那是**教學設計**，登錄表推不出來，所以用 `extraTypes`：

```ts
extraTypes: [
  { type: 'python_if' },
  { type: 'python_if', extraState: { hasElse: true } },
  { type: 'python_if', extraState: { elseifCount: 1, hasElse: true } },
]
```

⚠️ **三筆都要列，而不是只列帶狀態的那兩筆**——`sources` 收不收得到純的那一顆
要看分類對不對得上，**而那件事只有打開工具箱才知道**（我第一次多一顆、第二次少一顆）。

### 🔴 而「加一顆元件」有一張固定的清單——它今天散在七條護欄的失敗訊息裡

2026-08-13 新增 `cpp:block` 與 `cpp:exception_make` 各觸發一次，**兩次一模一樣**：

| 要動什麼 | 不動的話哪條護欄會紅 |
|---|---|
| **主體詞彙表**（`SUBJECTS`）或**單字名清單**（`ATOMIC_NAMES`） | `audit-naming`（硬性零） |
| **課程清單**（Topic 的 `levelTree`） | `audit-curriculum-coverage`（「未收錄 MUST 不得是忘了」） |
| 積木型別集合基線 | `audit-identity-namespace` |
| 工具箱與課程快照 | `toolbox-snapshot` |
| 執行器清冊（`GENERATE_INVENTORY=1`） | `executor-inventory` |
| 膠囊搬家防線 | `component-move-parity` |
| 就近性／符合性／完備性基線 | 各自的棘輪 |

⚠️ **共用檔要用膠囊的東西時，呼叫它匯出的建構子**（`buildXxx`）——
身分字串只留在膠囊裡一處，否則就近性護欄會**兩個方向都報**。

> **一張「加一顆元件要做什麼」的清單，如果只存在於七條護欄的失敗訊息裡，
> 那麼每一個新來的人都要把那七條各撞一次才學得會。**

⚠️ **加進課程清單是唯一真正需要判斷的一步，而它有兩個護欄在看**：
「可拿性」（宣告了卻拿不到 → 紅）與課程快照（成員或順序變動 → 紅，要一起改基線）。

⚠️ **放進哪一關要看前置**：一顆概念的前置若在更後面的關卡，學生拿得到它卻用不了
（`array_assign` 曾經就是，2026-08-13 修）。**先問「它需要的東西在同關或更前面嗎」。**

`toolbox-categories.ts` 的 `extraTypes` 只剩 1 筆，而它有明確理由
（同一顆 `cpp_if` 用三個預設狀態出現＝教學設計，登錄表推不出來）。
**除非你的概念也是這種「同身分多預設狀態」，否則不要碰它。**

### 步驟九：輸出摘要

```
## {component_name} 的膠囊（{scope}）

src/components/{scope}/{name}/
- [ ] component.json（六個必要鍵 ＋ 非顯然宣告附 _why）
- [ ] lift.ts / lift-pattern.json / lift-strategy.ts（三選一）
- [ ] generate.ts
- [ ] execute.ts（或 skipPaths 宣告 ＋ 理由）
- [ ] forms/blocks.json
- [ ] labels/zh-TW.json、labels/en.json
- [ ] spec.test.ts（每條負向前有正向錨點）
- [ ] 課程清單：{哪個 Topic 的哪一關}

### 驗證
npx tsc --noEmit
npm test          # 那批護欄在裡面——就近性、可拿性、課程快照都會說話（不寫數字：它每輪都在變）
```

⚠️ **不要自己 grep 身分當驗收**——見步驟六之二，它有三類合法命中。

## 準則

- 🔴 **第一顆走完整條路，才批次寫其餘** —— 取代原本的「一次一顆」。
  實測（2026-08-21）：批次寫 16 顆，於是 `owner` 與顏色**兩個錯複製了 16 份**。
  而 23 顆一顆一顆做完整流程也不實際。
  > **可以批次的是「寫」，不可以批次的是「驗」。**

- **照抄一顆既有的** — 按上面那張表挑，**而抄完要驗被抄的那顆**（見上）

- **最小變更** — 產生新概念時不要重構現有程式碼

- 🔴 **積木 UX —— 開瀏覽器【看】，不要在腦中預覽**

  原本這一行寫「在腦中預覽積木：學生第一眼能看懂嗎？」——**那是錯的**。
  2026-08-21 使用者連續回報五件事，全部在 4900 多支測試全綠的情況下：

  ```
  工具箱裡找不到 · 顏色與同族不一致 · 少了 mutation
  工具箱該有三個入口只有一個 · 🔴 mutation 按鈕的位置與同族不同
  ```

  最後一條**沒有任何 API 問得出它**。

  | 問題 | 查得出來嗎 |
  |---|---|
  | 這個分類有幾顆積木 · 這顆什麼顏色 | 🟢 API |
  | 這顆**長得對不對** | 🔴 **只有看** |
  | 與同族／另一個語言的那顆**一不一樣** | 🔴 **只有並排看** |

  → 走 [[verify-in-browser]]，而**積木類的改動固定截三張**：
  工具箱的每個分類、拖一顆出來的樣子、同一顆積木在另一個語言／同族那側。

- ⚠️ **搬移不重寫** — 如果這顆是從共用檔搬來的，**重寫另開 commit**，否則對不出基準

- 🔴 **不要在自己的 `_why` 裡寫別顆元件的完整身分**

  就近性護欄掃的是「身分出現在自己資料夾外」，而**它分不出引用與說明**。
  2026-08-21 一輪裡犯了**六次**——寫「與 `cpp:builtin_constant` 不同」就會報。
  → 用敘述：「與 C++ 那顆內建常數不同」。

  ⚠️ 而**程式碼裡真的要判斷別顆元件時，問性狀不看身分**：
  `isNamedCall(id)` 而不是 `id === 'python:func_call'`——
  **後者在那顆元件改名時不會有人發現。**

## 完成標記（強制）

```
🏁 SKILL_COMPLETE: component-generate | {scope} | {component_name} | 五路：{N}/5（skip {M}）| tsc: PASS/FAIL
```

如果未輸出此標記，pipeline 不會繼續下一階段。
