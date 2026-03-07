# First Principles：程式碼與積木雙向轉換系統

**建立日期**: 2026-03-04
**最後更新**: 2026-03-07
**適用範圍**: i18n、coding style、多語言支援、雙向轉換、套件擴充——所有子系統共用

---

# 第一層：理論基礎

## 1. 根公理：程式是語義結構

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
Scope 1 函式（Function）   → 子樹
Scope 2 檔案（File）       → 語義樹
Scope 3 模組（Module）     → 語義子圖（檔案間有引用關係）
Scope 4 專案（Project）    → 語義圖（模組間的依賴、呼叫、資料流）
Scope 5 系統（System）     → 語義超圖（跨專案互動 + 語義套件）
```

**Scope 0-2 是樹**（已實現），**Scope 3-5 是圖**（未來擴展）。每一層是前一層的**組合**，不是替換。

```
節點間的關係分兩類：

結構關係（樹邊，Scope 0-2）：
  parent-child — 語法巢狀（if 包含 then_body）

引用關係（圖邊，Scope 3+）：
  calls / imports / uses_type / extends / depends_on
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

---

## 2. 語用學基礎

語言學將語言分析分為三層：

```
語法（Syntax）     → 形式規則：句子怎麼組合        → AST
語義（Semantics）  → 字面意義：句子是什麼意思       → 語義結構
語用（Pragmatics） → 語境意義：在這個情境下想做什麼  → lift() 的推斷
```

**lift() 的本質是語用分析**——根據上下文推斷程式碼的意圖：

| 語法結構 | 語用推斷 | 推斷依據 |
|---------|---------|---------|
| `for(int i=0;i<n;i++)` | `count_loop` | **慣用語辨識**：init + cond + update 的模式 |
| `cout << x << endl` | `print` | **身份辨識**：`cout` 是什麼東西 |
| `printf("%d", x)` | `print` | **名稱辨識**：`printf` 的已知語義 |
| `i++`（在迴圈末尾） | 迴圈步進 | **位置上下文**：出現在 for 的 update 位置 |
| `i++`（獨立語句） | `cpp_increment` | **位置上下文**：出現在 statement 位置 |

語用分析解釋了四件設計決策：

1. **為什麼 lift() 需要符號表和作用域棧**——語用分析需要上下文
2. **為什麼 Pattern Engine 有三層**——Layer 1（JSON）處理純語義映射，Layer 2-3 處理需要語用推斷的情況
3. **為什麼降級存在**——語用分析是推斷，推斷可能失敗
4. **為什麼高 Scope 比低 Scope 難**——Scope 0-2 的語用推斷相對局部，Scope 3+ 需要跨檔案語境

```
語用分析的複雜度隨 Scope 急劇上升：

Scope 0-2（檔案內）：慣用語辨識、名稱推斷 → 目前的 lift() 已能處理
Scope 3（模組）：  跨檔案命名慣例和使用模式 → 需要模組級分析
Scope 4（專案）：  依賴方向和模組角色推斷   → 需要專案級分析
Scope 5（系統）：  服務角色和互動模式       → 需要系統級分析
```

**語用分析的結果融入語義結構，不另存一層**：`count_loop` 而非 `for_statement` 的概念選擇本身就包含了語用判斷。`metadata.confidence` 標記語用推斷的確定程度。

---

## 3. 資訊分類學

程式中的資訊分為四類：

| | 語義 | 呈現 | 元資訊 | 語法偏好 |
|---|---|---|---|---|
| **定義** | 改行為 | 改外觀 | 不改行為有資訊價值 | 不改行為但使用者有意識的選擇 |
| **程式碼側** | 變數名、型別、邏輯 | 縮排、空行、命名風格 | 註解、pragma | `+=` vs `= x+1` |
| **積木側** | 連接關係、field 值 | 位置、顏色、tooltip | block comment | — |
| **儲存** | 語義樹節點 | metadata | annotation | metadata.syntaxPreference |
| **round-trip** | 必須保留 | 可丟失 | best-effort | best-effort |

### 註解模型

註解不改變程式行為，但丟了會導致系統無法用於現有專案維護。

**行尾註解（inline comment）** — 附著標註，跟著宿主節點走：

```
x = 1; // set x
  → annotation on node(x=1), position: 'inline'
```

**獨立註解（standalone comment）** — 無操作的平級節點：

```
// section header    ← 不屬於上一行，也不屬於下一行
x = 1;
  → children: [node('comment', {text: 'section header'}), node('var_assign', ...)]
```

**表達式內部的註解** — 附著在子節點上，跟著子節點走：

```
foo(a, /* 重要參數 */ b);
  → arg[1]: identifier(b) + annotations: [{position: 'before', text: '重要參數'}]
```

annotation 可以附著在語義樹**任何層級**的節點上。獨立註解作為平級節點可以避免「最近節點」啟發式導致的註解漂移。

```typescript
interface SemanticNode {
  concept: ConceptType
  properties: Record<string, PropertyValue>
  children: Record<string, SemanticNode[]>
  annotations?: Annotation[]
}

interface Annotation {
  type: 'comment' | 'pragma' | 'lint_directive'
  text: string
  position: 'before' | 'after' | 'inline'
}
```

### 語法偏好

某些語法結構語義等價但使用者有意識地選擇了特定寫法（如 `x += 1` vs `x = x + 1`）。記錄在 metadata 中，project() 時優先使用原始寫法：

```typescript
{
  concept: 'var_assign',
  properties: { name: 'x', operator: '+=' },
  metadata: { syntaxPreference: 'compound_assign' }
}
```

