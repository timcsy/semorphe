# First Principles：程式碼與積木雙向轉換系統

**建立日期**: 2026-03-04
**最後更新**: 2026-03-07
**適用範圍**: i18n、coding style、多語言支援、雙向轉換、套件擴充——所有子系統共用

---

## 根公理：程式是語義結構

一個程式有三種存在形態：

```
「把 x 加 1」          ← 意圖（人腦中的想法）
「x++;」              ← 文字投影（程式碼）
[變數 x 加1（++）]     ← 視覺投影（積木）
```

程式碼不是程式本身，積木也不是程式本身。程式的本質是：

> **由「概念節點」和「關係邊」組成的語義結構。在檔案內是樹，在檔案間是圖，在系統間是超圖。**

每個節點 = (概念類型, 屬性, 子節點)。每條邊 = (關係類型, 來源節點, 目標節點)。

程式碼是語義結構的文字序列化。積木是語義結構的視覺序列化。tree-sitter 產生的 AST 是 parser 的中間產物，**接近但不等於**語義結構。

從根公理直接推導：
- 語義結構是唯一真實（唯一的權威表示）
- 程式碼和積木都是衍生的（不是真實本身）
- 節點的概念類型和屬性是語義，序列化方式是呈現（語義與呈現分離）

### 語義結構的分層

語義結構隨**觀察範圍（scope）**的不同而呈現不同的拓撲：

```
Scope 0 語句（Statement）  → 節點
  單一語句是一個語義節點

Scope 1 函式（Function）   → 子樹
  語句組成函式體，函式有簽名和作用域

Scope 2 檔案（File）       → 語義樹
  函式 + 全域變數 + 型別定義 + import 組成一棵完整的樹

Scope 3 模組（Module）     → 語義子圖
  多個相關檔案組成模組，檔案間有引用關係（呼叫、型別引用、匯入）

Scope 4 專案（Project）    → 語義圖
  模組之間的依賴、呼叫、資料流形成完整的圖結構

Scope 5 系統（System）     → 語義超圖
  多個專案/服務之間的互動（API、訊息佇列、共享資料庫）
  包含外部語義套件（Semantic Packages）——透過語義契約引用、透過 WASM 執行
```

**Scope 0-2 是樹**：檔案內的語法天然就是樹結構，這是已經實現的部分。
**Scope 3-5 是圖**：跨檔案的引用關係天然形成圖結構，這是未來的擴展方向。

每一層都是前一層的**組合**，不是替換。樹是圖的特例。系統架構師看到的是 Scope 5，但可以 zoom in 到任何一層，直到看到單一語句——語義結構從頭到尾是連貫的。

```
節點間的關係分兩類：

結構關係（樹邊，Scope 0-2）：
  parent-child — 語法巢狀（if 包含 then_body）
  這些關係已經由 SemanticNode.children 表達

引用關係（圖邊，Scope 3+）：
  calls        — 函式呼叫（caller → callee）
  imports      — 檔案匯入（file → imported file）
  uses_type    — 型別引用（usage → definition）
  extends      — 繼承（子類 → 父類）
  depends_on   — 模組依賴（module → dependency）
```

**架構原則**：Scope 0-2 的語義樹不需要改變。Scope 3+ 的圖邊是從多棵語義樹**衍生**的索引結構——任何一棵樹改了，重建相關的圖邊即可。

### AST ≠ 語義樹

```
// 這兩段 code 的 AST 不同，但語義樹相同：
printf("hello");     // AST: call_expression(function="printf")
cout << "hello";     // AST: shift_expression(operator="<<")
                     // 語義樹: print(values: ["hello"])
```

AST 是語法層的產物，語義樹是意圖層的產物。從 AST 到語義樹的過程稱為 `lift()`（語義提升）。

### 語法→語義的鴻溝是語用學的

語言學將語言分析分為三層：

```
語法（Syntax）     → 形式規則：句子怎麼組合
語義（Semantics）  → 字面意義：句子是什麼意思
語用（Pragmatics） → 語境意義：說這句話的人在這個情境下想做什麼
```

程式語言中的對應：

```
語法  → AST（tree-sitter 解析的純形式結構）
語義  → 語義結構（概念節點 + 關係）
語用  → 從語法結構 + 上下文推斷出的意圖
```

**lift() 的本質是語用分析**——它不只是語法結構的一對一映射，而是根據上下文推斷程式碼的意圖：

| 語法結構 | 語用推斷 | 推斷依據 |
|---------|---------|---------|
| `for(int i=0;i<n;i++)` | `count_loop`（計數迴圈） | **慣用語辨識**：init + cond + update 的模式 |
| `cout << x << endl` | `print`（輸出） | **身份辨識**：`cout` 是什麼東西 |
| `printf("%d", x)` | `print`（輸出） | **名稱辨識**：`printf` 的已知語義 |
| `i++`（在迴圈末尾） | 迴圈步進 | **位置上下文**：出現在 for 的 update 位置 |
| `i++`（獨立語句） | `cpp_increment` | **位置上下文**：出現在 statement 位置 |

這解釋了幾件關鍵設計決策：

1. **為什麼 lift() 需要符號表和作用域棧**——語用分析需要上下文
2. **為什麼 Pattern Engine 有三層**——Layer 1（JSON）處理純語義映射，Layer 2-3 處理需要語用推斷的情況
3. **為什麼降級存在**——語用分析是推斷，推斷可能失敗，`confidence: 'inferred'` 標記不確定的語用判斷
4. **為什麼高 Scope 比低 Scope 難**——Scope 0-2 的語用推斷相對局部（慣用語、函式名），Scope 3+ 需要跨檔案甚至跨專案的語境

```
語用分析的複雜度隨 Scope 急劇上升：

Scope 0-2（檔案內）：
  慣用語辨識（for→count_loop）、名稱推斷（printf→print）
  → 目前的 lift() + Pattern Engine 已能處理

Scope 3（模組）：
  這組檔案的職責是什麼？這個 class 是 service 還是 model？
  → 需要跨檔案的命名慣例和使用模式分析

Scope 4（專案）：
  這是什麼架構？MVC？microservice？event-driven？
  → 需要依賴方向和模組角色的推斷

Scope 5（系統）：
  這個服務扮演什麼角色？gateway？worker？aggregator？
  → 需要跨專案的互動模式分析
```

**語用分析的結果融入語義結構，不另存一層**：`count_loop` 而非 `for_statement` 的概念選擇本身就包含了語用判斷。`metadata.confidence` 標記語用推斷的確定程度。語用不是新的資料維度，而是 lift() 過程的理論基礎。

### 資訊的三個類別

程式中的資訊不只有「語義」和「呈現」兩類，還有第三類——**元資訊**：

| | 語義資訊 | 呈現資訊 | 元資訊 |
|---|---|---|---|
| **定義** | 改了程式做不同的事 | 改了程式看起來不同但做一樣的事 | 不影響行為但有資訊價值 |
| **程式碼側** | 變數名、型別、邏輯 | 縮排、空行、命名風格、大括號位置 | 註解、pragma、lint directive |
| **積木側** | 連接關係、field 值 | 積木位置 (x,y)、顏色、tooltip 文字 | block comment |
| **儲存** | 語義樹節點 | 各自的 metadata | 語義樹的 annotation |
| **round-trip** | 必須保留 | 可以丟失 | 應該保留（best-effort） |

**註解的處理**：註解不改變程式行為，但丟了會導致系統無法用於現有專案維護。註解分為兩種，處理方式不同：

**行尾註解（inline comment）** — 附著標註，跟著宿主節點走：

```
x = 1; // set x
  → annotation on node(x=1), position: 'inline'
  → Blockly block comment on that block
```

**獨立註解（standalone comment）** — 無操作的平級節點，獨立存在：

```
// section header    ← 不屬於上一行，也不屬於下一行
x = 1;
  → children: [
      node(concept: 'comment', properties: {text: 'section header'}),
      node(concept: 'var_assign', ...)
    ]
  → 積木端：獨立的「註解積木」，可自由拖動
```

