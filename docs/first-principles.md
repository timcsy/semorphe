# First Principles：程式碼與積木雙向轉換系統

**建立日期**: 2026-03-04
**最後更新**: 2026-03-06
**適用範圍**: i18n、coding style、多語言支援、雙向轉換、套件擴充——所有子系統共用

---

## 根公理：程式是一棵語義樹

一個程式有三種存在形態：

```
「把 x 加 1」          ← 意圖（人腦中的想法）
「x++;」              ← 文字投影（程式碼）
[變數 x 加1（++）]     ← 視覺投影（積木）
```

程式碼不是程式本身，積木也不是程式本身。程式的本質是：

> **一棵由「概念節點」組成的樹。每個節點 = (概念類型, 屬性, 子節點)。**

程式碼是這棵樹的文字序列化。積木是這棵樹的視覺序列化。tree-sitter 產生的 AST 是 parser 的中間產物，**接近但不等於**語義樹。

從根公理直接推導：
- 樹是唯一真實（唯一的權威表示）
- 程式碼和積木都是衍生的（不是真實本身）
- 節點的概念類型和屬性是語義，序列化方式是呈現（語義與呈現分離）

### AST ≠ 語義樹

```
// 這兩段 code 的 AST 不同，但語義樹相同：
printf("hello");     // AST: call_expression(function="printf")
cout << "hello";     // AST: shift_expression(operator="<<")
                     // 語義樹: print(values: ["hello"])
```

AST 是語法層的產物，語義樹是意圖層的產物。從 AST 到語義樹的過程稱為 `lift()`（語義提升）。

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

> 語義樹有多種等價表示，每種表示是一個**參數化、可逆的投影**。

#### 投影管線

```
code   = project(tree, language, style)       // Generator
blocks = project(tree, language, locale)       // Renderer
AST    = parse(code, language)                 // Parser（語法解析）
tree   = lift(AST, language)                   // Lifter（語義提升）
```

- 使用者在積木編輯器拖積木 → 修改語義樹 → 重新投影成程式碼
- 使用者在程式碼編輯器打字 → parse 成 AST → lift 成語義樹 → 重新投影成積木
- 兩邊永遠從同一棵樹衍生，不可能不一致

#### 三個正交參數

| 參數 | 影響什麼 | 不影響什麼 |
|------|---------|-----------|
| **Language**（程式語言） | 兩邊都影響：能用的概念、型別、語法 | — |
| **Style**（編碼風格） | 只影響程式碼：格式、命名、慣例 | 不影響積木外觀 |
| **Locale**（介面語言） | 只影響積木：message、tooltip、dropdown label | 不影響程式碼 |

**正交性的精確定義**：Language 是基底參數，它決定 Style 和 Concept 的**可用空間**，但不決定在空間內的選擇。Style 和 Locale 在各自空間內完全獨立。

```
Style 空間 = Universal Style Options × Language-Specific Style Options

Universal Style Options（所有語言共有）:
  indent_size: 2 | 4
  brace_style: 'K&R' | 'Allman'
  naming: 'camelCase' | 'snake_case'

Language-Specific Style Options（僅特定語言有意義）:
  C++: io_style: 'cout' | 'printf'
  C++: namespace_style: 'using' | 'explicit'
  C++: header_style: 'bits' | 'individual'
```

類比：Language 決定棋盤大小，Style 決定棋子位置。棋盤大小和棋子位置不是同一個維度，但棋子位置受限於棋盤——這不違反正交性。

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
| 新套件積木 | + block JSON（定義+模板+AST pattern） | 無 |
| 新語言概念 | + block JSON + generator rule | 無 |
| 新通用概念 | + UniversalConcept type | concept-registry（加一行） |
| 新語言 | + language module | 無（plugin 式載入） |

**判定法**：如果加一個外部套件的積木需要改 `blockly-editor.ts`，代表架構有耦合。目標是只加 JSON。

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

> 同一棵語義樹，在不同認知層級顯示不同的概念子集。

```
L0 初學：只看到 Universal 概念
         (變數、if、迴圈、函式、輸入輸出)

L1 進階：看到 Universal + Lang-Core
         (+ 指標、struct、switch、for)

L2 高階：看到全部
         (+ template、STL 容器、algorithm)
```