### 變數命名的邊界

變數名是語義資訊（`myVar` 和 `my_var` 是不同變數）。**Style 不能自動轉換既有變數名稱**——這是 rename refactoring，不是 style switch。Style 只控制新建變數的命名建議格式和程式碼的純呈現格式。

### lift() 的狀態模型

lift() 在**單次調用內**維護作用域棧 + 局部符號表。**跨次調用之間**不共享狀態。Style 切換不影響 lift() 的符號表——確保 lift() 與 Style 不耦合。

---

## 4. 教育學定位

> **積木是認知鷹架（cognitive scaffolding），不是替代品。**
> 其設計目標是降低外在認知負荷，讓學習者在近側發展區內建立程式設計的心智模型，並最終過渡到文字程式碼。

### 認知負荷理論（Cognitive Load Theory, Sweller 1988）

| 類型 | 定義 | 積木系統的角色 |
|------|------|--------------|
| **內在負荷**（Intrinsic） | 學習材料本身的複雜度 | 不可消除——程式邏輯就是那麼複雜 |
| **外在負荷**（Extraneous） | 不良教學設計帶來的額外負擔 | **積木的首要任務是消除這類負荷** |
| **增生負荷**（Germane） | 建立心智模型的有益負荷 | 積木應引導學習者投入這類負荷 |

積木消除外在負荷的方式：語法記憶→拖拽選擇、型別錯誤→形狀約束、結構錯誤→巢狀限制。

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

### 鷹架設計的四個推導原則

```
CLT + ZPD
  ├─ S1 鷹架可調性：同一概念在不同層級有不同的鷹架強度（對應 P4）
  ├─ S2 鷹架可退場：積木不可引入文字程式碼中不存在的概念
  ├─ S3 認知一致性：一個積木 = 一個語法結構，不多不少
  └─ S4 最小驚訝：積木行為和生成的程式碼一致
```

S2 與根公理呼應：積木是語義樹節點的視覺化，不應發明語義樹中不存在的概念。

---

# 第二層：設計原則

## 5. 四個原則

從根公理推導出四個正交原則：

```
根公理：程式是語義樹
  ├─ P1 投影定理：樹有多種等價表示，且可互轉
  ├─ P2 概念代數：概念有結構，可分層、可組合、可映射
  ├─ P3 開放擴充：新概念可加入而不破壞既有結構
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
code   = project(tree, file, code, { language, codeStyle })
blocks = project(tree, file, blocks, { language, locale, blockStyle })
AST    = parse(code, language)
tree   = lift(AST, language)
```

未來可擴展：flowchart、architecture、call_graph、narrative、execution（見願景章節）。

#### 四個正交參數

| 參數 | 影響什麼 | 不影響什麼 |
|------|---------|-----------|
| **Language** | 兩邊都影響：能用的概念、型別、語法 | — |
| **Code Style** | 只影響程式碼：格式、命名、慣例 | 不影響積木 |
| **Locale** | 只影響積木文字：message、tooltip、dropdown label | 不影響程式碼 |
| **Block Style** | 只影響積木外觀：方向、密度、配色、渲染器 | 不影響程式碼 |

**正交性的精確定義**：Language 是基底參數，決定其他三者的**可用空間**，但不決定空間內的選擇。Code Style、Locale、Block Style 在各自空間內完全獨立。

```
Code Style 空間 = Universal Options × Language-Specific Options
  Universal:    indent_size, brace_style, naming
  C++ Specific: io_style ('cout'|'printf'), namespace_style, header_style

Block Style 空間 = Universal Options × Language-Specific Options
  Universal:    renderer ('zelos'|'geras'), density, colour_scheme
  L-Specific:   inputsInline, orientation
```

#### 可逆性保證（分級）

設 `T` 為原始語義樹，`R = lift(parse(project(T)))` 為 round-trip 後的語義樹：

```
完全可逆：structured_info(R) ≡ structured_info(T)
          // 有精確積木的概念，結構化語義完全保留

有損保留：structured_info(R) ⊆ structured_info(T)
          且 total_info(R) ⊇ total_info(T)
          // 降級後結構化程度降低，但原始文字不丟失
```

不管怎麼投影再逆投影，語義不能丟失。呈現資訊和語法偏好可以丟失（可接受）。

**實用判定法**：寫完一個新積木後，跑 `code → blocks → code`，語義不能變。

#### 不存在「不可轉換」——只存在「降級程度」

> **系統的職責不是消除降級，而是讓降級透明可見、且不丟失資訊。**

```
結構化程度（高→低）：
  精確積木 (confidence: high)       → structured_info 完整
  警告積木 (confidence: warning)    → 結構匹配但語義可疑
  推斷積木 (confidence: inferred)   → 部分保留
  降級積木 (raw_code)               → structured_info = ∅，原始文字保留
```

降級是逐節點的，不是全有全無的。降級必須可見：

| 狀態 | 含義 | 視覺提示 |
|------|------|---------|
| 精確（high） | 系統完全理解，所有條件滿足 | 正常顯示 |
| 警告（warning） | 結構匹配但有可疑點 | 黃色邊框 + tooltip |
| 推斷（inferred） | 系統推測但不確定 | 淡色邊框 |
| 降級（raw_code） | 系統無法結構化理解 | 灰色底、程式碼文字 |

**強制性規則**（從 S4 推導）：任何 `patternType: 'composite'` 的 pattern，如果結構匹配成功但未通過所有語義驗證，**必須**設定 `confidence: 'warning'`。跳過語義驗證直接設為 `high` = 架構違規。

