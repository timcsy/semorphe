# Data Model: Phase 0 — 解耦基礎設施

## 新增型別

### ViewHost（介面）

| 欄位 | 型別 | 說明 |
|------|------|------|
| viewId | string (readonly) | 視圖唯一識別碼 |
| viewType | string (readonly) | 視圖類別（'blocks', 'code', 'console', 'variables' 等） |
| capabilities | ViewCapabilities (readonly) | 能力宣告 |
| initialize(config) | (ViewConfig) => Promise\<void\> | 初始化 |
| dispose() | () => void | 銷毀 |
| onSemanticUpdate(event) | (SemanticUpdateEvent) => void | 接收語義更新 |
| onExecutionState(event) | (ExecutionStateEvent) => void | 接收執行狀態 |

### ViewCapabilities

| 欄位 | 型別 | 說明 |
|------|------|------|
| editable | boolean | 是否可回寫語義樹 |
| needsLanguageProjection | boolean | 是否需要 Layer 2 投影提示 |
| consumedAnnotations | string[] | 消費哪些語義標註 key |

### ViewConfig

| 欄位 | 型別 | 說明 |
|------|------|------|
| language | string | 語言 ID（如 'cpp'） |
| style | StylePreset | 當前 code style |

### SemanticEvents（核心 → 視圖）

| 事件 key | 資料型別 | 說明 |
|----------|---------|------|
| semantic:update | { tree: SemanticNode } | 語義樹更新 |
| semantic:full-sync | { tree: SemanticNode; language: string; style: StylePreset } | 完整同步 |
| execution:state | { status: ExecutionStatus; step?: StepInfo } | 執行狀態變更 |
| execution:output | { text: string; stream: 'stdout' \| 'stderr' } | 執行輸出 |
| diagnostics:update | { items: Diagnostic[] } | 診斷訊息更新 |

### ViewRequests（視圖 → 核心）

| 事件 key | 資料型別 | 說明 |
|----------|---------|------|
| edit:code | { code: string } | 程式碼視圖的文字修改 |
| edit:blocks | { blocklyState: unknown } | 積木視圖的修改 |
| execution:run | { command: 'run' \| 'step' \| 'stop' \| 'reset' } | 執行指令 |
| execution:input | { text: string } | 主控台輸入 |
| config:change | { key: string; value: unknown } | 設定變更 |

## 修改型別

### ConceptDef（新增欄位）

| 欄位 | 型別 | 說明 |
|------|------|------|
| annotations | Record\<string, unknown\> (optional) | 語義標註（開放集合） |

### 示範 Annotations（C++）

| 概念 | annotation key | 值 | 消費者 |
|------|---------------|-----|--------|
| for_loop | control_flow | "loop" | dataflow 視圖 |
| for_loop | introduces_scope | true | variables 視圖 |
| for_loop | cognitive_level | 1 | toolbox |
| if | control_flow | "branch" | dataflow 視圖 |
| if | introduces_scope | true | variables 視圖 |
| if | cognitive_level | 0 | toolbox |
| func_def | control_flow | "sequence" | dataflow 視圖 |
| func_def | introduces_scope | true | variables 視圖 |
| func_def | cognitive_level | 2 | toolbox |
