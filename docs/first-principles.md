# 語義結構投射理論：程式教育的第一性原理

**建立日期**: 2026-03-04
**最後更新**: 2026-03-11
**適用範圍**: 所有投影（程式碼、積木、流程圖、執行、分析、教育、分發等）、多語言支援、套件擴充——所有子系統共用

**版本歷程**:
- 2026-03-11: 新增 §1.5 認識論基礎（三維錨定驗證、發現大於發明、認知局限承認）；§4.3 Soundness vs Correctness 加入管家式職責分工與三維解讀；§4.5 自蒸餾改為「映射還原」——優化目標從效能最大化改為結構還原度最大化，引入不可變原形（Static Prototype）；責任三分重構為三維互設模型（Protocol/Data/Agency）
- 2026-03-11: 新增 §4.5 自舉與元教學（Meta-Progressive Disclosure）——漸進揭露的遮罩運作、自蒸餾類比、精密摩擦控制、認知外骨骼、責任三分（語義結構/語用推斷/人類意圖）
- 2026-03-11: §2.4 概念層級從線性改為樹狀結構（倍增軟指引）；新增 Topic（主題）維度——同語言不同情境有不同的層級樹和積木投影；§3.1 架構維度加入 Topic；§3.2 Toolbox 公式加入 Topic；Topic 可覆蓋 BlockSpec 到欄位層級
- 2026-03-10: §1.3 新增結構性依賴宣告（跨 Scope 衍生投影，#include 等不屬於原有四類資訊）；§2.3 新增 DependencyResolver 介面定義（語言模組職責，核心只定義介面）；§2.4 新增基礎設施的漸進揭露（Program Scaffold：L0 隱藏→L1 ghost→L2+ 手動）
- 2026-03-09: P2 新增概念角色語境依賴、屬性結構化邊界；P3 歧義偵測改為偏序仲裁（最特化匹配 + 交叉歧義報錯）；P4 新增概念表面形態、層級轉換穩定性；§4.3 區分 soundness vs correctness；巨集硬邊界新增多 parser 融合路線；積木文字準則新增語法隔離與 Mutator 一致性
- 2026-03-08: lift() 定位精確化（慣用語辨識器）、降級單調性、語義 Diff 推論、Pattern 歧義偵測、Toolbox 多維度說明、User Context（慣性快取 + 角色意圖）、命名語義約束（namingSemantics）、TaintInfo 結構化、群體設定覆蓋權限（mandatory/recommended）
- 2026-03-07: 投影全景分類（R0-R4）、硬問題修正、編號重構、開放序數化、一致性修正
- 2026-03-06: 四層重構、可插拔執行後端、時空旅行除錯
- 2026-03-04: 初版