```
composite pattern 匹配流程（強制）：
  ① 結構匹配（AST 欄位類型檢查）  → 不通過 → 不匹配
  ② 語義驗證（副作用、變數修改等） → 不通過 → confidence: 'warning'
  ③ 所有檢查通過                   →          confidence: 'high'
```

#### lift() 的完備性邊界

```
Level 1: 結構匹配   — AST pattern 唯一對應，語義明確
Level 2: 上下文推導  — 查找 declaration/context 消除歧義
Level 3: 未決保留   — 建立 unresolved 節點，保留 AST 結構
Level 4: 降級       — 真正無法處理 → raw_code
```

Level 3 與 Level 4 的差異：Level 3 保留結構（知道是 binary expression、知道運算子），Level 4 只保留文字。

**動態語言的歧義處理**：多個候選語義時，不猜測，建立 unresolved 節點：

```typescript
{
  concept: 'unresolved_binary_op',
  properties: { operator: '+', candidates: ['math_add', 'string_concat'] },
  children: { left: a, right: b }
}
```

跨語言轉換的**前置條件**：語義樹中不可有 unresolved 節點。使用者不想手動消歧時，該節點降級為 raw_code。

**lift() 的上下文**：

```
lift() context = {
  declarations: [...],      // 變數宣告 → 推導型別
  using_directives: [...],  // namespace 指令 → 辨識 cout vs std::cout
  includes: [...],          // 引入的 header → 判斷可用的函式庫
  macro_definitions: [...]  // 巨集定義 → 避免誤判巨集調用
}
```

**巨集處理**：tree-sitter 不展開巨集。巨集的影響分兩種情況：

```
情況 1 — 獨立巨集調用（如 FOR(i,0,n)、DECLARE_PTR(Foo)）：
  巨集調用本身降級為 unresolved_macro（Level 3），
  但引數子樹各自獨立嘗試 lift()——不一刀切。
  已知巨集可由語言模組 opt-in 擴充。

情況 2 — 成對巨集（如 BEGIN_MAP/END_MAP、Qt 的 signals/slots）：
  tree-sitter 在成對巨集之間無法產生有效 AST——
  整個區塊變成 ERROR 節點，「子樹各自嘗試」的前提不成立。
  → 整片降級為 raw_code，這是物理限制，不是架構缺陷。

情況 3 — 巨集定義型別（如 DECLARE_SMART_PTR(Foo) → 生成 FooPtr）：
  符號表中缺少巨集生成的型別 → 所有使用該型別的節點連鎖降級。
  lift() 的符號表應標記這些節點為「型別來源受汙染」（tainted_type），
  使降級更精細——不是「不認識就全降」，而是「知道為什麼不認識」。
```

**誠實的邊界**：對於重度使用框架巨集的 C++ 專案（Qt、MFC、gtest），巨集密集區域會整片降級。緩解方向（工程代價大）：在 tree-sitter 之前跑 C preprocessor，或為特定框架預定義巨集展開規則。

---

### P2：概念代數（Concept Algebra）

> 概念不是散落的集合，它們形成一個**有結構的代數系統**：可分層、可組合、可映射。

#### 2a. 概念分層（Layering）

```
Layer 0: Universal      — 所有語言共有（variable, loop, if, function, print）
Layer 1: Lang-Core      — 語言核心語法（pointer, template, decorator）
Layer 2: Lang-Library   — 標準/外部函式庫（vector, printf, numpy）
```

每一層嚴格依賴上一層，不能反向依賴。型別系統是 language-specific 的。

#### 2a'. 概念註冊完備性（Concept Registry Completeness）

> 系統中每一個概念必須在**概念註冊表（Concept Registry）**中有唯一條目。

```
∀ concept ∈ ConceptRegistry:
  ① ∃ lift path     (AST → concept)        — 可辨識
  ② ∃ render path   (concept → Block)       — 可顯示
  ③ ∃ extract path  (Block → concept)       — 可還原
  ④ ∃ generate path (concept → Code)        — 可生成
  ⑤ roundtrip(concept) ≡ identity           — 可逆（P1 保證）
```

缺少任何一條路徑 = coverage gap = 架構缺陷（0 容忍）。

```
ConceptRegistry 的彙整來源：
  ┌─ BlockSpec JSON      → concept.conceptId
  ├─ lift-patterns.json  → concept.conceptId
  ├─ hand-written lifter → createNode('概念ID', ...)
  └─ hand-written generator → g.set('概念ID', ...)
```

**判定法**：靜態分析腳本收集所有概念 ID，對每個 ID 檢查四條路徑是否存在。

#### 2b. 概念映射與降級（Mapping & Degradation）

每個具體概念**必須**聲明映射到哪個抽象概念：

```
Level 1: 有具體積木       → 用具體積木（如 cpp:vector_push_back）
Level 2: 有抽象概念       → 用通用積木表示（如 func_call）
Level 3: 連抽象概念都沒有 → raw_code 降級
Level 4: 標記為不支援     → 保留在模型中不丟失
```

**跨語言轉換**從映射自然推導，但存在**語義阻抗（Semantic Impedance）**：

```
Layer 1 — 結構等價（可自動映射）：控制流、基本運算、函式定義
Layer 2 — 語義近似（需要適配）：容器操作、I/O、字串處理
Layer 3 — 無法映射（降級）：語言特有概念（C++ template、Python decorator）
```

**語義阻抗的偵測**：抽象概念攜帶語義契約和語言約束：

