# 契約：基線檔格式與標記語法

**Feature**: 049-audit-guardrails

本功能對外的介面有兩個，兩者都是**人與工具共用的契約**：基線檔的 JSON 格式、以及停用測試的標記語法。護欄本身是內部測試，不對外暴露 API。

---

## 契約 1：基線檔（`tests/baselines/*.json`）

四個檔共用一個 `_meta` 區塊，其餘欄位依護欄而異。

### 共用 `_meta`

```json
{
  "_meta": {
    "guard": "neutrality | completeness | defect-ledger | locality",
    "measuredAt": "YYYY-MM-DD",
    "rule": "判定方式的一句話描述",
    "note": "數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。"
  }
}
```

`rule` 為必填 —— FR-012／FR-042 要求判定方式被定義並記錄。

### `neutrality.json`

```json
{
  "_meta": { ... },
  "total": 12,
  "files": {
    "src/ui/app.ts": ["print", "cpp_string_at"],
    "src/interpreter/executors/strings.ts": ["cpp_string_at", "cpp_string_length"]
  }
}
```

`total` = `files` 的鍵數。註解引用不入此檔，只在報表中呈現。

### `completeness.json`

```json
{
  "_meta": { ... },
  "totals": { "implemented": 0, "shell": 0, "missing": 0 },
  "shells":  [{ "componentId": "…", "path": "execute" }],
  "missing": [{ "componentId": "…", "path": "render" }]
}
```

`path` ∈ `lift | render | extract | generate | execute`。
`totals` 以**路徑數**計（元件數 × 5 為上限），不是元件數。

### `defect-ledger.json`

```json
{
  "_meta": { ... },
  "total": 64,
  "byBlocker": { "print": 10, "array_declare": 2 }
}
```

`total` = 所有停用項目數（`it.todo` + `it.skip` + `describe.skip`）。
`byBlocker` 只統計 `[BLOCKED:…]` 類。

### `locality.json`

```json
{
  "_meta": { ... },
  "limits": {
    "cpp_string_at": { "files": 13, "dirs": 7 }
  }
}
```

只記上限，不記路徑清單——路徑變動頻繁，記了會讓 diff 不可讀。

### 棘輪語義（四檔共通）

| 情況 | 結果 |
|---|---|
| 量測結果 ⊆ 基線 | ✅ 通過 |
| 出現基線之外的項目 | ❌ 失敗，**報表指名是哪一項**（FR-005） |
| 量測結果 ⊊ 基線（有改善） | ✅ 通過，且報表提示可下調基線 |

**基線檔的任何放寬都是一次 commit**——這就是 FR-004 要的「顯式、在版本歷史中可見」。

---

## 契約 2：停用測試的標記語法

寫在測試／區塊的**標題開頭**。

```
[BLOCKED:<componentId>]   缺陷，被某元件擋住
[TOMBSTONE:<檔名#錨點>]    已否決決定的正確後果
[DEADSKIP]                已修好但沒開回來
```

### 範例

```ts
it.todo('[BLOCKED:print] fuzz_1: substr with computed indices and looping find')

it.skip('[TOMBSTONE:014-墓碑目錄#模擬-c-preprocessor-來解決巨集] executes correctly', ...)

describe.skip('[DEADSKIP] fuzz: char literal in function return (fixed)', ...)
```

### 規則

| 標記 | 必要條件 | 違反時 |
|---|---|---|
| 任一停用項目 | 標題必須以三種標記之一開頭 | ❌ 失敗（FR-033） |
| `[BLOCKED:X]` | `X` 必須是註冊表中存在的 componentId | ❌ 失敗（FR-031） |
| `[TOMBSTONE:F#A]` | `knowledge/history/F.md` 必須存在，且含錨點 `A` | ❌ 失敗（FR-032） |
| `[DEADSKIP]` | 無額外條件 | — |

### 為什麼標記在標題而不在別處

標記與測試**同住**，不可能漂移。獨立的登錄檔會立刻長成第二個真相源——那是本專案頭號病灶。
標題也直接出現在測試輸出，維護者跑測試時就看得到。

---

## 契約 3（僅新增一個可選欄位）：`ConceptDefJSON.skipPaths`

```json
{
  "conceptId": "cpp_include",
  "skipPaths": ["execute"]
}
```

- **可選**。不填等同 `[]`，既有元件零改動。
- 值為刻意不提供的路徑名陣列，`PathName ∈ lift | render | extract | generate | execute`。
- 只有完備性護欄讀它；**不影響任何執行期行為**。
- 語義：「本元件**刻意**不提供這條路徑」——未宣告的空實作一律判為殼。

> 這是「讓沉默的正確出聲」的落地。正確的空與缺失的空長得一樣，所以要求正確的那個說話。
