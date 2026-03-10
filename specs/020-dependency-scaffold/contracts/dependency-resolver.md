# Contract: DependencyResolver

**Location**: `src/core/dependency-resolver.ts`

## Interface

```typescript
interface DependencyEdge {
  directive: string        // e.g., '#include <iostream>'
  sourceType: 'builtin' | 'stdlib' | 'external'
  header: string           // e.g., '<iostream>'
  reason?: string          // e.g., 'cout' — concept that triggered this dependency
}

interface DependencyResolver {
  resolve(conceptIds: string[]): DependencyEdge[]
}
```

## Contract Rules

1. `resolve([])` MUST return `[]`
2. `resolve` MUST deduplicate — same header appears at most once
3. `resolve` MUST sort results by `header` (alphabetical)
4. `resolve` with unknown conceptIds MUST return `[]` (ignore unknown, no error)
5. `directive` MUST be a complete, ready-to-insert code line (including newline is optional)
6. `reason` SHOULD be the first conceptId that triggered the dependency

## C++ Implementation Contract

C++ 的 `ModuleRegistry` 實作 `DependencyResolver`：

1. `resolve(['print', 'endl'])` → `[{ directive: '#include <iostream>', sourceType: 'stdlib', header: '<iostream>', reason: 'print' }]`
2. `resolve(['print', 'vector_declare'])` → 兩條邊：`<iostream>` 和 `<vector>`
3. 結果與現有 `getRequiredHeaders` 產出相同 header 集合
4. `getRequiredHeaders` 方法移除，所有呼叫端遷移至 `resolve()`

## Test Scenarios

- 空 conceptIds → 空結果
- 單一 concept → 對應 header
- 多個 concept 指向同一 header → 去重
- 混合 concept（iostream + vector + algorithm）→ 三條邊，按 header 排序
- 未知 concept → 忽略
- 核心介面檔案不 import 任何 `languages/` 模組
