# Data Model: Cella 判決與型別查詢

## 判決（Verdict）——照抄 Cella 的判決 JSON

| 欄位 | 意思 |
|---|---|
| `verdict` | `accept`／`reject`／`unknown`／`invalid` |
| `problems[]` | `{ kind, at?, clause?, reason? }`；`at` 是 formalize 給的節點標籤 |
| `assumes?[]` | `{ implementation, choice }` |
| `basis` | `computed`／`kernel` |
| 出處 | `provenance: 'cella'`；版本號（送出時的同步版本） |

## 型別查詢結果

`slots: { "<節點>#<槽>": { display, expects, fits: { level } } }`、`nodes: { "<節點>": "<型別>" }`——照 Cella 的格式；只取「不合」的位置。

## 診斷（Diagnostic）——既有型別，本刀擴兩個值

| 欄位 | 本刀的值 |
|---|---|
| `source` | 新增 `'cella'` |
| `severity` | `'error'`（reject、型別不合）／新增 `'info'`（unknown：尚未支援、標準允許不同結果、步數用盡） |
| `rule` | `cella_<kind>`（例 `cella_ubBounds`）、`type_mismatch` |
| `nodeId` | problem 標籤的 `<id>` 前段；對不上就往上找可見祖先 |
| `params` | `reason`（Cella 原文）、`clause`、型別不合時 `expects`／`actual` |

## 載入狀態

```
idle ──(init 做完、閒置)──> loading ──> ready
                                  └──> unavailable(reason)
```

## 過濾規則（FR-008）

程式含讀取輸入的節點 且 沒有測資 ⟹ 丟掉 `kind` 以 `ub` 開頭與 `fuel` 的 problem，保留其餘；狀態附一句「需要一份輸入」。

## 問題種類 → 中文說明（初版）

| kind | 嚴重度 | 中文 |
|---|---|---|
| `ubUninit` | error | 用到還沒有值的變數 |
| `ubBounds` | error | 讀寫到陣列（或容器）外面了 |
| `ubOverflow` | error | 整數算到超出範圍 |
| `ubDivZero` | error | 除以零 |
| `ubOverlap` | error | 指定時來源與目的地重疊 |
| `reject` | error | 型別或寫法不合規則（附原文） |
| `unsupported` | info | 這個用法還判不出來（附構造名） |
| `fuel` | info | 跑太久了，判不出來 |
| `unspecified`／其他 unknown | info | 這裡的結果標準允許不同（附原文） |
| 其他未知種類 | 依 verdict | 顯示 Cella 原文，並記一筆（讓表長出來） |