**目次**:
- [第一層：理論基礎](#第一層理論基礎)
  - [1.1 根公理：程式是語義結構](#11-根公理程式是語義結構)
  - [1.2 語用學基礎](#12-語用學基礎)
  - [1.3 資訊分類學](#13-資訊分類學)
  - [1.4 教育學定位](#14-教育學定位)
  - [1.5 認識論基礎](#15-認識論基礎)
- [第二層：設計原則](#第二層設計原則)
  - [2.1 投影定理 P1](#21-投影定理-p1projection-theorem)
  - [2.2 概念代數 P2](#22-概念代數-p2concept-algebra)
  - [2.3 開放擴充 P3](#23-開放擴充-p3open-extension)
  - [2.4 漸進揭露 P4](#24-漸進揭露-p4progressive-disclosure)
- [第三層：架構與實踐](#第三層架構與實踐)
  - [3.1 架構維度](#31-架構維度)
  - [3.2 配置結構](#32-配置結構)（含 User Context）
  - [3.3 應用指引](#33-應用指引)
- [第四層：願景](#第四層願景)
  - [4.1 執行模型](#41-執行模型)
  - [4.2 語義套件與效能市場](#42-語義套件與效能市場)
  - [4.3 AI 輔助：LLM 作為語用分析師](#43-ai-輔助llm-作為語用分析師)
  - [4.4 相關工作與差異](#44-相關工作與差異)
  - [4.5 自舉與元教學](#45-自舉與元教學meta-progressive-disclosure)
- [附錄](#附錄)
  - [已知的實作挑戰](#已知的實作挑戰)

---

# 第一層：理論基礎

## 1.1 根公理：程式是語義結構

程式的本質不是程式碼，也不是積木——它們都是投影。

```
「x++;」              ← 文字投影（程式碼）
[變數 x 加1（++）]     ← 視覺投影（積木）
 x: 0→1               ← 行為投影（執行追蹤）
 ...                   ← 更多投影族群（§2.1 投影全景）
```

程式的本質是：

> **由「概念節點」和「關係邊」組成的語義結構。在檔案內是樹，在檔案間是圖，在系統間是超圖。**

每個節點 = (概念類型, 屬性, 子節點)。每條邊 = (關係類型, 來源節點, 目標節點)。

程式碼、積木、流程圖、執行結果、自然語言解說……都是語義結構的投影。投影的種類是開放集合（§2.1 列出 7 個族群、~45 種 viewType）。tree-sitter 產生的 AST 是 parser 的中間產物，**接近但不等於**語義結構。

從根公理直接推導：
- 語義結構是唯一真實（唯一的權威表示）
- 所有投影都是衍生的（不是真實本身）
- 節點的概念類型和屬性是語義，投影方式是呈現（語義與呈現分離）

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

## 1.2 語用學基礎

語言學將語言分析分為三層：

```
語法（Syntax）     → 形式規則：句子怎麼組合        → AST
語義（Semantics）  → 字面意義：句子是什麼意思       → 語義結構
語用（Pragmatics） → 語境意義：在這個情境下想做什麼  → lift() 的推斷
```

**lift() 是語法慣用語（syntactic idiom）的結構化辨識器**——它用 pattern matching 和上下文查表辨識已知的慣用寫法，將語法結構映射為語義概念。這是確定性、可驗證的過程，不涉及意圖推斷（「為什麼在這裡寫這個」）。真正需要意圖推斷的語用分析是機率性的，由 LLM 層處理（§4.3）。lift() 的辨識範圍：

| 語法結構 | 語用推斷 | 推斷依據 |
|---------|---------|---------|
| `for(int i=0;i<n;i++)` | `count_loop` | **慣用語辨識**：init + cond + update 的模式 |
| `cout << x << endl` | `print` | **身份辨識**：`cout` 是什麼東西 |
| `printf("%d", x)` | `print` | **名稱辨識**：`printf` 的已知語義 |
| `i++`（在迴圈末尾） | 迴圈步進 | **位置上下文**：出現在 for 的 update 位置 |
| `i++`（獨立語句） | `cpp_increment` | **位置上下文**：出現在 statement 位置 |

慣用語辨識解釋了四件設計決策：

1. **為什麼 lift() 需要符號表和作用域棧**——慣用語的辨識需要上下文（如區分 `cout` 是 stream 物件還是自定義變數）
2. **為什麼 Pattern Engine 有多層**——Layer 1（JSON）處理純語法映射，Layer 2+ 處理需要上下文查表的慣用語
3. **為什麼降級存在**——辨識基於已知 pattern 庫，未收錄的寫法無法辨識
4. **為什麼高 Scope 比低 Scope 難**——Scope 0-2 的慣用語相對局部，Scope 3+ 需要跨檔案語境（超出 pattern matching 能力，需要 LLM 層）

```
辨識的複雜度隨 Scope 急劇上升：

Scope 0-2（檔案內）：慣用語辨識、名稱推斷 → lift() 的確定性 pattern matching
Scope 3（模組）：  跨檔案命名慣例和使用模式 → 超出 pattern matching，需要啟發式或 LLM
Scope 4（專案）：  依賴方向和模組角色推斷   → 需要專案級分析（LLM 層）
Scope 5（系統）：  服務角色和互動模式       → 需要系統級分析（LLM 層）
```

**確定性與機率性的分界**：lift() 負責 Scope 0-2 的確定性辨識（pattern matching + 符號表查詢），結果直接寫入語義結構。Scope 3+ 的推斷由 LLM 層處理（§4.3），結果標記為 `llm_suggested`，需使用者確認後才寫入。`count_loop` 而非 `for_statement` 的概念選擇本身就包含了慣用語辨識的結果。`metadata.confidence` 標記辨識的確定程度。

---

## 1.3 資訊分類學

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
// 完整定義——其他章節引用此處
interface SemanticNode {
  id: string                                    // 穩定的節點識別符（語義 diff 與版本控制用）
  concept: ConceptType                          // 概念類型（來自 ConceptRegistry）
  properties: Record<string, PropertyValue>     // 概念屬性
  children: Record<string, SemanticNode[]>      // 子節點（結構關係）
  annotations?: Annotation[]                    // 附著的註解、pragma 等
  rawText?: string                              // 降級時保留的原始文字
  confidence?: 'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'
  degradationCause?: 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'
  taint?: TaintInfo                              // 受汙染來源標記（§2.1 符號表汙染追蹤）
  metadata?: Record<string, unknown>            // 呈現資訊、語法偏好等
}

interface TaintInfo {
  kind: 'tainted_type' | 'tainted_symbol' | 'macro_expansion' | 'missing_include' | 'dynamic_dispatch'
  source?: string                             // 汙染源識別（如巨集名稱、缺失的 header）
  propagatedFrom?: string                     // 汙染傳播自哪個節點 ID
  severity: 'hard' | 'soft'                   // hard: 阻止執行/投影，soft: 標記但可繼續
}

interface Annotation {
  type: 'comment' | 'pragma' | 'lint_directive'
  text: string
  position: 'before' | 'after' | 'inline'
}
```

**語義結構核心（Semantic Kernel）**：以上 SemanticNode 介面加上 ConceptRegistry（§2.2）構成語義結構核心。所有投影、執行、擴充機制都是外掛——核心只定義節點、概念、和結構操作（traverse、query、filter、diff、merge、validate）。

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

**命名語義約束（Naming Semantics）**：某些語言的命名風格不僅是呈現，還承載語義。當命名規則影響訪問控制、型別推斷或語言機制時，它自動從「呈現資訊」提升為「語義資訊」：

```
命名的語義光譜（由語言模組宣告）：

none        — 命名純呈現（C++）
              myVar ↔ my_var 只是風格差異，零語義差異
              style 切換可自由建議新命名格式

convention  — 命名有慣例語義但非語言強制（Python）
              _private — 技術上可外部存取，但違反社區慣例
              __dunder__ — 語言機制綁定（__init__、__str__）
              style 切換時警告：「此命名慣例可能影響 API 契約」

visibility  — 命名直接決定語言語義（Go）
              大寫開頭 = exported，小寫 = unexported — 編譯器強制
              style 切換時禁止：自動轉換大小寫 = 改變可見性 = 改變語義

partial     — 命名部分影響語言行為（Rust）
              大寫開頭 = type，小寫 = variable — 編譯器警告
              style 切換時標記：此轉換可能觸發編譯警告
```

語言模組通過 `namingSemantics` 宣告自己的命名約束等級。style 切換邏輯在遇到 `namingSemantics !== 'none'` 時，必須跳過命名轉換或提示使用者「此語言的命名具有語義約束，自動轉換可能改變程式行為」。

### 結構性依賴宣告（Structural Dependency Declarations）

`#include <iostream>` 不屬於上述四類資訊的任何一類：它不改變當前語義樹的行為（非語義）、不是呈現格式（非呈現）、不是附加描述（非元資訊）、也不是等價寫法的偏好（非語法偏好）。它是 **Scope 3 的圖邊（depends_on 關係）投影到 Scope 2 程式碼中的產物**——一種**跨 Scope 的衍生投影（cross-scope derived projection）**。

同類範例：`using namespace std;`、`import numpy as np`、`use std::collections::HashMap;`。

這類資訊的共同特徵：**可從 Scope 2 語義樹的概念使用集合中確定性地推導**。例如，語義樹中存在 `cout` 概念 → 必須有 `#include <iostream>`。因此其 round-trip 規則為 **best-effort**：lift() 時可忽略（因為可重新推導），project() 時由 DependencyResolver（§2.3）從概念使用自動生成。使用者手動添加的依賴宣告記錄在 metadata 中，避免 round-trip 丟失。

### lift() 的狀態模型

lift() 在**單次調用內**維護作用域棧 + 局部符號表。**跨次調用之間**不共享狀態。Style 切換不影響 lift() 的符號表——確保 lift() 與 Style 不耦合。

---

## 1.4 教育學定位

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

### 鷹架設計的推導原則

從 CLT + ZPD 推導出的鷹架原則（開放集合，目前有四個）：

```
CLT + ZPD
  ├─ Sc1 鷹架可調性：同一概念在不同層級有不同的鷹架強度（對應 P4）
  ├─ Sc2 鷹架可退場：積木不可引入文字程式碼中不存在的概念
  ├─ Sc3 認知一致性：一個積木 = 一個語法結構，不多不少
  └─ Sc4 最小驚訝：積木行為和生成的程式碼一致
  （框架允許追加新原則，只要能從 CLT/ZPD 推導）
```

Sc2 與根公理呼應：積木是語義樹節點的視覺化，不應發明語義樹中不存在的概念。

---

## 1.5 認識論基礎

§1.1 宣告「語義結構是唯一真實」。本節回答一個更根本的問題：**系統憑什麼聲稱自己在接近真實？**

### 三維錨定驗證（Tri-Dimensional Validation）

系統的可信度不依賴單一權威來源，而是三個互設且平衡的驗證維度同時成立：

```
            公理維度
           (Protocol)
              ╱╲
             ╱  ╲
            ╱    ╲
           ╱  ≡   ╲
          ╱________╲
   情境維度 ———————— 主體維度
   (Data)            (Agency)
```

| 維度 | 職責 | 性質 | 對應現有機制 |
|------|------|------|------------|
| **公理維度（Protocol）** | 不可變的邏輯基準 | 確定性、先驗 | 四路完備性（§2.2）、概念代數、投影定理（§2.1） |
| **情境維度（Data）** | 環境反饋與觀測數據 | 經驗性、後驗 | AST 解析、round-trip 測試、User Context（§3.2） |
| **主體維度（Agency）** | 基於責任的價值判斷 | 意圖性、規範 | Correctness 判斷（§4.3）、Topic 設計、根公理定義 |

**三維交叉驗證規則**：

```
合法的系統更新 = Protocol ∩ Data ∩ Agency

缺少 Protocol 對齊的更新 → 系統幻覺（結構性錯誤）
缺少 Data 驗證的更新   → 空想（未經實證的理論）
缺少 Agency 簽署的更新 → 自動化偏差（無人負責的變更）
```

這與 §4.3 的仲裁規則一致：Pattern Engine（Protocol）> 使用者確認（Agency）> LLM 建議（Data 輔助）> 降級。三維錨定不是新增的約束，而是對現有機制的認識論解釋。

**與現有架構的對應**：

```
§4.3 架構分層                     三維錨定

語義結構（Symbolic）           ← Protocol（公理維度）
  確定性、可驗證、不可變

Guardrails（確定性驗證）       ← Protocol ∩ Data 交集
  AST constraints、roundtrip

LLM 層（Connectionist）       ← Data（情境維度）
  機率性、可建議、需確認

使用者                         ← Agency（主體維度）
  定義根公理、判斷 correctness
```

### 發現大於發明（Discovery over Invention）

語義結構不是系統「發明」的任意建構，而是對程式中**客觀存在的邏輯秩序的發現與解碼**。

```
數學家不發明定理——他們發現定理。
Semorphe 不發明語義——它解碼語義。

printf("hello")  中的「輸出」語義
for(i=0;i<n;i++) 中的「計數迴圈」語義
  → 這些結構在程式碼被寫下的瞬間就已存在
  → lift() 的工作是辨識它們，不是創造它們
```

這個立場有三個實踐推論：

1. **概念命名不是任意的**：`count_loop` 不是系統給 for 迴圈取的暱稱——它是對一個客觀模式的辨識結果。命名的優劣取決於是否精確地指向了底層結構，而非使用者偏好。

2. **降級是誠實，不是失敗**：當系統無法辨識某段程式碼的語義結構時，`raw_code` 降級是在說「這裡的真實超越了我當前的解析能力」。這是認識論上的誠實聲明，不是工程上的技術遺憾。

3. **自舉的目標是還原，不是演化**：優化 Topic 層級樹不是「發明更好的教學路徑」，而是「更精確地映射知識的內在結構」（見 §4.5 映射還原）。

### 認知局限的承認（Epistemic Humility）

系統與觀察者（人類和 AI）都存在天然的認知邊界。系統的誠實不在於聲稱能理解一切，而在於精確地標記自己理解的邊界。

**降級作為認識論指標**：

```
confidence 層級不只是技術狀態——它是系統的認知自評：

high            ← 「我確定這裡的結構」（Protocol + Data 雙重驗證）
warning         ← 「結構匹配但我不太確定語義」（Protocol 通過，Data 存疑）
inferred        ← 「我根據已知模式推斷」（Protocol 啟發式推斷）
user_confirmed  ← 「我不確定，但使用者在審查後接受了」（Agency 介入）
llm_suggested   ← 「機率性建議，尚未驗證」（Data 維度的輔助）
raw_code        ← 「此處超越我的理解能力」（三維皆不足）
```

**禁止強行結構化**：

```
對於不確定的語義：
  ✗ 給出一個「看起來合理」的結構    → 偽造（violation of Protocol）
  ✓ 標記 raw_code 並保留原始文字    → 誠實降級

raw_code 覆蓋率不是 bug 數量，而是系統對自身認知邊界的誠實度量。
```

這與 §4.3「LLM 不能自動寫入語義結構」的規則同源：聲稱理解你不理解的東西，比承認不理解更危險。

---

# 第二層：設計原則

從根公理推導出的設計原則（開放集合，目前有四個）：

```
根公理：程式是語義樹
  ├─ P1 投影定理：語義結構有多種投影，可逆性依種類分級（R0 雙射 → R4 單向）
  ├─ P2 概念代數：概念有結構，可分層、可組合、可映射
  ├─ P3 開放擴充：新概念可加入而不破壞既有結構
  └─ P4 漸進揭露：同一棵樹在不同認知層級有不同的可見範圍
  （框架允許追加新原則，只要能從根公理推導且與現有原則正交）
```

---

## 2.1 投影定理 P1（Projection Theorem）

> 語義結構有多種表示，每種表示是一個**參數化投影**，可逆性依投影種類而異。

### 投影管線

```
view = project(structure, scope, viewType, viewParams)

其中 viewParams = { language, ...viewTypeSpecificParams }
```

每種 viewType 有自己的參數空間（viewParams），language 是所有投影共享的基底參數：

```
viewType    viewParams 範例
─────────   ────────────────────────────────────────────
code        { language, codeStyle: { indent, brace, naming, ... } }
blocks      { language, locale, blockStyle: { renderer, density, ... } }
flowchart   { language, layout, detailLevel, orientation }
call_graph  { language, depth, collapseLeaves }
narrative   { language, audience, verbosity }
execution   { language, strategy, backend, provider }
...         每種投影按需定義自己的參數空間
```

**正交性**：Language 是基底參數，決定其他參數的**可用空間**。同一 viewType 內的參數彼此獨立；不同 viewType 的參數互不影響。

### 可逆性分級

設 `T` 為原始語義結構，`R = lift(project(T))` 為 round-trip 後的結果：

| 等級 | 名稱 | 定義 | 意義 |
|------|------|------|------|
| **R0** | 雙射（Bijective） | `lift(project(T)) ≡ T` | 完全可逆，零損失 |
| **R1** | 語義保留（Semantic-preserving） | `structured_info(R) ≡ structured_info(T)` | 語義不丟，呈現資訊可丟 |
| **R2** | 結構可逆（Structurally reversible） | 主要拓撲關係可恢復，細粒度語義損失 | 骨架在，血肉缺 |
| **R3** | 片段可逆（Fragment-recoverable） | 部分語義片段可提取，整體不可恢復 | 能撿回碎片 |
| **R4** | 單向（One-way） | 無有意義的逆映射 | 只能觀察，不能反推 |

**關鍵洞察**：R0-R1 投影是**可編輯視圖**（使用者可在該視圖中修改，再同步回語義結構）；R2-R4 是**唯讀視圖**（用於觀察、分析、溝通，不用於編輯）。

### 投影全景

**一、文字族（Text Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `code:same_lang` | 同語言同風格原始碼 | **R0** | parse→lift→generate 完全 roundtrip |
| `code:restyle` | 同語言不同風格 | **R1** | 語義不變，縮排/命名/括號位置丟失 |
| `code:cross_lang` | 跨語言翻譯 | **R2-R3** | 語義阻抗造成拓撲級損失 |
| `pseudocode` | 偽代碼 | **R2** | 結構可恢復，型別和精確語法丟失 |
| `narrative` | 自然語言解說 | **R4** | 多對一——「把 x 加一」無法反推是 `x++` 還是 `x+=1` |
| `doc:structured` | 結構化文件（JSDoc/Doxygen） | **R3** | 函式簽名可恢復，實作邏輯丟失 |
| `diff` | 語義差異描述 | **R3** | 需要 base 版本才能 apply |
| `error_report` | 錯誤/警告訊息 | **R4** | 不同程式可產生相同錯誤 |

**二、視覺結構族（Visual-Structural Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `blocks` | 積木圖（Blockly 式） | **R0** | 設計目標即雙射 |
| `flowchart` | 流程圖（控制流圖） | **R1-R2** | 控制流拓撲可恢復；簡單情況 R1，複雜表達式可能簡化為標籤 |
| `ast_tree` | AST 樹狀視覺化 | **R2** | AST 是語法層產物（§1.1），lift() 後才等價於語義樹；AST 視覺化保留結構但非語義 |
| `call_graph` | 呼叫圖 | **R3** | 只保留函式間呼叫關係 |
| `dependency_graph` | 模組依賴圖 | **R3** | 只保留 import/include 關係 |
| `class_diagram` | 類別/實體圖 | **R3** | 資料模型可恢復，行為邏輯丟失 |
| `sequence_diagram` | 序列圖 | **R3** | 互動模式可恢復，內部邏輯丟失 |
| `state_machine` | 狀態機圖 | **R2** | 狀態轉移可恢復，轉移條件可能簡化 |
| `data_flow` | 資料流圖 | **R2** | 資料流動可恢復，控制流丟失 |
| `memory_layout` | 記憶體佈局圖 | **R4** | 運行時表示，多對一 |
| `system_topology` | 系統拓撲圖 | **R3** | Scope 5 連接關係，內部實作丟失 |
| `outline` | 檔案大綱/目錄 | **R3** | 只保留宣告層級結構 |
| `syntax_highlight` | 語法高亮文字 | **R1** | 在 code 上疊加顏色，語義完整 |
| `minimap` | 程式碼縮略圖 | **R4** | 像素級壓縮，不可逆 |

**三、行為族（Behavioral Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `execution` | 直譯/編譯執行 | **R4** | 輸出是行為/值，多對一 |
| `execution_trace` | 執行軌跡（每步快照） | **R2-R3** | 軌跡含狀態序列，可部分重建邏輯 |
| `animation` | 執行動畫/視覺化 | **R4** | 視覺呈現，不可反推 |
| `test_suite` | 測試案例集 | **R3** | 測試描述契約，不描述實作 |
| `benchmark` | 效能基準結果 | **R4** | 純數值 |

**四、分析族（Analytical Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `type_info` | 型別資訊表 | **R3** | 型別結構可恢復，邏輯丟失 |
| `symbol_index` | 符號索引/交叉引用 | **R3** | 定義-引用關係可恢復 |
| `complexity_metrics` | 複雜度指標 | **R4** | 純數值，多對一 |
| `coverage_report` | 覆蓋率報告 | **R4** | 路徑覆蓋資訊，不含結構 |
| `lint_diagnostics` | 靜態分析結果 | **R4** | 問題列表，不含修復方案 |

**五、教育族（Educational Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `scaffolded:LN` | LN 鷹架視圖 | **R1** | P4 過濾——語義完整，只隱藏高階概念 |
| `worked_example` | 工作範例/教案 | **R4** | 自然語言+程式碼混合 |
| `hint` | 提示/引導 | **R4** | 片段性建議 |
| `assessment` | 評量/評分結果 | **R4** | 評價結果，不含原始程式 |
| `comparison` | 兩版本差異對比 | **R3** | 差異需要兩端才有意義 |

**六、可及性族（Accessibility Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `screen_reader` | 螢幕閱讀器敘事 | **R2** | 結構化朗讀保留拓撲，表達式可能口語化 |
| `braille` | 點字輸出 | **R1** | 與文字同構，只是編碼不同 |
| `sonification` | 聲音化 | **R4** | 音高/節奏映射，極度壓縮 |
| `high_contrast` | 高對比/色盲友善 | **R1** | 只改視覺參數，語義完整 |

**七、分發族（Distribution Family）**

| viewType | 說明 | 可逆性 | 理由 |
|----------|------|--------|------|
| `semantic_package` | 語義套件 | **R0** | 語義結構的序列化形式 |
| `api_surface` | 公開 API 表面 | **R3** | 只保留公開介面 |
| `protocol_schema` | 協定/Schema 定義 | **R3** | 資料契約可恢復，行為丟失 |
| `embed_snippet` | 可嵌入程式碼片段 | **R1** | 本質是 code + scope 過濾 |
| `share_link` | 分享連結（含序列化狀態） | **R0** | URL 編碼的語義結構 |

### 可逆性總覽

```
R0 雙射 ──────── code:same, blocks, semantic_package, share_link
R1 語義保留 ──── code:restyle, scaffolded, syntax_highlight, braille,
                  high_contrast, embed_snippet, flowchart(簡單情況)
R2 結構可逆 ──── ast_tree, pseudocode, state_machine, data_flow, screen_reader,
                  flowchart(複雜情況), execution_trace
R3 片段可逆 ──── code:cross_lang, doc:structured, diff, call_graph,
                  dependency_graph, class_diagram, sequence_diagram,
                  outline, type_info, symbol_index, test_suite,
                  api_surface, protocol_schema, comparison, system_topology
R4 單向 ──────── narrative, error_report, execution, animation, benchmark,
                  complexity_metrics, coverage, lint, sonification,
                  worked_example, hint, assessment, memory_layout, minimap
```

### 目前已實現的投影

```
code   = project(tree, file, code, { language, codeStyle })
blocks = project(tree, file, blocks, { language, locale, blockStyle })
AST    = parse(code, language)
tree   = lift(AST, language)
```

其餘投影為理論框架中的擴展點，按需實現（見願景章節）。

**跨語言投影的組合性**：投影全景表中的 `code:cross_lang` 不是獨立的 viewType，而是 lift + project 的組合——`project(lift(parse(codeA), langA), scope, code, { language: langB })`。先從語言 A 提升到語義結構，再以語言 B 的參數投影為程式碼。可逆性取決於兩種語言間的語義阻抗（§2.2）。

**實用判定法**：寫完一個新的 R0/R1 投影後，跑 roundtrip，語義不能變。R2-R4 投影不需要 roundtrip，但需要驗證投影結果的**完整性**（不遺漏應投影的節點）。

**推論：語義 Diff 是投影不變量。** 如果 `semanticDiff(T1, T2) = ∅`（兩棵語義樹結構等價），則無論用什麼 viewParams 投影，語義層面的差異永遠為零——即使投影結果的文字表示不同（如 Code Style 切換導致縮排、命名風格變化）。反之，`codeDiff(project(T1), project(T2)) ≠ ∅` 不代表 `semanticDiff ≠ ∅`——可能只是呈現層的 viewParams 不同。這個性質是未來語義版本控制的理論基礎：style 變更 = semantic diff 0。

### 投影可逆性 ≠ 語義樹完整性

這兩個概念必須嚴格區分：

```
投影可逆性（R0-R4）：投影管線本身的數學性質，與輸入無關。
  code 投影永遠是 R0，不管語義樹多殘缺。

語義樹完整性：lift() 能從 AST 中恢復多少語義結構。
  受巨集、動態特性、框架 DSL 等因素影響。
  完整性 = structured_nodes / total_nodes
```

R0 投影作用在不完整的語義樹上，roundtrip 仍然成立——raw_code 節點也能 roundtrip。只是 structured_info 比理想情況少。所以「巨集導致大面積降級」不是投影管線從 R0 退化到 R4，而是語義樹的完整性下降。**根公理不動搖**——它說「程式是語義結構」，不說「所有文字都能被語義化」。巨集是元程式（metaprogram），在語義層之下的文字替換層運作。

### 不存在「不可轉換」——只存在「降級程度」

> **降級不是失敗，而是系統的認識論承諾——選擇保留原始資訊而非強行結構化的正確行為。** `raw_code` 的存在宣告了「此處的真實超越了當前的解析能力」（§1.5 認知局限的承認）。系統的職責不是消除降級，而是讓降級透明可見、原因可區分、資訊不丟失。raw_code 覆蓋率是系統誠實度的度量，而非缺陷數量的度量。

```
結構化程度（高→低）：
  精確積木 (confidence: high)       → structured_info 完整
  警告積木 (confidence: warning)    → 結構匹配但語義可疑
  推斷積木 (confidence: inferred)   → 部分保留
  降級積木 (raw_code)               → structured_info = ∅，原始文字保留
```

降級是逐節點的，不是全有全無的。**降級是單調遞減的**：一旦節點降級到某個 confidence 等級，除非有新的外部資訊（使用者確認、LLM 建議、或更完整的上下文），不會自動恢復到更高等級。降級必須可見，且必須區分**降級原因**：

| 狀態 | 含義 | 視覺提示 |
|------|------|---------|
| 精確（high） | 系統完全理解，所有條件滿足 | 正常顯示 |
| 警告（warning） | 結構匹配但有可疑點 | 黃色邊框 + tooltip |
| 推斷（inferred） | 系統推測但不確定 | 淡色邊框 |
| 降級（raw_code） | 系統無法結構化理解 | 依原因區分（見下表） |

**降級原因的視覺區分**（防止 Pattern 依賴的教育反噬）：

| 降級原因 | 視覺語義 | 說明 |
|---------|---------|------|
| 程式碼錯誤 | 紅色警告 | 語法或型別錯誤，合理的負面回饋 |
| 系統能力不足 | 中性灰色 + 「系統尚未支援此寫法」 | 不歸因於使用者 |
| 寫法非標準但正確 | 綠色邊框 + 「進階寫法」 | 鼓勵探索，不懲罰創意 |

**為什麼必須區分**：如果所有降級都用相同的「灰色」視覺，學習者會隱性地將「系統不認識」解讀為「我寫錯了」，進而只寫系統能匹配 pattern 的程式碼——**鷹架變成認知牢籠，違反 P4 的教育學定位**。區分的依據：如果程式碼能通過編譯/執行驗證但不匹配 pattern，就是「非標準但正確」。

**強制性規則**（從 Sc4 推導）：任何 `patternType: 'composite'` 的 pattern，如果結構匹配成功但未通過所有語義驗證，**必須**設定 `confidence: 'warning'`。跳過語義驗證直接設為 `high` = 架構違規。

```
composite pattern 匹配流程（強制）：
  ① 結構匹配（AST 欄位類型檢查）  → 不通過 → 不匹配
  ② 語義驗證（副作用、變數修改等） → 不通過 → confidence: 'warning'
  ③ 所有檢查通過                   →          confidence: 'high'
```

### lift() 的完備性邊界

```
Lift-1: 結構匹配   — AST pattern 唯一對應，語義明確
Lift-2: 上下文推導  — 查找 declaration/context 消除歧義
Lift-3: 未決保留   — 建立 unresolved 節點，保留 AST 結構
Lift-4: 降級       — 真正無法處理 → raw_code
```

Lift-3 與 Lift-4 的差異：Lift-3 保留結構（知道是 binary expression、知道運算子），Lift-4 只保留文字。

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

**誠實的邊界**：對於重度使用框架巨集的 C++ 專案（Qt、MFC、gtest），巨集密集區域會整片降級。如果 80% 的程式碼降級為 `raw_code`，語義結構的優勢將消失殆盡。

**緩解路線——多 parser 融合（Multi-Parser Fusion）**：

```
tree-sitter（快速、增量、不展開巨集）→ 結構骨架 + 非巨集區域的完整語義
clang AST（較慢、完整、展開巨集）    → 巨集區域的語義補充

融合策略：
  非巨集區域 → tree-sitter lift 結果（快速路徑）
  巨集區域   → clang AST 的語義補充（精確路徑）
  兩者在語義樹層面合流——同一棵樹，不同區域由不同來源填充
```

這比「模擬預處理器」更可行：不需要重新實現 C preprocessor，只需要在語義層整合兩個已有 parser 的結果。代價是：需要 clang 作為可選依賴（非教學場景），且融合邏輯需要處理兩個 parser 對同一區域的不同解讀。

**對 Scope 的意涵**：S0-S2（教學場景）不需要多 parser 融合——學生程式碼不會用框架巨集。S3-S5（大型專案分析）需要，但這些 Scope 的視圖本身就是唯讀的（R3-R4），融合的精確度要求較低。

---

## 2.2 概念代數 P2（Concept Algebra）

> 概念不是散落的集合，它們形成一個**有結構的代數系統**：可分層、可組合、可映射。

### 概念分層（Layering）

概念分層是一個**開放有序集**，越後面越專門。已知實例：

```
Layer 0: Universal      — 所有語言共有（variable, loop, if, function, print）
Layer 1: Lang-Core      — 語言核心語法（pointer, template, decorator）
Layer 2: Lang-Library   — 標準/外部函式庫（vector, printf, numpy）
...                     — 框架允許追加（如 domain-specific、framework-specific）
```

每一層嚴格依賴上一層，不能反向依賴。型別系統是 language-specific 的。新增概念層時，只需在有序集末端追加，不影響既有層的定義。

### 概念註冊完備性（Concept Registry Completeness）

> 系統中每一個概念必須在**概念註冊表（Concept Registry）**中有唯一條目。

```
∀ concept ∈ ConceptRegistry:
  ① ∃ lift path     (AST → concept)        — 可辨識
  ② ∃ render path   (concept → Block)       — 可顯示
  ③ ∃ extract path  (Block → concept)       — 可還原
  ④ ∃ generate path (concept → Code)        — 可生成
  （roundtrip 可逆性由組合四條路徑驗證：①→②→③→④→① ≡ identity，見 P1）
```

缺少任何一條路徑 = coverage gap = 架構缺陷（0 容忍）。

```
ConceptRegistry 的彙整來源：
  ┌─ BlockSpec JSON        → concept.conceptId
  ├─ lift-patterns.json    → concept.conceptId
  ├─ liftStrategy 註冊     → StrategyRegistry（Layer 3 擴充）
  └─ renderStrategy 註冊   → StrategyRegistry（Layer 3 擴充）
```

**判定法**：靜態分析腳本收集所有概念 ID，對每個 ID 檢查四條路徑是否存在。

**執行完備性（實作面補充）**：四路完備性保證概念在**編輯管線**中的 roundtrip 正確性。當系統提供語義直譯器（§4.1）時，每個可執行概念還需要 `⑤ ∃ execute path (concept → Behavior)`——即 interpreter executor 註冊。宣告性概念（如 `#include`、`using namespace`）需註冊 noop executor 以區分「已知不執行」與「未知概念」。未註冊 executor 的概念在執行時應通知使用者，而非靜默跳過。

### 概念映射與降級（Mapping & Degradation）

每個具體概念**必須**聲明映射到哪個抽象概念：

```
D1: 有具體積木       → 用具體積木（如 cpp:vector_push_back）
D2: 有抽象概念       → 用通用積木表示（如 func_call）
D3: 連抽象概念都沒有 → raw_code 降級
D4: 標記為不支援     → 保留在模型中不丟失
```

**跨語言轉換**從映射自然推導，但存在**語義阻抗（Semantic Impedance）**：

```
阻抗-1 — 結構等價（可自動映射）：控制流、基本運算、函式定義
阻抗-2 — 語義近似（需要適配）：容器操作、I/O、字串處理
阻抗-3 — 無法映射（降級）：語言特有概念（C++ template、Python decorator）
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

  結構等價的三個判定層次：
  (a) 節點等價：  f(x) ↔ f(x)            → 自動映射
  (b) 子樹等價：  if-else chain ↔ match   → 局部重寫，pattern-based
  (c) 拓撲等價：  RAII ↔ with+try-finally → 依賴圖重著色，不可局部化

  (c) 的核心困難：隱式語義→顯式語義的轉換需要型別語義（哪些物件持有資源），
  這超出語法樹的範圍。

  正確行為：
  (a)(b) → 自動映射
  (c)   → 呈現選項（「可翻譯為 with 語句或 try-finally，各有取捨」），
           由使用者決定，不自動選擇。
           這與 LLM 仲裁的 llm_suggested → user_confirmed 模式一致。
  無對等 → 降級 + 差異報告

語言模型級阻抗（超出形式化範圍）：
  記憶體模型（手動管理 vs GC）、併發模型（goroutine vs pthread）
  → constraints 欄位記錄，但無法自動處理，走降級路徑 + 「需人工調整」
```

跨語言映射時自動偵測 constraints 差異並標記 `semantic_gap`。對 L0-L1 教學場景不需要知道 constraints 差異，但 L2 高階使用者**必須**能看到。

**對 Scope 3 的影響**：跨語言轉換在阻抗-1（控制流）依然實用。但涉及語言特有結構模式（RAII、ownership、goroutine）時，Scope 3 退化為「顯示差異報告」而非「自動轉換」——這是正確的退化。

### 概念命名空間（Namespace）

```
概念的完整 ID = language:package:concept

衝突解決：
  階段 1 — Pattern Match（必要條件）：function name + arg count → 候選清單
  階段 2 — Context Disambiguation：#include / prefix → 精確匹配
  無法精確匹配 → confidence: 'inferred'（不降級為 generic_call）
```

### 概念組合（Composition）

```
複雜概念 = 簡單概念的組合
組合保持語義：meaning(A + B) = meaning(A) + meaning(B)
```

**判定法**：如果一個積木拿掉某個欄位後仍然有意義，那它應該拆成兩個積木。

### 概念角色的語境依賴（Context-Dependent Role）

概念的角色（statement / expression）不是固有屬性，而是**語法語境**決定的：

```
cin >> a >> n >> m;         ← statement（獨立語句）
if (cin >> a >> n >> m)     ← expression（條件）
x = y = 5;                 ← 右側 y = 5 是 expression，整行是 statement
```

**原則**：概念定義一個**主要角色**（ConceptDef.role），投影層負責語境切換。語境切換的規則：

```
Statement → Expression 語境時：
  ① 移除 indent 和語句結尾（分號、換行）
  ② 視覺投影切換為 expression 版積木（output 連接器取代 prev/next）
  ③ 語義不變——同一棵子樹，不同投影
```

**實作約束**：同一概念的 statement / expression 兩個版本的序列化格式（`saveExtraState` / `loadExtraState`）必須完全相容，因為投影層在語境切換時直接搬移 extraState。

### 屬性的結構化邊界（Property Structure Boundary）

SemanticNode 的 properties 是 `Record<string, PropertyValue>`，但何時用字串、何時用結構化物件，需要明確的判定準則：

```
判定準則：如果一個屬性值在管線中需要被拆分或解析，它就不該是字串。

字串適用：值只被完整傳遞或顯示（name: "main"、operator: "++"）
結構適用：值包含多個語義子部分（type+name、format+args）
```

**反例**：`params: ["long long x", "int y"]` 把型別和名稱壓扁成字串，renderer 必須反向解析。正確做法是結構化為 `params: [{ type: "long long", name: "x" }]`。

**推論**：C/C++ 型別系統本身有結構（修飾符 + 基礎型別 + 指標/引用），應視為語義子結構而非原子字串。這在支援 `auto`、模板參數（`vector<int>`）、多維陣列等進階特性時會成為必要條件。

---

## 2.3 開放擴充 P3（Open Extension）

> 系統可以在**不修改既有程式碼**的前提下，加入新概念、新語言、新套件。

### 擴充點

| 擴充什麼 | 加什麼 | 改什麼既有檔案 |
|---------|-------|--------------|
| 新翻譯 | + locale JSON | 無 |
| 新風格 | + style preset | 無 |
| 新套件積木（簡單） | + block JSON（Layer 1） | 無 |
| 新套件積木（需轉換） | + block JSON + transform 註冊（Layer 2） | 無 |
| 新語言概念（複雜） | + block JSON + strategy 註冊（Layer 3） | 無 |
| 新通用概念 | + UniversalConcept type | concept-registry（加一行） |
| 新語言 | + language module | 無（plugin 式載入） |

### Pattern Engine 的多層表達能力

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

### Pattern 歧義偵測與仲裁（Ambiguity Resolution）

開放擴充的前提是：**新增的 pattern 不能改變既有 pattern 的匹配結果。** 當兩個 pattern 可能匹配同一個 AST 節點時，系統必須在**註冊時**就判定如何處理。

Pattern 的 constraints 集合形成偏序關係（⊆）。歧義的處理取決於偏序是否可比較：

```
歧義仲裁規則（Registration-time enforcement）：

∀ pattern A, B ∈ Registry, A.nodeType = B.nodeType:

  情況一：偏序可比較（A.constraints ⊂ B.constraints）
    → A 更寬泛，B 更特化
    → 安全仲裁：最特化匹配（B 優先）
    → 這是 DSL 擴充的正常模式——特化已有 pattern，不需要改寫為 Layer 3

  情況二：偏序不可比較（A ∩ B ≠ ∅ 但 A ⊄ B 且 B ⊄ A）
    → 交叉歧義，無法安全仲裁
    → 報註冊錯誤：
       "Pattern {A.conceptId} 和 {B.conceptId} 對 nodeType '{nodeType}' 存在交叉歧義。
        請合併為 hand-written lifter 處理。"

  情況三：不相交（A ∩ B = ∅）
    → 無歧義，各自匹配
```

**同套件 vs 跨套件**：同一套件（同一 JSON 檔）的 pattern 開發者有義務自洽——偏序可比較的情況應儘量避免，改為在一個 pattern 中用 constraints 區分。跨套件的 pattern 允許偏序特化，這是「擴充已有語言模組」的正當用途。

**空 constraints 的處理**：`constraints: []` 意味著匹配該 nodeType 的所有 AST 節點。如果該 nodeType 只有一個 pattern，這是安全的。如果有多個 pattern，空 constraints 的 pattern 自動成為最寬泛的兜底（被任何有 constraints 的 pattern 特化），這是可預測的。

**逃生口**：如果同一個 nodeType 需要根據內容映射到不同概念（如 `unary_expression` 可能是 `-x`、`&x`、`*p`、`!flag`），且 constraints 之間的關係是交叉的，正確做法是使用 Layer 3 的 hand-written liftStrategy，在一個 strategy 函式中處理所有分支。

**設計原則**：偏序可比較→自動仲裁（低門檻），偏序不可比較→強制手寫（高門檻但安全）。這在開放擴充性和匹配可預測性之間取得了平衡。

### Language Layer 子模組結構

```
Language Layer (e.g., C++)
├── Core     — 語言核心語法（pointer, struct, template）
├── Stdlib   — 標準函式庫（containers, algorithms, io, strings）
└── External — 第三方函式庫（未來擴充點）
```

### DependencyResolver：語言模組的依賴推導職責

每個語言模組負責提供自己的 `DependencyResolver` 實作。核心引擎只定義介面：

```typescript
interface DependencyResolver {
  resolve(conceptIds: string[]): DependencyEdge[]
}

interface DependencyEdge {
  sourceType: 'builtin' | 'stdlib' | 'external'
  directive: string        // 語言特定的 import 指令，如 '#include <iostream>'
  packageSpec?: string     // external 時的套件規格，如 'boost::filesystem'
}
```

DependencyResolver 是 **Scope 3 的索引建構器**，不屬於 generator pipeline——它在 project() 之前獨立運行，將概念使用集合映射為依賴邊集合（見 §1.3 結構性依賴宣告）。新語言只需註冊自己的 resolver，無需修改核心引擎，符合 P3 的開放擴充原則。

C++ 範例：概念集合 `{cout, endl, vector}` → resolver 輸出 `[{directive: '#include <iostream>'}, {directive: '#include <vector>'}]`。

### 套件積木的標準定義格式

```jsonc
{
  "id": "cpp_find", "language": "cpp", "category": "algorithms",
  "concept": { "abstractConcept": "collection_search", ... },
  "blockDef": { "type": "cpp_find", "message0": "...", "colour": "#4C97FF" },
  "codeTemplate": { "pattern": "std::find(${BEGIN}, ${END}, ${VALUE})", "imports": ["algorithm"] },
  "astPattern": { "nodeType": "call_expression", "constraints": [...] }
}
```

### 概念的生命週期

```
階段 0: 不認識         → raw_code 降級
階段 1: 認識但無積木    → 通用 func_call 降級
階段 2: 有專屬積木      → 完全支援
階段 3: 有 abstract 映射 → 可跨語言轉換
```

---

## 2.4 漸進揭露 P4（Progressive Disclosure）

> 同一個語義結構，在不同認知維度顯示不同的概念子集和結構範圍。

P4 有兩個正交的維度：

### 概念層級（Concept Level）

概念層級是一個**樹狀結構**，而非線性序列。學習者從根節點出發，沿不同分支展開可見概念。

```
         L0（根）
        /    \
      L1a    L1b
      / \      \
   L2a  L2b   L2c
```

**倍增軟指引**：每往下一層，新增的可見積木數量約為上一層的兩倍。這是認知負載管理的啟發式原則，不是硬約束：

```
L0:  ~8 個積木      （基礎 I/O、變數、條件、迴圈）
L1:  ~16 個積木     （含 L0，新增函式、for、邏輯運算等）
L2:  ~32 個積木     （含 L0+L1，新增陣列、字串、進階特性等）
L3:  ~64 個積木     （含 L0+L1+L2，新增泛型、元程式等）
LN:  框架允許追加更高層級
```

**分支可疊加**：樹的分支不是互斥的。學習者可以同時啟用多個分支，看到的積木是所有已啟用分支的聯集（union）。這與 User Context 的慣性快取（§3.2）模型一致——系統記住使用者已探索的分支，不強制選擇單一路徑。

### 主題（Topic）

**同一語言在不同主題下，概念的層級樹、積木呈現、甚至積木的輸入欄位都可能不同。** Topic 是控制這種情境差異的維度。

```
語言: C++
  ├─ Topic: 初學 C++
  │    L0: 變數、print(cout)、if、while
  │    L1: 函式、for、陣列
  │    L2: 指標、struct、STL
  │
  ├─ Topic: Arduino
  │    L0: digitalRead、analogWrite、delay、Serial.print
  │    L1: if、for、函式、中斷
  │    L2: 類別、指標、進階感測器
  │
  └─ Topic: 競賽程式
       L0: 快速 I/O(scanf/printf)、變數、陣列
       L1: 排序、二分搜、遞迴、字串
       L2: 動態規劃、圖論、進階資料結構
```

三者共用同一套 C++ 語言模組（generator/lifter 不變），但投影方式完全不同。

**Topic 的設計原則**：

1. **Topic 是純投影層概念，不污染語義層**。SemanticNode 不知道 Topic 的存在。Lifter 保持 Topic-agnostic——盡可能辨識所有概念，Topic 只在投影端決定哪些概念可見、如何呈現。

2. **Topic 可覆蓋 BlockSpec 到欄位層級**。同一個概念在不同 Topic 下可以有不同的積木形狀：

```
概念: print
  初學 C++：一個 VALUE 輸入，自動加 endl
  Arduino：  一個 VALUE 輸入 + SERIAL_PORT 下拉選單
  競賽程式：FORMAT 文字欄位 + 多個 ARG 輸入（printf 風格）
```

三者的 SemanticNode 都是 `print`，但投影出的積木形狀不同。SemanticNode 的 properties 存完整資訊（語義上有意義的屬性都存），Topic 控制哪些屬性投影為積木欄位、哪些隱藏並使用預設值。

3. **Topic 定義結構**：

```typescript
interface Topic {
  id: string                         // 'cpp-beginner', 'cpp-arduino', 'cpp-competitive'
  language: string                   // 'cpp'
  name: string                       // '初學 C++'
  levelTree: LevelNode               // 樹狀層級定義
  blockOverrides?: Record<ConceptId, BlockOverride>
}

interface LevelNode {
  level: number
  label: string                      // 'L0: 基礎輸出入'
  concepts: ConceptId[]              // 這一層新增的概念
  children: LevelNode[]              // 分支路徑（可疊加）
}

interface BlockOverride {
  message?: string                   // 覆蓋積木顯示文字
  tooltip?: string                   // 覆蓋提示
  args?: BlockArg[]                  // 覆蓋輸入欄位定義
  renderMapping?: RenderMapping      // 覆蓋欄位↔屬性映射
}
```

4. **base + override 模型**：大部分概念在多數 Topic 下的積木形狀相同。Topic 只需定義與 base BlockSpec 不同的部分（override），沒有 override 就 fallback 到 base。這避免了 `(概念 × Topic × Level)` 的組合爆炸。

### 結構範圍（Structure Scope）

結構範圍是一個**開放非負整數序數**，N 越大越廣。已知實例：

```
S0 語句 → S1 函式 → S2 檔案 → S3 模組 → S4 專案 → S5 系統 → SN ...
```

組合形成學習路徑：初學者 L0×S0-S1 → 進階者 L1×S1-S2 → 高階者 L2×S2-S3 → 架構師 L2×S3-S5。

**重要**：這不是簡化，是**過濾**。語義結構始終完整，只是投影時隱藏超出層級的節點。

### 概念表面形態（Surface Form）

概念層級控制**哪些概念可見**，表面形態控制**同一概念展示多少結構**。兩者正交：

```
概念: if
  F0 基礎形態：if (condition) { body }
  F1 擴展形態：if (condition) { body } else { body }
  F2 完整形態：if / else if / else if / ... / else

同一個概念、同一個層級，只是 mutator 暴露不同結構深度。
```

表面形態用 toolbox 的 `extraState` 預配置實現——同一積木類型配置不同的初始結構。每個形態可獨立設定認知層級（例如 F0/F1 在 L0，F2 在 L1），由 `buildToolbox()` 過濾。

**與概念層級的區別**：概念層級在概念之間篩選（if 和 switch 是不同概念），表面形態在概念內部篩選（if 和 if-else 是同一概念的不同深度）。

### P4 與投影種類的關係

| Scope | 可編輯視圖（R0-R1） | 唯讀視圖（R2-R4） |
|-------|-------------------|------------------|
| S0-S1 | 積木、程式碼、鷹架視圖 | 流程圖、執行動畫、執行軌跡、敘事 |
| S2 | 程式碼、積木、語法高亮 | 檔案大綱、狀態機圖、型別資訊 |
| S3-S4 | — | 呼叫圖、依賴圖、類別圖、序列圖、資料流圖 |
| S5 | — | 系統拓撲圖、API 表面、協定 Schema |

高 Scope 沒有 R0-R1 投影——這不是缺陷，而是本質：跨檔案/跨系統的結構過於複雜，無法在單一視圖中無損編輯，必須回到子 Scope 的可編輯視圖中修改。

### P4 與認知負荷的關係

- **L0**：鷹架最強——外在負荷被積木形狀消除，概念集最小
- **L1**：鷹架適度——引入語言專屬概念
- **L2**：鷹架最弱——接近文字程式碼，準備過渡

層級切換是**控制在 ZPD 內可見的概念數量**。Topic 決定學習路徑的分支結構——不同 Topic 的 L0 可能包含完全不同的概念集合，但認知負載的倍增軟指引統一適用。

### 層級轉換穩定性（Level Transition Stability）

鷹架的撤去必須是漸進的——Vygotsky 的原意是逐步減少支撐，不是瞬間抽走。P4 的層級切換是離散跳躍，必須遵守穩定性約束以避免認知斷崖：

```
層級轉換不變式：
  ∀ concept C, level L₁ < L₂:
    如果 C 在 L₁ 可見，則 C 在 L₂ 的呈現（message、顏色、形狀）不變。
    L₁ → L₂ 的變化只來自新概念的加入，不來自舊概念的改變。
```

**推論**：
- **Message 穩定**：`if` 在 L0 叫「如果」，在 L1 仍然叫「如果」——不會因為進入進階層級就變成 `if statement`
- **差異可見**：L1 新增的概念應有視覺標記（如「新」徽章或漸入動畫），讓學習者知道哪些是新的、哪些是已熟悉的
- **單調遞增**：toolbox 只增不減——高層級包含低層級的所有概念

這是 Sc4（最小驚訝）在層級維度上的直接推論：**學習者已經建立的心智模型不應被層級切換破壞。**

| 層級 | Message 策略 | Tooltip 策略 |
|------|-------------|-------------|
| L0 | 完全口語 | 生活比喻 |
| L1 | 保留關鍵術語 | 技術說明 + 場景 |
| L2 | 可用更多術語 | 重點放在「什麼時候用」 |
| LN+ | 由該層級定義者決定 | 由該層級定義者決定 |

### 基礎設施的漸進揭露（Progressive Disclosure of Infrastructure）

程式的 boilerplate（includes、namespace 宣告、main 包裝、return 0）構成一個 **Program Scaffold**。這些全部是 Scope 3 的衍生投影（§1.3 結構性依賴宣告），P4 應統一控制其可見性：

```
L0：完全隱藏 — 零認知負荷，學習者只看到自己寫的邏輯
L1：幽靈行（ghost lines） — 可見但自動管理，hover 顯示原因（如「因為你用了 cout」）
L2+：使用者自行管理 — 缺失依賴觸發警告，不自動補全
```

這是**過濾（filtering），不是簡化（simplification）**——依賴圖始終完整存在於語義樹中，P4 只控制哪些投影到使用者可見的 view 上。統一的 scaffold 策略確保每個 boilerplate 項目不會各自成為獨立的 ad-hoc 特殊處理，而是由同一個 scaffold visibility 機制管理。

---

# 第三層：架構與實踐

## 3.1 架構維度

```
┌─ Scope ─────────────────── 觀察範圍（開放序數：S0 語句 → S1 函式 → ...）──┐
├─ View Type ────────────── 投影種類（開放集合：文字/視覺/行為/分析/...）────┤
├─ View Params ──────────── 投影參數（每種 viewType 各自的參數空間）─────────┤
├─ Topic ───────────────── 主題（同語言不同情境的層級樹和積木覆蓋）──────┤
├─ Concept Layer ─────────── 概念代數（開放有序集：universal → lang-core → ...）┤
├─ Language Layer ────────── 語言專屬（型別、語法、慣例）─────────────────────┤
├─ Locale ───────────────── 自然語言（zh-TW / en / ...）──────────────────┤
├─ User Context ─────────── 使用者模型（慣性快取 + 角色意圖）─────────────────┤
├─ ... ──────────────────── 框架允許追加新維度 ────────────────────────────┤
└──────────────────────────────────────────────────────────────────────────┘
```

每一層獨立可配置、獨立可擴充。維度集合本身也是開放的——如果發現現有維度無法覆蓋的正交配置需求，可追加新維度。Topic 決定概念的層級樹和積木覆蓋（§2.4），與 Language 正交——同一語言可有多個 Topic（初學 C++ / Arduino / 競賽程式），不同語言也可共享相似的 Topic 結構。View Params 的內容隨 View Type 而變——Code Style、Block Style、Layout Algorithm 等都是特定 viewType 的 View Params。User Context 不直接影響投影結果，而是作為 View Params 的**推導來源**——當使用者沒有明確指定參數時，系統從慣性快取和角色意圖中推導預設值。

---

## 3.2 配置結構

以下是目前已實現的兩種 viewType（`code` 和 `blocks`）的 View Params 範例。其他 viewType（如 flowchart、execution 等）將在實現時定義各自的參數空間，遵循相同的正交性原則（§2.1）。

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

### Toolbox 的多維度來源

Toolbox（工具箱）顯示的積木集合由多個正交維度共同決定，但各維度的職責不同：

```
積木是否存在於 Toolbox = f(Topic, P4 概念層級, View Params)

其中：
  Topic（主題）     → 控制「層級樹的結構」和「積木的形狀覆蓋」
  P4 概念層級（Level）  → 控制「在該 Topic 的層級樹中，哪些概念可見」（可見性）
  View Params           → 控制「同一概念怎麼呈現」（呈現選擇）
    ├─ Code Style       → APCS 顯示 cout 積木，競賽顯示 printf 積木
    ├─ IO Preference    → iostream vs cstdio（與 Code Style 連動）
    └─ Language         → 決定語言專屬積木的可用集合
```

**三者的職責區分**：
- **Topic** 決定「這個情境下，層級樹長什麼樣、每一層有哪些概念、積木形狀是否需要覆蓋」
- **P4 Level** 在 Topic 定義的層級樹中，決定「使用者目前展開到哪一層」
- **View Params** 決定「可見概念的呈現細節（顏色、風格、語言等）」

例如：`print` 概念在「初學 C++」Topic 的 L0 就可見，積木有一個 VALUE 輸入；在「Arduino」Topic 的 L0 也可見，但積木多一個 SERIAL_PORT 下拉選單（Topic 的 BlockOverride）；投影為 cout 還是 printf 是 Code Style 的 View Params 決定的。三個維度正交，不應混合。

### User Context（使用者上下文）

使用者與系統的互動會累積隱式知識——偏好、習慣、決策歷史。這些知識統稱為**慣性（Inertia）**。系統應記住慣性以減少重複操作的摩擦，但慣性不改變投影定理的數學性質，只影響 viewParams 未指定時的預設值推導。

#### 慣性的三層結構

```
Layer 0: 語境慣性（Context Inertia）
  同一個 session 內，前面的操作影響後面的預設值。
  ├─ 符號表：檔案內的變數/函式宣告追蹤（已存在於 lift()）
  ├─ Style 延續：前面用了 cout → 後續新增的 print 也預設投影為 cout
  └─ 格式延續：選了 4-space 縮排 → 新生成的程式碼沿用
  儲存：記憶體（session 結束即消失）

Layer 1: 個體慣性（Individual Inertia）
  跨 session，同一個使用者的偏好和歷史。
  ├─ Style 偏好：上次使用的 Code Style / Block Style preset
  ├─ 操作頻率：最常用的積木、最常選的變數名
  ├─ 決策記錄：跨語言映射或 LLM 建議時使用者選過的方案
  └─ 視圖偏好：偏好哪種投影、zoom level、面板配置
  儲存：localStorage 或使用者設定檔（跨 session 持久化）

Layer 2: 群體慣性（Collective Inertia）
  跨個體，一個組織/團隊/班級的共享設定。
  ├─ 編碼規範：Google Style / APCS Style / 競賽 Style
  ├─ 概念白名單：本專案/本學期只用到的概念子集
  ├─ 命名慣例：專案內的命名模式
  └─ 自定義 pattern：團隊的 macro/idiom 辨識規則（P3 擴充）
  儲存：共享設定檔（由管理者發佈，成員繼承）
```

#### viewParams 的解析順序

當使用者沒有明確指定某個 viewParam 時，系統從慣性快取中推導：

```
resolvedParams = resolve(explicitParams, userContext)

解析優先順序（高→低）：
  ① 使用者明確指定（本次操作的參數）
  ② 語境偵測（檔案自身的 style，由 detectStyle() 推斷）
  ③ 群體設定（團隊/班級規範）
  ④ 個體慣性（歷史偏好）
  ⑤ 系統預設值
```

**語境偵測優先於個體慣性**——因為打開別人的程式碼時，應該尊重程式碼本身的 style，而非把自己的偏好強加上去。群體設定優先於個體慣性——因為團隊一致性比個人偏好重要。

#### 角色意圖（Role Intent）

不同角色對慣性的期待不同。角色意圖不是使用者屬性，而是**當下的互動模式**——同一個人在不同場景可能切換角色：

| 角色 | 慣性策略 | 典型場景 |
|------|---------|---------|
| **learner** | 慣性 + 教育引導——可能主動打破慣性推薦新概念 | 學生練習、自學入門 |
| **developer** | 慣性 + 效率優先——尊重偏好，不主動干預 | 日常開發、程式碼維護 |
| **reviewer** | 群體設定優先——強調團隊規範，個人偏好次之 | code review、程式碼審查 |
| **instructor** | 設定群體慣性——定義課程的 level 上限和 style 規範（見下方覆蓋權限） | 教師備課、課程管理 |
| **explorer** | 最少慣性——每次探索可能用完全不同的設定 | 實驗新語言、嘗試新功能 |

#### 群體設定的覆蓋權限

群體慣性中的每項設定區分兩種強度：

```
mandatory（強制）：
  個體慣性無法覆蓋。適用於影響正確性或一致性的設定。
  例：instructor 限定 level ≤ 1（學生無法自行切到 L2）
  例：團隊強制 Google Style（成員無法切換為 APCS Style）
  UI 表現：設定項目為灰色，顯示「由 [管理者名稱] 鎖定」

recommended（建議）：
  個體慣性可覆蓋，但會標記偏離。適用於偏好性設定。
  例：instructor 建議用 iostream（學生可切換為 cstdio，但顯示提示）
  例：團隊建議 snake_case（成員可用 camelCase，但 lint 會提示）
  UI 表現：設定項目可編輯，旁邊顯示「建議：[群體設定值]」
```

**解析順序修正**：mandatory 群體設定的優先順序高於使用者明確指定——這是唯一一種使用者無法覆蓋的情況。完整順序：

```
resolvedParams 的解析順序（修正版）：
  ① mandatory 群體設定（不可覆蓋）
  ② 使用者明確指定（本次操作的參數）
  ③ 語境偵測（檔案自身的 style）
  ④ recommended 群體設定（可被 ②③ 覆蓋）
  ⑤ 個體慣性（歷史偏好）
  ⑥ 系統預設值
```

#### 三種關鍵快取

**1. Style Resolution Cache**

```
使用者打開一份檔案時的 style 推導：
  ① 檔案內有程式碼 → detectStyle()   → 語境慣性（最高優先）
  ② 專案有設定檔    → 群體設定        → 第二優先
  ③ 使用者有歷史    → 上次的 style    → 第三優先
  ④ 都沒有          → 系統預設
```

解決的問題：打開一份用 printf 寫的程式碼時，即使使用者的個人偏好是 iostream，系統也能正確辨識並沿用 printf style。

**2. User Decision Cache**

```
跨語言轉換或 LLM 建議時，使用者做過的決策被記住：
  第一次：「C++ 的 RAII 轉 Python 用什麼？」→ 使用者選 with 語句
  第二次：遇到同樣的 pattern → 直接套用上次決策
  UI 顯示：「已套用你上次的選擇（RAII → with）」，可一鍵改
```

解決的問題：大規模跨語言轉換中避免重複回答相同問題。快取的粒度是 `(source_concept, target_language) → user_choice`。

**3. Concept Familiarity Profile**

```
根據使用者的操作頻率，調整介面佈局：
  從未使用 template → toolbox 中 template 區域預設摺疊
  頻繁使用 STL 容器  → toolbox 中容器區域置頂
  偏好拖拽而非打字   → 三模式參數預設 select 模式
```

解決的問題：減少視覺噪音，讓常用功能更容易觸及。這是純 UX 優化，不限於教育場景。

#### 慣性不是原理

慣性不屬於第一層或第二層——它不改變語義結構的定義（根公理）、投影的數學性質（P1）、概念的代數結構（P2）、擴充的架構（P3）、或揭露的層級（P4）。慣性是第三層的實踐策略：**讓系統從「每次從零開始」變為「記住你是誰、你上次做了什麼」。** 使用者感知的差異巨大，但底層的投影管線完全不變。

---

## 3.3 應用指引

### 各子系統 checklist

| 子系統 | 關鍵原則 |
|--------|---------|
| **i18n** | P1：Locale 是投影參數。根公理：message/tooltip 是呈現資訊，分離到 locale 檔案 |
| **coding style** | P1：Code Style 是 `code` viewType 的 viewParams，切換 = 重新投影 |
| **block style** | P1：Block Style 是 `blocks` viewType 的 viewParams。Sc4：預設值符合學習者閱讀習慣 |
| **多語言支援** | P2：區分概念分層。跨語言走 abstract concept 映射（R2-R3 投影） |
| **R0-R1 投影** | 根公理：建立顯式語義樹。P1：roundtrip 是判定標準。P3：Pattern Engine 是唯一管線 |
| **R2-R4 投影** | P1：唯讀視圖無需 roundtrip，但需保證投影完整性（不遺漏節點） |
| **外部套件** | P2：辨識語義角色。P3：只加 JSON + 可選註冊。P4：決定認知層級 |
| **主題（Topic）** | §2.4 Topic：同語言不同情境有不同層級樹。Topic 是投影層概念，不污染語義層。base + override 避免組合爆炸 |
| **使用者上下文** | §3.2 User Context：慣性是 viewParams 的推導來源，不是新原理。解析順序：明確指定 > 語境偵測 > 群體 > 個體 > 預設 |

### 積木設計準則

```
Sc3 認知一致性 → 一個積木 = 一個語法結構，不多不少
Sc2 鷹架可退場 → 積木概念必須在文字程式碼中有直接對應
Sc4 最小驚訝   → 積木行為和生成的程式碼一致
Sc1 鷹架可調   → 同一概念在不同層級提供不同程度的輔助
CLT           → 每個積木最小化外在認知負荷
```

### 積木文字設計準則

- **Message**：動詞 + 身份 + 名稱，回答「對誰做什麼」。串起來讀起來像一段中文敘述。
- **Tooltip**：一句定義 + 一句場景 + 注意事項。Universal 用生活比喻，Advanced 重點放在「什麼時候用」。
- **Dropdown**：型別 `英文術語（中文）`，運算子 `中文（符號）`。型別清單由語言模組提供。
- **語法隔離**：積木上不出現目標語言的語法符號（`@`、`*/`、`<<`、`;`）。例如 doc comment 的 mutator 用「參數」和「回傳」而非 `@param` 和 `@return`。語法符號是程式碼投影的細節，不是積木投影的一部分。
- **Mutator 一致性**：mutator 彈窗中的 container / item label 遵守與主積木相同的文字設計準則。使用者看得到的所有文字都是介面。

### 最終檢驗表

| 問題 | 回到哪條 |
|------|---------|
| 兩種視圖不一致了 | **根公理**：所有視圖都是同一棵語義樹的投影 |
| 要不要支援某種投影 | **P1**：確定可逆性等級（R0-R4）和參數空間 |
| 轉不了怎麼辦 | **P1**：不存在轉不了——只有降級程度 |
| 積木該歸哪類 | **P2**：它映射到哪個抽象概念？ |
| 測試夠不夠完整 | **P2**：ConceptRegistry 每個條目的四條路徑都通過嗎？ |
| 加新套件要改哪些檔案 | **P3**：只加 JSON，不改既有程式碼 |
| 初學者看到太多積木 | **P4**：過濾層級，不是刪除概念 |
| 同語言但不同教學情境 | **Topic**：同語言不同 Topic 有不同的層級樹和積木覆蓋（§2.4）|
| Topic 切換後積木形狀變了 | **Topic**：SemanticNode 存完整屬性，Topic 只控制投影可見性和欄位覆蓋 |
| 積木設計對學習者有幫助嗎 | **Sc3**：映射到真實的程式結構嗎？ |
| 積木應該多複雜 | **CLT**：最小化外在負荷，一個積木做一件事 |
| 積木會不會變成依賴 | **Sc2**：切到文字後能理解嗎？ |
| 積木排版要水平還是垂直 | **View Params**：`blocks` 的投影參數，不是結構決策 |
| 要不要支援多檔案 | **根公理**：Scope 3+ 加圖邊即可 |
| 外部套件不理解怎麼辦 | **P2 降級 + 可插拔執行**：語義契約引用 + 最適後端執行 |
| 怎麼讓程式可以共享 | **語義套件**：語義結構 + 投影定義 + 多後端執行體 |
| 每次打開都要重新設定 style | **User Context**：慣性快取，解析順序 §3.2 |
| 打開別人的程式碼 style 錯了 | **User Context**：語境偵測（detectStyle）優先於個體慣性 |
| 跨語言轉換一直問相同問題 | **User Context**：User Decision Cache 記住使用者選擇 |
| 不同角色對介面需求不同 | **User Context**：角色意圖（Role Intent），同一人可切換角色 |
| LLM 該放在哪裡 | **Guardrails 之上**：LLM 是語用分析師 |

---

# 第四層：願景

## 4.1 執行模型

> 執行模型在理論上屬於 P1 投影定理的一種實例（行為族投影），但因實作複雜度高且尚未實現，歸入願景層。

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

## 4.2 語義套件與效能市場

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

## 4.3 AI 輔助：LLM 作為語用分析師

### 為什麼 LLM 不能是核心

語義結構是確定性的，LLM 是機率性的。如果讓 LLM 當核心引擎，語義結構從 source of truth 變成「LLM 覺得大概是這樣」。正確定位：**語義結構提供 guardrails，LLM 在 guardrails 內活動**。

### LLM 參與的位置

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
│  ├─ AST constraints / ConceptRegistry（P2）   │
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
| 安全網 | 無法匹配 | 也沒建議 | 降級 | `raw_code` |

**confidence 完整層級**（高到低）：

```
high            ← 確定性系統完全驗證
warning         ← 結構匹配但語義可疑（附帶 warning_reason）
inferred        ← 確定性系統的啟發式推斷
user_confirmed  ← LLM 建議 + 使用者接受 + roundtrip test 通過
llm_suggested   ← LLM 建議，未經驗證（暫存狀態，不參與 roundtrip）
raw_code        ← 降級為 raw_code
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

### Soundness vs Correctness

Guardrails 保證的是**結構健全性（soundness）**，不是**語義正確性（correctness）**。這兩者有本質區別，對應 §1.5 三維錨定的不同維度：

```
Soundness（系統保證——公理維度 Protocol）：
  LLM 輸出的結構 S' 是合法的語義結構
  → 可無損投影到所有視圖
  → Roundtrip test 通過：lift(project(S')) ≡ S'
  → ConceptRegistry 路徑完備

Correctness（使用者維護——主體維度 Agency）：
  S' 是否符合使用者意圖
  → 只有使用者能判斷
  → 但使用者的判斷不是任意的——它服務於程式邏輯的內在健全性

Adequacy（數據驗證——情境維度 Data）：
  S' 是否在實際環境中產生預期行為
  → Round-trip test、執行測試、User Context 數據
  → 客觀可量測，不依賴主觀判斷
```

**管家式職責分工（Stewardship Model）**：

```
人類的角色不是「創造真理」，而是「維護健全性」。

人類不是在「發明」一個新的程式結構
  → 而是利用系統提供的概念代數（P2）來實踐一個具體目標
  → 人類的意圖必須服務於程式的邏輯健全性
  → 「我想讓它做 X」受制於「X 在這個語義結構中是否有意義」

LLM 的角色不是「替代人類判斷」，而是「提供機率性輔助」
  → LLM 的建議是基於大量數據的模式辨識（情境維度）
  → 它不能動搖系統底層的確定性公理（公理維度）
  → 即使「很有信心」也不能自動寫入——類比：AI reviewer 可以留言，不能 merge
```

**可審查性是 correctness 的前提**。系統保證 soundness，使得 LLM 的輸出可以被無損投影到使用者理解的視圖中（積木、程式碼、流程圖），從而讓使用者有能力判斷 correctness。如果投影本身有資訊丟失（如 `raw_code` 降級），使用者的審查也是不完整的——這是 `raw_code` 降級的另一層代價。

**confidence 的三維解讀**：`user_confirmed` 不代表「系統驗證為正確」，而是「三個維度中，公理（roundtrip 通過）和主體（使用者接受）都已確認，但情境（長期數據）仍在累積」。

使用者確認不等於語義正確——roundtrip test 是不可跳過的客觀閘口。L0 使用者可能不懂 LLM 建議的正確性，但 roundtrip test 不依賴使用者的認知能力。

**LLM 不能自動寫入語義結構**——即使「很有信心」。類比：AI reviewer 可以留言建議，但不能自己 merge PR。

---

## 4.4 相關工作與差異

| 專案 | 做了什麼 | 對應原則 | 本質差異 |
|------|---------|---------|---------|
| **Unison** | AST hash 內容定址 | 根公理、Scope 4-5 | Hash 語法層 vs 我們 hash 語義層 |
| **Hedy** | 漸進式教學語言 | P4 漸進揭露 | 每個 Level 是不同語法 vs 我們只改投影解析度（scaffolded R1） |
| **Blockly/Scratch** | 積木→程式碼單向生成 | P1 投影定理 | 單向 R4 vs 雙向 R0 roundtrip |
| **LSP/LSIF** | 跨檔案符號索引 | Scope 3-5 語義圖 | 位置導向 vs 語義導向 |
| **WebContainers** | 瀏覽器 WASM 執行 | 可插拔執行 | 通用環境 vs 語義直譯器 + 可插拔後端 |
| **IPFS** | 內容定址分散式儲存 | 語義套件分發 | 儲存層 vs 語義層 |

**獨特定位**：不是在語義層之上疊加積木、程式碼、執行，而是**只有語義層，其他都是投影**。開放的投影族（文字、視覺結構、行為、分析、教育、可及性、分發等）統一為同一個投影管線，可逆性從 R0（雙射）到 R4（單向）分級。

---

## 4.5 自舉與元教學（Meta-Progressive Disclosure）

### 核心同構：教學路徑即語義樹

語義樹（Semantic Tree）描述程式的結構，Topic 層級樹（Level Tree）描述知識的結構。這不是比喻——它們在數學結構上同構：

```
語義樹 (Semantic Tree)     ≅     教學層級樹 (Topic Level Tree)
   ↓                                  ↓
程式的結構                          知識的結構
   ↓                                  ↓
積木/程式碼 = 投影                   課程/練習 = 投影
```

這意味著 P1-P4 不只適用於「程式碼↔積木」轉換，它們是**認知投影的通用公理**。當系統優化教學路徑時，它實際上是在對自身的知識結構進行投影優化——這構成了自舉的基礎。

### 漸進揭露的注意力遮罩

P4（漸進揭露）的本質是：**語義結構始終完整，只有可見集合隨脈絡改變**。所有的「選擇性呈現」都可以統一理解為**注意力遮罩函數** `mask(context) → VisibleSet`——結構始終完整存在（全局權威），遮罩決定當前「注意什麼」：

| 注意力遮罩類型 | context 參數 | 已實現 |
|---------|-------------|--------|
| **教學注意力** | 學習者的 enabledBranches | 是（Topic Level Tree） |
| **風格注意力** | Code Style 偏好 | 是（Style Preset） |
| **鷹架注意力** | Program Scaffold 層級 | 是（L0 隱藏→L1 ghost→L2+ 手動） |
| **ZPD 注意力** | 學習者的近側發展區（自動偵測） | 否（未來） |
| **領域注意力** | 跨學科的語義投射 | 否（未來） |
| **多頭投影** | viewType（積木/程式碼/流程圖/敘事） | 部分（積木+程式碼） |

**與 Transformer 的類比**：固定的 L0→L1→L2 線性解鎖類似 RNN 的步進遞迴——每一步只看前一步的輸出，容易卡在局部最佳解。現在的 Topic + enabledBranches 架構類似 Transformer 的自注意力（Self-Attention）——結構從一開始就完整存在，注意力遮罩決定當前可見的子集，任何節點都可以直接「關注」任何其他節點而不受順序限制。多維投影（同一語義樹同時投射為積木、程式碼、流程圖、敘事）類似 Multi-head Attention，每個「注意力頭」提供不同角度的認知理解。

如果說遞迴式的自舉是「自舉（Self-bootstrap）」，那注意力式的全局影響力可以稱為**自影響力（Self-Attention / Self-Influence）**——系統中每個概念都能同時影響和被影響，不受線性教學順序的限制。

### 映射還原：教學路徑的結構發現

當系統不斷優化其層級樹（P4）時，它不是在「發明」更好的教學路徑——而是在**還原知識的內在結構**（§1.5 發現大於發明）。AI 領域的自蒸餾（Self-distillation）類比仍然有效，但優化目標需要精確化：

```
第 1 代層級樹：教育專家手動設計（初始映射）
     ↓ 累積 User Context（學習軌跡、成功率、ZPD 數據）
第 2 代層級樹：系統根據數據修正映射（數據驗證）
     ↓ 結構還原
第 N 代層級樹：以更精確的結構映射同樣的邏輯秩序
```

**優化目標的修正**：

```
原本：效能最大化（學習者速度最快 = 最好）
  → 風險：過度適應使用者偏好，偏離知識的客觀結構

修正後：結構還原度最大化（映射越接近知識的內在結構 = 越好）
  → 約束：最佳化路徑受公理維度（Protocol）定錨
```

關鍵差異：AI 自蒸餾優化的是**參數（Weights）**，趨近同一個目標；這裡優化的是**結構（Structure）**，並利用這個結構來管理其自身的複雜度。知識的投影效率（Distillation Efficiency）提高了，後來的學習者能以更快的速度達到收斂。

**不可變原形（Static Prototype）**：

自蒸餾過程必須引入一個不隨迭代改變的參照基準——系統的「固定點」：

```
不可變原形 ≡ 概念代數（P2）的四路完備性

lift → render → extract → generate 四路閉合
  → 這個性質不隨 Topic 層級樹的優化而改變
  → 無論教學路徑怎麼調整，四路完備性是所有概念的硬約束
  → 如果某次自蒸餾的結果違反四路完備性 → 回退（不是放寬約束）
```

具體而言：任何一代層級樹的優化，都必須通過以下檢查點：

```
自蒸餾檢查點（每次迭代）：
  1. Protocol 對齊：新的層級樹不違反四路完備性（不可變原形）
  2. Data 驗證：新的層級樹在實際學習數據上表現不劣於前代
  3. Agency 簽署：教育專家或系統管理員審查並接受變更

缺少任一維度 → 拒絕本次迭代（見 §1.5 三維錨定規則）
```

**教學套件化**：優秀的教學路徑可以被封裝為語義套件（§4.2），跨語言、跨 Topic 共享。這使得**對知識結構的發現**本身成為可複用的語義結構——不是個人發明，而是集體發現的累積。

### 精密摩擦控制（Precision Friction Control）

P4 是「移除遮罩以揭露更多」；精密摩擦是逆向操作——**主動加入遮罩以製造挑戰**：

```
reveal(node)    = mask.remove(node)    // 漸進揭露：降低認知負荷
challenge(node) = mask.add(node)       // 精密摩擦：製造有效挑戰
```

目的不是讓學習變得「容易」，而是讓「努力」變得「精確」——消除無效痛苦，保留有效挑戰。

具體機制：當學習者對某個模式的 round-trip 成功率達到閾值時，系統可以：
- 遮蔽該概念的某些投影，迫使學習者用更基本的積木重建（降級路徑 D1→D2 的逆向利用）
- 在最熟練的路徑上引入語義阻抗，促進跨領域聯想
- 防止認知懶惰和局部最佳解

### 認知外骨骼

系統的最終形態不是替人思考的 AI，而是**認知外骨骼**：

```
┌─────────────────────────────────────────────────┐
│  人類意圖 = 神經訊號（定義「為什麼」）              │
├─────────────────────────────────────────────────┤
│  元教學腳本 = 傳動系統（管理複雜度的輸出）          │
│  ├─ 注意力遮罩（P4）：控制認知負荷                 │
│  ├─ 精密摩擦：製造有效挑戰                        │
│  └─ 自蒸餾：遞迴優化教學路徑                      │
├─────────────────────────────────────────────────┤
│  語義投影 = 感知系統（讓你看見結構）                │
│  ├─ 多維投影：積木/程式碼/流程圖/敘事               │
│  └─ ZPD 自適應：動態調整可見集合                   │
└─────────────────────────────────────────────────┘
```

### 責任三分與系統的完備性邊界

自舉有一個邏輯極限：系統可以優化所有分支，但**根公理必須由外部預設**。這不是缺陷，而是系統的完備性邊界——類似哥德爾不完備定理：任何足夠強大的系統都無法完全證明自身的一致性。

這自然導出三維責任分離——對應 §1.5 的三維錨定：

```
公理維度（Protocol）── 語義結構（System）
  負責「健全（Soundness）」與「一致（Consistency）」
  確定性、可驗證、不可變
  → 四路完備性、概念代數、投影定理
  → 系統的固定點——不隨自舉改變

情境維度（Data）── 語用推斷（LLM/AI + 數據）
  負責「適切（Adequacy）」與「慣例（Convention）」
  機率性、可建議、需驗證
  → 學習數據、round-trip 測試結果、User Context
  → 系統的反饋迴路——驅動映射還原

主體維度（Agency）── 人類意圖（Human）
  負責「目的（Purpose）」與「價值（Value）」
  意圖性、可審查、有責任
  → 定義根公理、判斷 correctness、審計自蒸餾
  → 系統的方向盤——不是隨意的，而是基於責任的
```

**三維互設（Co-determination）**：

三個維度不是層級關係（不是 Protocol > Data > Agency），而是**互設關係**——每個維度都需要其他兩個維度來完整定義自身：

```
Protocol 沒有 Data → 不可驗證的空洞公理（形式主義陷阱）
Protocol 沒有 Agency → 無人維護的殭屍規則
Data 沒有 Protocol → 無方向的數據漂移（過擬合）
Data 沒有 Agency → 無人負責的自動化偏差
Agency 沒有 Protocol → 主觀任意的獨斷
Agency 沒有 Data → 不顧現實的空想
```

**系統的真理接近度**：

系統對語義結構的「接近真實」程度，可理解為公理對齊度與情境匹配度在主體責任下的交集：

```
T = Protocol_fixed ∩ Data_dynamic | Agency_responsible

其中：
  Protocol_fixed  — 不隨自舉改變的邏輯基準（四路完備性、投影定理）
  Data_dynamic    — 持續更新的環境反饋（學習數據、測試結果）
  Agency_responsible — 人類基於責任的審計與價值判斷
```

這保證了系統在追求自蒸餾優化時，始終有一個外部定錨點（Protocol），並受到經驗驗證（Data）和有責任的主體監督（Agency），防止過度自舉導致的結構漂移。

**LLM 作為導師投影**：在這個框架下，LLM 不再是漫無目的地回答問題，而是作為語用分析師（§4.3），在情境維度（Data）中運作——分析學習者目前的語義樹狀態，並精確地投影出下一條最適合的學習引導（Hint Projection）。但它的建議必須通過公理維度（Protocol）的驗證和主體維度（Agency）的簽署。

**種子層級**：最初的根公理（`docs/first-principles.md` 本身、Topic Level Tree 的根節點）仍需依賴人類的洞察和教育專業——這不是系統的弱點，而是三維架構的設計。根公理是人類在主體維度（Agency）中的核心職責，正如四路完備性是系統在公理維度（Protocol）中的核心承諾。這呼應了 Sc2（積木不可引入程式碼中不存在的概念）——系統不能無中生有。

---

# 附錄

## 已知的實作挑戰

### 邏輯邊界（硬限制）

1. **語用分析的精確度邊界**：lift() 基於 pattern 推斷，存在誤判風險（如 body 內修改迴圈變數的 for）。對策：composite pattern 必須包含副作用檢查，可疑匹配強制 `confidence: 'warning'`。

2. **C/C++ 巨集的不可解析硬邊界**：詳見 §2.1「lift() 的完備性邊界」。對重度框架巨集的專案，巨集密集區域會整片降級。緩解路線是多 parser 融合（tree-sitter + clang AST），在語義樹層面整合兩個 parser 的結果，而非模擬預處理器。

3. **語義阻抗的三層問題**：詳見 §2.2「語義阻抗（Semantic Impedance）」。節點級可標記，拓撲級需生成差異報告，語言模型級超出形式化範圍走降級路徑。

### 工程待解問題

4. **註解歸屬歧義**：拖拽積木時相鄰註解是否自動跟隨——需要 Block Style 層的吸附邏輯。

5. **符號表的汙染追蹤（Taint Tracking）**：詳見 §2.1「lift() 的完備性邊界」中巨集處理情況 3。SemanticNode.taint 欄位（§1.3）記錄汙染來源，使降級更精細。執行時 raw_code 的汙染擴散也應在語義結構中顯式標記傳播路徑。

6. **lift() 性能**：目前轉換是使用者主動觸發，全量 lift 在教學場景不構成瓶頸。未來可考慮增量 parse + 延遲 lift。

7. **Scope 3-5 的狀態空間爆炸**：增量更新演算法是效能瓶頸。實作優先序：Phase 1 Scope 0-2（已實現）→ Phase 2 Scope 3 → Phase 3 Scope 4-5。可能需要引入**語義快取層**：對穩定子圖（未修改的模組）快取語義結構和索引，只對變更傳播路徑執行增量 lift。快取失效粒度以模組為單位，避免節點級失效帶來的追蹤開銷。

8. **語義契約的驗證成本**：初期只覆蓋 L0-L1 概念，L2 按需補充，跨語言 constraints 可由 LLM 輔助生成初稿。

9. **執行後端的橋接開銷**：WASM 有序列化開銷，Remote 有網路延遲，WebGPU 有 GPU 同步代價。正確的粒度是「子樹」而非「節點」。JS native 因零 bridge 開銷特別適合大量小型運算。

10. **語義套件的工程約束**：執行他人的程式需要沙箱隔離、語義契約需要驗證機制（屬性測試）、語義結構的版本管理比文字原始碼更複雜。語義套件的執行體應受**語義沙箱**約束——副作用必須符合語義契約的宣告，否則拒絕執行，以保護時空旅行除錯的完整性（與 Virtual I/O Layer 統一為執行驗證層）。

11. **語義套件的版本一致性**：當多個使用者引用同一語義套件的不同版本時（老師更新 v1→v2，學生仍引用 v1），需要語義契約的相容性檢查——比文字原始碼的版本管理更難，因為要比較的是契約而非 diff。

12. **語義 Diff 與版本控制**：傳統版本控制基於文字行 diff，但 R1 投影變動（Code Style 切換）會產生大量文字差異而語義差異為零。語義層的版本控制應基於**語義樹 diff**（比較節點結構而非文字），使 style 變更 = diff 0。挑戰在於：語義樹的序列化格式需要穩定（節點 ID 不隨重新 lift 而改變）、合併（merge）演算法需要理解樹結構而非行結構。

13. **不透明節點的錯誤回溯（Error Projection）**：執行投影中，不透明（opaque）節點的 runtime error 發生在編譯執行的內部——錯誤堆疊只有編譯執行的底層細節（如 WASM trap、segfault），無法直接映射回語義節點。需要一個**錯誤投影層**：編譯執行體在語義契約中宣告可能的錯誤類型，runtime error 透過錯誤映射表歸因到語義節點，再投影到 L0 積木視圖中提供有意義的建議（而非「WASM unreachable executed」）。

14. **Pattern 依賴的教育反噬**：詳見 §2.1「降級原因的視覺區分」。降級視覺必須區分原因（錯誤 / 系統能力不足 / 非標準但正確），防止鷹架變成認知牢籠。長期方向：LLM 輔助的語用分析可擴大 pattern 覆蓋率。

---

## 一句話總結

> **程式是語義結構——檔案內是樹、檔案間是圖、系統間是超圖。程式碼、積木、流程圖、執行、敘事、分析、分發都是它的參數化投影，由 scope 和 viewType 決定觀察角度，可逆性從 R0（雙射）到 R4（單向）分級。概念形成可分層、可映射的代數結構，可封裝為語義套件透過可插拔後端執行與共享。LLM 作為語用分析師在確定性 guardrails 之上輔助推斷與生成。系統透過開放擴充成長，透過漸進揭露（主題情境 × 概念層級樹 × 結構範圍）適應從初學者到系統架構師、從課堂教學到嵌入式開發到競賽程式的所有使用者與情境。積木是認知鷹架——降低外在負荷、在近側發展區內引導學習，並最終退場。系統承認自身的認知邊界——降級是誠實而非失敗。驗證來自三個互設維度：不可變的邏輯基準（Protocol）、持續更新的環境反饋（Data）、基於責任的人類判斷（Agency）。**
