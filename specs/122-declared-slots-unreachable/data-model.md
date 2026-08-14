# Data Model

**Date**: 2026-08-14

## 實體一：接點宣告（不變）

`component.json` 的 `children`——**12 筆都已經對了**，本功能一行不改。

## 實體二：形態路徑（本功能加的）

```
renderMapping.inputs        靜態：一個插槽對一個接點
renderMapping.dynamicRules  動態：EXPR{i} 那一族
renderMapping.strategy      🔴 手寫——護欄看不進去
```

⚠️ 而 `args0` 為空 ＋ `renderMapping` 引用欄位名 ＝ **積木在別處命令式產生**。

## 實體三：符合性量測

| 桶 | 意思 |
|---|---|
| 安全 | 每個放得進去的接點都回得來 |
| **確定違規** | 🔴 放得進去，走完投影**不見了** ← 本功能推向 0 |
| 無法確定 | 判不出來（本功能不動） |

⚠️ 它**偵測而不預防**——預防是 Out of Scope 的那個獨立決定。
