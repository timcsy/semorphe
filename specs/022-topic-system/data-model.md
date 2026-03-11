# Data Model: Topic System (022-topic-system)

**Date**: 2026-03-11

## 核心實體

### Topic

代表一個使用情境的投影組態。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | ✅ | 唯一識別碼，慣例 `{lang}-{name}`（如 `cpp-beginner`） |
| language | string | ✅ | 所屬語言 ID（如 `cpp`） |
| name | string | ✅ | 顯示名稱（如「初學 C++」） |
| default | boolean | ❌ | 是否為該語言的預設 Topic，每語言恰好一個 |
| description | string | ❌ | Topic 的簡短描述 |
| levelTree | LevelNode | ✅ | 層級樹根節點 |
| blockOverrides | Record<ConceptId, BlockOverride> | ❌ | 概念級積木覆蓋 |

**唯一性規則**: `id` 全域唯一。每個 `language` 恰好有一個 `default: true` 的 Topic。

**生命週期**: 載入時從 JSON 解析 → 註冊到 TopicRegistry → 使用期間不可變 → 語言切換時可替換整批。

---

### LevelNode

層級樹中的一個節點。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | ✅ | 節點識別碼，用於持久化啟用狀態（如 `L0`、`L1a`、`L2b`） |
| level | number | ✅ | 深度層級（根 = 0） |
| label | string | ✅ | 顯示標籤（如「L1a: 函式與迴圈」） |
| concepts | ConceptId[] | ✅ | 此節點新增的概念 ID 列表 |
| children | LevelNode[] | ✅ | 子分支（可為空陣列） |

**關係**: 樹狀結構。根節點是 Topic.levelTree，啟用子節點時自動啟用所有祖先節點。

**可見概念計算**: `visibleConcepts = union(enabledNode.concepts for each enabledNode in enabledBranches)`

**倍增軟指引**: `|node.concepts| ≈ 2 × |parent.concepts|`，偏差超過 2.5 倍時載入時警告。

---

### BlockOverride

Topic 對特定概念的積木呈現覆蓋。

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| message | string | ❌ | 覆蓋積木顯示標題 |
| tooltip | string | ❌ | 覆蓋提示文字 |
| args | BlockArgOverride[] | ❌ | 覆蓋輸入欄位（合併語義） |
| renderMapping | Partial<RenderMapping> | ❌ | 覆蓋欄位↔屬性映射 |

**args 合併規則**:
- 同名 arg：override 值取代 base 值
- 新名 arg：追加到 base args
- `{ name: "FIELD_X", _remove: true }`：從 base 移除該 arg
- 未在 override 出現的 arg：保留 base 值

---

### TopicRegistry

Topic 的記憶體註冊表。

| 操作 | 簽名 | 說明 |
|------|------|------|
| register | `(topic: Topic) → void` | 註冊一個 Topic，驗證唯一性和 default 規則 |
| get | `(topicId: string) → Topic \| undefined` | 按 ID 查找 |
| getDefault | `(language: string) → Topic \| undefined` | 取得語言的預設 Topic |
| listForLanguage | `(language: string) → Topic[]` | 列出某語言的所有 Topic |

**驗證規則**:
- ID 不可重複
- 同語言中 `default: true` 恰好一個（多於一個報錯，零個時自動將第一個設為預設）

---

### UserContext（Topic 部分）

使用者的 Topic 選擇狀態，持久化在 SavedState 中。

| 欄位 | 型別 | 說明 |
|------|------|------|
| topicId | string | 當前選擇的 Topic ID |
| enabledBranches | string[] | 已啟用的 LevelNode ID 列表 |

**Fallback 規則**: 若儲存的 topicId 對應的 Topic 不存在，fallback 到該語言的 `default` Topic 並重置 enabledBranches 為根節點。

---

## 關係圖

```
Language (1) ──── has many ──── Topic (N)
                                  │
                                  ├── levelTree: LevelNode (tree)
                                  │     └── concepts: ConceptId[]
                                  │
                                  └── blockOverrides: ConceptId → BlockOverride
                                                                    │
                                                                    └── merges with → BlockSpec (base)

UserContext
  ├── topicId → selects → Topic
  └── enabledBranches[] → selects → LevelNode[]
                                        │
                                        └── union(concepts) → visibleConcepts
```

## 現有型別的變更（破壞性）

### 移除 CognitiveLevel

完全移除 `CognitiveLevel = 0 | 1 | 2` 型別。所有使用此型別的介面改用 Topic + enabledBranches。

**影響範圍**（~52 檔案）:
- `types.ts`：移除 CognitiveLevel 型別定義；BlockSpec、ConceptDef 等移除 `level` 欄位
- `cognitive-levels.ts`：重寫為 Topic-based 層級引擎（或合併到 `level-tree.ts`）
- `block-spec-registry.ts`：`listByCategory()` 和 `getLevel()` 改為接受 Topic + enabledBranches
- 28 個 JSON 檔案（171 個 level 欄位）：移除 `level` 欄位，概念歸屬改由 Topic LevelNode.concepts 決定

### SavedState（改寫）

移除欄位：
- `level: CognitiveLevel`（刪除）

新增欄位：
- `topicId: string`
- `enabledBranches: string[]`

### ToolboxBuildConfig（改寫）

移除欄位：
- `level: CognitiveLevel`（刪除）

新增欄位：
- `topic: Topic`
- `enabledBranches: Set<string>`

### BlockSpec / ConceptDef（改寫）

移除欄位：
- `level: CognitiveLevel`（刪除）

概念的層級歸屬完全由 Topic 的 LevelNode.concepts 決定，不再在 BlockSpec/ConceptDef 上標記。

### ScaffoldConfig（改寫）

移除欄位：
- `cognitiveLevel: CognitiveLevel`（刪除）

新增欄位：
- `enabledBranches: Set<string>`
- `topic: Topic`

Scaffold 可見性（hidden/ghost/editable）改由 Topic 的層級樹深度或配置決定。
