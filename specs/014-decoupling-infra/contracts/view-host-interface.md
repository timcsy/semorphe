# Contract: ViewHost Interface

## 介面定義

```typescript
interface ViewHost {
  readonly viewId: string
  readonly viewType: string
  readonly capabilities: ViewCapabilities

  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void
}

interface ViewCapabilities {
  editable: boolean
  needsLanguageProjection: boolean
  consumedAnnotations: string[]
}
```

## 不變式

1. `viewId` 在整個應用生命週期中唯一
2. `viewType` 為固定字串，不在 runtime 變更
3. `capabilities` 為 readonly，初始化後不變
4. `initialize()` 只呼叫一次，重複呼叫為未定義行為
5. `dispose()` 後不再接收事件

## SemanticBus 事件契約

```typescript
// 核心 → 視圖
interface SemanticEvents {
  'semantic:update': { tree: SemanticNode }
  'semantic:full-sync': { tree: SemanticNode; language: string; style: StylePreset }
  'execution:state': { status: ExecutionStatus; step?: StepInfo }
  'execution:output': { text: string; stream: 'stdout' | 'stderr' }
  'diagnostics:update': { items: Diagnostic[] }
}

// 視圖 → 核心
interface ViewRequests {
  'edit:code': { code: string }
  'edit:blocks': { blocklyState: unknown }
  'execution:run': { command: 'run' | 'step' | 'stop' | 'reset' }
  'execution:input': { text: string }
  'config:change': { key: string; value: unknown }
}
```

## 錯誤隔離

- SemanticBus 訂閱者拋出例外時，bus 捕獲並 `console.error`，不影響其他訂閱者
- 這保證單一視圖的 bug 不會癱瘓整個系統
