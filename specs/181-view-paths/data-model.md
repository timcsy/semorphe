# Data Model: 元件動詞改名

## 視圖（View）

核心的一張小表；加一個視圖 = 加一筆。

| 欄位 | 意思 |
|---|---|
| 名字 | `blocks`、`code`（今天兩筆） |
| 方向 | `both`（render 與 lift）或 `render-only` |

驗證：元件宣告裡出現的每個視圖名都 MUST 在這張表上。

## 元件的路徑宣告（`component.json` 的 `paths`）

```
paths
├── views
│   ├── <視圖名>
│   │   ├── render         檔案路徑 | null      （必填鍵）
│   │   ├── _render_why    說明                 （render 為 null 時必填）
│   │   ├── lift           檔案路徑 | null      （雙向視圖必填鍵；單向視圖不得出現）
│   │   ├── _lift_why      說明                 （lift 為 null 時必填）
│   │   └── liftStrategy   檔案路徑             （選填；只在 code 視圖）
│   └── …
├── formalize              檔案路徑             （選填；有 formalize.ts 才寫）
├── execute                檔案路徑 | null      （必填鍵，到階段 6 退場）
└── _execute_why           說明                 （execute 為 null 時必填）
```

驗證規則（取代今天的 C3）：

1. `paths.views` MUST 存在，且至少有一個視圖。
2. 每個視圖：`render` 鍵 MUST 存在；雙向視圖的 `lift` 鍵 MUST 存在；單向視圖 MUST NOT 有 `lift`。
3. 值為 `null` 時，同層的 `_<方向>_why` MUST 存在。
4. 平鋪的舊鍵（`render`／`extract`／`generate`／`lift`／`liftStrategy` 直接掛在 `paths` 下）MUST NOT 出現。
5. `execute` 鍵 MUST 存在（`null` ＋ `_execute_why` 合法）。

## 格子（Cell）

「一顆元件的一路」的統一稱呼，給判定者對照、覆蓋護欄、實作檔掃描共用。

| 格子名 | 對應宣告 |
|---|---|
| `blocks.render` | `paths.views.blocks.render` |
| `blocks.lift` | `paths.views.blocks.lift` |
| `code.render` | `paths.views.code.render` |
| `code.lift` | `paths.views.code.lift` |
| `code.liftStrategy` | `paths.views.code.liftStrategy` |
| `formalize` | `paths.formalize` |
| `execute` | `paths.execute` |

一顆元件「有」某一格 ⟺ 那個宣告存在且不是 `null`。

## 判定者對照（`PATH_JUDGE`）

鍵 = 格子名（`liftStrategy` 不單獨判定，併入 `code.lift`）。每格：判定者種類、證據（測試檔）、說明、覆蓋（已覆蓋 / 母體）。
數字與改動前逐一相同：`render` → `blocks.render`、`extract` → `blocks.lift`、`generate` → `code.render`、`lift` → `code.lift`。
