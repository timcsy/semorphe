# 契約：歧義基線的格式

**Feature**: 051-lift-claim-arbitration

本功能只新增一個契約——第五份基線檔。既有四份與所有生產介面**皆不改動**。

## `tests/baselines/lift-ambiguity.json`

```json
{
  "_meta": {
    "guard": "lift-ambiguity",
    "measuredAt": "YYYY-MM-DD",
    "rule": "判定程序的一句話描述",
    "note": "數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。"
  },
  "samePriorityGroups": 8,
  "definitelyCollide": 0,
  "unknown": 0,
  "duplicateRegistrations": 0,
  "groups": [
    { "nodeType": "declaration", "priority": 10, "rules": ["cpp_pointer_declare", "…"] }
  ]
}
```

### 四個數字的語義

| 欄位 | 是什麼 | 為什麼要它 |
|---|---|---|
| `samePriorityGroups` | 同語法同優先權的群組數 | **代理指標**：算得準，但可能誤報 |
| `definitelyCollide` | 可證會撞的規則對數 | **真問題的下界**：保守，不誤報 |
| `unknown` | 判不出來的規則對數 | **判定能力的邊界**：變大代表退步 |
| `duplicateRegistrations` | 同一概念在同一語法上登記多次 | 它不是設計，是意外 |

四者**各自**是只准下降的棘輪。

### 為什麼 `unknown` 也要當棘輪

沒有這條，「判不出來」會變成一個免費的垃圾桶——任何新規則只要複雜到判不出來，就能無聲通過。

這與上一輪處理「歸因待確認」是同一個做法：**誠實的不確定是一等公民，但它的量必須被盯著**。

### 棘輪語義（與既有四條相同）

| 情況 | 結果 |
|---|---|
| 皆 ≤ 基線 | ✅ 通過 |
| 任一上升 | ❌ 失敗，**報表指名是哪一組** |
| 有下降 | ✅ 通過，提示可下調基線 |

**基線的任何放寬都是一次 commit**，訊息說明原因。