**重要**：這不是簡化，是**過濾**。語義樹始終是完整的，只是投影時隱藏了超出層級的節點。

```
L0 使用者看到：  [呼叫函式 sort (...)]       // 通用 func_call 積木
L2 使用者看到：  [排序 v.begin() 到 v.end()]  // 專屬 sort 積木
```

兩者的語義樹完全相同，只是投影的「解析度」不同。這與 P2 的降級策略自然銜接——低層級使用者看到的就是「降級後」的投影。

#### 認知分層對積木文字的影響

| 層級 | 積木類型 | Message 策略 | Tooltip 策略 |
|------|---------|-------------|-------------|
| L0 初學 | Universal | 完全口語 | 生活比喻 |
| L1 進階 | Basic | 保留關鍵術語 | 技術說明 + 場景 |
| L2 高階 | Advanced | 可用更多術語 | 重點放在「什麼時候用」 |

---

## 四維架構

```
┌─ Locale（zh-TW / en）─── 控制人看的文字 ──────────┐
├─ Concept Layer ──── 積木結構、概念代數 ──────────── ┤
├─ Language Layer ─── 型別、語言專屬積木、套件擴充 ──── ┤
├─ Style Layer ────── 程式碼生成風格 ─────────────── ┤
└──────────────────────────────────────────────────┘
```

每一層獨立可配置、獨立可擴充：
- 加新 locale = 加翻譯檔
- 改積木結構 = 只動 Concept Layer
- 加新語言 = 加 Language Layer
- 加新套件 = 在 Language Layer 加子模組
- 加新風格 = 加 Style preset

---

## 各子系統的應用指引

### 做 i18n（積木文字國際化）時

```
P1 → Locale 是投影參數，不是寫死的字串
根公理 → message/tooltip 是呈現資訊，不屬於積木結構定義
       → 分離到 locale 檔案
```

### 做 coding style（編碼風格切換）時

```
P1 → Style 是投影參數，generator 接受 style config
根公理 → 縮排、命名、大括號位置是呈現資訊
P1 → Parser 必須能辨識不同風格（可逆性）
     切換風格 = 用不同參數重新投影，語義樹不動
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

## Coding Style 配置結構

### Style Preset 範例

```
APCS 考試:    cout/cin, camelCase*, K&R, 4-space, using namespace std
競賽:         printf/scanf, snake_case*, K&R, 4-space, bits/stdc++.h
Google Style: cout/cin, snake_case*, K&R, 2-space, 不用 using namespace

* naming convention 僅影響新建變數的預設名稱格式，不轉換既有變數名稱（參見根公理「變數命名」段落）
```

### Style 三大功能

1. **使用者選擇**：切換 preset → 積木不動，重新生成程式碼
2. **自動偵測**：貼入程式碼 → 分析 I/O 方式、命名、縮排、namespace → 匹配最接近的 preset
3. **風格互轉**：Code(Style A) → Parser → 積木(無風格) → Generator(Style B) → Code(Style B)

### Style 對工具箱的影響

- APCS 風格 → 顯示 u_print (cout)，隱藏 c_printf
- 競賽風格 → 顯示 c_printf，隱藏 u_print
- 混合 → 兩者都顯示

---

## 最終檢驗

任何未來的設計決策，都應該能回到這五句話之一：

| 問題 | 回到哪條 |
|------|---------|
| 積木和程式碼不一致了 | **根公理**：它們應該是同一棵樹的投影 |
| 要不要支援某個功能 | **P1**：它能無損來回嗎？ |
| 這個積木該歸哪類 | **P2**：它映射到哪個抽象概念？ |
| 加新套件要改哪些檔案 | **P3**：只加 JSON，不改既有程式碼 |
| 初學者看到太多積木 | **P4**：過濾層級，不是刪除概念 |

---

## 一句話總結

> **程式是一棵語義樹，程式碼和積木都是它的參數化投影。概念形成可分層、可映射的代數結構。系統透過開放擴充成長，透過漸進揭露適應不同使用者。**
