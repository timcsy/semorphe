# Phase 1 資料模型

**Feature**: 051-lift-claim-arbitration ｜ **Date**: 2026-08-06

本功能**零行為改動**，所有新資料形只存在於 `tests/` 之下。

## 1. Discriminator（判別式）

一條規則用來區分自己與別人的所有依據。**關鍵是它不只來自 `constraints`**（見 research F2）。

```
Discriminator
├── dimension: string        # 判別維度，如 "field:operator"、"chain:rootText"
├── kind: 'exact' | 'prefix' | 'nodeType'
└── value: string
```

**從一條規則萃取判別式**：

| 來源 | 產生的 dimension |
|---|---|
| `constraints[]` 的每一條 | `field:<欄位名>` |
| `chain` 型 | `chain:operator`、`chain:rootText` |
| `operatorDispatch` 型 | `dispatch:operators`（值為排序後的鍵集合） |
| `composite` 型 | `composite:<欄位名>` |

## 2. PairVerdict（一對規則的判定）

```
PairVerdict
├── a, b: string                                  # 兩條規則的概念身分
├── verdict: 'never' | 'definitely' | 'unknown'
└── reason: string                                # 必填——判定的依據
```

**判定程序**（research D1）：

```
1. 存在某個 dimension，雙方都有值且可證互斥        → never（附證明的維度與值）
2. 雙方的判別式集合皆為空                          → definitely
3. 其餘                                            → unknown（附「差在哪個維度判不出來」）
```

**可證互斥的規則**：

| 雙方 kind | 互斥條件 |
|---|---|
| exact vs exact | 值不同 |
| nodeType vs nodeType | 值不同 |
| exact vs prefix | exact 值不以 prefix 值開頭 |
| prefix vs prefix | 互不為對方前綴 |
| 其餘組合 | 判不出來 |

## 3. AmbiguityGroup（歧義組）

```
AmbiguityGroup
├── nodeType: string
├── priority: number
├── rules: string[]              # 該組的規則，依實際嘗試順序
├── winner: string               # 目前實際勝出的那條
├── winReason: 'priority' | 'insertion-order'
└── pairs: PairVerdict[]
```

`winReason` 是 FR-003 的核心：**「優先權較高」是設計，「登記較早」是意外**——報表要分得出來。

## 4. DuplicateRegistration（重複登記）

```
DuplicateRegistration
├── nodeType: string
├── conceptId: string
└── priorities: number[]       # 同一概念在同一語法上出現的所有優先權
```

判準（research F4）：**同一個 conceptId 在同一 nodeType 上出現一次以上**。它不是優先權設計，是同一概念從兩個來源被登記。

## 5. 基線

```
tests/baselines/lift-ambiguity.json
{
  "_meta": { guard, measuredAt, rule, note },
  "samePriorityGroups": 8,        // 同優先權的群組數（代理指標）
  "definitelyCollide": N,         // 確定會撞的規則對數（真問題的下界）
  "unknown": M,                   // 無法確定的規則對數（判定能力的邊界）
  "duplicateRegistrations": K,    // 重複登記
  "groups": [ { nodeType, priority, rules } ]
}
```

四個數字**各自**是只准下降的棘輪。

**`unknown` 也是棘輪**：它變大代表判定程序退步、或有人加了判不出來的規則——兩者都該擋。與 050 處理「歸因待確認」同一個做法。
