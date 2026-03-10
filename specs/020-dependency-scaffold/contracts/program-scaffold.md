# Contract: ProgramScaffold

**Location**: `src/core/program-scaffold.ts`

## Interface

```typescript
type ScaffoldVisibility = 'hidden' | 'ghost' | 'editable'

interface ScaffoldItem {
  code: string
  visibility: ScaffoldVisibility
  reason?: string
  section: 'imports' | 'preamble' | 'entryPoint' | 'epilogue'
  pinned?: boolean
}

interface ScaffoldResult {
  imports: ScaffoldItem[]
  preamble: ScaffoldItem[]
  entryPoint: ScaffoldItem[]
  epilogue: ScaffoldItem[]
}

interface ScaffoldConfig {
  cognitiveLevel: CognitiveLevel  // L0 | L1 | L2
  manualImports?: string[]         // user-written imports to exclude from scaffold
  pinnedItems?: string[]           // codes of pinned items (persist across sessions)
}

interface ProgramScaffold {
  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult
}
```

## Contract Rules

### Visibility Rules

1. `cognitiveLevel === 'L0'` → all items `visibility: 'hidden'`，**除非** `pinned: true`
2. `cognitiveLevel === 'L1'` → all items `visibility: 'ghost'`
3. `cognitiveLevel === 'L2'` 或更高 → all items `visibility: 'editable'`
4. `pinned: true` 的項目在任何等級下 `visibility: 'editable'`

### Content Rules

5. `imports` 由 DependencyResolver 的結果驅動，每個 DependencyEdge 產生一個 ScaffoldItem
6. `preamble` 包含 `using namespace std;`（C++ 特定）
7. `entryPoint` 包含 `int main() {`
8. `epilogue` 包含 `return 0;` 和 `}`
9. `manualImports` 中的 header 不出現在 scaffold 的 imports 中（去重）

### Reason Rules

10. Ghost 項目的 `reason` MUST 非空（如 `'因為你用了 cout'`）
11. Hidden 和 editable 項目的 `reason` 可選

## C++ Implementation Contract

1. 使用 `DependencyResolver.resolve()` 產生 imports
2. preamble 固定為 `using namespace std;`
3. entryPoint 固定為 `int main() {`
4. epilogue 固定為 `    return 0;\n}`（含縮排）

## Test Scenarios

- 空語義樹 + L0 → 所有項目 hidden
- 空語義樹 + L1 → 最小骨架（main + return 0）標記為 ghost
- cout + vector 語義樹 + L1 → imports 含 iostream + vector（ghost），preamble 含 using namespace（ghost）
- L2 → 所有項目 editable
- manualImports 含 `<iostream>` → scaffold imports 不含 iostream
- pinned 項目 + L0 → 該項目仍為 editable
