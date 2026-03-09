# Module Interfaces: Phase 2 — app.ts 拆分

**Date**: 2026-03-09

## ToolboxBuilder

```typescript
// src/ui/toolbox-builder.ts

import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { CognitiveLevel, StylePreset } from '../core/types'

export interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  level: CognitiveLevel
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>
  categoryColors: Record<string, string>
}

/**
 * 純函式：從積木規格 + 認知層級 + 風格產出 toolbox 定義。
 * 零 UI 框架依賴。
 */
export function buildToolbox(config: ToolboxBuildConfig): object
```

**測試契約**：
- `buildToolbox({ level: 0 })` → 只包含 L0 積木
- `buildToolbox({ level: 2 })` → 包含更多進階積木
- `buildToolbox({ ioPreference: 'cstdio' })` → cstdio 積木排在 iostream 前面
- 不 import `blockly`（靜態分析驗證）

## BlockRegistrar

```typescript
// src/ui/block-registrar.ts

import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type * as Blockly from 'blockly'

export interface WorkspaceAccessors {
  getVarOptions: () => Array<[string, string]>
  getScanfVarOptions: () => Array<[string, string]>
  getArrayOptions: (currentVal?: string) => Array<[string, string]>
  getFuncOptions: (currentVal?: string) => Array<[string, string]>
  getWorkspace: () => Blockly.Workspace | null
}

export class BlockRegistrar {
  constructor(blockSpecRegistry: BlockSpecRegistry)

  /**
   * 註冊所有積木（JSON spec + 動態積木）。
   * 必須在 Blockly workspace 建立前呼叫。
   */
  registerAll(accessors: WorkspaceAccessors): void

  /**
   * 取得 workspace 變數選項（供外部使用，如 app.ts 的 CodeToBlocks pipeline）。
   */
  getWorkspaceVarOptions(): Array<[string, string]>
  getScanfVarOptions(): Array<[string, string]>
  getWorkspaceArrayOptions(currentVal?: string): Array<[string, string]>
  getWorkspaceFuncOptions(currentVal?: string): Array<[string, string]>
}
```

**測試契約**：
- 註冊後 `Blockly.Blocks['u_print']` 存在
- `saveExtraState` / `loadExtraState` roundtrip 正確
- 重複註冊同一積木 ID 不報錯

## AppShell

```typescript
// src/ui/app-shell.ts

import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { LocaleLoader } from '../i18n/loader'
import type { StorageService } from '../core/storage'
import type { StylePreset, CognitiveLevel } from '../core/types'

export interface AppShellConfig {
  container: HTMLElement
  stylePresets: StylePreset[]
}

export interface AppShellElements {
  toolbar: HTMLElement
  leftPanel: HTMLElement
  blocklyContainer: HTMLElement
  monacoWrapper: HTMLElement
  bottomContainer: HTMLElement
  statusBar: HTMLElement
}

export interface AppShellCallbacks {
  onSyncBlocks: () => void
  onSyncCode: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
  onImport: () => void
  onUploadBlocks: () => void
  onAutoSyncToggle: () => void
  onLevelChange: (level: CognitiveLevel) => void
  onStyleChange: (style: StylePreset) => void
  onBlockStyleChange: (preset: unknown) => void
  onLocaleChange: (locale: string) => void
  onExecute: () => void
}

export class AppShell {
  constructor(config: AppShellConfig)

  /**
   * 建立 DOM 骨架，回傳容器元素引用。
   */
  createLayout(): AppShellElements

  /**
   * 設定 toolbar 事件回呼。
   */
  wireCallbacks(callbacks: AppShellCallbacks): void

  /**
   * 更新 status bar 顯示。
   */
  updateStatusBar(info: { style: StylePreset; blockStyleId: string; level: CognitiveLevel; locale: string }): void

  /**
   * 更新自動同步按鈕狀態。
   */
  setAutoSync(enabled: boolean): void
}
```

**測試契約**：
- `createLayout()` → 回傳包含所有必要容器的 elements
- DOM 中包含 toolbar、main、status-bar
- 不依賴 SyncController 或任何 panel class
