# Phase 1 資料模型

**Feature**: 050-repay-top-blockers ｜ **Date**: 2026-08-06

本功能新增的資料形只有兩處：陣列宣告多一個子槽、缺陷帳的量測結果多兩個分類。

---

## 1. `array_declare` 的初始值（US1）

```
array_declare
├── properties: { type, name }              # 既有，不動
└── children
    ├── size:   [SemanticNode]              # 既有，不動
    └── values: [SemanticNode, ...]         # ← 新增
```

**三態的表達**（FR-005）：

| 原始碼 | `children.values` |
|---|---|
| `int a[3];` | **欄位不存在** |
| `int a[3] = {};` | `[]`（空陣列） |
| `int a[3] = {1,2,3};` | `[node, node, node]` |

`Record<string, SemanticNode[]>` 天然表達得出三態，不需要額外欄位。

**多維不壓平**（FR-002）：巢狀的初始值列表遞迴成巢狀節點，層次由樹本身承載。

```
int m[2][2] = {{1,2},{3,4}}
  values: [ <列表節點>{ values: [1,2] }, <列表節點>{ values: [3,4] } ]
```

**否決**：把初始值壓成字串屬性（`"1,2,3"`）——直接違反既有教訓「**需要 parse 回結構才能用的字串，就不該是字串**」。

---

## 2. 可見降級（US1，FR-004）

不新增型別。用既有的 `NodeMetadata`：

```
metadata
├── confidence:       ConfidenceLevel     # 既有：high | warning | inferred | ...
└── degradationCause: DegradationCause    # 既有：syntax_error | unsupported | ...
```

**現況是什麼樣**（研究 F3 實測）：

```
array_declare { type=int, name=a }  confidence=high     ← 值丟了，卻標最高信心
  size: number_literal { value=3 }
```

**修好之後，做不到時應該是什麼樣**：

```
array_declare { type=int, name=a }  confidence=inferred, degradationCause=unsupported
  size:   number_literal { value=3 }
  values: [ ...能拿到的部分... ]
```

> **本功能的成敗在這一格**，不在「能不能保留值」。現況的錯不是「沒做」，是**沒做卻說做到了**。

---

## 3. 缺陷帳的兩類（US3）

```
DisabledEntry
├── file, line, kind, scope, title, tag    # 既有
└── hasBody: boolean                       # ← 新增

DefectLedgerResult
├── total:      number                     # 既有（兩類合計，維持可比較）
├── withBody:   number                     # ← 新增：真的測試，被關掉了
├── titleOnly:  number                     # ← 新增：只有名字，程式從未存在
├── byBlocker:  Record<id, number>         # 既有，但**只統計 hasBody**（FR-021）
└── unclassified, ...                      # 既有
```

**判定 `hasBody`**：停用宣告後面有沒有 callback。`it.todo('x')` 沒有；`it.skip('x', () => {...})` 有。

**基線格式**：

```json
{
  "_meta": { ... },
  "total": 85,
  "withBody": 21,
  "titleOnly": 64,
  "byBlocker": { ... }
}
```

三個數字**各自**是只准下降的棘輪（FR-023）。`total` 保留是為了與舊基線可比較。

---

## 4. 「歸因待確認」（US4）

不新增標記型別。沿用既有的 `[BLOCKED:<id>]`／`[UNSUPPORTED:<描述>]`／`[TOMBSTONE:<ref>]`／`[DEADSKIP]`，加一個：

```
[UNVERIFIED]   逐筆註解未寫明真正原因，先前的標記來自檔案層級推測，不可信
```

**為什麼是新標記而不是留空**：留空會被 `unclassified` 判定為失敗（FR-033，上一個功能定的）。而「我知道它停用、但不知道為什麼」是一個**誠實且有效的狀態**，不該被逼著編一個阻斷者出來。

這正是既有紀律的同一形狀：**沉默的正確與沉默的缺失撞在一起時，讓正確的那個說話**——這裡讓「不知道」出聲，才不會被迫假裝知道。
