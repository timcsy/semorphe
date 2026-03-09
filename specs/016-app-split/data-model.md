# Data Model: Phase 2 — app.ts 拆分

**Date**: 2026-03-09 | **Plan**: [plan.md](plan.md)

## 核心實體

### ToolboxBuilder

純資料轉換器，零 class state。

```typescript
// 輸入
interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  level: CognitiveLevel
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>       // Blockly.Msg 的純資料快照
  categoryColors: Record<string, string>
}

// 輸出
interface ToolboxDefinition {
  kind: 'categoryToolbox'
  contents: ToolboxCategory[]
}

interface ToolboxCategory {
  kind: 'category'
  name: string
  colour: string
  contents: ToolboxEntry[]
}

interface ToolboxEntry {
  kind: 'block'
  type: string
  extraState?: Record<string, unknown>
}
```

### BlockRegistrar

Blockly 框架專屬，管理動態積木定義。

```typescript
interface WorkspaceAccessors {
  getVarOptions: () => Array<[string, string]>
  getScanfVarOptions: () => Array<[string, string]>
  getArrayOptions: (currentVal?: string) => Array<[string, string]>
  getFuncOptions: (currentVal?: string) => Array<[string, string]>
  getWorkspace: () => Blockly.Workspace | null
}

// BlockRegistrar 內部持有 WorkspaceAccessors + BlockSpecRegistry
// 註冊所有 Blockly.Blocks[...] 定義
```

### AppShell

DOM layout 管理器，建立 UI 骨架。

```typescript
interface AppShellConfig {
  container: HTMLElement          // #app 元素
  blockSpecRegistry: BlockSpecRegistry
  localeLoader: LocaleLoader
  storageService: StorageService
  stylePresets: StylePreset[]
}

interface AppShellElements {
  toolbar: HTMLElement
  leftPanel: HTMLElement          // Blockly 容器
  monacoWrapper: HTMLElement      // Monaco 容器
  bottomContainer: HTMLElement    // BottomPanel 容器
  statusBar: HTMLElement
}

// AppShell 回傳 elements，供 app.ts 初始化各面板
```

## 模組間資料流

```
app.ts (初始化膠水碼)
  │
  ├─→ BlockRegistrar.registerAll(specs, accessors)
  │     寫入 Blockly.Blocks[...]（全域副作用）
  │
  ├─→ ToolboxBuilder.build(config) → ToolboxDefinition
  │     純資料轉換，無副作用
  │
  ├─→ AppShell.create(config) → AppShellElements
  │     建立 DOM 骨架，回傳容器引用
  │
  └─→ SyncController + panels + bus 接線
        使用 AppShellElements 中的容器
```

## 驗證規則

- ToolboxBuilder 不得 import `blockly`、不得存取 `document`/`window`
- BlockRegistrar 接收 Blockly 引用而非 import（可在呼叫時才存取）
- AppShell 不依賴 SyncController 或任何 panel class
- app.ts 重構後所有 module 依賴方向：app.ts → {ToolboxBuilder, BlockRegistrar, AppShell}
