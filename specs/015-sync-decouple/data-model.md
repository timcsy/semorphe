# Data Model: Phase 1 — SyncController 解耦

**Feature**: [spec.md](./spec.md)
**Created**: 2026-03-09

## Entities

### SemanticUpdateEvent (擴充)

現有定義（`src/core/semantic-bus.ts`）：
```typescript
'semantic:update': { tree: SemanticNode }
```

擴充為：
```typescript
'semantic:update': {
  tree: SemanticNode
  code?: string           // blocks→code 方向產生的程式碼
  blockState?: unknown    // code→blocks 方向產生的積木狀態
  source: 'blocks' | 'code'  // 觸發來源，用於防迴圈
  mappings?: SourceMapping[]  // 來源映射
}
```

### ViewRequests (不變)

```typescript
'edit:code': { code: string }       // MonacoPanel 發出
'edit:blocks': { blocklyState: unknown }  // BlocklyPanel 發出（含序列化狀態）
```

### SyncController Constructor (變更)

Before:
```typescript
constructor(blocklyPanel: BlocklyPanel, monacoPanel: MonacoPanel, language: string, style: StylePreset)
```

After:
```typescript
constructor(bus: SemanticBus, language: string, style: StylePreset)
```

## Relationships

```
BlocklyPanel --emit(edit:blocks)--> SemanticBus --on(edit:blocks)--> SyncController
SyncController --emit(semantic:update)--> SemanticBus --on(semantic:update)--> MonacoPanel

MonacoPanel --emit(edit:code)--> SemanticBus --on(edit:code)--> SyncController
SyncController --emit(semantic:update)--> SemanticBus --on(semantic:update)--> BlocklyPanel

ConsolePanel <--on(execution:output)-- SemanticBus
VariablePanel <--on(execution:state)-- SemanticBus
```