**表達式內部的註解** — 附著在子節點上，跟著子節點走：

```
foo(a, /* 重要參數 */ b);
  → call_expression(foo)
    ├── arg[0]: identifier(a)
    └── arg[1]: identifier(b)
                  └── annotations: [{type: 'comment', position: 'before', text: '重要參數'}]
```

annotation 可以附著在語義樹**任何層級**的節點上，不只是 statement level。當使用者在積木端互換 a 和 b 的順序時，註解跟著 b 走——因為它描述的是 b，不是「第二個位置」。

**為什麼不能用「最近節點」啟發式**：如果兩行語句之間有一行註解，它到底屬於上一行的 `after` 還是下一行的 `before`？當使用者在積木端拖曳互換兩個語句時，啟發式會導致不可預期的「註解漂移」。將獨立註解作為平級節點可以徹底避免這個問題。

```typescript
interface SemanticNode {
  concept: ConceptType
  properties: Record<string, PropertyValue>
  children: Record<string, SemanticNode[]>
  annotations?: Annotation[]   // 附著型元資訊（任何層級節點皆可）
}

interface Annotation {
  type: 'comment' | 'pragma' | 'lint_directive'
  text: string
  position: 'before' | 'after' | 'inline'
  // before: 節點前的註解（子節點層級，跟著節點走）
  // after:  節點後的註解
  // inline: 行尾註解（同一行）
}

// 獨立的 statement-level 註解是一種特殊的語義節點（no-op），不是 annotation：
// { concept: 'comment', properties: { text: '...' }, children: {} }
```

**語法偏好（Syntax Preference）** — 第四類資訊：

某些語法結構在語義上等價，但使用者有意識地選擇了特定寫法（如 `x += 1` vs `x = x + 1`，`i++` vs `i += 1`）。這不是語義（不改變行為），也不是純粹的呈現（使用者有意識的選擇），而是第四類資訊：

| | 語義 | 呈現 | 元資訊 | 語法偏好 |
|---|---|---|---|---|
| **定義** | 改行為 | 改外觀 | 不改行為有資訊價值 | 不改行為但使用者有意識的選擇 |
| **例子** | 型別、邏輯 | 縮排 | 註解 | `+=` vs `= x+1`、`i++` vs `i+=1` |
| **儲存** | 語義樹節點 | metadata | annotation | metadata.syntaxPreference |
| **round-trip** | 必須保留 | 可丟失 | best-effort | best-effort |

```typescript
// 語法偏好記錄在 metadata 中，project() 時優先使用原始寫法：
{
  concept: 'var_assign',
  properties: { name: 'x', operator: '+=' },
  children: { value: number(1) },
  metadata: {
    syntaxPreference: 'compound_assign'
    // project() 時優先使用 +=
    // 如果目標語言不支援則退回 x = x + 1
  }
}
```

**特殊案例——變數命名**：變數名是語義資訊（`myVar` 和 `my_var` 是不同變數）。因此 **Style 不能自動轉換既有變數名稱**——這會將語義操作偽裝成呈現操作，破壞根公理的分界。

```
Style 的職責邊界：
  ✅ 控制新建變數時的命名建議格式（如預設用 camelCase）
  ✅ 控制程式碼的縮排、大括號位置等純呈現格式
  ❌ 轉換既有變數的命名風格（這是 rename refactoring）

變數重新命名的正確處理：
  → 這是 refactoring 操作（rename symbol），不是 style switch
  → 需要 symbol table + scope analysis
  → 必須由使用者明確觸發，不能在切換 Style 時自動發生
  → 必須在所有引用點一致轉換，需要理解作用域和引用關係
```

**lift() 的狀態模型**：lift() 在**單次調用內**需要維護帶有作用域層級的符號表（scoped symbol table），以正確處理變數遮蔽（variable shadowing）和型別推導。但它在**跨次調用之間**不共享狀態，且 Style 切換不影響其符號表——這確保了 lift() 與 Style 不耦合。

```
lift() 的狀態邊界：
  ✅ 單次 lift(AST) 調用中：維護作用域棧 + 局部符號表（必要）
  ❌ 不同次 lift() 調用之間：不共享持久化狀態（純函數語義）
  ❌ Style 參數不影響 lift() 的符號表（不耦合）
```

---

## 教育學定位

> **積木是認知鷹架（cognitive scaffolding），不是替代品。**
> 其設計目標是降低外在認知負荷，讓學習者在近側發展區內建立程式設計的心智模型，並最終過渡到文字程式碼。

這段話建立在三個教育學理論之上：

### 認知負荷理論（Cognitive Load Theory, Sweller 1988）

學習時的認知負荷分三類：

| 類型 | 定義 | 積木系統的角色 |
|------|------|--------------|
| **內在負荷**（Intrinsic） | 學習材料本身的複雜度 | 不可消除——程式邏輯就是那麼複雜 |
| **外在負荷**（Extraneous） | 不良教學設計帶來的額外負擔 | **積木的首要任務是消除這類負荷** |
| **增生負荷**（Germane） | 建立心智模型的有益負荷 | 積木應引導學習者投入這類負荷 |

積木消除外在負荷的方式：
- **語法記憶 → 拖拽選擇**：不需要記住分號、括號、關鍵字拼寫
- **型別錯誤 → 形狀約束**：積木的接口形狀就是型別系統
- **結構錯誤 → 巢狀限制**：不可能把 expression 放在 statement 的位置

### 近側發展區（Zone of Proximal Development, Vygotsky 1978）

```
┌─────────────────────────────────────┐
│  學習者無法獨立完成的區域             │
│  ┌──────────────────────────────┐   │
│  │  ZPD：在鷹架輔助下可完成的區域  │   │
│  │  ┌───────────────────────┐   │   │
│  │  │  學習者已能獨立完成的區域 │   │   │
│  │  └───────────────────────┘   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

積木系統是 ZPD 中的**鷹架**：讓學習者做到他們「差一點就能做到」的事。鷹架必須：
1. **可調整**：隨著能力成長，鷹架應減少（P4 的層級切換）
2. **可拆除**：最終目標是過渡到文字程式碼，積木不應成為依賴
3. **透明**：鷹架不應遮蔽被輔助的概念（積木應映射到真實程式結構）

### 鷹架設計的四個推導原則

從上述理論推導出積木設計的約束：

```
CLT + ZPD
  │
  ├─ S1 鷹架可調性：同一概念在不同層級有不同的鷹架強度
  │   （對應 P4 漸進揭露——L0 鷹架最強，L2 鷹架最弱）
  │
  ├─ S2 鷹架可退場：積木設計不可引入文字程式碼中不存在的概念
  │   （確保學習者過渡到文字時不需要「忘掉」積木特有的抽象）
  │
  ├─ S3 認知一致性：積木結構應映射到真實的程式結構
  │   （一個積木 = 一個語法結構，不多不少）
  │
  └─ S4 最小驚訝：積木的行為應符合學習者對程式碼的預期
      （積木生成的程式碼和學習者預期的程式碼一致）
```

S2 與根公理呼應：如果「程式是語義樹」，那積木就是語義樹節點的視覺化，不應該發明語義樹中不存在的概念。

---

## 四個原則

從根公理推導出四個正交原則：

```
根公理：程式是語義樹
  │
  ├─ P1 投影定理：樹有多種等價表示，且可互轉
  │
  ├─ P2 概念代數：概念有結構，可分層、可組合、可映射
  │
  ├─ P3 開放擴充：新概念可加入而不破壞既有結構
  │
  └─ P4 漸進揭露：同一棵樹在不同認知層級有不同的可見範圍
```

---

### P1：投影定理（Projection Theorem）

> 語義結構有多種等價表示，每種表示是一個**參數化、可逆的投影**。

#### 投影管線

```
view = project(structure, scope, viewType, viewParams)

