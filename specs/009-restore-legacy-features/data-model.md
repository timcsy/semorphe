# Data Model: 009-restore-legacy-features

## Entities

### ExecutionSession

一次程式執行的完整生命週期。

| Field | Type | Description |
|-------|------|-------------|
| status | `'idle' \| 'running' \| 'paused' \| 'stopped' \| 'completed' \| 'error'` | 當前狀態 |
| speed | `'slow' \| 'medium' \| 'fast'` | 執行速度（800ms/300ms/50ms） |
| stepRecords | `StepInfo[]` | 所有步驟的快照記錄 |
| currentStepIndex | `number` | 逐步執行時的當前索引 |
| output | `string[]` | 累積的程式輸出 |
| errorMessage | `string \| null` | 錯誤訊息（如有） |

**State Transitions**:
```
idle → running (execute/step)
running → paused (pause)
running → completed (正常結束)
running → error (執行錯誤)
running → stopped (使用者停止)
paused → running (resume)
paused → stopped (使用者停止)
any → idle (reset)
```

### StepInfo（已存在於 src/interpreter/types.ts）

| Field | Type | Description |
|-------|------|-------------|
| node | `SemanticNode` | 被執行的語義節點 |
| blockId | `string \| null` | 對應的 Blockly 積木 ID |
| sourceRange | `{ start: number, end: number } \| null` | 對應的程式碼行範圍 |
| outputLength | `number` | 此步驟時的輸出行數 |
| scopeSnapshot | `{ name: string, type: string, value: string }[]` | 變數快照 |

### SourceMapping

積木與程式碼行的對應關係。

| Field | Type | Description |
|-------|------|-------------|
| blockId | `string` | Blockly 積木 ID |
| startLine | `number` | 對應程式碼的起始行（0-based） |
| endLine | `number` | 對應程式碼的結束行（0-based） |

**Lifecycle**: 每次 syncBlocksToCode() 時重新建立。由 code-generator 在生成程式碼時同步產出。

### Diagnostic

積木配置問題描述。

| Field | Type | Description |
|-------|------|-------------|
| blockId | `string` | 相關積木 ID |
| severity | `'warning' \| 'error'` | 嚴重程度 |
| message | `string` | 診斷訊息（i18n key） |

### QuickAccessItem

快速存取按鈕定義。

| Field | Type | Description |
|-------|------|-------------|
| blockType | `string` | 積木類型（如 'u_var_declare'） |
| icon | `string` | 顯示圖示（emoji 或 SVG） |
| label | `string` | 按鈕標籤（i18n key） |
| minLevel | `CognitiveLevel` | 最低可見層級（0/1/2） |

### ScopeGroup（變數面板用）

作用域分組顯示。

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | 作用域名稱（如 '全域'、'main'、'for 迴圈'） |
| collapsed | `boolean` | 是否收合 |
| variables | `VariableEntry[]` | 此作用域的變數列表 |

## Relationships

```
ExecutionSession 1──* StepInfo
StepInfo *──1 SemanticNode
StepInfo 0..1──1 SourceMapping (via blockId)
SyncController 1──* SourceMapping
BottomPanel 1──1 ConsolePanel
BottomPanel 1──1 VariablePanel
VariablePanel 1──* ScopeGroup
ScopeGroup 1──* VariableEntry
QuickAccessBar 1──* QuickAccessItem
```
