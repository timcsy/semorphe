# Semorphe 願景

> **唯一真實，各式投影。**
> 解構語法之散，重塑形態之模。

**與第一性原理的關係**: 本文件是 `first-principles.md` 的工程實現願景，包含專案定位、架構現狀、創意構想、演化路線圖。每個決策都可追溯到對應原則。

**演化原則：不做向後相容** — 每個 Phase 都是乾淨的切割（clean break）。不保留舊 API、不寫 migration、不做過渡期。編譯器就是驗證器。

---

## 目次

- [0. 專案總覽](#0-專案總覽)
- [1. 架構現狀](#1-架構現狀)
- [2. 創意構想](#2-創意構想)（尚未排入 Roadmap 的想法）
- [3. 未來規格](#3-未來規格)（已有初步設計的架構規格）
- [4. 演化路線圖](#4-演化路線圖)
- [5. 進度 Checklist](#5-進度-checklist)
- [6. 品質閘門](#6-品質閘門)

---

## 0. 專案總覽

### 我們要解決什麼問題？

程式教育有一個根本鴻溝：**理解程式邏輯**和**掌握語法細節**之間的斷層。

傳統工具走兩個極端——Scratch/Blockly 讓學生拼積木但永遠碰不到真正的程式碼；文字教學讓初學者同時面對邏輯和語法的雙重認知負荷。兩者之間缺少一座橋。

Semorphe 的答案：**程式碼和積木都不是本質——它們是同一個語義結構的不同投影。** 學生可以用積木理解邏輯，同時看到對應的真實程式碼，在兩者之間自由切換，最終過渡到純文字編程。

### 核心哲學

程式的本質不是程式碼，也不是積木——它們都是投影：

```
「x++;」              ← 文字投影（程式碼）
[變數 x 加1（++）]     ← 視覺投影（積木）
 x: 0→1               ← 行為投影（執行追蹤）
```

**語義結構**（由概念節點和關係邊組成的樹）是唯一的權威表示。程式碼、積木、流程圖、執行結果、自然語言解說……全都是投影。投影的種類是開放集合。

從這個根公理推導出整個系統的設計：
- 語義結構是唯一真實（Single Source of Truth）
- 所有投影都是衍生的、可重建的
- 投影之間的轉換不是「翻譯」，而是「重新投影」——資訊零損失

### 和現有工具的根本差異

| 工具 | 做法 | Semorphe 的不同 |
|------|------|----------------|
| **Blockly/Scratch** | 積木 → 程式碼（單向，不可逆） | 程式碼 ↔ 積木（雙向，完美 round-trip） |
| **Hedy** | 每個等級有不同語法 | 同一語義樹，不同投影解析度 |
| **傳統 IDE** | 以文字為中心，視覺化為附加 | 以語義為中心，文字和視覺都是投影 |

關鍵不是在程式碼上面疊一層積木——**只有語義層存在**，程式碼和積木都是參數化的投影。

### 教育理論基礎

基於認知負荷理論（Sweller 1988）和近側發展區（Vygotsky 1978）：

**積木是認知鷹架，不是替代品：**
- 記憶負擔 → 拖放選取
- 型別錯誤 → 形狀約束
- 結構錯誤 → 嵌套規則

**漸進揭露（Progressive Disclosure）：**
- **L0（初學者）**：樣板程式碼隱藏，只看到邏輯積木
- **L1（中階）**：基礎設施可見但半透明（ghost），看到完整結構
- **L2+（進階）**：手動控制所有鷹架，逐步過渡到純文字

目標是讓鷹架隨著能力增長而退場，而非永遠依賴積木。

### 目標使用者

- **學生**（主要）：從零基礎到進階，涵蓋 APCS 考試準備、競程訓練、學校課程
- **教師**：設計教學路徑（Topic）、指定練習、追蹤學習軌跡
- **語言開發者**：透過模組化語言套件擴充新程式語言
- **課程設計者**：透過 Topic 系統定制不同教學情境的概念可見性和積木形態

### 長期願景

1. **多語言**：C++ → Python → Java → Go → Rust……同一語義結構，切換語言即切換投影
2. **語義套件市場**：教師發布演算法套件，學生探索不同實作；L0 看積木、L1 看老師的程式碼、L2 fork 並改寫
3. **硬體教育**：Arduino 接線視圖 + 模擬視圖，從軟體延伸到嵌入式
4. **AI 輔助**：LLM 作為語用分析師，在嚴格護欄內提供提示投影——建議下一步學習方向，但不自動修改語義結構
5. **自舉**：教學路徑本身成為可分享的語義套件；學習數據回饋優化 Topic 層級樹

### 專案身份

| | |
|---|---|
| **名稱** | Semorphe（散模費 σημορφή）— σῆμα（語義）+ μορφή（形態） |
| **標語** | 唯一真實，各式投影 |
| **CLI** | `smorph` |
| **Logo** | `<Σ>` |
| **npm** | `semorphe` |
| **VSCode** | `semorphe-vscode` |
| **技術棧** | TypeScript 5.x, Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite |

---

## 1. 架構現狀

### 目標願景

```
宿主環境（瀏覽器 / VSCode / Electron）
  ↕ ViewHost 介面
多個獨立視圖（積木 / 程式碼 / 主控台 / 變數 / 資料流 / 接線 / 模擬）
  ↕ SemanticBus（EventEmitter / postMessage）
SemanticCore（語義樹 + 概念註冊 + 投影引擎 + 直譯器）
  ↕ 語言套件介面
多個語言套件（C++ / Python / Arduino）+ 外部擴充套件
```

### 三層解耦模型（Phase 0-2 實現）

```
View Layer  — 獨立視圖，透過 ViewHost 介面互動
Bus Layer   — SemanticBus（瀏覽器=EventEmitter / VSCode=postMessage）
Core Layer  — SemanticTree + 投影引擎 + 直譯器（零 DOM 依賴）
```

**不變式**：Core 不 import View。View 間零 import。跨層通訊只走 Bus。

### 已完成元件

**Core**：SemanticNode 型別、ConceptRegistry、BlockSpecRegistry、PatternLifter、PatternRenderer/Extractor、CodeGenerator、TemplateGenerator、BlockRenderer、Interpreter、CognitiveLevel、Storage、DependencyResolver（語言無關介面）、ProgramScaffold（imports/preamble/entryPoint/epilogue + hidden/ghost/editable）、CodeMapping + BlockMapping（nodeId-based 跨投影查詢）

**C++ 語言套件**：core concepts/blocks/generators/lifters、std modules（iostream/cstdio/vector/algorithm/string/map/stack/queue/set/cstring/cmath）、ModuleRegistry（implements DependencyResolver）、auto-include、lift-patterns、render strategies、style presets（apcs/competitive/google）、style-exceptions、manifest

**UI**：Blockly/Monaco/Console/Variable 面板、Debug 工具列、SyncController（SemanticBus）、ToolboxBuilder、BlockRegistrar、AppShell、ExecutionController、Ghost Line（scaffold 漸進揭露）

### 語言套件目錄結構

```
languages/{lang}/
  ├─ manifest.json          ← 套件中繼資料
  ├─ core/                  ← 語言核心概念
  │   ├─ concepts.json / blocks.json / generators/ / lifters/
  ├─ std/                   ← 標準函式庫（目錄名即 header 名）
  │   ├─ index.ts / module-registry.ts / iostream/ / cstdio/ / vector/ / ...
  ├─ lift-patterns.json     ← AST → 語義 pattern 規則
  ├─ auto-include.ts / style-exceptions.ts / renderers/ / styles/
```

### 三層契約

- **Layer 1（語義宣告）**：concepts.json + lift-patterns + lifters — 所有消費者可用
- **Layer 2（投影提示）**：blockDef / renderMapping / codeTemplate / generator — 僅對應視圖消費
- **Layer 3（視圖策略）**：視圖根據 annotations 決定呈現 — 新增唯讀視圖不需改語言套件

### 差距分析

| 缺失項目 | 優先級 | 說明 |
|----------|--------|------|
| ~~**Topic 系統**~~ | ~~P1~~ | ~~主題 × 層級樹 × 積木覆蓋（Phase 6）~~ ✅ 已完成 |
| **SemanticDiff 增量更新** | P2 | 全量替換→增量（Phase 9.2，nodeId 穩定性已部分完成） |
| **硬體描述層** | P3 | 等 Arduino 需求（Phase 8） |
| **DataFlow 視圖** | P3 | 需 annotations 機制（Phase 9.1） |

---

## 2. 創意構想

> 尚未排入 Roadmap、尚未有完整設計的構想。成熟後移入 §3 未來規格或 §4 路線圖。

### 2.1 語義診斷系統（Diagnostic as Projection）

**核心洞察**：錯誤訊息本質上也是語義結構的一種投影 — 它是對「語義結構與預期之間差距」的結構化呈現。

**模型**：Diagnostic 掛在語義節點上，不是獨立的資料結構。

```
SemanticNode
  ├── conceptId, props, children
  └── diagnostics: [
        { rule, severity, anchor: { nodeId, field? }, suggestions: [...] }
      ]
```

**分析三層**：
1. **概念自身 constraint** — 節點層級，「我自己合不合法」（如：name 不可為空）
2. **關係規則** — 樹層級，「我和 parent/sibling 的關係對不對」（如：return 必須在 function 內）
3. **語言特有規則** — 語言模組層級（如：C++ const 語義）

核心只負責遍歷語義樹、依序執行三層、收集 Diagnostic。

**C++ 等複雜語言的務實策略 — 分層委派**：
- **Level 1：我們自己做** — 語義樹上就能判斷的結構性錯誤（缺 main、return 在函式外、break 不在 loop 內）。成本低、教育價值高。
- **Level 2：委派編譯器** — generate 出程式碼 → 餵給編譯器 → 用 `_lineBox` line tracking 映射回語義節點。型別系統、overload resolution 等不需自己做。
- **Level 3：翻譯層** — 把編譯器 diagnostic 用 pattern matching 轉譯成分級教育訊息。社群可貢獻翻譯表，沒匹配到就 fallback 顯示原始訊息。

**投影**：同一個 Diagnostic 在不同面板有不同呈現 — 程式碼面板紅色波浪底線、積木面板邊框變色、語義樹 badge、獨立錯誤清單面板。

**漸進揭露整合**：訊息深度跟著 Level 走。
- L0：「『加法』需要兩個數字，但右邊放的是文字」
- L1：「型別不符：+ 的右運算元期望 int，收到 string」
- L2+：「type mismatch: binary operator+ expects int operand, got const char*」

**修正建議**：Suggestion 是語義樹的 patch（SemanticPatch），不是文字。可投影成程式碼 diff 或積木面板的「點擊套用」按鈕。

**架構位置**：插在 lift 之後、投影之前。Diagnostic 只是語義樹上多掛了資料，現有 renderer 不認識就忽略，向後相容。

```
程式碼 ──lift──→ SemanticTree ──analyze──→ SemanticTree + Diagnostics
                                              │
                        ┌───────────────┬──────┴──────┬──────────┐
                     code投影        block投影     tree投影   問題清單投影
```

---

## 3. 未來規格

> 已有初步設計但尚未實作的架構規格，供後續 Phase 實作時參考。

### 3.1 語義標註（Annotations）

語義標註是語言套件和視圖套件之間的契約（開放集合）：

| 標註 key | 消費者 | 值域 |
|----------|--------|------|
| `control_flow` | dataflow 視圖 | `"sequence"` \| `"branch"` \| `"loop"` \| `"jump"` |
| `body_execution` | 執行分析 | `"1"` \| `"0..1"` \| `"0..N"` \| `"1..N"` |
| `introduces_scope` | variables 視圖 | `boolean` |
| `scope_variables` | variables 視圖 | `string[]` |
| `cognitive_level` | toolbox | `number` |
| `abstract_concept` | 跨語言映射 | `string` |
| `side_effects` | 靜態分析 | `"pure"` \| `"mutate_self"` \| `"body_dependent"` \| `"io"` |
| `hardware_binding` | 接線視圖 | `"pin"` \| `"bus"` \| `"serial"` |
| `device_type` | 模擬視圖 | `string`（元件 ID） |

### 3.2 視圖套件規格

按與語義樹的互動方式分類：

| 類別 | 視圖 | 回寫語義樹 | 需要 Layer 2 | 消費的標註 |
|------|------|-----------|-------------|-----------|
| **可編輯** | blocks | ✓ | ✓ blockDef | cognitive_level |
| **可編輯** | code | ✓ | ✓ generator | — |
| **唯讀-執行** | console | ✗ | ✗ | — |
| **唯讀-執行** | variables | ✗ | ✗ | introduces_scope, scope_variables |
| **唯讀-分析** | dataflow | ✗ | ✗ | control_flow, body_execution, side_effects |
| **唯讀-硬體** | wiring | ✗ | ✗ | hardware_binding, device_type |
| **唯讀-硬體** | simulation | ✗ | ✗ | device_type |

視圖套件結構：`views/{name}/manifest.json` + `src/view.ts`（實作 ViewHost）+ `src/renderers/`

**Fallback 原則**：缺少 annotation 時用 generic fallback，不報錯。任何語言 × 視圖組合都能工作。

### 3.3 WebView 隔離模型

- **瀏覽器**：每個視圖 = `<div>` 或 `<iframe>`，Bus = EventEmitter（同步）
- **VSCode**：blocks = WebviewPanel，code = 原生 TextEditor，console = Terminal，Bus = postMessage（異步）
- **共通**：ViewHost 介面不變，視圖不知道跑在哪個宿主

### 3.4 外部套件與硬體擴充

外部套件結構：

```
packages/{name}/
  ├─ manifest.json          ← { id, language, extends, provides: { concepts, hardware } }
  ├─ semantics/concepts.json
  ├─ projections/blocks/ + code/
  └─ hardware/              ← components.json（元件物理規格）+ simulation.json（模擬行為）
```

依賴規則：擴充可引用基礎套件概念，不可引用其他擴充（避免菱形依賴）。

### 3.5 VSCode Extension 目標架構

```
Extension Main（Node.js）
  ├─ SemanticCore（語義樹 + 投影引擎 + 直譯器）
  ├─ SemanticBus（postMessage 橋接）
  ├─ LanguageManager（載入語言 / 外部套件）
  └─ ViewManager（blocks=WebviewPanel, code=原生TextEditor, console=Terminal）
```

**關鍵**：Core 跑在 Extension Host，不跑在 WebView。code 視圖用 VSCode 原生編輯器。

---

## 4. 演化路線圖

每個 Phase 都可以用 SpecKit 執行（specify → clarify → plan → tasks → implement）。

### Phase 0-5b：已完成 ✅

- **Phase 0**：打地基 — ViewHost + SemanticBus + Annotations *(014-decoupling-infra)*
- **Phase 1**：SyncController 解耦 — 面板透過 Bus 通訊 *(015-sync-decouple)*
- **Phase 2**：app.ts 拆分 — ToolboxBuilder + BlockRegistrar + AppShell *(016-app-split)*
- **Phase 3**：concept/blockDef 分離 — JSON 分離，manifest 驅動，std 按 header 重組 *(019-cpp-std-modules)*
- **Phase 4**：VSCode Extension 原型 — Blockly WebView + 原生 TextEditor *(018-vscode-extension-prototype)*
- **Phase 5**：DependencyResolver + Scaffold — 語言無關依賴解析、ProgramScaffold、Ghost Line *(020-dependency-scaffold)*
- **Phase 5b**：Semantic Node Identity — CodeMapping + BlockMapping 雙表、nodeId-based 跨投影查詢 *(021-semantic-node-identity)*

> **5b.4 未完成**：SemanticDiff 算法原型 → 留待 Phase 9.2

### Phase 6：Topic 系統 ✅

**目標**：實作 Topic 維度——同一語言在不同主題下有不同的層級樹結構、積木可見性和積木形狀覆蓋。

**理論基礎**：first-principles §2.4（Topic）、§3.1（架構維度）、§3.2（Toolbox 多維度來源）

**設計原則**：
- Topic 是純投影層概念，SemanticNode 不知道 Topic
- Lifter 保持 Topic-agnostic，Topic 只控制可見性和積木覆蓋
- base + override 模型避免組合爆炸

### Phase 7：Python 語言套件

**目標**：用第二個語言驗證架構的語言無關性。

**前置條件**：Phase 5 + Phase 6

```
7.1 Python 語言骨架
    → manifest.json + core/（if, for, def, class, print, input）+ stdlib/ + tree-sitter-python

7.2 Python DependencyResolver
    → concept → import 映射（stdlib + external）

7.3 Python ProgramScaffold
    → imports + if __name__ == "__main__"，L0/L1/L2 漸進揭露

7.4 Python 積木投射
    → 核心積木達 C++ L0 等效，code ↔ blocks roundtrip

驗證：Python roundtrip 成功、C++ 測試不受影響、語言切換 toolbox 自動更新
```

### Phase 8：外部套件生態

**目標**：支援第三方函式庫的語義套件（Arduino、NumPy 等）。

**前置條件**：Phase 7

```
8.1 外部套件載入（manifest 依賴鏈 + 概念生命週期降級）
8.2 套件安裝狀態 UI（ghost line 安裝指示 + 一鍵安裝）
8.3 Arduino 語言套件（基於 C++ 擴充 + 硬體描述層 + Servo/NeoPixel）

驗證：安裝/移除套件後概念自動出現/降級、依賴鏈正確解析
```

### Phase 9+：進階擴充

```
9.1 DataFlow 視圖（消費 control_flow annotations）
9.2 SemanticDiff 增量更新（前置：Phase 5b nodeId 穩定性）
9.3 接線視圖 + 模擬視圖（硬體教育）
9.4 跨語言映射視圖（abstractConcept 驅動）
9.5 語義套件市場
```

---

## 5. 進度 Checklist

> 每個 Phase 用 SpecKit 展開。每個子項完成時打勾。

### Phase 0-5b：已完成 ✅

- [x] Phase 0-4：打地基 → SyncController → app.ts 拆分 → concept/blockDef 分離 → VSCode 原型
- [x] Phase 5：DependencyResolver + ProgramScaffold + Ghost Line
- [x] Phase 5b：Semantic Node Identity（CodeMapping + BlockMapping）

> **5b.4 未完成**：SemanticDiff 算法原型 → Phase 9.2

### Phase 6：Topic 系統 ✅

- [x] **6.1** Topic 核心型別與註冊表
- [x] **6.2** 層級樹引擎
- [x] **6.3** BlockSpec Topic 覆蓋機制
- [x] **6.4** C++ 內建 Topic 定義
  - [ ] manifest.json 加入 `topics` 欄位（等 Phase 7 統一做 manifest-driven plugin system）
- [x] **6.5** Toolbox 整合
- [x] **6.6** Topic 持久化與 User Context
- [x] **Phase 6 驗證**（所有測試通過）

### Phase 7：Python 語言套件

- [ ] **7.1** Python 語言骨架（manifest + core + stdlib + tree-sitter-python）
- [ ] **7.2** Python DependencyResolver
- [ ] **7.3** Python ProgramScaffold
- [ ] **7.4** Python 積木投射（roundtrip 驗證）
- [ ] **Phase 7 驗證**：roundtrip 成功、C++ 不受影響、toolbox 自動更新

### Phase 8：外部套件生態

- [ ] **8.1** 外部套件載入（manifest 依賴鏈 + 概念降級）
- [ ] **8.2** 套件安裝狀態 UI
- [ ] **8.3** Arduino 語言套件（C++ 擴充 + 硬體描述層）

### Phase 9+：進階擴充

- [ ] 9.1 DataFlow 視圖
- [ ] 9.2 SemanticDiff 增量更新
- [ ] 9.3 接線視圖 + 模擬視圖
- [ ] 9.4 跨語言映射視圖
- [ ] 9.5 語義套件市場

---

## 6. 品質閘門

每個 Phase 完成後必須通過：

- **語言獨立性**：拔掉 C++，只裝 Python stub → 所有視圖仍啟動，無 `languages/cpp/` import
- **視圖獨立性**：拔掉任一視圖 → 其他不受影響，視圖間零 import
- **宿主獨立性**：同一套件在瀏覽器和 VSCode 中語義行為完全相同
- **核心純淨性**：`src/core/` + `src/languages/` + `src/interpreter/` 零 DOM import，Node.js 環境可執行

---

## 附錄：文件關係

| 文件 | 角色 |
|------|------|
| `first-principles.md` | 理論基礎（不變的原則），本文件每個決策可追溯到對應原則 |
| `vision.md`（本文件） | 規劃總覽（創意構想 + 架構規格 + 路線圖 + 進度追蹤） |
| `technical-experiences.md` | 經驗傳承，Phase 執行時參考 |
| `specs/*/` | 每個 Phase 用 SpecKit 展開的詳細產出物 |
