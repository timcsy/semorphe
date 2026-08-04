# 願景

## 問題陳述

程式教育有一個根本鴻溝：**理解程式邏輯**和**掌握語法細節**之間的斷層。

傳統工具走兩個極端——Scratch/Blockly 讓學生拼積木但永遠碰不到真正的程式碼；文字教學讓初學者同時面對邏輯和語法的雙重認知負荷。兩者之間缺少一座橋。

**目標使用者：**

- **學生**（主要）：從零基礎到進階，涵蓋 APCS 考試準備、競程訓練、學校課程
- **教師**：設計教學路徑（Topic）、指定練習、追蹤學習軌跡
- **語言開發者**：透過模組化語言套件擴充新程式語言
- **課程設計者**：透過 Topic 系統定制不同教學情境的概念可見性和積木形態

## 核心想法

**程式碼和積木都不是本質——它們是同一個語義結構的不同投影。** 學生可以用積木理解邏輯，同時看到對應的真實程式碼，在兩者之間自由切換，最終過渡到純文字編程。

關鍵不是在程式碼上面疊一層積木——**只有語義層存在**，程式碼和積木都是參數化的投影。理論基礎見 [原則](principles.md)。

**和現有工具的根本差異：**

| 工具 | 做法 | Semorphe 的不同 |
|------|------|----------------|
| Blockly/Scratch | 積木 → 程式碼（單向，不可逆） | 程式碼 ↔ 積木（雙向，完美 round-trip） |
| Hedy | 每個等級有不同語法 | 同一語義樹，不同投影解析度 |
| 傳統 IDE | 以文字為中心，視覺化為附加 | 以語義為中心，文字和視覺都是投影 |
| Unison | AST hash 內容定址 | hash 語法層 vs hash 語義層 |
| LSP/LSIF | 跨檔案符號索引 | 位置導向 vs 語義導向 |

## 專案身份

| | |
|---|---|
| **名稱** | Semorphe（散模費 σημορφή）— σῆμα（語義）+ μορφή（形態） |
| **標語** | 唯一真實，各式投影 |
| **CLI** | `smorph` |
| **Logo** | `<Σ>` |
| **npm** | `semorphe` |
| **VSCode** | `semorphe-vscode` |
| **技術棧** | TypeScript 5.x, Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite |

## 現狀

C++ 單語言可用，程式碼 ↔ 積木雙向 round-trip 成立，語義直譯器可執行。三層解耦（Core / Bus / View）已落地。Topic 系統已完成。**尚未驗證語言無關性**——這是 Phase 7 的核心目的。

**已完成元件：**

- **Core**：SemanticNode 型別、ConceptRegistry、BlockSpecRegistry、PatternLifter、PatternRenderer/Extractor、CodeGenerator、TemplateGenerator、BlockRenderer、Interpreter、Topic 系統、Storage、DependencyResolver（語言無關介面）、ProgramScaffold、CodeMapping + BlockMapping（nodeId-based 跨投影查詢）
- **C++ 語言套件**：core concepts/blocks/generators/lifters、std modules（iostream/cstdio/vector/algorithm/string/map/stack/queue/set/cstring/cmath）、ModuleRegistry、auto-include、lift-patterns、render strategies、style presets（apcs/competitive/google）、style-exceptions、manifest
- **UI**：Blockly/Monaco/Console/Variable 面板、Debug 工具列、SyncController、ToolboxBuilder、BlockRegistrar、AppShell、ExecutionController、Ghost Line

**已知差距：**

| 缺失項目 | 優先級 | 說明 |
|----------|--------|------|
| SemanticDiff 增量更新 | P2 | 全量替換 → 增量（Phase 9.2，nodeId 穩定性已部分完成） |
| 硬體描述層 | P3 | 等 Arduino 需求（Phase 8） |
| DataFlow 視圖 | P3 | 需 annotations 機制（Phase 9.1） |

## 架構

```
宿主環境（瀏覽器 / VSCode / Electron）
  ↕ ViewHost 介面
多個獨立視圖（積木 / 程式碼 / 主控台 / 變數 / 資料流 / 接線 / 模擬）
  ↕ SemanticBus（瀏覽器=EventEmitter / VSCode=postMessage）
SemanticCore（語義樹 + 概念註冊 + 投影引擎 + 直譯器，零 DOM 依賴）
  ↕ 語言套件介面
多個語言套件（C++ / Python / Arduino）+ 外部擴充套件
```

### 三層契約

- **Layer 1（語義宣告）**：concepts.json + lift-patterns + lifters — 所有消費者可用
- **Layer 2（投影提示）**：blockDef / renderMapping / codeTemplate / generator — 僅對應視圖消費
- **Layer 3（視圖策略）**：視圖根據 annotations 決定呈現 — 新增唯讀視圖不需改語言套件

### 語言套件目錄結構

```
languages/{lang}/
  ├─ manifest.json          ← 套件中繼資料
  ├─ core/                  ← 語言核心概念（concepts.json / blocks.json / generators/ / lifters/）
  ├─ std/                   ← 標準函式庫（目錄名即 header 名）
  ├─ lift-patterns.json     ← AST → 語義 pattern 規則
  └─ auto-include.ts / style-exceptions.ts / renderers/ / styles/
```

### 尚未實作但已有設計的規格