```typescript
interface AbstractConceptDef {
  id: string
  semanticContract: {
    effect: 'pure' | 'mutate_self' | 'mutate_arg'
    returnSemantics: 'void' | 'self' | 'new_value'
    chainable: boolean
  }
  constraints?: Record<string, LanguageConstraints>
}

interface LanguageConstraints {
  may_reallocate?: boolean
  invalidates_iterators?: boolean
  worst_case?: string
  thread_safe?: boolean
  throws?: boolean
  notes?: string
}
```

語義阻抗分三個層次：

```
節點級阻抗（可標記、可近似）：
  push_back vs push — 回傳值、副作用差異
  → semanticContract 可偵測，標記 semantic_gap + 生成 TODO 註解

拓撲級阻抗（無法節點級映射，需要重構子圖）：
  C++ RAII (scope_guard → resource_acquire → scope_exit)
    → Python 中沒有「所有權」這個結構維度，整個子圖需要重新設計
  Go goroutine + channel
    → C++ 中沒有對等的結構模式，不是翻譯節點而是重寫架構

  拓撲級阻抗不是 semantic_gap 標記能解決的——
  目標語言的語義結構中根本不存在對應的維度。
  正確行為：生成差異報告（「這裡的結構在目標語言中不存在，需要重新設計」），
  而非靜默生成破碎的程式碼。

語言模型級阻抗（超出形式化範圍）：
  記憶體模型（手動管理 vs GC）、併發模型（goroutine vs pthread）
  → constraints 欄位記錄，但無法自動處理，走降級路徑 + 「需人工調整」
```

跨語言映射時自動偵測 constraints 差異並標記 `semantic_gap`。對 L0-L1 教學場景不需要知道 constraints 差異，但 L2 高階使用者**必須**能看到。

**對 Scope 3 的影響**：跨語言轉換在 Layer 1（控制流）依然實用。但涉及語言特有結構模式（RAII、ownership、goroutine）時，Scope 3 退化為「顯示差異報告」而非「自動轉換」——這是正確的退化。

#### 2c. 概念命名空間（Namespace）

```
概念的完整 ID = language:package:concept

衝突解決：
  階段 1 — Pattern Match（必要條件）：function name + arg count → 候選清單
  階段 2 — Context Disambiguation：#include / prefix → 精確匹配
  無法精確匹配 → confidence: 'inferred'（不降級為 generic_call）
```

#### 2d. 概念組合（Composition）

```
複雜概念 = 簡單概念的組合
組合保持語義：meaning(A + B) = meaning(A) + meaning(B)
```

**判定法**：如果一個積木拿掉某個欄位後仍然有意義，那它應該拆成兩個積木。

---

### P3：開放擴充（Open Extension）

> 系統可以在**不修改既有程式碼**的前提下，加入新概念、新語言、新套件。

#### 擴充點

| 擴充什麼 | 加什麼 | 改什麼既有檔案 |
|---------|-------|--------------|
| 新翻譯 | + locale JSON | 無 |
| 新風格 | + style preset | 無 |
| 新套件積木（簡單） | + block JSON（Layer 1） | 無 |
| 新套件積木（需轉換） | + block JSON + transform 註冊（Layer 2） | 無 |
| 新語言概念（複雜） | + block JSON + strategy 註冊（Layer 3） | 無 |
| 新通用概念 | + UniversalConcept type | concept-registry（加一行） |
| 新語言 | + language module | 無（plugin 式載入） |

#### Pattern Engine 的三層表達能力

真正的開放擴充是：**語言模組能用自己的程式碼擴充引擎的行為，而不修改引擎本身。**

```
Layer 1: 純 JSON 聲明        — 覆蓋 ~80% 場景
Layer 2: JSON + 具名 transform — 覆蓋 ~15% 場景（純文字轉換 string → string）
Layer 3: JSON + 具名 strategy  — 覆蓋 ~5% 場景（完全控制 lift/render 邏輯）
```

```typescript
// Transform: 純文字轉換（Layer 2）
interface TransformRegistry {
  register(name: string, fn: (text: string) => string): void
}

// Lift Strategy: AST → SemanticNode（Layer 3）
interface LiftStrategyRegistry {
  register(name: string, fn: (node: AstNode, ctx: LiftContext) => SemanticNode | null): void
}

// Render Strategy: SemanticNode → BlockState（Layer 3）
interface RenderStrategyRegistry {
  register(name: string, fn: (node: SemanticNode) => BlockState | null): void
}
```

**核心引擎只有一條管線**：PatternLifter / PatternRenderer 是唯一路徑。遇到 `transform` 欄位就查 TransformRegistry，遇到 `liftStrategy` / `renderStrategy` 就查 StrategyRegistry。不存在雙管線競爭或黑名單切換。

#### Language Layer 子模組結構

```
Language Layer (e.g., C++)
├── Core     — 語言核心語法（pointer, struct, template）
├── Stdlib   — 標準函式庫（containers, algorithms, io, strings）
└── External — 第三方函式庫（未來擴充點）
```

#### 套件積木的標準定義格式

```jsonc
{
  "id": "cpp_find", "language": "cpp", "category": "algorithms",
  "concept": { "abstractConcept": "collection_search", ... },
  "blockDef": { "type": "cpp_find", "message0": "...", "colour": "#4C97FF" },
  "codeTemplate": { "pattern": "std::find(${BEGIN}, ${END}, ${VALUE})", "imports": ["algorithm"] },
  "astPattern": { "nodeType": "call_expression", "constraints": [...] }
}
```

#### 概念的生命週期