其中 viewParams = { language, locale, codeStyle, blockStyle, ... }
```

目前已實現的兩種投影：

```
code   = project(tree, file, code, { language, codeStyle })         // Generator
blocks = project(tree, file, blocks, { language, locale, blockStyle }) // Renderer
AST    = parse(code, language)                                       // Parser
tree   = lift(AST, language)                                         // Lifter
```

未來可擴展的投影：

```
flowchart     = project(tree, function, flowchart, { flowStyle })
architecture  = project(graph, project, architecture, { archStyle })
call_graph    = project(graph, module, call_graph, { graphStyle })
narrative     = project(tree, function, narrative, { locale, detail })
```

- 使用者在積木編輯器拖積木 → 修改語義結構 → 重新投影成程式碼
- 使用者在程式碼編輯器打字 → parse 成 AST → lift 成語義樹 → 重新投影成積木
- 所有視圖永遠從同一個語義結構衍生，不可能不一致
- 多個視圖可以同時顯示，每個視圖用不同的 scope + viewType 觀察同一個結構

#### 四個正交參數

| 參數 | 影響什麼 | 不影響什麼 |
|------|---------|-----------|
| **Language**（程式語言） | 兩邊都影響：能用的概念、型別、語法 | — |
| **Code Style**（編碼風格） | 只影響程式碼：格式、命名、慣例 | 不影響積木 |
| **Locale**（介面語言） | 只影響積木文字：message、tooltip、dropdown label | 不影響程式碼、不影響積木排版 |
| **Block Style**（積木排版） | 只影響積木外觀：方向、密度、配色、渲染器 | 不影響程式碼、不影響積木文字 |

**正交性的精確定義**：Language 是基底參數，它決定其他三者的**可用空間**，但不決定在空間內的選擇。Code Style、Locale、Block Style 在各自空間內完全獨立。

```
Code Style 空間 = Universal Code Style Options × Language-Specific Code Style Options

Universal Code Style Options（所有語言共有）:
  indent_size: 2 | 4
  brace_style: 'K&R' | 'Allman'
  naming: 'camelCase' | 'snake_case'

Language-Specific Code Style Options（僅特定語言有意義）:
  C++: io_style: 'cout' | 'printf'
  C++: namespace_style: 'using' | 'explicit'
  C++: header_style: 'bits' | 'individual'
```

```
Block Style 空間 = Universal Block Style Options × Language-Specific Block Style Options

Universal Block Style Options（所有語言共有）:
  renderer: 'zelos' | 'geras'               // 渲染器（圓角 vs 方角）
  density: 'compact' | 'normal' | 'spacious' // 積木密度
  colour_scheme: 'scratch' | 'classic' | ... // 配色方案

Language-Specific Block Style Options（可由語言模組覆蓋）:
  inputsInline: true | false                 // 預設水平或垂直排列
  orientation: 'horizontal' | 'vertical'     // 多值積木的延伸方向
```

**Code Style vs Block Style 的對稱性**：兩者都是純呈現參數，改了不動語義樹。Code Style 控制程式碼的排版（縮排、換行、命名），Block Style 控制積木的排版（方向、密度、形狀）。

類比：Language 決定棋盤大小，Code Style 決定棋子記號，Block Style 決定棋盤材質。三者互不影響，但都受限於棋盤——這不違反正交性。

#### 可逆性保證（分級）

定義兩種資訊度量：
- `structured_info(tree)` — 語義樹中結構化的語義資訊（概念類型、屬性、子節點關聯）
- `total_info(tree)` — 結構化語義 + 原始文字資訊（包含 raw_code 中保留的文字）

設 `T` 為原始語義樹，`R = lift(parse(project(T)))` 為 round-trip 後的語義樹：

```
完全可逆：structured_info(R) ≡ structured_info(T)
          // 有精確積木的概念，結構化語義完全保留

有損保留：structured_info(R) ⊆ structured_info(T)
          且 total_info(R) ⊇ total_info(T)
          // 降級後結構化程度降低（⊆），但原始文字不丟失（⊇）
          // 總資訊量不減少，只是從結構化轉為非結構化
```

**為什麼 `total_info` 用 `⊇` 是正確的**：降級為 `raw_code` 時，結構化語義資訊減少（`structured_info(R) ⊂ structured_info(T)`），但原始程式碼文字被完整保留在 `raw_code` 節點中，補償了結構損失。總資訊量不減少，只是**結構化程度降低**。

不管怎麼投影再逆投影，語義不能丟失。但呈現資訊和語法偏好可以丟失（可接受）：
- 程式碼的縮排、空行 → 投影到積木再投影回來，格式可能不同（語義相同）
- 積木的位置、排列 → 投影到程式碼再投影回來，位置可能重排（語義相同）
- 語法糖的選擇 → best-effort 保留在 `metadata.syntaxPreference`，不保證

**實用判定法**：寫完一個新積木後，跑 `code → blocks → code`，語義不能變。

#### 不存在「不可轉換」——只存在「降級程度」

從 P1 的可逆性保證和 P2 的降級層次（見 2b）共同推導：

> **系統的職責不是消除降級，而是讓降級透明可見、且不丟失資訊。**

任何程式碼片段都至少能降級為 `raw_code`（Level 4），因此**不存在「轉換失敗」這個狀態**。只存在「結構化程度」的差異：

```
結構化程度（高→低）：

  精確積木          structured_info 完整保留
    ↓
  通用積木（推斷）   structured_info 部分保留，metadata.confidence = 'inferred'
    ↓
  unresolved 節點    結構保留（子樹各自嘗試），metadata.confidence = 'inferred'
    ↓
  raw_code 積木      structured_info = ∅，但 total_info 完整保留
```

**降級是逐節點的，不是全有全無的**。一段 100 行的程式碼，可能 95 行精確 lift、3 行推斷、2 行降級為 raw_code。每個節點獨立決定自己的結構化程度。

**降級必須可見**：使用者需要能區分三種積木狀態：

| 狀態 | 含義 | 視覺提示 |
|------|------|---------|
| 精確（confidence: high） | 系統完全理解此概念 | 正常顯示 |
| 推斷（confidence: inferred） | 系統推測但不確定 | 微小提示（如淡色邊框） |
| 降級（raw_code） | 系統無法結構化理解 | 明顯標記（如灰色底、程式碼文字） |

**降級不是錯誤，是設計好的安全網**。系統的進化方向是逐漸減少 raw_code 節點（透過新增概念和 pattern），但永遠不追求消除它——因為使用者永遠可能寫出系統尚未建模的程式碼。

#### lift() 的完備性邊界

從 AST 提升到語義樹（`lift()`）不是 trivial 的操作。AST 是語法結構，語義樹是意圖結構，兩者之間的鴻溝因語言而異：

```
// Python 中的 a + b，不知道型別就無法判斷語義：
a + b   // math_add? string_concat? list_concat?

// C++ 中的 a + b，從宣告可以推導型別：
int a;  // → 語義確定為 math_add
```

**lift() 的四級策略**：

```
Level 1: 結構匹配   — AST pattern 唯一對應，語義明確
Level 2: 上下文推導  — 查找 declaration/context 消除歧義
Level 3: 未決保留   — 建立 unresolved 節點，保留原始 AST 結構
Level 4: 降級       — 真正無法處理 → raw_code
```

**Level 3 與 Level 4 的關鍵差異**：Level 3 保留了結構資訊（知道是 binary expression、知道運算子是 `+`），Level 4 只保留原始文字（完全放棄結構解析）。

**完備性因語言而異**：

| 語言類型 | lift() 難度 | 原因 |
|---------|------------|------|
| 靜態型別（C/C++/Java） | 中等 | Level 1 + Level 2 可覆蓋絕大多數情況 |
| 動態型別（Python/JS） | 困難 | 多型運算子頻繁觸發 Level 3 |

**系統策略**：不追求完備，追求「能 lift 的精確 lift，不能的優雅降級」。對於教學場景，Level 1 + Level 2 已經足夠。

**動態語言的歧義處理（Level 3 詳述）**：當結構匹配產生多個候選語義時（如 Python 的 `a + b` 可能是 `math_add` 或 `string_concat`），**不能採用機率猜測**——猜錯會污染語義樹，破壞 P1 的可逆性保證。正確做法是建立「未決節點」：

```typescript
// 不猜測，而是保留歧義：
{
  concept: 'unresolved_binary_op',
  properties: { operator: '+', candidates: ['math_add', 'string_concat'] },
  children: { left: a, right: b }
}
```

未決節點在積木端顯示為通用的運算積木（如 `[a + b]`），保留完整的 AST 結構資訊。當使用者在積木端提供型別標註、或系統從其他上下文取得足夠資訊後，才特化為具體概念。這確保了 `lift(parse(project(tree))) ⊇ tree` 的保證不被破壞。

**未決節點與跨語言轉換**：未決節點在同語言 round-trip 中是安全的（原始文字原樣保留），但在跨語言轉換時會產生死鎖——目標語言的 Generator 無法決定如何生成程式碼。因此跨語言轉換有一個**前置條件**：

```
跨語言轉換流程：
  source code → lift() → 語義樹
  → [前置檢查門] 語義樹中有 unresolved 節點？
    → 有：UI 標記這些節點，要求使用者消歧後才能繼續
    → 無：進入跨語言映射 → project(tree, target_lang)
