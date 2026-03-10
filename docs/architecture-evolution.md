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
  - [3.4 依賴解析與 Program Scaffold](#34-依賴解析與-program-scaffold)
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

將 semorphe 從「一個 Blockly + Monaco 的網頁應用」演化為「一個可插拔的語義投影平台」：

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
  ├─ manifest.json              ← 套件中繼資料（id, provides, parser）
  │
  ├─ core/                      ← 語言核心（不需要 #include 的概念）
  │   ├─ concepts.json          ← 核心概念定義（if, for, var_declare, func_def...）
  │   ├─ blocks.json            ← 核心積木定義
  │   ├─ generators/            ← 核心 code generators
  │   └─ lifters/               ← 核心 lifters + strategies + transforms
  │
  ├─ std/                       ← 標準函式庫（每個 header 一個子目錄）
  │   ├─ index.ts               ← allStdModules 聚合 + createPopulatedRegistry()
  │   ├─ module-registry.ts     ← concept→header 映射（DependencyResolver 雛形）
  │   ├─ iostream/              ← <iostream>: cout/cin generators
  │   │   ├─ concepts.json
  │   │   ├─ blocks.json
  │   │   ├─ generators.ts
  │   │   └─ lifters.ts
  │   ├─ cstdio/                ← <cstdio>: printf/scanf
  │   ├─ vector/                ← <vector>: vector operations
  │   ├─ algorithm/             ← <algorithm>: sort/find
  │   ├─ string/                ← <string>: string operations
  │   ├─ cmath/                 ← <cmath>: math functions
  │   ├─ map/                   ← <map>
  │   ├─ set/                   ← <set>
  │   ├─ stack/                 ← <stack>
  │   ├─ queue/                 ← <queue>
  │   └─ cstring/               ← <cstring>
  │
  ├─ lift-patterns.json         ← AST → 語義的 pattern 規則
  ├─ auto-include.ts            ← 語義樹掃描→所需 #include 推導
  ├─ style-exceptions.ts        ← 借音偵測（模組化）
  ├─ renderers/                 ← hand-written render 策略
  │
  └─ styles/                    ← Code Style 預設
      ├─ apcs.json
      └─ competitive.json
```

> **目錄名即 header 名**：`std/iostream/` 對應 `<iostream>`，`std/vector/` 對應 `<vector>`。新增 std 模組只需加目錄 + 在 `std/index.ts` 註冊，不改核心引擎。

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

### 3.4 依賴解析與 Program Scaffold

#### 問題定位

`#include <iostream>` 不屬於第一性原理 §1.3 的四類資訊（語義、呈現、元資訊、語法偏好）。它是 **Scope 3 圖邊（depends_on）在 Scope 2 程式碼中的投影**——可從語義樹的概念使用確定性推導出來的衍生資訊（見 first-principles §1.3 結構性依賴宣告）。

同樣性質的還有：`using namespace std;`、`int main() { ... }`、`return 0;`——這些都是程式的**基礎設施 boilerplate**，語義上是衍生的，不應該是語義樹的一部分。

#### DependencyResolver 介面

核心引擎只定義介面，每個語言模組提供自己的實作：

```typescript
/** 核心引擎定義（語言無關） */
interface DependencyResolver {
  resolve(conceptIds: string[]): DependencyEdge[]
}

interface DependencyEdge {
  sourceType: 'builtin' | 'stdlib' | 'external'
  directive: string        // 語言專用的 import 語句
  packageSpec?: {          // 外部套件才需要
    name: string
    version?: string
    registry?: string      // 'npm' | 'pypi' | 'vcpkg' | 'crates'
  }
}
```

各語言的實作：

| 語言 | concept 範例 | directive 範例 | sourceType |
|------|-------------|---------------|------------|
| C++ | `cpp_vector_declare` | `#include <vector>` | stdlib |
| C++ | `print` (cout) | `#include <iostream>` | stdlib |
| Python | `numpy_array` | `import numpy as np` | external |
| Java | `arraylist_add` | `import java.util.ArrayList;` | stdlib |
| Rust | `hashmap_insert` | `use std::collections::HashMap;` | stdlib |

**現狀**：C++ 的 `ModuleRegistry` + `computeAutoIncludes()` 是 DependencyResolver 的語言專用雛形。泛化時只需抽出介面，C++ 實作保持不變。

#### Program Scaffold

Program Scaffold 統一管理所有基礎設施 boilerplate，取代目前散落在 program generator 中的硬編碼：

```typescript
interface ProgramScaffold {
  /** 從語義樹推導所有需要的基礎設施 */
  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult
}

interface ScaffoldConfig {
  cognitiveLevel: number     // P4 漸進揭露
  style: StylePreset
}

interface ScaffoldResult {
  imports: ScaffoldItem[]    // #include / import
  preamble: ScaffoldItem[]   // using namespace / from ... import
  entryPoint: ScaffoldItem   // int main() / if __name__ == "__main__"
  epilogue: ScaffoldItem[]   // return 0;
}

interface ScaffoldItem {
  code: string
  visibility: 'hidden' | 'ghost' | 'editable'  // 由 cognitiveLevel 決定
  reason?: string            // hover 說明（如「因為你用了 cout」）
}
```

#### 漸進揭露策略（P4）

| Level | imports | preamble | entryPoint | epilogue |
|-------|---------|----------|------------|----------|
| L0 | hidden | hidden | hidden | hidden |
| L1 | ghost（hover 顯示原因） | ghost | ghost | ghost |
| L2+ | editable（缺少時警告） | editable | editable | editable |

**Ghost line**：在程式碼面板中以淡灰色顯示，不可直接編輯，但可「固定」（pin）為手動管理。使用者新增的手動 import 不受 scaffold 影響。

#### 外部套件的額外考量

| | stdlib | external |
|---|--------|----------|
| 可用性 | 永遠可用 | 需要安裝 |
| import | 自動加 | 自動加 + 檢查是否安裝 |
| 版本 | 跟語言走 | 需要指定 |
| UX | ghost / auto | ghost + 安裝狀態指示（✓ / ✗） |

外部套件的概念走 P3 概念生命週期：`raw_code` → `func_call` 降級 → 安裝語義套件後完全支援。

#### 管線定位

```
語義樹（Scope 2，唯一真實）
     │
     ├─ 概念遍歷 → conceptIds
     │      │
     │      ▼
     │  DependencyResolver（語言模組提供）  ← Scope 3 索引構建
     │      │
     │      ▼
     │  DependencyEdge[]
     │      │
     │      ▼
     │  ProgramScaffold（P4 過濾）         ← 決定 hidden/ghost/editable
     │      │
     │      ▼
     └─ CodeGenerator（消費 scaffold 結果）← Scope 2 投影
            │
            ▼
        最終程式碼
```

**關鍵**：DependencyResolver 不是 CodeGenerator 的一部分。它是獨立的 Scope 3 索引構建器，結果被 ProgramScaffold 消費後才進入投影管線。

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
| Core concepts (JSON) | `src/languages/cpp/core/concepts.json` | ✅ 語言核心概念（if, for, var_declare 等） |
| Core blocks (JSON) | `src/languages/cpp/core/blocks.json` | ✅ 語言核心積木 |
| Core generators | `src/languages/cpp/core/generators/*.ts` | ✅ statements/declarations/expressions |
| Core lifters | `src/languages/cpp/core/lifters/*.ts` | ✅ statements/declarations/expressions/strategies/transforms |
| Std modules | `src/languages/cpp/std/*/` | ✅ iostream/cstdio/vector/algorithm/string/map/stack/queue/set/cstring/cmath |
| ModuleRegistry | `src/languages/cpp/std/module-registry.ts` | ✅ concept→header 映射 |
| Auto-include | `src/languages/cpp/auto-include.ts` | ✅ 語義樹→所需 #include 推導 |
| Lift patterns (JSON) | `src/languages/cpp/lift-patterns.json` | ✅ 完成 |
| Render strategies | `src/languages/cpp/renderers/strategies.ts` | ✅ 完成 |
| Style presets | `src/languages/cpp/styles/*.json` | ✅ apcs/competitive/google |
| Style exceptions | `src/languages/cpp/style-exceptions.ts` | ✅ 含模組化借音偵測 |
| Manifest | `src/languages/cpp/manifest.json` | ✅ 套件中繼資料 + 路徑宣告 |

### 已完成（UI）

| 元件 | 檔案 | 狀態 | 備註 |
|------|------|------|------|
| Blockly 面板 | `src/ui/panels/blockly-panel.ts` | ✅ 完成 | 含 extractBlockInner |
| Monaco 面板 | `src/ui/panels/monaco-panel.ts` | ✅ 完成 | |
| 主控台面板 | `src/ui/panels/console-panel.ts` | ✅ 完成 | |
| 變數面板 | `src/ui/panels/variable-panel.ts` | ✅ 完成 | |
| Debug 工具列 | `src/ui/debug-toolbar.ts` | ✅ 完成 | |
| 同步控制器 | `src/ui/sync-controller.ts` | ✅ 完成 | 透過 SemanticBus 通訊，不直接 import 面板 |
| App（初始化膠水碼） | `src/ui/app.ts` | ✅ 完成 | 已拆分為 ToolboxBuilder + BlockRegistrar + AppShell |
| 工具箱建構器 | `src/ui/toolbox-builder.ts` | ✅ 完成 | 純資料模組，零 Blockly DOM 依賴 |
| 積木註冊器 | `src/ui/block-registrar.ts` | ✅ 完成 | Blockly 專屬動態積木 |
| 執行控制器 | `src/ui/execution-controller.ts` | ✅ 完成 | |

### 差距分析

| 缺失項目 | 對應章節 | 優先級 | 說明 |
|----------|---------|--------|------|
| **DependencyResolver 抽象** | §3.4 | P1 | ModuleRegistry 是 C++ 專用，需泛化為語言無關介面 |
| **Program Scaffold 層** | §3.4 | P1 | include/namespace/main/return 的漸進揭露（L0 隱藏→L1 ghost→L2 手動） |
| **Semantic Node Identity** | §2.2 | P1 | 跨投影對應用 blockId（投影層 ID），應改用 node.id（語義層 ID） |
| **SemanticDiff 增量更新** | §2.2 | P2 | 目前是全量替換，效能隨視圖數量線性增長（前置：Semantic Node Identity） |
| **硬體描述層** | §5.2 | P3 | 等 Arduino 需求時再實作 |
| **DataFlow 視圖** | §4.2 | P3 | 需要 annotations 機制先到位 |

---

## 8. 演化路線圖

每個 Phase 都可以用 SpecKit 執行（specify → clarify → plan → tasks → implement）。

### Phase 0-4：已完成 ✅

- **Phase 0**：打地基 — ViewHost 介面、SemanticBus、Annotations 機制 *(014-decoupling-infra)*
- **Phase 1**：SyncController 解耦 — 面板透過 SemanticBus 通訊，面板間零 import *(015-sync-decouple)*
- **Phase 2**：app.ts 拆分 — ToolboxBuilder + BlockRegistrar + AppShell + ExecutionController *(016-app-split)*
- **Phase 3**：concept/blockDef 分離 — concepts.json + blocks.json 物理分離，manifest.json 驅動載入 *(019-cpp-std-modules)*
- **Phase 4**：VSCode Extension 原型 — Blockly WebView + 原生 TextEditor + postMessage 通訊 *(018-vscode-extension-prototype)*

### Phase 5：DependencyResolver 抽象 + Program Scaffold

**目標**：將 C++ 專用的 auto-include 泛化為語言無關的依賴解析框架，並統一 boilerplate 管理。

**理論基礎**：first-principles §1.3（結構性依賴宣告）、§2.3（DependencyResolver）、§2.4（基礎設施漸進揭露）

```
5.1 DependencyResolver 核心介面
    → src/core/dependency-resolver.ts（純介面 + 型別定義）
    → DependencyResolver { resolve(conceptIds) → DependencyEdge[] }
    → DependencyEdge { sourceType, directive, packageSpec? }
    → 核心引擎零語言依賴

5.2 C++ DependencyResolver 實作
    → 從 ModuleRegistry + computeAutoIncludes 重構
    → ModuleRegistry implements DependencyResolver
    → 移除 code-generator.ts 的全域 setModuleRegistry()
    → 改為 ProgramScaffold 消費 DependencyResolver
    → 所有現有測試通過（行為不變，只是管線重組）

5.3 ProgramScaffold 層
    → src/core/program-scaffold.ts（語言無關框架）
    → 統一管理 imports + preamble + entryPoint + epilogue
    → 接收 cognitiveLevel → 決定 hidden/ghost/editable
    → C++ 實作：#include + using namespace std + int main() + return 0
    → 從 program generator 中抽離 boilerplate 邏輯

5.4 Ghost Line 視覺呈現
    → Monaco 面板：ghost line 以淡灰色顯示（decorations API）
    → hover 顯示原因（如「因為你用了 cout」）
    → 「固定」操作：ghost → editable（寫入語義樹）
    → Blockly 面板：不影響（blocks 不顯示 include）

驗證：
  → C++ auto-include 行為不變（regression test）
  → L0 程式碼不顯示 include/main（ghost 或 hidden）
  → L2 缺少 include 時顯示警告
  → DependencyResolver 介面不含任何 C++ 專用型別
```

### Phase 5b：Semantic Node Identity（語義節點身份）

**目標**：將跨投影對應（source mapping）從 Blockly 投影層 ID（blockId）遷移到語義層 ID（node.id），消除投影間的直接耦合。

**理論基礎**：first-principles §1.1（語義結構是唯一真實——節點身份屬於語義層，不屬於任何投影層）、§2.1（投影定理——跨投影對應應經由語義結構間接建立，不應讓兩個投影直接互相推算）

**動機**：

```
現狀問題：
  SourceMapping { blockId, startLine, endLine }
                  ^^^^^^
                  這是 Blockly 投影層的 ID，不是語義層的身份

後果：
  1. code→blocks 方向必須等 Blockly 渲染完才能建立 mapping（時序耦合）
  2. lifter 產出的語義樹沒有 blockId → mapping 為空 → 需要額外的 rebuild 步驟
  3. 未來新增投影（flowchart、dataflow）需要各自建立與 blockId 的對應（N×N 耦合）
  4. SemanticDiff（§2.2）需要穩定的節點身份來偵測 add/remove/move/modify

現有基礎：
  SemanticNode.id 欄位 — 已存在（types.ts），createNode() 已自動分配
  → 不需要改型別，只需要讓 mapping 系統使用 node.id 而非 metadata.blockId
```

**目標架構**：

```
                    語義層（node.id 是唯一身份）
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    CodeMapping     BlockMapping    未來投影 Mapping
  { nodeId,       { nodeId,       { nodeId,
    startLine,      blockId }       svgElementId }
    endLine }

跨投影查詢（經由 nodeId join）：
  點擊 block → blockId → BlockMapping → nodeId → CodeMapping → 高亮行
  點擊 code  → line    → CodeMapping  → nodeId → BlockMapping → 選取積木
```

```
5b.1 SourceMapping 遷移：blockId → nodeId
    → SourceMapping { nodeId, startLine, endLine }（取代 blockId）
    → code-generator.ts generateNode() 改用 node.id 而非 metadata.blockId
    → 所有 mapping 消費者（getMappingForBlock, getMappingForLine）更新

5b.2 BlockMapping 對應表
    → 新增 BlockMapping { nodeId, blockId } 對應表
    → Blockly extractSemanticTree() 已產出帶 node.id 的語義節點
    → block-renderer.ts renderToBlocklyState() 記錄 nodeId → blockId 映射
    → SyncController 維護 blockMappings: BlockMapping[]

5b.3 跨投影查詢重構
    → getMappingForBlock(blockId): 查 BlockMapping → nodeId → 查 CodeMapping
    → getMappingForLine(line): 查 CodeMapping → nodeId → 查 BlockMapping
    → code→blocks 不再需要等 Blockly 渲染後才能建立 CodeMapping
    → handleEditCode 可直接從 generateCodeWithMapping 取得正確的 CodeMapping

5b.4 nodeId 穩定性保證
    → createNode() 自動分配（已實作）
    → Lifter lift() 產出的節點帶 id（已實作）
    → Blockly extractSemanticTree() 保留 node.id（需驗證）
    → round-trip（blocks→code→blocks）中同一邏輯節點的 id 應保持穩定
    → 為 SemanticDiff（Phase 8.2）的 id-based 節點匹配鋪路

驗證：
  → 所有現有測試通過
  → SourceMapping 不含 blockId（純語義層）
  → code→blocks mapping 不依賴 Blockly 渲染時序
  → 點擊積木正確高亮程式碼行（L0 / L1 / L2）
  → 點擊程式碼行正確選取積木
  → 新增投影只需建立自己的 { nodeId, X } 映射，不需要知道其他投影的存在
```

### Phase 6：Python 語言套件

**目標**：用第二個語言驗證架構的語言無關性。

**前置條件**：Phase 5（DependencyResolver 框架）

```
6.1 Python 語言骨架
    → languages/python/manifest.json
    → languages/python/core/（if, for, def, class, print, input）
    → languages/python/stdlib/（os, collections, json）
    → tree-sitter-python 解析器整合

6.2 Python DependencyResolver
    → concept → import 語句映射
    → stdlib: import os / from collections import defaultdict
    → external: import numpy as np（含 packageSpec）

6.3 Python ProgramScaffold
    → imports + if __name__ == "__main__" 入口
    → 無 using namespace 等效物
    → L0: 隱藏 import，L2: 手動管理

6.4 Python 積木投射
    → core blocks（if, for, def, variable, print, input）
    → generator + lifter
    → 最少達到 C++ L0 的等效功能

驗證：
  → Python code → blocks → code roundtrip
  → DependencyResolver 自動產出 import 語句
  → C++ 所有測試不受影響
  → 語言切換後 toolbox 自動更新
```

### Phase 7：外部套件生態

**目標**：支援第三方函式庫的語義套件（如 Arduino、NumPy）。

**前置條件**：Phase 6（多語言驗證）

```
7.1 外部套件載入機制
    → packages/{name}/manifest.json 宣告 dependencies + provides
    → LanguageManager 解析依賴鏈
    → 概念生命週期：raw_code → func_call 降級 → 安裝後完全支援

7.2 套件安裝狀態 UI
    → DependencyEdge.sourceType === 'external' 時
    → Ghost line 額外顯示安裝狀態（✓ 已安裝 / ✗ 需安裝）
    → 「一鍵安裝」按鈕（呼叫 pip/npm/vcpkg）

7.3 Arduino 語言套件（第一個外部套件實例）
    → 基於 C++ 語言套件擴充
    → 硬體描述層（§5.2）
    → Servo / NeoPixel 積木

驗證：
  → 安裝套件後新概念自動出現在 toolbox
  → 移除套件後使用其概念的積木降級為 raw_code
  → 套件依賴鏈正確解析
```

### Phase 8+：進階擴充

```
8.1 DataFlow 視圖（消費 control_flow annotations）
8.2 SemanticDiff 增量更新（效能優化，前置：Phase 5b nodeId 穩定性）
8.3 接線視圖 + 模擬視圖（硬體教育）
8.4 跨語言映射視圖（concept.abstractConcept 驅動）
8.5 語義套件市場（§4.2 效能市場的工程實作）
```

---

## 9. 重構進度 Checklist

> 每個 Phase 用 SpecKit 展開（specify → clarify → plan → tasks → implement）。
> 開始新 Phase 前，先在此 checklist 標記前一個 Phase 的完成狀態。
> 每個子項完成時打勾，並附上完成日期或 commit hash。

### Phase 0-4：已完成 ✅

- [x] **Phase 0：打地基** *(2026-03-09, 014-decoupling-infra)* — ViewHost 介面 + SemanticBus + Annotations 機制
- [x] **Phase 1：SyncController 解耦** *(015-sync-decouple)* — 面板透過 SemanticBus 通訊，面板間零 import
- [x] **Phase 2：app.ts 拆分** *(016-app-split)* — ToolboxBuilder + BlockRegistrar + AppShell（app.ts 488 行）
- [x] **Phase 3：concept/blockDef 分離** *(019-cpp-std-modules)* — concepts.json + blocks.json 分離，manifest.json，std 模組按 header 重組
- [x] **Phase 4：VSCode Extension 原型** *(2026-03-10, 018-vscode-extension-prototype)* — Blockly WebView + 原生 TextEditor + postMessage

### Phase 5：DependencyResolver 抽象 + Program Scaffold

前置條件：Phase 4 完成

- [x] **5.1 DependencyResolver 核心介面**
  - [x] 定義 `DependencyResolver` + `DependencyEdge` 介面（`src/core/dependency-resolver.ts`）
  - [x] 介面零語言依賴（不含 `#include`、`import` 等語言專用概念）
  - [x] 單元測試：mock resolver 可編譯、型別正確
- [x] **5.2 C++ DependencyResolver 實作**
  - [x] `ModuleRegistry` implements `DependencyResolver`
  - [x] 移除 `code-generator.ts` 的全域 `setModuleRegistry()`
  - [x] auto-include 邏輯從 program generator 遷移到 ProgramScaffold
  - [x] 所有現有 1555 tests 通過（行為不變）
- [x] **5.3 ProgramScaffold 層**
  - [x] 定義 `ProgramScaffold` + `ScaffoldConfig` + `ScaffoldResult` 介面（`src/core/program-scaffold.ts`）
  - [x] C++ 實作：imports（auto-include）+ preamble（using namespace）+ entryPoint（main）+ epilogue（return 0）
  - [x] 接收 `cognitiveLevel` → 決定 `hidden` / `ghost` / `editable`
  - [x] 從 program generator 抽離所有 boilerplate 邏輯
  - [x] 整合測試：scaffold 結果與現有 code generation 一致
- [x] **5.4 Ghost Line 視覺呈現**
  - [x] Monaco decorations API 實作淡灰色 ghost line
  - [x] Hover provider 顯示依賴原因
  - [x] 「固定」操作（ghost → editable）
  - [x] L0 / L1 / L2 三種模式的端到端測試
- [x] **Phase 5 驗證**
  - [x] C++ auto-include 行為不變（regression）
  - [x] `DependencyResolver` 介面不 import `languages/cpp/`
  - [x] Ghost line 在瀏覽器和 VSCode 都正常顯示

### Phase 5b：Semantic Node Identity

前置條件：Phase 5 完成（或可與 Phase 5 平行，因為不依賴 DependencyResolver）

- [x] **5b.1 SourceMapping 遷移：blockId → nodeId**（2026-03-10 完成）
  - [x] `SourceMapping` 介面改為 `CodeMapping { nodeId, startLine, endLine }`（已移除 SourceMapping，無向後相容）
  - [x] `code-generator.ts` `generateNode()` 改用 `node.id` 而非 `metadata.blockId`
  - [x] 所有 mapping 消費者更新（`getMappingForBlock`、`getMappingForLine`）
- [x] **5b.2 BlockMapping 對應表**（2026-03-10 完成）
  - [x] 新增 `BlockMapping { nodeId, blockId }` 介面
  - [x] `block-renderer.ts` 記錄 `nodeId → blockId` 映射
  - [x] `SyncController` 維護 `blockMappings`（blocks→code 用 `extractBlockMappingsFromTree`；code→blocks 用 `renderToBlocklyState().blockMappings`）
  - [x] `extractSemanticTree()` 保留 `node.id`（驗證）
- [x] **5b.3 跨投影查詢重構**（2026-03-10 完成）
  - [x] `getMappingForBlock(blockId)` → 查 BlockMapping → nodeId → 查 CodeMapping
  - [x] `getMappingForLine(line)` → 查 CodeMapping → nodeId → 查 BlockMapping
  - [x] `handleEditCode` 直接從 `generateCodeWithMapping` 取得 CodeMapping（不需等 Blockly）
  - [x] 移除 `rebuildSourceMappings` 的 workaround（不再需要）
- [ ] **5b.4 nodeId 穩定性與 SemanticDiff 基礎**（部分完成）
  - [x] round-trip 中同一節點 id 保持穩定（2026-03-10 驗證）
  - [ ] Diff 算法原型：依 id 匹配節點，偵測 add/remove/modify
  - [ ] 為 Phase 8.2 SemanticDiff 增量更新鋪路
- [x] **Phase 5b 驗證**（2026-03-10 完成，1608 測試全通過）
  - [x] 所有現有測試通過
  - [x] `CodeMapping` 不含 `blockId`（純語義層）
  - [x] code→blocks mapping 不依賴 Blockly 渲染時序
  - [x] 跨投影高亮正確（L0 / L1 / L2）

### Phase 6：Python 語言套件

前置條件：Phase 5 完成

- [ ] **6.1 Python 語言骨架**
  - [ ] `languages/python/manifest.json`
  - [ ] `languages/python/core/`（if, for, def, class, print, input 概念 + 積木 + generator + lifter）
  - [ ] tree-sitter-python 解析器整合
- [ ] **6.2 Python DependencyResolver**
  - [ ] concept→import 映射（stdlib: `import os`；external: `import numpy as np`）
  - [ ] `PythonDependencyResolver` implements `DependencyResolver`
- [ ] **6.3 Python ProgramScaffold**
  - [ ] imports + `if __name__ == "__main__"` 入口
  - [ ] L0/L1/L2 漸進揭露
- [ ] **6.4 Python 積木投射**
  - [ ] 核心積木達到 C++ L0 等效功能
  - [ ] code → blocks → code roundtrip
- [ ] **Phase 6 驗證**
  - [ ] Python roundtrip 成功
  - [ ] C++ 全部測試不受影響
  - [ ] 語言切換後 toolbox 自動更新

### Phase 7：外部套件生態

前置條件：Phase 6 完成

- [ ] **7.1 外部套件載入**
  - [ ] `packages/{name}/manifest.json` 宣告格式
  - [ ] LanguageManager 依賴鏈解析
  - [ ] 概念生命週期降級（raw_code → func_call → 完全支援）
- [ ] **7.2 套件安裝狀態 UI**
  - [ ] Ghost line 安裝狀態指示（✓ / ✗）
  - [ ] 一鍵安裝按鈕
- [ ] **7.3 Arduino 語言套件**
  - [ ] 基於 C++ 擴充
  - [ ] 硬體描述層
  - [ ] Servo / NeoPixel 積木

### Phase 8+：進階擴充

- [ ] 8.1 DataFlow 視圖
- [ ] 8.2 SemanticDiff 增量更新
- [ ] 8.3 接線視圖 + 模擬視圖
- [ ] 8.4 跨語言映射視圖
- [ ] 8.5 語義套件市場

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