```
階段 0: 不認識         → raw_code 降級
階段 1: 認識但無積木    → 通用 func_call 降級
階段 2: 有專屬積木      → 完全支援
階段 3: 有 abstract 映射 → 可跨語言轉換
```

---

### P4：漸進揭露（Progressive Disclosure）

> 同一個語義結構，在不同認知維度顯示不同的概念子集和結構範圍。

P4 有兩個正交的維度：

#### 概念層級（Concept Level）

```
L0 初學：只看到 Universal 概念（變數、if、迴圈、函式、I/O）
L1 進階：看到 Universal + Lang-Core（+ 指標、struct、switch）
L2 高階：看到全部（+ template、STL 容器、algorithm）
```

#### 結構範圍（Structure Scope）

```
S0 語句 → S1 函式 → S2 檔案 → S3 模組 → S4 專案 → S5 系統
```

組合形成學習路徑：初學者 L0×S0-S1 → 進階者 L1×S1-S2 → 高階者 L2×S2-S3 → 架構師 L2×S3-S5。

**重要**：這不是簡化，是**過濾**。語義結構始終完整，只是投影時隱藏超出層級的節點。

#### P4 與投影種類的關係

| Scope | 最有價值的投影 |
|-------|-------------|
| S0-S1 | 積木、程式碼、流程圖、執行動畫 |
| S2 | 程式碼、積木、檔案大綱 |
| S3-S4 | 架構圖、依賴圖、呼叫圖 |
| S5 | 系統拓撲圖、資料流圖 |

#### P4 與認知負荷的關係

- **L0**：鷹架最強——外在負荷被積木形狀消除，概念集最小
- **L1**：鷹架適度——引入語言專屬概念
- **L2**：鷹架最弱——接近文字程式碼，準備過渡

層級切換是**控制在 ZPD 內可見的概念數量**。

| 層級 | Message 策略 | Tooltip 策略 |
|------|-------------|-------------|
| L0 | 完全口語 | 生活比喻 |
| L1 | 保留關鍵術語 | 技術說明 + 場景 |
| L2 | 可用更多術語 | 重點放在「什麼時候用」 |

---

# 第三層：架構與實踐

## 6. 六維架構

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

每一層獨立可配置、獨立可擴充。

---

## 7. 配置結構

### Code Style

```
Preset 範例：
  APCS 考試:    cout/cin, camelCase*, K&R, 4-space, using namespace std
  競賽:         printf/scanf, snake_case*, K&R, 4-space, bits/stdc++.h
  Google Style: cout/cin, snake_case*, K&R, 2-space, 不用 using namespace

* naming convention 僅影響新建變數的預設名稱格式（參見「變數命名的邊界」）
```

三大功能：(1) 使用者選擇 preset → 積木不動，重新生成程式碼 (2) 自動偵測：貼入程式碼 → 匹配最接近的 preset (3) 風格互轉：Code(A) → Parser → 積木 → Generator(B) → Code(B)。

Code Style 影響工具箱：APCS 顯示 cout 積木、競賽顯示 printf 積木。

### Block Style

```
Preset 範例：
  Scratch 風格: zelos, compact, scratch 配色, 預設 inline
  經典風格:     geras, normal, classic 配色, 預設 external
  教學風格:     zelos, spacious, 高對比配色, 複雜積木垂直展開
```

| 面向 | 選項 | 影響 |
|------|------|------|
| Renderer | zelos / geras | 圓角 vs 方角 |
| Density | compact / normal / spacious | 間距 |
| Colour scheme | scratch / classic / custom | 配色 |
| Inputs inline | true / false / auto | 水平或垂直 |
| Orientation | horizontal / vertical | 多值積木延伸方向 |

Block Style 不影響：語義樹結構、積木文字（Locale 控制）、程式碼生成（Code Style 控制）、可用積木集合（Language + P4 控制）。

---

## 8. 應用指引

### 各子系統 checklist

| 子系統 | 關鍵原則 |
|--------|---------|
| **i18n** | P1：Locale 是投影參數。根公理：message/tooltip 是呈現資訊，分離到 locale 檔案 |
| **coding style** | P1：Code Style 是投影參數，切換 = 重新投影。Parser 必須能辨識不同風格 |
| **block style** | P1：Block Style 是投影參數。S4：預設值符合學習者閱讀習慣 |
| **多語言支援** | P2：區分三層概念。跨語言走 abstract concept 映射 |
| **雙向轉換** | 根公理：建立顯式語義樹。P1：roundtrip 是判定標準。P3：Pattern Engine 是唯一管線 |
| **外部套件** | P2：辨識語義角色。P3：只加 JSON + 可選註冊。P4：決定認知層級 |

### 積木設計準則

```
S3 認知一致性 → 一個積木 = 一個語法結構，不多不少
S2 鷹架可退場 → 積木概念必須在文字程式碼中有直接對應
S4 最小驚訝   → 積木行為和生成的程式碼一致
S1 鷹架可調   → 同一概念在不同層級提供不同程度的輔助
CLT           → 每個積木最小化外在認知負荷
```

### 積木文字設計準則

- **Message**：動詞 + 身份 + 名稱，回答「對誰做什麼」。串起來讀起來像一段中文敘述。
- **Tooltip**：一句定義 + 一句場景 + 注意事項。Universal 用生活比喻，Advanced 重點放在「什麼時候用」。
- **Dropdown**：型別 `英文術語（中文）`，運算子 `中文（符號）`。型別清單由語言模組提供。

### 最終檢驗表

