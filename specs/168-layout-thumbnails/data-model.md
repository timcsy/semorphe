# Data Model：版面

## LayoutPresetSpec（改）

```ts
export type LayoutSlot = UnderstandingLayer | '*'   // '*' ＝ 使用者現在看的那一層（只有 focus 用）

export interface LayoutPresetSpec {
  readonly id: LayoutPresetId
  /** 給人看的名字的 i18n 鍵——⚠️ 不得把 id 印上畫面（第七十八條） */
  readonly nameKey: string
  /**
   * **二維的格子表**：一列一個陣列，同一層連續重複 ＝ 跨格。
   * 與 CSS `grid-template-areas` 同構——套用、畫圖、驗護欄讀的是同一份。
   */
  readonly areas: readonly (readonly LayoutSlot[])[]
}
```

🪦 **移除** `layers: readonly UnderstandingLayer[]`——它是一維的，
表達不出「哪一層在哪一格」。它的三個消費者改讀 `areas`。

## 四份宣告

```ts
focus         areas: [['*'],            ['state']]
compare       areas: [['element','space'],                ['state','state']]
three-column  areas: [['element','relation','space'],     ['state','state','state']]
grid          areas: [['element','space'],                ['relation','state']]
```

## 不變式（＝第八十一條護欄的新形狀）

| # | 不變式 | 為什麼 |
|---|---|---|
| I1 | `areas` 是**矩形**：每一列長度相同 | 不是矩形就畫不出格子，也產不出 grid |
| I2 | 每一格的值是宣告過的層，或 `'*'` | 舊 I 的延續 |
| I3 | **每一列**與**每一欄**都是 `LAYER_ORDER` 的子序列（連續重複視為一格） | 左右是**語義**不是偏好；它同時擋掉鏡像版面（FR-010） |
| I4 | `state` 在**每一個**版面裡恰好出現**一個連續矩形區域** | 版面可以搬它，**不得關掉它**（FR-006） |
| I5 | 同一層在一個版面裡最多出現一個連續矩形區域 | 一層兩格 ＝ 兩個真相 |
| I6 | `'*'` 只准出現在 `focus` | 其餘版面的內容是宣告出來的，不是當下狀態 |

⚠️ **I3 的「子序列」要在【去掉連續重複之後】判斷**：
`['state','state','state']` 去重後是 `['state']`，是子序列 ✅。

## 衍生（不儲存，算出來）

```
gridTemplateAreas(preset)   → CSS 字串，套用時用
thumbnailCells(preset)      → 給示意圖畫的格子（列、欄、跨度、層的 i18n 名）
occupiedLayers(preset)      → 這個版面看得到哪幾層（工具箱／控制項要問）
```

🟢 三個都是 `areas` 的純函數——**沒有第二份資料**，所以不會漂開。
