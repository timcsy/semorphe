# 架構演化藍圖：從單體應用到可插拔投影平台

**建立日期**: 2026-03-09
**適用範圍**: 整體架構重構、VSCode Extension 遷移、語言套件生態、視圖插拔機制
**與第一性原理的關係**: 本文件是 `first-principles.md` 的工程實現路線圖，每個決策都可追溯到對應原則

**演化原則：不做向後相容**

本專案在架構演化時**不維護向後相容**。每個 Phase 都是乾淨的切割（clean break）：

- **不保留舊 API**：重構時直接刪除舊介面，不做 adapter、shim、或 deprecated 標記
- **不保留舊格式**：序列化格式變更時直接升級，不寫 migration 邏輯；舊存檔由使用者重新建立
- **不分階段遷移**：不做「同時支援新舊兩套」的過渡期，直接切到新架構
- **編譯器就是驗證器**：刪掉舊東西後，TypeScript 編譯失敗的地方就是需要更新的地方

理由：這是一個教育工具的研究型專案，使用者基數小且集中。向後相容的成本（程式碼膨脹、雙重路徑、測試倍增）遠超過重新建立少量存檔的成本。保持程式碼乾淨比保留歷史包袱更重要。

---

## 目次

- [1. 目標願景](#1-目標願景)
- [2. 核心架構](#2-核心架構)
  - [2.1 三層解耦模型](#21-三層解耦模型)
  - [2.2 SemanticBus 通訊協議](#22-semanticbus-通訊協議)
  - [2.3 ViewHost 介面](#23-viewhost-介面)
- [3. 語言套件規格](#3-語言套件規格)
  - [3.1 套件目錄結構](#31-套件目錄結構)
  - [3.2 語義標註（Annotations）](#32-語義標註annotations)
  - [3.3 三層契約](#33-三層契約)
- [4. 視圖套件規格](#4-視圖套件規格)
  - [4.1 視圖分類學](#41-視圖分類學)
  - [4.2 視圖套件結構](#42-視圖套件結構)
  - [4.3 WebView 隔離模型](#43-webview-隔離模型)
- [5. 外部套件與硬體擴充](#5-外部套件與硬體擴充)
  - [5.1 外部套件結構](#51-外部套件結構)
  - [5.2 硬體描述層](#52-硬體描述層)
  - [5.3 套件依賴鏈](#53-套件依賴鏈)
- [6. VSCode Extension 架構](#6-vscode-extension-架構)
- [7. 現狀盤點與差距分析](#7-現狀盤點與差距分析)
- [8. 演化路線圖](#8-演化路線圖)
- [9. 重構進度 Checklist](#9-重構進度-checklist)
- [10. 解耦驗證標準](#10-解耦驗證標準)

---

## 1. 目標願景

將 code-blockly 從「一個 Blockly + Monaco 的網頁應用」演化為「一個可插拔的語義投影平台」：

```
核心不變量：語義樹是唯一真實（first-principles §1.1）
所有視圖都是語義樹的投影（first-principles §2.1）
語言套件定義語義，視圖套件定義呈現，兩者透過標註解耦
```

最終形態：

```
宿主環境（瀏覽器 / VSCode / Electron / 嵌入式）
  ↕ ViewHost 介面
多個獨立視圖（積木 / 程式碼 / 主控台 / 變數 / 資料流 / 接線 / 模擬 / ...）
  ↕ SemanticBus（事件 / postMessage / WebSocket）
SemanticCore（語義樹 + 概念註冊 + 投影引擎 + 直譯器）
  ↕ 語言套件介面
多個語言套件（C++ / Python / Arduino / ...）+ 外部擴充套件
```

---

## 2. 核心架構

### 2.1 三層解耦模型

```
┌─────────────────────────────────────────────────────┐
│  View Layer（視圖層）                                 │
│  每個視圖是獨立的 WebView 或原生元件                    │
│  視圖之間零依賴，只認識 ViewHost 介面                   │
├─────────────────────────────────────────────────────┤
│  Bus Layer（通訊層）                                  │
│  SemanticBus：語義事件的發布/訂閱                      │
│  在瀏覽器裡 = EventEmitter                            │
│  在 VSCode 裡 = postMessage                          │
│  在測試裡 = mock                                     │
├─────────────────────────────────────────────────────┤
│  Core Layer（核心層）                                 │
│  SemanticTree + ConceptRegistry + Lifter             │
│  CodeGenerator + BlockRenderer + Interpreter          │
│  純 TypeScript，零 DOM 依賴，零視圖依賴               │
└─────────────────────────────────────────────────────┘
```

**不變式**：Core Layer 不 import View Layer 的任何東西。View Layer 不 import 其他 View 的任何東西。所有跨層通訊透過 Bus Layer。

### 2.2 SemanticBus 通訊協議

```typescript
// 核心 → 視圖（單向推送）
interface SemanticEvents {
  'semantic:update': { diff: SemanticDiff; tree: SemanticNode }
  'semantic:full-sync': { tree: SemanticNode; language: string; style: StylePreset }
  'execution:state': { snapshot: ExecutionSnapshot }
  'execution:output': { text: string; stream: 'stdout' | 'stderr' }
  'diagnostics:update': { items: Diagnostic[] }
}

// 視圖 → 核心（請求式）
interface ViewRequests {
  'edit:semantic': { edits: SemanticEdit[] }          // 可編輯視圖的修改
  'edit:code': { code: string }                       // code 視圖的文字修改
  'edit:blocks': { blocklyState: SerializedWorkspace } // blocks 視圖的修改
  'execution:run': { command: 'run' | 'step' | 'stop' | 'reset' }
  'execution:input': { text: string }                 // 主控台輸入
  'config:change': { key: string; value: unknown }    // 設定變更
}

// SemanticDiff：增量更新（未來實作）
interface SemanticDiff {
  changed: Array<{ id: string; node: SemanticNode }>
  added: Array<{ parentId: string; slot: string; index: number; node: SemanticNode }>
  removed: Array<{ id: string }>
}
```

### 2.3 ViewHost 介面

每個視圖實作此介面，核心透過此介面與視圖互動：

```typescript
interface ViewHost {
  readonly viewId: string
  readonly viewType: string     // 'blocks' | 'code' | 'console' | 'variables' | 'dataflow' | ...
  readonly capabilities: ViewCapabilities

  // 生命週期
  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  // 核心 → 視圖
  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void

  // 視圖 → 核心（透過 bus 發送，不直接呼叫核心）
}

interface ViewCapabilities {
  editable: boolean           // 是否可回寫語義樹
  needsLanguageProjection: boolean  // 是否需要語言套件的 Layer 2 投影提示
  consumedAnnotations: string[]     // 消費哪些語義標註
}
```

---

## 3. 語言套件規格

### 3.1 套件目錄結構

```
languages/{lang}/
  ├─ manifest.json              ← 套件中繼資料 + 依賴宣告
  │
  ├─ semantics/                 ← Layer 1：純語義，零視圖依賴
  │   ├─ concepts.json          ← 概念定義 + 語義標註
  │   ├─ lift-patterns.json     ← AST → 語義的 pattern 規則
  │   └─ lifters/               ← Layer 3 hand-written lift 策略
  │       ├─ statements.ts
  │       ├─ expressions.ts
  │       └─ strategies.ts
  │
  ├─ projections/               ← Layer 2：視圖專屬投影提示
  │   ├─ blocks/                ← 積木視圖專屬
  │   │   ├─ block-specs.json   ← blockDef + renderMapping
  │   │   └─ renderers/         ← hand-written render 策略
  │   ├─ code/                  ← 程式碼視圖專屬
  │   │   ├─ templates.json     ← codeTemplate 宣告式
  │   │   └─ generators/        ← hand-written generator
  │   └─ execution/             ← 執行視圖專屬（可選覆寫）
  │       └─ overrides.ts
  │
  └─ styles/                    ← Code Style 預設
      ├─ apcs.json
      └─ competitive.json
```

**manifest.json**:

```jsonc
{
  "id": "cpp",
  "name": "C++",
  "version": "1.0.0",
  "parser": "tree-sitter-cpp",
  "extends": null,
  "dependencies": [],
  "provides": {
    "concepts": ["for_loop", "while_loop", "if", "func_def", ...],
    "styles": ["apcs", "competitive", "google"]
  }
}
```

### 3.2 語義標註（Annotations）

語義標註是語言套件和視圖套件之間的契約。語言套件誠實標註概念的語義特性，視圖套件自行決定如何呈現。

```jsonc
// semantics/concepts.json
{
  "for_loop": {
    "role": "statement",
    "properties": ["init_var", "from", "to", "step"],
    "children": {
      "init": { "role": "expression", "cardinality": "0..1" },
      "condition": { "role": "expression", "cardinality": "1" },
      "update": { "role": "expression", "cardinality": "0..1" },
      "body": { "role": "statement", "cardinality": "0..N" }
    },
    "annotations": {
      // 控制流分析（dataflow 視圖消費）
      "control_flow": "loop",
      "body_execution": "0..N",

      // 作用域（variables 視圖消費）
      "introduces_scope": true,
      "scope_variables": ["init_var"],

      // 教育分層（toolbox 消費）
      "cognitive_level": 1,

      // 跨語言映射（跨語言視圖消費）
      "abstract_concept": "count_loop",

      // 副作用分析（優化/警告消費）
      "side_effects": "body_dependent"
    }
  }
}
```

**已知的標註類別**（開放集合，可由視圖套件追加需求）：

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

### 3.3 三層契約

```
Layer 1: 語義宣告（語言套件提供，所有消費者可用）
  concepts.json + lift-patterns.json + lifters/
  → 定義「這個語言有什麼概念、怎麼從 AST 辨識」
  → 所有視圖、分析器、直譯器都可消費

Layer 2: 投影提示（語言套件為特定視圖提供，可選）
  projections/blocks/   → 積木視圖需要的 blockDef、renderMapping
  projections/code/     → 程式碼視圖需要的 codeTemplate、generator
  projections/execution/ → 執行視圖的覆寫行為
  → 只有對應視圖消費，其他視圖不需要

Layer 3: 視圖策略（視圖自己定義，消費 Layer 1 的標註）
  → 視圖根據 annotations 決定呈現方式
  → 語言套件不需要知道有哪些視圖
  → 新增視圖不需要改語言套件
```

**重要原則**：唯讀視圖（dataflow、variables、模擬）只需要 Layer 1。只有可編輯視圖（blocks、code）需要 Layer 2。這意味著**新增唯讀視圖永遠不需要改語言套件**。

---

## 4. 視圖套件規格

### 4.1 視圖分類學

按與語義樹的互動方式分類：

| 類別 | 視圖 | 回寫語義樹 | 需要 Layer 2 | 消費的標註 |
|------|------|-----------|-------------|-----------|
| **可編輯** | blocks | ✓ | ✓ blockDef | cognitive_level |
| **可編輯** | code | ✓ | ✓ codeTemplate/generator | — |
| **唯讀-執行** | console | ✗ | ✗ | — |
| **唯讀-執行** | variables | ✗ | ✗ | introduces_scope, scope_variables |
| **唯讀-分析** | dataflow | ✗ | ✗ | control_flow, body_execution, side_effects |
| **唯讀-硬體** | wiring | ✗ | ✗ | hardware_binding, device_type |
| **唯讀-硬體** | simulation | ✗ | ✗ | device_type |
| **互動-執行** | debug toolbar | ✗（改執行狀態） | ✗ | — |

### 4.2 視圖套件結構

```
views/{view-name}/
  ├─ manifest.json
  │   {
  │     "id": "dataflow-view",
  │     "name": "資料流圖",
  │     "version": "1.0.0",
  │     "capabilities": {
  │       "editable": false,
  │       "needsLanguageProjection": false,
  │       "consumedAnnotations": ["control_flow", "body_execution", "side_effects"]
  │     },
  │     "hostRequirement": "webview"
  │   }
  │
  ├─ src/
  │   ├─ view.ts              ← 實作 ViewHost 介面
  │   ├─ renderers/           ← 根據 annotations 決定呈現
  │   │   ├─ loop-node.ts
  │   │   ├─ branch-node.ts
  │   │   └─ generic-node.ts  ← 未知標註的 fallback
  │   └─ layout/              ← 佈局引擎（如 ELK、dagre）
  │
  └─ styles/
      └─ dataflow.css
```

**Fallback 原則**：如果語言套件沒有提供某個 annotation，視圖用 generic fallback 呈現，不報錯。這保證任何語言套件 + 任何視圖套件的組合都能工作，只是精細度不同。

### 4.3 WebView 隔離模型

```
瀏覽器宿主：
  每個視圖 = 一個 <div> 或 <iframe>
  SemanticBus = EventEmitter（同步，同 JS context）

VSCode Extension 宿主：
  blocks 視圖 = WebviewPanel（Blockly 必須在 WebView 中）
  code 視圖 = 原生 TextEditor（VSCode 自帶 Monaco）
  console 視圖 = Terminal 或 OutputChannel
  其他視圖 = WebviewPanel
  SemanticBus = postMessage（異步，跨 context）

共通：
  ViewHost 介面不變
  視圖不知道自己跑在哪個宿主
  宿主負責建立 SemanticBus 的具體實作
```

---

## 5. 外部套件與硬體擴充

### 5.1 外部套件結構

外部套件（如 Arduino Servo library）遵循語言套件的結構，但多了硬體描述層：

```
packages/{package-name}/
  ├─ manifest.json
  │   {
  │     "id": "arduino-servo",
  │     "name": "Arduino Servo Library",
  │     "version": "1.0.0",
  │     "language": "cpp",
  │     "extends": "arduino-core",
  │     "provides": {
  │       "concepts": ["servo_attach", "servo_write", "servo_read"],
  │       "hardware": ["servo_motor"]
  │     }
  │   }
  │
  ├─ semantics/
  │   └─ concepts.json          ← 概念定義 + annotations（hardware_binding 等）
  │
  ├─ projections/
  │   ├─ blocks/
  │   │   └─ servo-blocks.json  ← 積木定義（角度滑桿等）
  │   └─ code/
  │       └─ servo-generators.ts
  │
  └─ hardware/                   ← 硬體描述層
      ├─ components.json         ← 元件物理規格
      └─ simulation.json         ← 模擬行為的宣告式描述
```

### 5.2 硬體描述層

```jsonc
// hardware/components.json
{
  "servo_motor": {
    "displayName": "伺服馬達",
    "category": "actuator",
    "pins_required": 1,
    "pin_type": "PWM",
    "state_model": {
      "angle": { "type": "number", "min": 0, "max": 180, "unit": "degrees", "default": 90 }
    },
    "visual": {
      "icon": "servo-motor.svg",
      "animation_type": "rotate"
    }
  }
}

// hardware/simulation.json
{
  "servo_attach": {
    "effect": { "target_device": "$device", "bind_pin": "$pin" }
  },
  "servo_write": {
    "effect": { "target_device": "$device", "set_state": { "angle": "$angle" } },
    "animation": { "property": "angle", "duration_ms": 300, "easing": "ease-out" }
  }
}
```

接線視圖消費 `components.json`，模擬視圖消費 `simulation.json`。兩者都不需要知道 Servo library 的程式碼怎麼寫。

### 5.3 套件依賴鏈

```
arduino-core（基礎套件）
  ├─ 語義：digitalRead, digitalWrite, analogWrite, delay, ...
  ├─ 硬體：Arduino Uno/Mega/Nano 的 pin layout
  └─ 積木：基本 I/O 積木

arduino-servo（depends: arduino-core）
  ├─ 語義：Servo 類別方法
  ├─ 硬體：伺服馬達元件
  └─ 積木：角度控制積木

arduino-neopixel（depends: arduino-core）
  ├─ 語義：NeoPixel 類別方法
  ├─ 硬體：LED 燈條元件
  └─ 積木：顏色選擇器 + 燈條預覽
```

**依賴規則**：
- 擴充套件可以引用基礎套件的概念（如 `arduino-core` 的 `pin` 型別）
- 擴充套件不可引用其他擴充套件（避免菱形依賴）
- 基礎套件不知道有哪些擴充套件

---

## 6. VSCode Extension 架構

```
┌─ VSCode Host ──────────────────────────────────────┐
│                                                     │
│  Extension Main（Node.js context）                  │
│  ├─ SemanticCore                                    │
│  │   ├─ SemanticTree                                │
│  │   ├─ ConceptRegistry                             │
│  │   ├─ PatternLifter / PatternRenderer             │
│  │   ├─ CodeGenerator / TemplateGenerator           │
│  │   └─ Interpreter                                 │
│  │                                                  │
│  ├─ SemanticBus（postMessage 橋接）                 │
│  │                                                  │
│  ├─ LanguageManager                                 │
│  │   └─ 載入語言套件、外部套件                       │
│  │                                                  │
│  └─ ViewManager                                     │
│       ├─ register('blocks', BlocksWebView)          │
│       ├─ register('console', TerminalView)          │
│       ├─ register('variables', VarWebView)          │
│       └─ register('dataflow', DataFlowWebView)      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  code 視圖 = VSCode 原生 TextEditor                 │
│  （不需要 WebView，用 LSP 協議與 Core 通訊）         │
│                                                     │
│  blocks 視圖 = WebviewPanel (Blockly 12.x)          │
│  console 視圖 = Terminal / OutputChannel             │
│  variables 視圖 = WebviewPanel（表格）              │
│  dataflow 視圖 = WebviewPanel（D3/ELK）             │
│  wiring 視圖 = WebviewPanel（SVG 電路圖）           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**關鍵**：SemanticCore 跑在 Extension Host（Node.js），不跑在任何 WebView 裡。code 視圖用 VSCode 原生編輯器（不需要自己管 Monaco 實例）。

---

## 7. 現狀盤點與差距分析

### 已完成（Core Layer）

| 元件 | 檔案 | 狀態 | 備註 |
|------|------|------|------|
| SemanticNode 型別 | `src/core/types.ts` | ✅ 完成 | 統一版，含 id/concept/properties/children |
| ConceptRegistry | `src/core/concept-registry.ts` | ✅ 完成 | Universal + 語言專屬概念 |
| BlockSpecRegistry | `src/core/block-spec-registry.ts` | ✅ 完成 | JSON-driven |
| PatternLifter | `src/core/lift/pattern-lifter.ts` | ✅ 完成 | 三層 pattern 引擎 |
| PatternRenderer | `src/core/projection/pattern-renderer.ts` | ✅ 完成 | 語義→積木狀態 |
| PatternExtractor | `src/core/projection/pattern-extractor.ts` | ✅ 完成 | 積木狀態→語義 |
| CodeGenerator | `src/core/projection/code-generator.ts` | ✅ 完成 | 語義→程式碼 |
| TemplateGenerator | `src/core/projection/template-generator.ts` | ✅ 完成 | JSON-driven code template |
| BlockRenderer | `src/core/projection/block-renderer.ts` | ✅ 完成 | 語義→Blockly state |
| Interpreter | `src/interpreter/interpreter.ts` | ✅ 完成 | 直接走訪語義樹執行 |
| CognitiveLevel | `src/core/cognitive-levels.ts` | ✅ 完成 | L0/L1/L2 過濾 |
| Storage | `src/core/storage.ts` | ✅ 完成 | localStorage 自動儲存 |

### 已完成（C++ Language）

| 元件 | 檔案 | 狀態 |
|------|------|------|
| Block specs (JSON) | `src/languages/cpp/blocks/*.json` | ✅ basic + advanced + special |
| Lift patterns (JSON) | `src/languages/cpp/lift-patterns.json` | ✅ 完成 |
| Hand-written lifters | `src/languages/cpp/lifters/*.ts` | ✅ statements/expressions/io/strategies |
| Hand-written generators | `src/languages/cpp/generators/*.ts` | ✅ statements/expressions/io/declarations |
| Render strategies | `src/languages/cpp/renderers/strategies.ts` | ✅ 完成 |
| Style presets | `src/languages/cpp/styles/*.json` | ✅ apcs/competitive/google |
| Style exceptions | `src/languages/cpp/style-exceptions.ts` | ✅ 完成 |
| Language module | `src/languages/cpp/module.ts` | ✅ 統一初始化入口 |

### 已完成（UI）

| 元件 | 檔案 | 狀態 | 備註 |
|------|------|------|------|
| Blockly 面板 | `src/ui/panels/blockly-panel.ts` | ✅ 完成 | 含 extractBlockInner |
| Monaco 面板 | `src/ui/panels/monaco-panel.ts` | ✅ 完成 | |
| 主控台面板 | `src/ui/panels/console-panel.ts` | ✅ 完成 | |
| 變數面板 | `src/ui/panels/variable-panel.ts` | ✅ 完成 | |
| Debug 工具列 | `src/ui/debug-toolbar.ts` | ✅ 完成 | |
| 同步控制器 | `src/ui/sync-controller.ts` | ⚠️ 需重構 | 直接 import BlocklyPanel/MonacoPanel |
| 動態積木 + 工具箱 | `src/ui/app.ts` | ⚠️ 需拆分 | 3575 行的 god object |

### 差距分析

| 缺失項目 | 對應章節 | 優先級 | 說明 |
|----------|---------|--------|------|
| **語義標註機制** | §3.2 | P0 | concepts.json 的 annotations 不存在，新視圖無法不依賴語言套件 |
| **ViewHost 介面** | §2.3 | P0 | 視圖沒有統一介面，每個面板 API 不同 |
| **SemanticBus** | §2.2 | P0 | 視圖間透過 SyncController 直接耦合 |
| **app.ts 拆分** | §6 | P1 | 積木註冊、toolbox、layout、sync 混在一起 |
| **concept 和 blockDef 分離** | §3.1 | P1 | 目前在同一個 JSON 的同一個物件裡 |
| **套件 manifest** | §3.1 | P2 | 語言套件沒有宣告式中繼資料 |
| **SemanticDiff 增量更新** | §2.2 | P2 | 目前是全量替換，效能隨視圖數量線性增長 |
| **硬體描述層** | §5.2 | P3 | 等 Arduino 需求時再實作 |
| **DataFlow 視圖** | §4.2 | P3 | 需要 annotations 機制先到位 |

---

## 8. 演化路線圖

每個 Phase 都可以用 SpecKit 執行（specify → clarify → plan → tasks → implement）。

### Phase 0：打地基（解耦基礎設施）

**目標**：建立三層解耦的基礎設施，不改變現有功能。

```
0.1 定義 ViewHost 介面
    → src/core/view-host.ts（純介面，不依賴任何 UI 框架）
    → 現有面板暫不實作，只定義介面

0.2 建立 SemanticBus
    → src/core/semantic-bus.ts（EventEmitter 實作）
    → 定義所有事件型別（SemanticEvents + ViewRequests）

0.3 annotations 機制
    → 擴充 concepts.json 結構，加入 annotations 欄位
    → ConceptRegistry 可查詢 annotations
    → 不改變現有功能，只是加了新的查詢能力

驗證：所有現有測試通過，annotations 可被查詢
```

### Phase 1：SyncController 解耦

**目標**：SyncController 不再直接 import 面板，改為透過 SemanticBus 通訊。

```
1.1 SyncController → SemanticBus
    → 移除 import BlocklyPanel / MonacoPanel
    → 改為發送 SemanticEvents，接收 ViewRequests
    → 面板訂閱事件，自行更新

1.2 面板實作 ViewHost
    → BlocklyPanel、MonacoPanel 實作 ViewHost 介面
    → ConsolePanel、VariablePanel 實作 ViewHost 介面
    → 面板之間零 import

驗證：面板獨立性測試（拔掉任一面板，其他面板不報錯）
```

### Phase 2：app.ts 拆分

**目標**：把 3575 行的 god object 拆為獨立模組。

```
2.1 ToolboxBuilder
    → 純資料模組，從 BlockSpecRegistry + CognitiveLevel 產出 toolbox 定義
    → 不依賴 Blockly DOM

2.2 BlockRegistrar
    → Blockly 專屬，只在 blocks WebView 中使用
    → 管理動態積木註冊（saveExtraState/loadExtraState）
    → 從 app.ts 搬出所有 Blockly.Blocks[...] = {...} 定義

2.3 AppShell
    → 宿主專屬的 layout 管理
    → 瀏覽器版 = DOM layout
    → VSCode 版 = WebviewPanel 管理

驗證：app.ts < 500 行，每個模組可獨立測試
```

### Phase 3：concept 與 blockDef 分離

**目標**：語義宣告和積木定義物理分離，為多視圖做準備。

```
3.1 拆分 BlockSpec JSON
    → semantics/concepts.json：concept + annotations
    → projections/blocks/block-specs.json：blockDef + renderMapping
    → 兩者透過 conceptId 關聯

3.2 語言套件 manifest
    → languages/cpp/manifest.json
    → 宣告提供的概念、風格、依賴

驗證：新增唯讀視圖不需要改語言套件的任何檔案
```

### Phase 4：VSCode Extension 原型

**目標**：在 VSCode 中跑起最小可用版本。

```
4.1 Extension 骨架
    → Extension Main 載入 SemanticCore
    → SemanticBus 的 postMessage 實作

4.2 Blocks WebView
    → Blockly 在 WebviewPanel 中運行
    → 透過 postMessage 與 Core 通訊

4.3 Code 視圖
    → 用 VSCode 原生 TextEditor
    → 透過 TextDocument API 與 Core 同步

驗證：在 VSCode 中能做到 code → blocks → code roundtrip
```

### Phase 5+：擴充（按需求排序）

```
5.1 DataFlow 視圖（消費 control_flow annotations）
5.2 SemanticDiff 增量更新
5.3 Arduino 語言套件 + 硬體描述層
5.4 接線視圖 + 模擬視圖
5.5 Python 語言套件完整實作
5.6 跨語言映射視圖
```

---

## 9. 重構進度 Checklist

> 每個 Phase 用 SpecKit 展開（specify → clarify → plan → tasks → implement）。
> 開始新 Phase 前，先在此 checklist 標記前一個 Phase 的完成狀態。
> 每個子項完成時打勾，並附上完成日期或 commit hash。

### Phase 0：打地基（解耦基礎設施）

前置條件：無

- [x] **0.1 ViewHost 介面** *(2026-03-09, 014-decoupling-infra)*
  - [x] 定義 `ViewHost` + `ViewCapabilities` 介面（`src/core/view-host.ts`）
  - [x] 定義 `ViewConfig` + 生命週期方法簽名
  - [x] 介面零 DOM 依賴（純 TypeScript 型別）
  - [x] 單元測試：型別檢查通過，mock 實作可編譯
- [x] **0.2 SemanticBus** *(2026-03-09, 014-decoupling-infra)*
  - [x] 定義事件型別（`SemanticEvents` + `ViewRequests`）
  - [x] EventEmitter 實作（`src/core/semantic-bus.ts`）
  - [x] 單元測試：publish/subscribe、事件過濾、多訂閱者
- [x] **0.3 Annotations 機制** *(2026-03-09, 014-decoupling-infra)*
  - [x] 擴充 concepts JSON schema，加入 `annotations` 欄位
  - [x] `ConceptRegistry` 新增 `getAnnotation(conceptId, key)` 查詢 API
  - [x] 為 `count_loop`、`if`、`func_def` 加上示範 annotations
  - [x] 單元測試：annotations 可被查詢、未標註的概念回傳 `undefined`
- [x] **Phase 0 驗證** *(2026-03-09)*
  - [x] 所有現有 `npm test` 通過（1461 tests，零 regression）
  - [x] `src/core/` 無新增 DOM import

### Phase 1：SyncController 解耦

前置條件：Phase 0 完成

- [x] **1.1 SyncController → SemanticBus**
  - [x] 移除 `sync-controller.ts` 對 `BlocklyPanel` / `MonacoPanel` 的 type import
  - [x] SyncController 改為只依賴 SemanticBus（發送 `semantic:update`，接收 `edit:*`）
  - [x] 整合測試：SyncController + mock bus，無真實面板
- [x] **1.2 面板實作 ViewHost**
  - [x] `BlocklyPanel` implements `ViewHost`
  - [x] `MonacoPanel` implements `ViewHost`
  - [x] `ConsolePanel` implements `ViewHost`
  - [x] `VariablePanel` implements `ViewHost`
  - [x] 面板之間零 import（grep 驗證）
- [x] **Phase 1 驗證**
  - [x] 面板獨立性測試：拔掉任一面板 import，其他面板編譯通過
  - [x] 瀏覽器端功能不退化（手動 smoke test）

### Phase 2：app.ts 拆分

前置條件：Phase 1 完成

- [ ] **2.1 ToolboxBuilder**
  - [ ] 抽出純資料模組（`src/ui/toolbox-builder.ts`）
  - [ ] 輸入：BlockSpecRegistry + CognitiveLevel → 輸出：toolbox JSON 定義
  - [ ] 零 Blockly DOM 依賴
  - [ ] 單元測試：給定 specs + level，產出正確的 toolbox 結構
- [ ] **2.2 BlockRegistrar**
  - [ ] 抽出 Blockly 專屬模組（`src/ui/block-registrar.ts`）
  - [ ] 搬出所有 `Blockly.Blocks[...] = {...}` 定義
  - [ ] 搬出所有 `saveExtraState` / `loadExtraState` 邏輯
  - [ ] 整合測試：積木註冊 + 序列化 roundtrip
- [ ] **2.3 AppShell**
  - [ ] 抽出宿主 layout（`src/ui/app-shell.ts`）
  - [ ] app.ts 只剩初始化膠水碼
  - [ ] app.ts < 500 行
- [ ] **Phase 2 驗證**
  - [ ] 每個新模組可獨立測試
  - [ ] 瀏覽器端功能不退化

### Phase 3：concept 與 blockDef 分離

前置條件：Phase 2 完成

- [ ] **3.1 拆分 BlockSpec JSON**
  - [ ] `semantics/concepts.json`：concept 定義 + annotations
  - [ ] `projections/blocks/block-specs.json`：blockDef + renderMapping
  - [ ] 兩者透過 `conceptId` 關聯
  - [ ] 載入邏輯更新：ConceptRegistry 讀 concepts.json，BlockSpecRegistry 讀 block-specs.json
- [ ] **3.2 語言套件 manifest**
  - [ ] `languages/cpp/manifest.json`：id、name、version、provides、parser
  - [ ] LanguageModule 從 manifest 驅動載入
- [ ] **Phase 3 驗證**
  - [ ] 新增一個 dummy 唯讀視圖，不修改語言套件的任何檔案
  - [ ] 全部測試通過

### Phase 4：VSCode Extension 原型

前置條件：Phase 3 完成

- [ ] **4.1 Extension 骨架**
  - [ ] VSCode Extension 專案結構（`vscode-ext/`）
  - [ ] Extension Main 載入 SemanticCore
  - [ ] SemanticBus 的 `postMessage` 實作
- [ ] **4.2 Blocks WebView**
  - [ ] Blockly 在 WebviewPanel 中運行
  - [ ] BlockRegistrar 在 WebView context 中初始化
  - [ ] 透過 postMessage 與 Core 通訊
- [ ] **4.3 Code 視圖**
  - [ ] VSCode 原生 TextEditor
  - [ ] TextDocument API ↔ SemanticBus 同步
- [ ] **Phase 4 驗證**
  - [ ] VSCode 中 code → blocks → code roundtrip 成功
  - [ ] 瀏覽器版同時維持正常

### Phase 5+：擴充

前置條件：Phase 4 完成（各子項可獨立進行）

- [ ] 5.1 DataFlow 視圖（消費 `control_flow` annotations）
- [ ] 5.2 SemanticDiff 增量更新
- [ ] 5.3 Arduino 語言套件 + 硬體描述層
- [ ] 5.4 接線視圖 + 模擬視圖
- [ ] 5.5 Python 語言套件完整實作
- [ ] 5.6 跨語言映射視圖

---

## 10. 解耦驗證標準

每個 Phase 完成後，必須通過以下測試：

### 語言獨立性

```
拔掉 C++ 語言套件，只裝 Python stub
→ 所有視圖仍能啟動（空的 toolbox，但不 crash）
→ 如果任何視圖 import 了 languages/cpp/ 下的東西，測試失敗
```

### 視圖獨立性

```
拔掉任一視圖套件
→ 其他視圖不受影響
→ 如果視圖 A import 了視圖 B 的任何東西，測試失敗
```

### 宿主獨立性

```
同一個語言套件 + 同一個視圖邏輯
→ 在瀏覽器裡跑（AppShell = DOM）
→ 在 VSCode 裡跑（AppShell = WebView）
→ 語義行為完全相同（只有 layout 不同）
```

### 核心純淨性

```
src/core/ 和 src/languages/ 和 src/interpreter/
→ 零 DOM import（無 document、window、Blockly、Monaco）
→ 可在 Node.js 環境直接執行
→ 所有現有 Vitest 測試在無瀏覽器環境下通過
```

---

## 附錄 A：與現有文件的關係

| 文件 | 角色 | 關係 |
|------|------|------|
| `first-principles.md` | 理論基礎 | 本文件的每個設計決策可追溯到第一性原理的對應原則 |
| `technical-experiences.md` | 經驗傳承 | 記錄實作過程中的陷阱和解法，本文件的 Phase 執行時應參考 |
| `architecture-evolution.md`（本文件） | 工程路線圖 | 連接理論和實作，定義「從現在到未來」的演化路徑 |
| `specs/*/` | SpecKit 產出物 | 每個 Phase 用 SpecKit 展開為 spec → plan → tasks |
