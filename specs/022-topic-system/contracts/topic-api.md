# Topic System 內部 API 契約

**Date**: 2026-03-11

## TopicRegistry

```typescript
class TopicRegistry {
  register(topic: Topic): void
  get(topicId: string): Topic | undefined
  getDefault(language: string): Topic | undefined
  listForLanguage(language: string): Topic[]
}
```

## Level Tree Engine（取代 cognitive-levels.ts）

```typescript
// 計算可見概念集合
function getVisibleConcepts(
  topic: Topic,
  enabledBranches: Set<string>
): Set<ConceptId>

// 取得所有 LevelNode（扁平列表，用於 UI 渲染）
function flattenLevelTree(root: LevelNode): LevelNode[]

// 啟用/停用一個分支時，自動解析祖先依賴
function resolveEnabledBranches(
  root: LevelNode,
  toggled: string
): Set<string>

// 倍增軟指引驗證
function validateDoublingGuideline(root: LevelNode): Warning[]

// 判斷概念是否在當前 Topic + 啟用分支中可見（取代 isBlockAvailable）
function isConceptVisible(
  conceptId: string,
  topic: Topic,
  enabledBranches: Set<string>
): boolean
```

## BlockSpec Override Merging

```typescript
// 合併 base BlockSpec 和 Topic override
function applyBlockOverride(
  base: BlockSpec,
  override: BlockOverride
): BlockSpec

// 合併 args（merge with removal semantics）
function mergeArgs(
  baseArgs: BlockArg[],
  overrideArgs: BlockArgOverride[]
): BlockArg[]
```

## BlockSpecRegistry（改寫）

```typescript
class BlockSpecRegistry {
  // 移除的方法：
  // getLevel(blockType: string): CognitiveLevel  ← 刪除
  // listByCategory(category, level: CognitiveLevel)  ← 改寫

  // 改寫後：
  listByCategory(category: string, visibleConcepts: Set<string>): BlockSpec[]
  getByBlockType(blockType: string): BlockSpec | undefined
  getByConceptId(conceptId: string): BlockSpec | undefined
}
```

## Toolbox Builder（改寫）

```typescript
interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  // 移除：level: CognitiveLevel
  topic: Topic
  enabledBranches: Set<string>
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>
  categoryColors: Record<string, string>
  categoryDefs?: ToolboxCategoryDef[]
}
```

## Storage（改寫）

```typescript
interface SavedState {
  version: number
  tree: SemanticNode | null
  blocklyState: object
  code: string
  language: string
  styleId: string
  // 移除：level: CognitiveLevel
  topicId: string
  enabledBranches: string[]
  lastModified: string
  blockStyleId?: string
  locale?: string
}
```

## ScaffoldConfig（改寫）

```typescript
interface ScaffoldConfig {
  // 移除：cognitiveLevel: CognitiveLevel
  topic: Topic
  enabledBranches: Set<string>
  // scaffold visibility 由 Topic 層級深度決定：
  // 根節點 = hidden, 第一層 = ghost, 更深 = editable
}
```

## 事件

| 事件名 | Payload | 觸發時機 |
|--------|---------|----------|
| `topic:changed` | `{ topic: Topic, enabledBranches: Set<string> }` | 使用者切換 Topic |
| `topic:branches-changed` | `{ enabledBranches: Set<string>, visibleConcepts: Set<string> }` | 使用者啟用/停用分支 |

## 移除的 API

以下 API 在此 Phase 中完全移除：

- `type CognitiveLevel = 0 | 1 | 2`
- `getBlockLevel(blockType: string): CognitiveLevel`
- `isBlockAvailable(blockType: string, level: CognitiveLevel): boolean`
- `filterBlocksByLevel(blockTypes: string[], level: CognitiveLevel): string[]`
- `setBlockSpecRegistry(registry: BlockSpecRegistry): void`（cognitive-levels.ts 中的 global setter）
- `LevelSelector` 類別
- `DEFAULT_LEVEL_DEFS`
- `LEVEL_LABELS` mapping