```

如果使用者不想手動消歧，該節點降級為 `raw_code`（帶 warning 標籤），而非讓 Generator 猜測。

**lift() 的上下文**：lift() 需要的上下文不只包含型別宣告，也包含 namespace 指令、include、巨集定義等「環境修飾」。這些不是語義節點，但影響其他節點的語義辨識：

```
lift() context = {
  declarations: [...],      // 變數宣告 → 推導型別
  using_directives: [...],  // namespace 指令 → 辨識 cout vs std::cout
  includes: [...],          // 引入的 header → 判斷可用的函式庫
  macro_definitions: [...]  // 巨集定義 → 避免誤判巨集調用
}
```

例如 `using namespace std;` 不進入語義樹，但 Parser 遇到它時會更新上下文，使後續的 `cout` 能正確 lift 為 `io_output` 概念。在 project() 時，由 Style preset 決定是否產生 `using namespace`——兩者不耦合。

**C/C++ 巨集的處理**：tree-sitter 不展開巨集，`FOR(i, 0, 10)` 會被解析為 `call_expression` 而非 `for_statement`。如果 lift() 用 Level 1 結構匹配將其硬解為函式呼叫，迴圈的語義就會丟失。

```
巨集處理策略：
  1. parse() 階段遇到 #define → 將巨集名稱加入 context.macro_definitions
  2. lift() 遇到 call_expression → 檢查函式名是否在 macro_definitions 中
     → 是未知巨集：巨集調用節點本身降級為 unresolved_macro（Level 3），
       但其引數子樹各自獨立嘗試 lift()（不一刀切）
     → 不是巨集：正常 Level 1-4 策略
```

**精細降級的原因**：如果一個未知巨集包裹了龐大的程式碼區塊（例如 `TEST_CASE("name") { ... }`），整個降級為 `raw_code` 會導致內部所有合法的、可解析的語義樹全部丟失。正確做法是只降級巨集調用本身，保留子樹的結構：

```
TEST_CASE("name") { x = 1; y = 2; }
  → unresolved_macro(name="TEST_CASE")          ← 巨集節點降級
    ├── arg[0]: string_literal("name")           ← 正常 lift
    └── arg[1]: compound_statement               ← 正常 lift 內部語句
        ├── var_assign(x, 1)                     ← 正常 lift
        └── var_assign(y, 2)                     ← 正常 lift
```

```
  已知巨集的 opt-in 擴充：
  → 語言模組（如競賽風格）可預定義常見巨集的語義映射
  → 例如 #define FOR(i,a,b) for(...) → 映射為 count_loop 概念
  → 這是 Style preset 的擴充，不是 lift() 的核心職責
```

---

### P2：概念代數（Concept Algebra）

> 概念不是散落的集合，它們形成一個**有結構的代數系統**：可分層、可組合、可映射。

#### 2a. 概念分層（Layering）

```
Layer 0: Universal      — 所有語言共有（variable, loop, if, function, print）
Layer 1: Lang-Core      — 語言核心語法（pointer, template, decorator）
Layer 2: Lang-Library   — 標準/外部函式庫（vector, printf, numpy）
```

每一層嚴格依賴上一層，不能反向依賴：

```
Layer 2 用 Layer 0 的結構表達自己：
  cpp:vector_push_back = func_call(object="vec", method="push_back", args=[value])

Layer 1 擴充 Layer 0 的語法能力：
  cpp:pointer_deref = unary_expression(operator="*", operand=ptr)
```

**推論**：
- Universal 積木定義「概念的結構」，但不定義「型別清單」。型別清單由語言模組注入。
- Universal 積木的 tooltip 可以有預設文字（概念說明），但語言模組可以覆蓋（加入語言特定的細節）。
- 型別系統是 language-specific 的（C++ 有 `double`/`char`/`long long`，Python 沒有）。

#### 2a′. 概念註冊完備性（Concept Registry Completeness）

從根公理（概念可枚舉）和 P1（每個概念必須可逆投影）推導：

> 系統中每一個概念必須在**概念註冊表（Concept Registry）**中有唯一條目。概念註冊表是四條管線的共同 source of truth。

**四條管線的完備性約束**：

```
∀ concept ∈ ConceptRegistry:
  ① ∃ lift path     (AST → concept)        — 可辨識
  ② ∃ render path   (concept → Block)       — 可顯示
  ③ ∃ extract path  (Block → concept)       — 可還原
  ④ ∃ generate path (concept → Code)        — 可生成
  ⑤ roundtrip(concept) ≡ identity           — 可逆（P1 保證）