- **語義標註（Annotations）**：語言套件與視圖套件之間的開放契約（`control_flow`、`body_execution`、`introduces_scope`、`side_effects`、`hardware_binding` 等）。缺少 annotation 時用 generic fallback，不報錯——任何語言 × 視圖組合都能工作。
- **視圖套件規格**：按與語義樹的互動方式分類（可編輯 / 唯讀-執行 / 唯讀-分析 / 唯讀-硬體），結構為 `views/{name}/manifest.json` + `src/view.ts`（實作 ViewHost）。
- **WebView 隔離模型**：瀏覽器每視圖 = `<div>`/`<iframe>` + EventEmitter；VSCode 中 blocks = WebviewPanel、code = 原生 TextEditor、console = Terminal + postMessage。**Core 跑在 Extension Host，不跑在 WebView。**
- **外部套件與硬體擴充**：`packages/{name}/` 含 semantics / projections / hardware。依賴規則：擴充可引用基礎套件概念，**不可引用其他擴充**（避免菱形依賴）。

### 長期方向

1. **多語言**：C++ → Python → Java → Go → Rust……同一語義結構，切換語言即切換投影
2. **語義套件市場**：語義契約 + 投影定義 + 多後端執行體。同一概念可有多個執行體（wasm / js / webgpu / remote），自動基準測試 + 自動後端選擇。教學價值：讓學習者直觀感受演算法複雜度
3. **可插拔執行與時空旅行除錯**：執行即投影；直譯器每步產生語義狀態快照，回溯 = 用歷史快照重新投影（viewParams 多一個 `timeStep`）
4. **硬體教育**：Arduino 接線視圖 + 模擬視圖，從軟體延伸到嵌入式
5. **AI 輔助**：LLM 作為語用分析師，在確定性 guardrails 內提供提示投影——建議下一步，但不自動修改語義結構
6. **自舉**：教學路徑本身成為可分享的語義套件；學習數據回饋優化 Topic 層級樹，目標是**結構還原度最大化**而非效能最大化

## 路線圖

每個 Phase 用 SpecKit 展開（`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`）。

### 階段 0-5b：地基與解耦

- [x] 完成（2026-03-10）

<!--
  交付：ViewHost + SemanticBus + Annotations (014) → SyncController 解耦 (015)
       → app.ts 拆分為 ToolboxBuilder/BlockRegistrar/AppShell (016)
       → concept/blockDef 分離、std 按 header 重組 (019)
       → VSCode Extension 原型 (018)
       → DependencyResolver + ProgramScaffold + Ghost Line (020)
       → Semantic Node Identity：CodeMapping + BlockMapping 雙表 (021)
  前置條件：無
-->

**成功標準：**

- [x] Core 零 DOM 依賴，Node.js 環境可執行
- [x] 面板間零 import，跨層通訊只走 Bus
- [x] nodeId-based 跨投影查詢可用
- [ ] SemanticDiff 算法原型 → 延後至階段 9.2

### 階段 6：Topic 系統

- [x] 完成（2026-03-11）

<!--
  交付：Topic 核心型別與註冊表、層級樹引擎、BlockSpec Topic 覆蓋機制、
       C++ 內建 Topic 定義、Toolbox 整合、Topic 持久化與 User Context (022)
  前置條件：階段 0-5b
  設計原則：Topic 是純投影層概念，SemanticNode 不知道 Topic；
           Lifter 保持 Topic-agnostic；base + override 避免組合爆炸
-->

**成功標準：**

- [x] 同一語言在不同 Topic 下有不同層級樹與積木覆蓋
- [x] 所有測試通過
- [ ] manifest.json 加入 `topics` 欄位（等階段 7 統一做 manifest-driven plugin system）

### 階段 7：Python 語言套件

- [ ] 完成

<!--
  交付：7.1 語言骨架（manifest + core + stdlib + tree-sitter-python）
       7.2 Python DependencyResolver（concept → import 映射）
       7.3 Python ProgramScaffold（imports + if __name__ == "__main__"）
       7.4 Python 積木投射（核心積木達 C++ L0 等效）
  前置條件：階段 5 + 階段 6
  目的：用第二個語言驗證架構的語言無關性——這是四項獨立性中「語言獨立性」的真正檢驗
-->

**成功標準：**

- [ ] Python code ↔ blocks roundtrip 成功
- [ ] C++ 既有測試不受影響
- [ ] 語言切換時 toolbox 自動更新

### 階段 8：外部套件生態

- [ ] 完成

<!--
  交付：8.1 外部套件載入（manifest 依賴鏈 + 概念生命週期降級）
       8.2 套件安裝狀態 UI（ghost line 安裝指示 + 一鍵安裝）
       8.3 Arduino 語言套件（基於 C++ 擴充 + 硬體描述層 + Servo/NeoPixel）
  前置條件：階段 7
-->

**成功標準：**

- [ ] 安裝/移除套件後概念自動出現/降級
- [ ] 依賴鏈正確解析

### 階段 9+：進階擴充

- [ ] 完成

<!--
  交付：9.1 DataFlow 視圖（消費 control_flow annotations）
       9.2 SemanticDiff 增量更新（前置：階段 5b nodeId 穩定性）
       9.3 接線視圖 + 模擬視圖（硬體教育）
       9.4 跨語言映射視圖（abstractConcept 驅動）
       9.5 語義套件市場
  前置條件：階段 8
-->

**成功標準：**

- [ ] 唯讀視圖可從 annotations 自動生成，不需改語言套件
- [ ] style 變更的語義 diff 為零

## 關鍵延伸（主題觸發必讀）

| 觸發關鍵字 | MUST 讀 |
|---|---|
| 新增語言、語言套件、manifest、依賴解析 | `concepts/開放擴充.md` |
| Topic、認知層級、toolbox、scaffold | `concepts/漸進揭露.md` |
| 新視圖、viewType、可逆性、唯讀視圖 | `concepts/投影.md` |
| 語義診斷、錯誤訊息投影 | `draft/2026-08-05-語義診斷系統.md` |
| 待解工程問題、效能、版本控制、沙箱 | `draft/2026-03-11-已知工程待解問題.md` |
