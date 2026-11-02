# Data Model：測試用的共用 Cella 判決入口

## 判決結果（CellaRunResult）

| 欄位 | 說明 |
|---|---|
| `verdict` | `accept`／`reject`／`unknown`／`invalid`／`untranslated`（formalize 翻不出時，入口自己給的第五種） |
| `out` | 標準輸出（accept 時是完整輸出；其他時候是 Cella 給的前綴，可能是空的） |
| `problems` | 每筆：`kind`（例如 fuel、ubUninit、unsupported）、`reason`、`at`（語義樹節點 id）、`source`（對回的原始碼片段與行號，見下） |
| `untranslated` | 翻不出時：每筆 `construct`（元件身分）＋ `reason` |
| `assumes` | 判決帶的假設（例如依 libstdc++、gcc 的 VLA） |

## 問題的原始碼位置（ProblemSource）

| 欄位 | 說明 |
|---|---|
| `line` | 起始行（1 起算） |
| `text` | 那一段原始碼（截到 120 字） |

查找：`at` → 樹裡同 id 的節點 → `metadata.sourceRange`；`at` 是衍生 id（`<id>/…`）時退到 `<id>`；都找不到就只給 id。

## 狀態

沒有狀態轉換。判決器在每個測試檔裡懶建一次（Promise 快取），之後重用。