```

**coverage gap 的定義**：如果一個概念存在於 ConceptRegistry 中，但缺少上述 ①-④ 任何一條路徑，即為 coverage gap。coverage gap 是架構缺陷，不是測試遺漏。

**測試完整性的保證**：如果 ConceptRegistry 是完整的（包含系統中所有概念），且 ①-⑤ 對每個條目都通過，則**測試完整性由 P1 + P2 的數學性質保證**——不依賴經驗性的覆蓋率指標。

**概念的來源**：概念散布在多個位置——BlockSpec JSON（`blocks/*.json`）、lift-patterns.json、hand-written lifters、hand-written generators。ConceptRegistry 必須彙整所有來源，任何只存在於某一處但未註冊的概念是違規。

```
ConceptRegistry 的彙整來源：
  ┌─ BlockSpec JSON      → concept.conceptId
  ├─ lift-patterns.json  → concept.conceptId
  ├─ hand-written lifter → createNode('概念ID', ...)
  └─ hand-written generator → g.set('概念ID', ...)

靜態檢查規則：
  - BlockSpec 中定義的概念 → 必須有 lift + render + extract + generate
  - lift-patterns.json 的概念 → 必須有對應的 render + generate
  - hand-written lifter 產生的概念 → 必須有對應的 render + generate
  - generator 接受的概念 → 必須有對應的 lift + render 能產生它
```

**判定法**：跑一個靜態分析腳本，收集所有概念 ID，對每個 ID 檢查四條路徑是否存在。任何缺口 = 0 容忍的架構缺陷。

#### 2b. 概念映射（Mapping）

每個具體概念**必須**聲明它映射到哪個抽象概念：

```
抽象概念                具體概念
────────────────────────────────────
container_add      ←── cpp:vector_push_back
                   ←── cpp:set_insert
                   ←── python:list_append

io_output          ←── cpp:cout_print
                   ←── c:printf
                   ←── python:print

generic_call       ←── 任何未特化的 call_expression
```

**這就是降級策略的來源**（不需要獨立的「優雅降級」原則）：

```
Level 1: 有具體積木       → 用具體積木（如 cpp:vector_push_back）
Level 2: 有抽象概念       → 用通用積木表示（如 func_call）
Level 3: 連抽象概念都沒有 → raw_code 降級
Level 4: 標記為不支援     → 保留在模型中不丟失
```

**最重要的是 Level 4**：即使無法顯示，也**絕不丟失語義資訊**。

**跨語言轉換**也從映射自然推導，但存在**語義阻抗（Semantic Impedance）**，需要分級處理：

```
跨語言轉換的三個層次：

Layer 1 — 結構等價（可自動映射）：
  控制流（if/for/while）、基本運算、函式定義
  → 所有語言語義幾乎相同，自動映射安全

Layer 2 — 語義近似（需要適配）：
  容器操作、I/O、字串處理
  → 存在語義阻抗（回傳值、副作用、例外處理差異）
  → 映射是「最佳近似」，不是「精確等價」

Layer 3 — 無法映射（降級）：
  語言特有概念（C++ template、Python decorator）
  → 沒有對等物，必須降級為 raw_code 或拒絕轉換
```

**語義阻抗的偵測**：抽象概念應該攜帶語義契約（Semantic Contract），用於在映射時偵測阻抗：

```typescript
interface AbstractConceptDef {
  id: string
  semanticContract: {
    effect: 'pure' | 'mutate_self' | 'mutate_arg'  // 副作用類型
    returnSemantics: 'void' | 'self' | 'new_value'   // 回傳語義
    chainable: boolean                                 // 是否可鏈式呼叫
  }
}

// 偵測阻抗：
// cpp:push_back   (return: 'void', chainable: false)
//   → python:list_append (return: 'void', chainable: false)  ✅ 安全
//   → js:array_push      (return: 'new_value')               ⚠️ 阻抗警告
```

跨語言轉換的基本流程：

```
C++ code → lift → 語義樹 → 找到 cpp:vector_push_back
  → 查映射：abstractConcept = container_add
  → 比對語義契約：是否有阻抗？
    → 無阻抗：在目標語言中找具體概念 → project
    → 有阻抗：標記警告，生成近似程式碼 + TODO 註解
    → 無映射：降級為 raw_code
```

#### 2c. 概念命名空間與衝突解決（Namespace）

當多個套件定義了映射到同一個 `abstractConcept` 的具體概念時，需要命名空間機制來避免衝突：

```
概念的完整 ID = language:package:concept

cpp:stdlib:sort       → abstractConcept: collection_sort
cpp:boost:sort        → abstractConcept: collection_sort
python:builtin:sorted → abstractConcept: collection_sort
```

**衝突解決規則**：

```
1. 命名空間隔離：不同 package 的概念 ID 不同，不會衝突
2. AST 辨識（兩階段）：
   階段 1 — Pattern Match（必要條件）：
     function name = "sort", argument count = 2 or 3
     → 候選: [cpp:stdlib:sort, cpp:boost:sort]
   階段 2 — Context Disambiguation（充分條件）：
     有 #include <algorithm> → 確認 cpp:stdlib:sort (confidence: high)
     有 std:: prefix        → 確認 cpp:stdlib:sort (confidence: high)
     都沒有                  → 選擇 cpp:stdlib:sort (confidence: low, tag: inferred)
3. Style 選擇：同一個 abstractConcept 有多個具體實現時，
   由 Style preset 決定「生成」時用哪個
   （如 APCS style 用 stdlib，不用 boost）
4. 辨識不衝突：「認回來」時根據 AST constraints 精確匹配，
   不依賴 Style 選擇
```

**confidence 標籤**：C++ 允許隱式引入（header 包含在其他 header 中）或依賴 PCH，僅依賴 header constraint 做辨識太脆弱。當 AST pattern 符合但找不到明確的 include 時，不應直接降級為 `generic_call`，而是標記為 `inferred`：

```typescript
{
  concept: 'cpp:stdlib:sort',
  properties: { ... },
  metadata: { confidence: 'inferred', reason: 'no explicit #include <algorithm> found' }
}
```

- `confidence: 'high'` — 有明確的 AST constraints 匹配，round-trip 正常
- `confidence: 'inferred'` — pattern 符合但缺少充分條件，round-trip 正常但 UI 可顯示微小提示
- 如果推論錯誤，使用者可以手動修正

這與 `io_style`（cout vs printf）是同一個模式——同一個抽象概念的多個具體實現，由 Style 參數選擇生成方式，由 AST constraints + confidence 選擇辨識方式。

#### 2d. 概念組合（Composition）

```
複雜概念 = 簡單概念的組合
組合保持語義：meaning(A + B) = meaning(A) + meaning(B)
```

實用意義：每個積木只負責一個概念，複雜行為靠**積木嵌套**實現，不靠做一個「超級積木」。

**判定法**：如果一個積木拿掉某個欄位後仍然有意義，那它應該拆成兩個積木。

---

### P3：開放擴充（Open Extension）

> 系統可以在**不修改既有程式碼**的前提下，加入新概念、新語言、新套件。

#### 擴充點與擴充方式

| 擴充什麼 | 加什麼檔案 | 改什麼既有檔案 |
|---------|-----------|--------------|
| 新翻譯 | + locale JSON | 無 |
| 新風格 | + style preset | 無 |
| 新套件積木（簡單） | + block JSON（Layer 1：定義+模板+AST pattern） | 無 |
| 新套件積木（需轉換） | + block JSON + transform 註冊（Layer 2） | 無 |
| 新語言概念（複雜） | + block JSON + strategy 註冊（Layer 3） | 無 |
| 新通用概念 | + UniversalConcept type | concept-registry（加一行） |
| 新語言 | + language module（含 transform/strategy 註冊） | 無（plugin 式載入） |

**判定法**：如果加一個外部套件的積木需要改 `blockly-editor.ts`，代表架構有耦合。目標是只加 JSON + 可選的註冊函數。

#### Pattern Engine 的三層表達能力

P3 的「開放擴充」不等於「所有邏輯都必須是 JSON」。把所有邏輯塞進 JSON 會導致在 JSON 裡建一個圖靈不完備的 DSL，每加一個語言就需要加新的內建操作——這不是真正的開放擴充，而是核心引擎不斷膨脹。

真正的開放擴充是：**語言模組能用自己的程式碼擴充引擎的行為，而不修改引擎本身。**

Pattern Engine（包括 PatternLifter 和 PatternRenderer）提供三層漸進的表達能力：

```
Layer 1: 純 JSON 聲明        — 覆蓋 ~80% 場景
Layer 2: JSON + 具名 transform — 覆蓋 ~15% 場景
Layer 3: JSON + 具名 strategy  — 覆蓋 ~5% 場景
```

**Layer 1 — 純 JSON 聲明**：fieldMappings、constraints、chain、composite、operatorDispatch 等。不需要任何程式碼，絕大多數概念用這層就夠。

```jsonc
// 80% 的概念長這樣——純 JSON，零程式碼
{
  "astNodeType": "break_statement",
  "concept": { "conceptId": "break" }
}
```

**Layer 2 — JSON + 具名 transform**：當 JSON 的 fieldMapping 需要文字轉換（去引號、去前綴等）時，在 `extract` 中引用一個具名的 transform 函數。Transform 函數是純函數（`string → string`），由語言模組註冊，不寫在核心引擎裡。

```jsonc
// 15% 的概念需要文字轉換
{
  "astNodeType": "string_literal",
  "concept": { "conceptId": "string_literal" },
  "fieldMappings": [
    { "semantic": "value", "ast": "$text", "extract": "text", "transform": "stripQuotes" }
  ]
}
```

```typescript
// 核心提供少量通用 transform
coreTransforms.register('stripQuotes', (t) => t.replace(/^["']|["']$/g, ''))

// C++ 語言模組註冊自己的
cppTransforms.register('stripComment', (t) => {
  if (t.startsWith('//')) return t.slice(2).trim()
  if (t.startsWith('/*')) return t.slice(2, -2).trim()
  return t
})

// 未來 Python 模組可以註冊自己的，不需要改核心
pythonTransforms.register('stripFString', (t) => t.replace(/^f["']|["']$/g, ''))
```

**Layer 3 — JSON + 具名 strategy**：對於真正複雜的邏輯（條件概念路由、深層巢狀提取、動態欄位生成），JSON 中引用一個完整的 strategy 函數。Strategy 函數由語言模組註冊，擁有完全的 lift/render 控制權。

```jsonc
// 5% 的概念需要完全自訂邏輯
{
  "astNodeType": "function_definition",
  "concept": { "conceptId": "func_def" },
  "liftStrategy": "cpp:liftFunctionDef"
}
```

```jsonc
// Renderer 側同理
{
  "conceptId": "var_declare",
  "renderStrategy": "cpp:renderVarDeclare"
}
```

**三個 Registry 介面**：

```typescript
// Transform: 純文字轉換（Layer 2）
interface TransformRegistry {
  register(name: string, fn: (text: string) => string): void
  get(name: string): ((text: string) => string) | null
}

// Lift Strategy: AST → SemanticNode（Layer 3，完全控制 lift 邏輯）
interface LiftStrategyRegistry {
  register(name: string, fn: (node: AstNode, ctx: LiftContext) => SemanticNode | null): void
  get(name: string): LiftStrategyFn | null
}

// Render Strategy: SemanticNode → BlockState（Layer 3，完全控制 render 邏輯）
interface RenderStrategyRegistry {
  register(name: string, fn: (node: SemanticNode) => BlockState | null): void
  get(name: string): RenderStrategyFn | null
}
```

**核心引擎只有一條管線**：PatternLifter / PatternRenderer 是唯一路徑。遇到 `transform` 欄位就查 TransformRegistry，遇到 `liftStrategy` / `renderStrategy` 就查 StrategyRegistry。不存在「兩條管線競爭 + 黑名單切換」的問題。

**判定法**：讀一個概念的 JSON 定義，就能知道它的完整行為——純宣告（Layer 1）、引用哪個 transform（Layer 2）、或引用哪個 strategy（Layer 3）。不需要搜尋散落在核心引擎中的 switch-case。

**各層的職責邊界**：

| 層 | JSON 負責 | 程式碼負責 | 範例 |
|---|---|---|---|
| Layer 1 | 完整定義 | 無 | `break`, `number_literal`, `arithmetic` |
| Layer 2 | 結構 + 引用 transform 名 | transform 函數實現 | `string_literal`, `comment` |
| Layer 3 | 概念聲明 + 引用 strategy 名 | strategy 函數實現 | `function_definition`, `var_declare` |

**擴充性保證**：加新語言時——
- Layer 1 概念：只加 JSON
- Layer 2 概念：加 JSON + 在語言模組中註冊 transform 函數
- Layer 3 概念：加 JSON + 在語言模組中註冊 strategy 函數
- **以上三者都不需要修改核心引擎程式碼**

#### Language Layer 的子模組結構

```
Language Layer (e.g., C++)
├── Core     — 語言核心語法（pointer, struct, template）
├── Stdlib   — 標準函式庫
│   ├── containers (vector, map, set, stack, queue...)
│   ├── algorithms (sort, find, binary_search...)
│   ├── io (cout, printf, scanf...)
│   └── strings (strlen, strcmp, string methods...)
└── External — 第三方函式庫（未來擴充點）
    ├── opencv
    └── ...
```

#### 套件積木的標準定義格式

一個 JSON 物件包含四個維度的完整定義：

```jsonc
{
  // 身份
  "id": "cpp_find",
  "language": "cpp",
  "category": "algorithms",

  // 語義層：這個概念是什麼
  "concept": {
    "abstractConcept": "collection_search",   // 映射到哪個抽象概念
    "role": "container",                       // 語義角色
    "signature": {                             // 型別簽名
      "params": ["iterator", "iterator", "value"],
      "returns": "iterator"
    }
  },

  // 積木層：使用者看到什麼
  "blockDef": { "type": "cpp_find", "message0": "...", "colour": "#4C97FF" },

  // 程式碼層：產生什麼 code
  "codeTemplate": {
    "pattern": "std::find(${BEGIN}, ${END}, ${VALUE})",
    "imports": ["algorithm"]
  },

  // AST 層：怎麼從 code 認回來
  "astPattern": {
    "nodeType": "call_expression",
    "constraints": [{ "field": "function", "text": "find" }]
  }
}
```

#### 概念的生命週期

描述一個概念從「不存在」到「完全支援」的漸進過程：

```
階段 0: 不認識         → raw_code 降級
階段 1: 認識但無積木    → 通用 func_call 降級
階段 2: 有專屬積木      → 完全支援
階段 3: 有 abstract 映射 → 可跨語言轉換
```

這直接定義了「為外部套件寫積木」的路線圖。

---

### P4：漸進揭露（Progressive Disclosure）

> 同一個語義結構，在不同認知維度顯示不同的概念子集和結構範圍。

P4 有兩個正交的維度：**概念層級**（Concept Level，看到哪些概念）和**結構範圍**（Structure Scope，看到多大的結構）。

#### 概念層級（Concept Level）

```
L0 初學：只看到 Universal 概念
         (變數、if、迴圈、函式、輸入輸出)

L1 進階：看到 Universal + Lang-Core
         (+ 指標、struct、switch、for)

L2 高階：看到全部
         (+ template、STL 容器、algorithm)
```

#### 結構範圍（Structure Scope）

```
S0 語句：只看到單一語句                    → 初學者從這裡開始
S1 函式：看到函式內的完整邏輯              → 學會「把步驟包成函式」
S2 檔案：看到一個檔案的完整結構            → 學會「一個檔案是一個翻譯單元」
S3 模組：看到多個檔案組成的模組            → 學會「封裝和介面」
S4 專案：看到模組之間的依賴和呼叫          → 學會「系統架構」
S5 系統：看到多個專案/服務之間的互動        → 學會「分散式系統」
```

兩個維度的組合形成完整的學習路徑：

```
初學者:     L0 × S0-S1  （簡單概念 + 語句/函式範圍）
進階學習者: L1 × S1-S2  （語言概念 + 函式/檔案範圍）
高階學習者: L2 × S2-S3  （全部概念 + 檔案/模組範圍）
系統架構師: L2 × S3-S5  （全部概念 + 模組/專案/系統範圍）
```

**重要**：這不是簡化，是**過濾**。語義結構始終是完整的，只是投影時隱藏了超出層級的節點和超出範圍的結構。

```
L0 使用者看到：  [呼叫函式 sort (...)]       // 通用 func_call 積木
L2 使用者看到：  [排序 v.begin() 到 v.end()]  // 專屬 sort 積木
```

兩者的語義結構完全相同，只是投影的「解析度」不同。這與 P2 的降級策略自然銜接——低層級使用者看到的就是「降級後」的投影。

#### P4 與投影種類的關係

不同 scope 層級自然對應不同的最佳投影種類（viewType）：

| Scope | 最有價值的投影 | 教學目的 |
|-------|-------------|---------|
| S0-S1 語句/函式 | 積木、程式碼、流程圖、執行動畫 | 理解結構、語法、行為、狀態 |
| S2 檔案 | 程式碼、積木、檔案大綱 | 理解翻譯單元的組成 |
| S3 模組 | 程式碼、模組介面圖、類別階層圖 | 理解封裝和抽象 |
| S4 專案 | 架構圖、依賴圖、呼叫圖 | 理解系統架構 |
| S5 系統 | 系統拓撲圖、資料流圖 | 理解分散式系統 |

多個視圖可以**同時顯示**——積木看結構、程式碼看語法、流程圖看行為、執行動畫看狀態。所有視圖從同一個語義結構衍生，一致性由根公理保證。

#### P4 與認知負荷的關係

P4 的分層機制直接服務於認知負荷理論：

- **L0 初學者**：鷹架最強——大量外在負荷被積木形狀消除，概念集最小以降低內在負荷
- **L1 進階者**：鷹架適度——引入語言專屬概念，學習者開始承擔更多內在負荷
- **L2 高階者**：鷹架最弱——接近文字程式碼的表達力，準備過渡到純文字

層級切換不是「降低難度」，而是**控制在 ZPD 內可見的概念數量**。

#### 認知分層對積木文字的影響

| 層級 | 積木類型 | Message 策略 | Tooltip 策略 |
|------|---------|-------------|-------------|
| L0 初學 | Universal | 完全口語 | 生活比喻 |
| L1 進階 | Basic | 保留關鍵術語 | 技術說明 + 場景 |
| L2 高階 | Advanced | 可用更多術語 | 重點放在「什麼時候用」 |

---

## 六維架構

```
┌─ Scope ─────────────────── 觀察範圍（語句→系統）──┐
├─ View Type ────────────── 投影種類（程式碼/積木/...）┤
├─ Locale（zh-TW / en）──── 控制積木文字 ───────────┤
├─ Block Style ──────────── 控制積木排版外觀 ────────┤
├─ Concept Layer ─────────── 積木結構、概念代數 ──────┤
├─ Language Layer ────────── 型別、語言專屬積木 ──────┤
├─ Code Style Layer ──────── 程式碼生成風格 ──────────┤
└──────────────────────────────────────────────────┘
```

每一層獨立可配置、獨立可擴充：
- 換觀察範圍 = 切 Scope（zoom in/out）
- 加新視圖種類 = 加 View Type（新增 renderer）
- 加新 locale = 加翻譯檔
- 換積木外觀 = 切 Block Style preset
- 改積木結構 = 只動 Concept Layer
- 加新語言 = 加 Language Layer
- 加新套件 = 在 Language Layer 加子模組
- 加新程式碼風格 = 加 Code Style preset

---

## 各子系統的應用指引

### 做 i18n（積木文字國際化）時

```
P1 → Locale 是投影參數，不是寫死的字串
根公理 → message/tooltip 是呈現資訊，不屬於積木結構定義
       → 分離到 locale 檔案
```

### 做 coding style（程式碼編碼風格切換）時

```
P1 → Code Style 是投影參數，generator 接受 style config
根公理 → 縮排、命名、大括號位置是呈現資訊
P1 → Parser 必須能辨識不同風格（可逆性）
     切換風格 = 用不同參數重新投影，語義樹不動
```

### 做 block style（積木排版風格切換）時

```
P1 → Block Style 是投影參數，renderer 接受 blockStyle config
根公理 → inputsInline、延伸方向、配色、密度是呈現資訊，不屬於語義
P1 → 切換 Block Style = 用不同參數重新渲染積木，語義樹不動
     同一積木可以水平排列也可以垂直排列，語義完全相同
S4 → Block Style 的預設值應符合學習者的閱讀習慣
     簡單積木（少欄位）預設水平，複雜積木（多欄位）預設垂直
```

### 做多語言支援時

```
P2 → 區分 universal / lang-core / lang-library 三層概念
P1 → Language 是投影參數，型別清單由語言模組注入
P2 → 跨語言轉換走 abstract concept 映射，無法對應的概念走降級策略
```

### 做雙向轉換時

```
根公理 → 建立顯式的語義樹，不要讓 Blockly workspace 直接當 model
P1 → lift(parse(project(S))) ≡ S 是正確性的判定標準
根公理 → Parser 需要額外輸出 style metadata（偵測到的風格）
P2 → 無法解析的程式碼不是 error，是降級成 raw_code
P2a′ → 每個概念的四條路徑（lift/render/extract/generate）缺一不可
       新增概念後跑靜態覆蓋檢查，確認無 coverage gap
P3 → Pattern Engine 是唯一管線；簡單概念用 JSON（Layer 1），
     需要文字轉換用 transform（Layer 2），複雜概念用 strategy（Layer 3）
     不允許核心引擎出現雙管線競爭或黑名單切換
```

### 做積木設計時

```
S3 認知一致性 → 一個積木映射到一個語法結構，不多不少
   違反案例：u_var_declare 用 mutator 把多個宣告塞進一個積木
             → 學習者以為「宣告」是一次性動作，實際上每個變數獨立存在
   正確做法：一個積木 = 一行宣告（int x = 5;），多個變數用多個積木

S2 鷹架可退場 → 積木概念必須在文字程式碼中有直接對應
   違反案例：積木引入「計數迴圈」概念但文字程式碼只有 for(;;)
             → 只要生成的程式碼結構可辨識，這個鷹架就是合法的
   檢驗方法：學習者切到文字模式後，能否不靠積木理解生成的程式碼？

S4 最小驚訝 → 積木行為和生成的程式碼一致
   違反案例：積木 message 寫「設定值」但生成 x = x + 1
             → 積木文字和程式碼語義不對應
   檢驗方法：讀積木文字 → 預測程式碼 → 和實際生成的比較

S1 鷹架可調 → 同一概念在不同層級提供不同程度的輔助
   L0：完全口語化 message + 強型別約束（拖不進去就是型別錯）
   L1：引入術語 + 放寬約束（允許更多表達式組合）
   L2：接近文字語法 + 最少約束

CLT → 每個積木應最小化外在認知負荷
   message 回答「做什麼」而非「怎麼做」
   tooltip 一句定義 + 一句場景 + 注意事項
   dropdown 選項按認知層級過濾
```

### 為外部套件寫積木時

```
P2 → 辨識語義角色，找到或建立 abstract concept
P3 → 只加 JSON（blockDef + codeTemplate + astPattern + concept）
P4 → 決定積木出現在哪個認知層級
P1 → 確認 code → blocks → code 來回無損
```

---

## 積木文字設計準則（從 P1 + P4 推導）

### Message 設計

- **動詞 + 身份 + 名稱**：每個 message 回答「對誰做什麼」
- 身份標示系統：變數、函式、陣列、列表、指標、結構
- 用概念詞不用語言術語（型別名稱只出現在 dropdown 裡）
- 積木串起來讀起來要像一段中文敘述

### Tooltip 設計

- 統一公式：**一句定義 + 一句場景 + （注意事項）**
- Universal 積木用生活比喻，Advanced 積木重點放在「什麼時候用」
- 語言模組可覆蓋 tooltip（加入語言特定細節）

### Dropdown 設計

- 型別格式統一：`英文術語（中文）`，如 `int（整數）`
- 型別清單由語言模組提供，不寫死在 universal 積木裡
- 運算子格式：`中文（符號）`，如 `加上（+=）`

---

## Code Style 配置結構

### Code Style Preset 範例

```
APCS 考試:    cout/cin, camelCase*, K&R, 4-space, using namespace std
競賽:         printf/scanf, snake_case*, K&R, 4-space, bits/stdc++.h
Google Style: cout/cin, snake_case*, K&R, 2-space, 不用 using namespace

* naming convention 僅影響新建變數的預設名稱格式，不轉換既有變數名稱（參見根公理「變數命名」段落）
```

### Code Style 三大功能

1. **使用者選擇**：切換 preset → 積木不動，重新生成程式碼
2. **自動偵測**：貼入程式碼 → 分析 I/O 方式、命名、縮排、namespace → 匹配最接近的 preset
3. **風格互轉**：Code(Style A) → Parser → 積木(無風格) → Generator(Style B) → Code(Style B)

### Code Style 對工具箱的影響

- APCS 風格 → 顯示 u_print (cout)，隱藏 c_printf
- 競賽風格 → 顯示 c_printf，隱藏 u_print
- 混合 → 兩者都顯示

## Block Style 配置結構

### Block Style Preset 範例

```
Scratch 風格:  zelos renderer, compact density, scratch 配色, 預設 inline
經典風格:      geras renderer, normal density, classic 配色, 預設 external
教學風格:      zelos renderer, spacious density, 高對比配色, 複雜積木垂直展開
```

### Block Style 控制的面向

| 面向 | 選項 | 影響 |
|------|------|------|
| **Renderer** | zelos / geras | 積木的基本形狀（圓角 vs 方角） |
| **Density** | compact / normal / spacious | 積木間距、欄位間距 |
| **Colour scheme** | scratch / classic / custom | 各概念類別的顏色 |
| **Inputs inline** | true / false / auto | 欄位水平或垂直排列 |
| **Orientation** | horizontal / vertical | 多值積木（如 print 多個值）的延伸方向 |

### Block Style 不影響的東西

- 語義樹結構（改排版不改語義）
- 積木文字內容（由 Locale 控制）
- 程式碼生成結果（由 Code Style 控制）
- 可用積木集合（由 Language + P4 Level 控制）

---

## 最終檢驗

任何未來的設計決策，都應該能回到這些原則之一：

| 問題 | 回到哪條 |
|------|---------|
| 積木和程式碼不一致了 | **根公理**：它們應該是同一棵樹的投影 |
| 要不要支援某個功能 | **P1**：它能無損來回嗎？ |
| 這段程式碼轉不了怎麼辦 | **P1**：不存在轉不了——只有降級程度，且降級必須可見 |
| 這個積木該歸哪類 | **P2**：它映射到哪個抽象概念？ |
| 怎麼知道測試夠不夠完整 | **P2a′**：ConceptRegistry 每個條目的四條路徑都通過嗎？ |
| 加新套件要改哪些檔案 | **P3**：只加 JSON，不改既有程式碼 |
| 初學者看到太多積木 | **P4**：過濾層級，不是刪除概念 |
| 這個積木設計對學習者有幫助嗎 | **S3**：它映射到真實的程式結構嗎？ |
| 積木應該多複雜 | **CLT**：最小化外在負荷，一個積木做一件事 |
| 積木會不會變成依賴 | **S2**：學習者切到文字後能不靠積木理解程式碼嗎？ |
| 積木排版要水平還是垂直 | **Block Style**：這是投影參數，不是結構決策 |
| 要不要支援多檔案 | **根公理**：語義結構在檔案內是樹、檔案間是圖，Scope 3+ 加圖邊即可 |
| 該用什麼方式呈現 | **P1**：scope + viewType 決定投影，所有視圖從同一結構衍生 |
| 外部套件不理解怎麼辦 | **P2 降級 + WASM**：黑箱函式透過語義契約引用、透過 WASM 執行 |
| 怎麼讓程式可以共享 | **語義套件**：共享語義結構 + 投影定義 + WASM 執行體 |

---

## 已知的實作挑戰

本框架在原則層面完備，但以下三點在實作時需要額外設計：

1. **語義阻抗（Semantic Impedance）**：記憶體管理（new/delete vs ownership vs GC）、並行模型（goroutine vs async/await vs pthread）等深層語言特性，無法用 abstract concept 跨語言映射。應走 P2 降級路徑，並在轉換時標記「需人工調整」而非靜默降級。

2. **註解歸屬歧義**：語義樹中註解是獨立平級節點，但 UI 層面拖拽積木時，視覺上相鄰的註解是否應自動跟隨？這需要 Block Style 層的「吸附」邏輯，不改變語義模型。

3. **lift() 性能**：目前轉換是使用者主動觸發（非即時同步），全量 lift 在教學場景的程式碼規模下不構成瓶頸。若未來需要支援即時同步或處理大型檔案，可考慮增量 parse（tree-sitter 原生支援）搭配延遲 lift。

---

## 願景：語義網路與 WASM 執行

從根公理和 Scope 分層自然延伸出的長期方向。

### 執行也是投影

「執行」是語義結構的一種投影——不是生成文字或圖形，而是生成**行為**：

```
view = project(structure, scope, execution, { runtime })

每個語義節點有對應的 execute() 語義：
  execute(count_loop) = 初始化 i → 檢查條件 → 執行 body → 步進 → 重複
  execute(print)      = 把值輸出到虛擬 console
  execute(func_call)  = 查找函式定義 → 執行函式體 → 回傳結果
```

這使得語義直譯器（Semantic Interpreter）成為可能——直接走訪語義結構來執行程式，而不需要先生成程式碼再編譯。

### WASM 作為黑箱的執行橋

對於系統無法完全理解的外部套件（黑箱函式），WASM 提供了執行能力：

```
已知概念（count_loop, print, var_assign, ...）
  → 語義直譯器直接解釋執行（逐步、可視覺化）

黑箱函式（sort, regex, opencv, ...）
  → 編譯成 WASM → 在瀏覽器中呼叫 → 拿回結果繼續走
```

這與 P2 的概念成熟度自然銜接：

```
階段 0: 不認識        → raw_code  → 整段丟給 WASM 執行（如果有的話）
階段 1: 認識但無積木   → func_call → WASM 執行，只看輸入輸出
階段 2: 有專屬積木     → 完全理解  → 語義直譯器逐步執行、可視覺化
```

對學習者來說，黑箱是合理的——你不需要理解 `sort` 的內部實作，你只需要知道「丟進去一個陣列，出來一個排好的陣列」。WASM 讓黑箱真的能跑。

### 語義套件（Semantic Packages）

如果程式是語義結構而不是文字檔，共享的單位也應該是語義結構：

```
Semantic Package = 語義契約 + 投影定義 + 執行體

語義契約（Semantic Contract）：
  concept: sort
  input:   array<T> where T: comparable
  output:  array<T>（已排序）

投影定義（Projections）：
  L0 積木:  [排序 ▼陣列]
  L2 積木:  [sort( v.begin(), v.end() )]
  C++ code: std::sort(v.begin(), v.end())
  Python:   sorted(arr)

執行體（Implementations）：
  cpp.wasm   — 從 std::sort 編譯
  rust.wasm  — 從 slice::sort 編譯
  js native  — Array.prototype.sort
```

消費者不需要懂原始語言——他們引用的是**語義概念**，執行的是 WASM，看到的是自己層級的投影。

### 互聯網式的語義網路

語義套件可以發佈到共享的 **Semantic Package Registry**，形成互聯網式的語義結構：

```
我的程式（語義樹）
  ├── 引用 @stdlib/sort      （標準庫，WASM 執行）
  ├── 引用 @stdlib/io        （I/O，瀏覽器 API 橋接）
  ├── 引用 @community/matrix （社群分享的矩陣運算）
  └── 引用 @school/grading   （老師分享的評分函式）
```

每個引用節點在語義結構中是一個 `semantic_package_ref`，帶有語義契約。執行時透過 WASM 呼叫實際實作。投影時根據使用者的 Concept Level 和 Locale 顯示對應的積木或程式碼。

### 教學場景

```
老師：
  寫一個「計算 BMI」語義套件 → 發佈到 classroom registry

學生 A（L0 初學者）：
  在工具箱看到 [計算 BMI 體重 身高] 積木
  → 拖拽使用 → 點執行 → WASM 真的算出結果

學生 B（L1 進階）：
  點「展開」→ 看到老師的實作（積木 + 程式碼並排）
  → 理解內部邏輯 → 嘗試修改

學生 C（L2 高階）：
  fork 老師的套件 → 改寫實作 → 發佈自己的版本
  → 其他同學可以引用

老師（Scope 4 視角）：
  看到全班的語義圖 → 誰引用了誰 → 誰修改了什麼
  → 理解每個學生的學習軌跡
```

這是 P4 漸進揭露的終極形態——同一個語義套件，初學者看到積木、進階者看到實作、老師看到全局。

### 需要注意的工程約束

- **WASM 不是萬能的**：依賴 OS API 的函式（檔案系統、網路）需要瀏覽器端的 polyfill 或明確限制
- **安全性**：執行他人的 WASM 需要沙箱隔離，語義契約需要驗證機制
- **版本相容性**：語義結構的版本管理比文字原始碼更複雜（語義契約的演進）
- **語義契約的正確性**：如何驗證一個 WASM 模組真的符合它宣稱的語義契約？可能需要屬性測試（property-based testing）

這些是工程問題，不是原則問題。從第一性原理來看，這個方向完全一致——程式是語義結構，WASM 是執行投影，共享是語義網路的自然延伸。

---

## 一句話總結

> **程式是語義結構——檔案內是樹、檔案間是圖、系統間是超圖。程式碼、積木、流程圖、執行都是它的參數化投影，由 scope 和 viewType 決定觀察角度。概念形成可分層、可映射的代數結構，可封裝為語義套件透過 WASM 執行與共享。系統透過開放擴充成長，透過漸進揭露（概念層級 × 結構範圍）適應從初學者到系統架構師的所有使用者。積木是認知鷹架——降低外在負荷、在近側發展區內引導學習，並最終退場。**
