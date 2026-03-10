# Data Model: DependencyResolver + Program Scaffold

**Date**: 2026-03-10 | **Feature**: 020-dependency-scaffold

## Entities

### DependencyEdge

表示一個概念對某個模組/標頭的依賴關係。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| directive | string | ✅ | Import 指令（如 `#include <iostream>`） |
| sourceType | `'builtin' \| 'stdlib' \| 'external'` | ✅ | 依賴來源分類 |
| header | string | ✅ | 標頭名稱（如 `<iostream>`） |
| reason | string | ❌ | 觸發此依賴的概念名稱（如 `'cout'`），供 tooltip 使用 |
| packageSpec | object | ❌ | 外部套件規格（留待 Phase 7） |

**Uniqueness**: 以 `header` 為 key 去重，同一 header 可由多個 concept 觸發。

### ScaffoldItem

表示一個 boilerplate 程式碼行及其可見性。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | ✅ | 程式碼內容（如 `#include <iostream>`） |
| visibility | `'hidden' \| 'ghost' \| 'editable'` | ✅ | 根據認知等級決定 |
| reason | string | ❌ | 為什麼需要這行（如 `'因為你用了 cout'`） |
| section | `'imports' \| 'preamble' \| 'entryPoint' \| 'epilogue'` | ✅ | 所屬區段 |
| pinned | boolean | ❌ | 使用者是否已固定此行（預設 false） |

**State transitions**:
- `hidden` → 認知等級從 L0 切到 L1 → `ghost`
- `ghost` → 認知等級從 L1 切到 L2 → `editable`
- `ghost` → 使用者固定 → `editable`（pinned = true）
- `editable` (pinned) → 認知等級切回 L0 → 保持 `editable`（因使用者明確選擇）

### ScaffoldResult

完整的程式基礎設施結果。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| imports | ScaffoldItem[] | ✅ | `#include` 指令列表 |
| preamble | ScaffoldItem[] | ✅ | `using namespace std;` 等前置宣告 |
| entryPoint | ScaffoldItem[] | ✅ | `int main() {` |
| epilogue | ScaffoldItem[] | ✅ | `return 0;` + `}` |

**Relationships**:
- ScaffoldResult 的 imports 由 DependencyResolver.resolve() 的結果驅動
- ScaffoldResult 的其他區段由語言模組的 ProgramScaffold 實作決定

## Interfaces

### DependencyResolver（核心介面）

```
resolve(conceptIds: string[]): DependencyEdge[]
```

- 輸入：語義樹中收集到的所有概念 ID
- 輸出：去重、排序的依賴邊列表
- 核心介面，不 import 任何語言專用模組

### ProgramScaffold（核心介面）

```
resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult
```

- ScaffoldConfig: `{ cognitiveLevel: CognitiveLevel, manualImports?: string[] }`
- 輸入：語義樹 + 配置
- 輸出：結構化的 scaffold 結果
- 核心介面，不 import 任何語言專用模組
