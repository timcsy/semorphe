# 架構演化藍圖

**與第一性原理的關係**: 本文件是 `first-principles.md` 的工程實現路線圖，每個決策都可追溯到對應原則。

**演化原則：不做向後相容** — 每個 Phase 都是乾淨的切割（clean break）。不保留舊 API、不寫 migration、不做過渡期。編譯器就是驗證器。

---

## 目次

- [1. 現有架構摘要](#1-現有架構摘要)
- [2. 未來規格](#2-未來規格)（視圖套件、外部套件、硬體、VSCode）
- [3. 演化路線圖](#3-演化路線圖)
- [4. 重構進度 Checklist](#4-重構進度-checklist)
- [5. 解耦驗證標準](#5-解耦驗證標準)

---

## 1. 現有架構摘要

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

## 2. 未來規格

以下為尚未實作的架構規格，供後續 Phase 實作時參考。

### 2.1 語義標註（Annotations）

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

### 2.2 視圖套件規格

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

### 2.3 WebView 隔離模型

- **瀏覽器**：每個視圖 = `<div>` 或 `<iframe>`，Bus = EventEmitter（同步）
- **VSCode**：blocks = WebviewPanel，code = 原生 TextEditor，console = Terminal，Bus = postMessage（異步）
- **共通**：ViewHost 介面不變，視圖不知道跑在哪個宿主

### 2.4 外部套件與硬體擴充

外部套件結構：

```
packages/{name}/
  ├─ manifest.json          ← { id, language, extends, provides: { concepts, hardware } }
  ├─ semantics/concepts.json
  ├─ projections/blocks/ + code/
  └─ hardware/              ← components.json（元件物理規格）+ simulation.json（模擬行為）
```

依賴規則：擴充可引用基礎套件概念，不可引用其他擴充（避免菱形依賴）。

### 2.5 VSCode Extension 目標架構

```
Extension Main（Node.js）
  ├─ SemanticCore（語義樹 + 投影引擎 + 直譯器）
  ├─ SemanticBus（postMessage 橋接）
  ├─ LanguageManager（載入語言 / 外部套件）
  └─ ViewManager（blocks=WebviewPanel, code=原生TextEditor, console=Terminal）
```

**關鍵**：Core 跑在 Extension Host，不跑在 WebView。code 視圖用 VSCode 原生編輯器。

---

## 3. 演化路線圖

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

### Phase 6：Topic 系統（主題 × 層級樹 × 積木覆蓋）

**目標**：實作 Topic 維度——同一語言在不同主題下有不同的層級樹結構、積木可見性和積木形狀覆蓋。

**理論基礎**：first-principles §2.4（Topic）、§3.1（架構維度）、§3.2（Toolbox 多維度來源）

**前置條件**：Phase 5 完成（Level 機制已存在）

**設計原則**：
- Topic 是純投影層概念，SemanticNode 不知道 Topic
- Lifter 保持 Topic-agnostic，Topic 只控制可見性和積木覆蓋
- base + override 模型避免組合爆炸

```
6.1 Topic 核心型別與註冊表
    → src/core/topic.ts
    → Topic { id, language, name, levelTree, blockOverrides? }
    → LevelNode { level, label, concepts, children }
    → BlockOverride { message?, tooltip?, args?, renderMapping? }
    → TopicRegistry { register(), get(), list(), getForLanguage() }

6.2 層級樹引擎（取代線性 L0/L1/L2）
    → src/core/level-tree.ts
    → getVisibleConcepts(topic, activatedBranches): ConceptId[]
    → 分支可疊加（union），倍增軟指引（warning）
    → 無 Topic 時退化為現有 L0/L1/L2

6.3 BlockSpec Topic 覆蓋機制
    → getBlockSpec(conceptId, topic?): BlockSpec
    → 查詢順序：Topic override → base BlockSpec
    → 覆蓋粒度到欄位層級，不改變 conceptId 和語義結構

6.4 C++ 內建 Topic 定義
    → src/languages/cpp/topics/
    → cpp-beginner.json / cpp-competitive.json
    → 預留 Arduino Topic（Phase 8 外部套件到位後填充）

6.5 Toolbox 整合
    → buildToolbox(topic, activatedBranches, viewParams)
    → Topic 分區 UI + 動態樹瀏覽 Level selector
    → Topic 切換不丟失語義樹

6.6 Topic 持久化與 User Context
    → StorageService + User Context 慣性快取 + 群體設定鎖定

驗證：
  → 無 Topic 時行為不變（向後相容退化）
  → 同一語義樹在不同 Topic 間切換，語義不變
  → BlockOverride 可改變積木輸入欄位
  → Topic 不影響 lifter/generator
```

### Phase 7：Python 語言套件

**目標**：用第二個語言驗證架構的語言無關性。

**前置條件**：Phase 5 + Phase 6（Topic 框架，使 Python 可從一開始就設計 Topic 支援）

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

## 4. 重構進度 Checklist

> 每個 Phase 用 SpecKit 展開。每個子項完成時打勾。

### Phase 0-5b：已完成 ✅

- [x] Phase 0-4：打地基 → SyncController → app.ts 拆分 → concept/blockDef 分離 → VSCode 原型
- [x] Phase 5：DependencyResolver + ProgramScaffold + Ghost Line
- [x] Phase 5b：Semantic Node Identity（CodeMapping + BlockMapping）

> **5b.4 未完成**：SemanticDiff 算法原型 → Phase 9.2

### Phase 6：Topic 系統

前置條件：Phase 5 完成

- [x] **6.1 Topic 核心型別與註冊表**
  - [x] `Topic`、`LevelNode`、`BlockOverride` 型別定義（`src/core/types.ts`）
  - [x] `TopicRegistry`（register / get / list / getForLanguage）
  - [x] 核心型別零語言依賴
  - [x] 單元測試
- [x] **6.2 層級樹引擎**
  - [x] `src/core/level-tree.ts`（取代線性 cognitiveLevel）
  - [x] `getVisibleConcepts(topic, activatedBranches)` → ConceptId[]
  - [x] 分支可疊加（union），無 Topic 退化為 L0/L1/L2
  - [x] 倍增軟指引驗證
- [x] **6.3 BlockSpec Topic 覆蓋機制**
  - [x] `getWithOverride(conceptId, topic?)` 擴充
  - [x] 覆蓋粒度：message、tooltip、args、renderMapping
  - [x] 整合測試：覆蓋前後 SemanticNode 不變
- [x] **6.4 C++ 內建 Topic 定義**
  - [x] cpp-beginner.json / cpp-competitive.json
  - [ ] manifest.json 加入 `topics` 欄位（目前 Topic JSON 與 concepts/blocks 一樣是直接 import，無 manifest 機制。等多語言支援 Phase 7 時再統一做 manifest-driven plugin system）
- [x] **6.5 Toolbox 整合**
  - [x] `buildToolbox(topic, activatedBranches, viewParams)`
  - [x] Topic 分區 UI + 動態樹 Level selector（popover 風格）
  - [x] Topic 切換不丟失語義樹
- [x] **6.6 Topic 持久化與 User Context**
  - [x] StorageService（topicId + enabledBranches 持久化）
- [x] **Phase 6 驗證**
  - [x] 無 Topic 行為不變、語義不受 Topic 影響
  - [x] BlockOverride 可改變輸入欄位
  - [x] Topic 不影響 lifter/generator
  - [x] 所有現有測試通過（1695/1695）

### Phase 7：Python 語言套件

前置條件：Phase 5 + Phase 6

- [ ] **7.1** Python 語言骨架（manifest + core + stdlib + tree-sitter-python）
- [ ] **7.2** Python DependencyResolver
- [ ] **7.3** Python ProgramScaffold
- [ ] **7.4** Python 積木投射（roundtrip 驗證）
- [ ] **Phase 7 驗證**：roundtrip 成功、C++ 不受影響、toolbox 自動更新

### Phase 8：外部套件生態

前置條件：Phase 7

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

## 5. 解耦驗證標準

每個 Phase 完成後必須通過：

- **語言獨立性**：拔掉 C++，只裝 Python stub → 所有視圖仍啟動，無 `languages/cpp/` import
- **視圖獨立性**：拔掉任一視圖 → 其他不受影響，視圖間零 import
- **宿主獨立性**：同一套件在瀏覽器和 VSCode 中語義行為完全相同
- **核心純淨性**：`src/core/` + `src/languages/` + `src/interpreter/` 零 DOM import，Node.js 環境可執行

---

## 附錄：與現有文件的關係

| 文件 | 角色 |
|------|------|
| `first-principles.md` | 理論基礎，本文件每個決策可追溯到對應原則 |
| `technical-experiences.md` | 經驗傳承，Phase 執行時參考 |
| `specs/*/` | 每個 Phase 用 SpecKit 展開的產出物 |