| 問題 | 回到哪條 |
|------|---------|
| 積木和程式碼不一致了 | **根公理**：它們是同一棵樹的投影 |
| 要不要支援某個功能 | **P1**：它能無損來回嗎？ |
| 轉不了怎麼辦 | **P1**：不存在轉不了——只有降級程度 |
| 積木該歸哪類 | **P2**：它映射到哪個抽象概念？ |
| 測試夠不夠完整 | **P2a'**：ConceptRegistry 每個條目的四條路徑都通過嗎？ |
| 加新套件要改哪些檔案 | **P3**：只加 JSON，不改既有程式碼 |
| 初學者看到太多積木 | **P4**：過濾層級，不是刪除概念 |
| 積木設計對學習者有幫助嗎 | **S3**：映射到真實的程式結構嗎？ |
| 積木應該多複雜 | **CLT**：最小化外在負荷，一個積木做一件事 |
| 積木會不會變成依賴 | **S2**：切到文字後能理解嗎？ |
| 積木排版要水平還是垂直 | **Block Style**：投影參數，不是結構決策 |
| 要不要支援多檔案 | **根公理**：Scope 3+ 加圖邊即可 |
| 外部套件不理解怎麼辦 | **P2 降級 + 可插拔執行**：語義契約引用 + 最適後端執行 |
| 怎麼讓程式可以共享 | **語義套件**：語義結構 + 投影定義 + 多後端執行體 |
| LLM 該放在哪裡 | **Guardrails 之上**：LLM 是語用分析師 |

---

# 第四層：願景

## 9. 執行模型

### 執行即投影

「執行」是語義結構的一種投影——不是生成文字或圖形，而是生成**行為**。每個語義節點有對應的 execute() 語義。語義直譯器直接走訪語義結構來執行程式。

### 執行策略與後端選擇

同一個語義節點可以有多種執行方式。策略（何時用）和後端（用什麼）是兩個獨立維度：

```
view = project(structure, scope, execution, {
  executionStrategy: 'interpret' | 'compiled' | 'hybrid',
  backend: 'js' | 'wasm' | 'remote' | 'webgpu' | ...,
  provider: '@stdlib' | '@optimized' | ...,
})
```

|              | interpret    | js native     | wasm          | remote       | webgpu       |
|--------------|-------------|---------------|---------------|--------------|--------------|
| **速度**     | 最慢         | 快（零 bridge）| 快（大量運算最佳）| 視網路延遲  | 快（GPU 平行）|
| **透明度**   | 全透明       | 半透明         | 黑箱           | 黑箱         | 黑箱         |
| **時空旅行** | 無限回溯     | 關鍵點回溯     | pure 可重新執行 | 不可         | 不可         |
| **適用場景** | 教學/debug   | 輕量運算       | 計算密集       | OS API      | 矩陣/ML     |
| **貢獻門檻** | 內建         | 寫 JS 函數     | 編譯 C++/Rust  | 架設 server | WebGPU API  |

每個執行體只需滿足語義契約（相同輸入→相同輸出）。後端選擇是效能/透明度的取捨，不影響語義正確性（**外延等價**）。

**混合執行**和 P4 漸進揭露一致——你想看多深就看多深：

```
學習者視角：
  main()       → interpret，逐步看
  my_sort()    → interpret，展開看自己寫的排序
  std::sort()  → compiled（wasm），只看結果
  print()      → interpret，看輸出過程

預設策略：
  已知概念且有語義直譯器  → interpret
  raw_code 且有執行體     → compiled（自動選最適後端）
  raw_code 且無執行體     → 不可執行（汙染下游）
  使用者手動切換          → 任何節點都可在 interpret ↔ compiled 間切換
```

### Raw code 解毒與外延等價

語義直譯器遇到 `raw_code` 就卡住，不可執行像汙染一樣往下游擴散。如果能提供一個**外延等價**的執行體，汙染就被阻斷：

```
x = 5                             // ✅ interpret
y = compiled_call("complex_algo") // ✅ 編譯執行，回傳具體值
z = x + y                         // ✅ interpret（y 已經是具體值）
```

**外延等價的定義**：∀ 合法輸入，A(input) ≡ B(input)。不要求內部結構相同。系統可用測試輸入自動驗證。

### 時空旅行除錯（Time-travel Debugging）

語義直譯器每步生成**語義狀態快照**。回溯 = 用歷史快照重新投影視圖（viewParams 多一個 `timeStep`）。

**因果追溯**：點擊輸出值，系統反向追蹤哪些節點「貢獻」了這個值。

**副作用隔離層**：教學模式下，所有 I/O 經由 Virtual I/O Layer 代理。回溯時 Virtual Console 只顯示對應時間步的輸出。效能模式可 bypass（但失去時空旅行能力）。

**編譯執行的狀態盲區**：直譯器看不到編譯執行節點的內部狀態。解法——節點宣告透明度等級：

```
pure: true                              → 重新呼叫即重現
stateful: { getState(), setState() }    → 快照介面
opaque: true                            → 不透明屏障，只能從前面重新執行
```

**三層執行透明度**（與 P4 對齊）：

| 模式 | 策略 | 時空旅行 | 副作用 | P4 對應 |
|------|------|---------|-------|---------|
| 全透明（教學） | interpret + 每步快照 | 無限回溯 | Virtual I/O | L0 最大鷹架 |
| 混合（進階） | hybrid + 關鍵點快照 | 回溯到關鍵點 | Virtual I/O 可選 | L1 鷹架退場中 |
| 效能（專家） | compiled + 無快照 | 不可用 | 直接作用 | L2 鷹架已退場 |

**執行透明度本身就是一種認知鷹架。**

---

## 10. 語義套件與效能市場

### 語義套件（Semantic Packages）

```
Semantic Package = 語義契約 + 投影定義 + 執行體

語義契約：  concept: sort, input: array<T>, output: array<T>（已排序）
投影定義：  L0 積木 / L2 積木 / C++ code / Python code
執行體：    cpp.wasm [wasm] / sort.js [js] / sort-gpu.js [webgpu]
```

消費者引用的是**語義概念**，系統自動選擇最適的執行後端。

### 效能市場（Performance Marketplace）

同一語義概念可有多個執行體，由不同來源、不同後端提供：

```
sort:
  @stdlib/sort.wasm       [wasm]   1M→120ms  通用
  @optimized/sort.wasm    [wasm]   1M→45ms   只限整數
  @community/sort.js      [js]     1K→0.3ms  小陣列最快
  @student/sort.js        [js]     1M→8500ms 教學：理解 O(n²)
```

自動化基準測試 + 自動後端選擇。教學價值：讓學習者**直觀感受演算法複雜度**（CLT 增生負荷）。

### 語義網路

語義套件發佈到 **Semantic Package Registry**：

```
我的程式（語義樹）
  ├── 引用 @stdlib/sort      [wasm]
  ├── 引用 @stdlib/io        [js + 瀏覽器 API]
  ├── 引用 @community/matrix [webgpu]
  └── 引用 @school/grading   [js]
```

### 教學場景

```
老師：寫「計算 BMI」語義套件 → 發佈到 classroom registry
學生 A（L0）：在工具箱看到積木 → 拖拽 → 執行 → 算出結果
學生 B（L1）：點「展開」→ 看到老師的實作 → 理解 → 修改
學生 C（L2）：fork → 改寫 → 發佈自己的版本
老師（S4）：看到全班的語義圖 → 誰引用誰 → 學習軌跡
```

P4 漸進揭露的終極形態——同一語義套件，初學者看到積木、進階者看到實作、老師看到全局。

---

## 11. AI 輔助：LLM 作為語用分析師

### 為什麼 LLM 不能是核心

語義結構是確定性的，LLM 是機率性的。如果讓 LLM 當核心引擎，語義結構從 source of truth 變成「LLM 覺得大概是這樣」。正確定位：**語義結構提供 guardrails，LLM 在 guardrails 內活動**。

### LLM 參與的五個位置

1. **強化 lift() 的語用分析**（最高價值）：處理 Pattern Engine 沒覆蓋的慣用語。結果標記 `confidence: 'llm_suggested'`，需使用者確認。
2. **語義阻抗顧問**：提供人類可讀的跨語言遷移建議，不做自動翻譯。
3. **敘事投影（Narrative Projection）**：語義樹→自然語言解說。LLM 可完全主導——自然語言本身是機率性的。
4. **自動化系統擴充（P3）**：LLM 生成 JSON 定義，確定性系統驗證（四路徑 + roundtrip test）。
5. **語義搜尋與自然語言建構（Scope 4-5）**：LLM 生成語義結構（不是程式碼），語義結構自動投影為積木+程式碼。

### 架構分層

```
┌───────────────────────────────────────────────┐
│  使用者                                         │
├───────────────────────────────────────────────┤
│  LLM 層（Connectionist，機率性）                 │
│  ├─ 語用推斷 / 敘事生成 / 擴充自動化              │
│  └─ 語義搜尋 / 跨語言建議                        │
├───────────────────────────────────────────────┤
│  Guardrails（確定性驗證）                        │
│  ├─ AST constraints / ConceptRegistry（P2a'）   │
│  ├─ Roundtrip test（P1）/ Type check            │
├───────────────────────────────────────────────┤
│  語義結構（Symbolic，Source of Truth）            │
│  ├─ 語義樹 / 語義圖 / 語義超圖                    │
│  └─ Pattern Engine + 可插拔執行後端               │
└───────────────────────────────────────────────┘
```

### 仲裁規則

```
確定性系統 = 自動機（可自動寫入語義結構）
機率性系統 = 顧問（需要人類或確定性系統批准）

優先序：Pattern Engine > 使用者確認 > LLM 建議 > 降級
```

| 場景 | Pattern Engine | LLM | 仲裁結果 | confidence |
|------|---------------|-----|---------|------------|
| 共識 | 匹配成功 | 同意 | 採用 PE | `high` |
| PE 優先 | 匹配成功 | 不同意 | 採用 PE | `high` |
| 人在迴路 | 無法匹配 | 有建議 | 呈現為建議，使用者決定（需通過驗證閘口） | `llm_suggested` → 驗證 → `user_confirmed` |
| 安全網 | 無法匹配 | 也沒建議 | 降級 | `degraded` |

**confidence 完整層級**（高到低）：

```
high            ← 確定性系統完全驗證
warning         ← 結構匹配但語義可疑（附帶 warning_reason）
inferred        ← 確定性系統的啟發式推斷
user_confirmed  ← LLM 建議 + 使用者接受 + roundtrip test 通過
llm_suggested   ← LLM 建議，未經驗證（暫存狀態，不參與 roundtrip）
degraded        ← 降級為 raw_code
```

**結構化驗證閘口**（防止 L0 使用者誤認 LLM 錯誤建議）：

```
LLM 建議 → 使用者確認 → 強制 roundtrip test
  → 通過（code→blocks→code 語義不變）
       → user_confirmed（結構化寫入，參與 roundtrip）
  → 不通過
       → user_confirmed_unverified（保留但標記，不參與跨語言映射）
       → UI 顯示「此概念未通過自動驗證」警告
```

使用者確認不等於語義正確——roundtrip test 是不可跳過的客觀閘口。L0 使用者可能不懂 LLM 建議的正確性，但 roundtrip test 不依賴使用者的認知能力。

**LLM 不能自動寫入語義結構**——即使「很有信心」。類比：AI reviewer 可以留言建議，但不能自己 merge PR。

---

## 12. 相關工作與差異

| 專案 | 做了什麼 | 對應原則 | 本質差異 |
|------|---------|---------|---------|
| **Unison** | AST hash 內容定址 | 根公理、Scope 4-5 | Hash 語法層 vs 我們 hash 語義層 |
| **Hedy** | 漸進式教學語言 | P4 漸進揭露 | 每個 Level 是不同語法 vs 我們只改投影解析度 |
| **Blockly/Scratch** | 積木→程式碼單向生成 | P1 投影定理 | 單向流 vs 雙向 roundtrip |
| **LSP/LSIF** | 跨檔案符號索引 | Scope 3-5 語義圖 | 位置導向 vs 語義導向 |
| **WebContainers** | 瀏覽器 WASM 執行 | 可插拔執行 | 通用環境 vs 語義直譯器 + 可插拔後端 |
| **IPFS** | 內容定址分散式儲存 | 語義套件分發 | 儲存層 vs 語義層 |

**獨特定位**：不是在語義層之上疊加積木、程式碼、執行，而是**只有語義層，其他都是投影**。

```
積木 = 語義結構的視覺投影    程式碼 = 文字投影
執行 = 行為投影              共享 = 網路投影    索引 = 圖投影
```

---

# 附錄

## 已知的實作挑戰

### 邏輯邊界（硬限制）

1. **語用分析的精確度邊界**：lift() 基於 pattern 推斷，存在誤判風險（如 body 內修改迴圈變數的 for）。對策：composite pattern 必須包含副作用檢查，可疑匹配強制 `confidence: 'warning'`。

2. **C/C++ 巨集的不可解析硬邊界**：tree-sitter 不展開巨集。獨立巨集調用可局部降級，但成對巨集（BEGIN_MAP/END_MAP、Qt signals/slots）會導致整個區塊的 AST 崩潰為 ERROR 節點——子樹無法獨立 lift。更嚴重的是，巨集定義的型別不在符號表中，導致連鎖降級。對重度框架巨集的專案，巨集密集區域會整片降級。

3. **語義阻抗的三層問題**：節點級阻抗（回傳值、副作用差異）可由 semanticContract 偵測標記。拓撲級阻抗（RAII、ownership、goroutine）改變語義結構的拓撲，目標語言中不存在對應的結構維度，無法節點級映射——正確行為是生成差異報告而非靜默生成破碎程式碼。語言模型級阻抗（記憶體模型、併發模型）超出形式化範圍，走降級路徑。

### 工程待解問題

4. **註解歸屬歧義**：拖拽積木時相鄰註解是否自動跟隨——需要 Block Style 層的吸附邏輯。

5. **符號表的汙染追蹤（Taint Tracking）**：lift() 的符號表應標記哪些型別和符號來自 raw_code 或未展開的巨集區域（`tainted_type`）。使用受汙染符號的節點應自動繼承較低的 confidence，使降級更精細——不是「不認識就全降」，而是「知道為什麼不認識」。同理，執行時 raw_code 的汙染擴散也應在語義結構中顯式標記傳播路徑。

6. **lift() 性能**：目前轉換是使用者主動觸發，全量 lift 在教學場景不構成瓶頸。未來可考慮增量 parse + 延遲 lift。

7. **Scope 3-5 的狀態空間爆炸**：增量更新演算法是效能瓶頸。實作優先序：Phase 1 Scope 0-2（已實現）→ Phase 2 Scope 3 → Phase 3 Scope 4-5。

8. **語義契約的驗證成本**：初期只覆蓋 L0-L1 概念，L2 按需補充，跨語言 constraints 可由 LLM 輔助生成初稿。

9. **執行後端的橋接開銷**：WASM 有序列化開銷，Remote 有網路延遲，WebGPU 有 GPU 同步代價。正確的粒度是「子樹」而非「節點」。JS native 因零 bridge 開銷特別適合大量小型運算。

10. **語義套件的工程約束**：執行他人的程式需要沙箱隔離、語義契約需要驗證機制（屬性測試）、語義結構的版本管理比文字原始碼更複雜。語義套件的執行體應受**語義沙箱**約束——副作用必須符合語義契約的宣告，否則拒絕執行，以保護時空旅行除錯的完整性（與 Virtual I/O Layer 統一為執行驗證層）。

11. **語義套件的版本一致性**：當多個使用者引用同一語義套件的不同版本時（老師更新 v1→v2，學生仍引用 v1），需要語義契約的相容性檢查——比文字原始碼的版本管理更難，因為要比較的是契約而非 diff。

---

## 一句話總結

> **程式是語義結構——檔案內是樹、檔案間是圖、系統間是超圖。程式碼、積木、流程圖、執行都是它的參數化投影，由 scope 和 viewType 決定觀察角度。概念形成可分層、可映射的代數結構，可封裝為語義套件透過可插拔後端（JS/WASM/WebGPU/Remote）執行與共享。LLM 作為語用分析師在確定性 guardrails 之上輔助推斷與生成。系統透過開放擴充成長，透過漸進揭露（概念層級 × 結構範圍）適應從初學者到系統架構師的所有使用者。積木是認知鷹架——降低外在負荷、在近側發展區內引導學習，並最終退場。**
