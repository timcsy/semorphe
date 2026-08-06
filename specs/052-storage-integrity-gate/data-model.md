# Phase 1 資料模型：存檔完整性

## 契約 1：欄位清單（單一來源）

```ts
export const SAVED_STATE_FIELDS = {
  version: 1, tree: 1, blocklyState: 1, code: 1, language: 1, styleId: 1,
  topicId: 1, enabledBranches: 1, lastModified: 1, blockStyleId: 1, locale: 1,
} satisfies Record<keyof Required<SavedState>, 1>
```

**不變式**：漏一個或多一個都編不過（實測 `TS1360`，見 research F4）。

**用途**：執行期的欄位守恆測試靠它列舉。它是手寫的，但**不可能與型別漂移**。

---

## 契約 2：載入結果（三態，不是二態）

現況 `load(): SavedState | null` 只有兩態，於是「沒有存檔」與「存檔被拒絕」**無法區分**——research F3 的四步刪除鏈就從這裡開始。

```ts
export type LoadOutcome =
  | { kind: 'empty' }                                    // 沒有存檔
  | { kind: 'loaded';   state: SavedState }              // 正常
  | { kind: 'migrated'; state: SavedState; from: number }// 升級後正常
  | { kind: 'refused';  reason: RefusalReason; backedUpTo: string }

export type RefusalReason =
  | { code: 'too-new';        found: number; current: number }
  | { code: 'no-upgrade-path';found: number; current: number }
  | { code: 'upgrade-failed'; found: number; detail: string }
  | { code: 'not-a-save';     detail: string }
```

**`refused` 一定帶 `backedUpTo`**——型別上就不允許「拒絕了但沒備份」。這是 FR-020 的執行機構，不是靠實作自律。

**相容性**：`load(): SavedState | null` **保留不動**，實作為
`const r = loadOutcome(); return r.kind === 'loaded' || r.kind === 'migrated' ? r.state : null`。
既有呼叫端與既有測試完全不受影響（FR-042）。

---

## 契約 3：版本判定（兩條路徑共用）

```ts
export const CURRENT_VERSION = 1

export type VersionVerdict =
  | { kind: 'ok' }
  | { kind: 'needs-upgrade'; from: number }
  | { kind: 'too-new';       from: number }
  | { kind: 'not-a-save';    detail: string }

export function judge(raw: unknown): VersionVerdict
```

**`judge` 是唯一的判定處。** `load()` 與 `importFromJSON()` 都呼叫它——**不得各自實作**，否則會產生第三種鬆緊度（research F2 的病就是兩條路徑鬆緊不同）。

### 形狀驗證的判準

| 條件 | 結果 |
|---|---|
| 不是物件、或 `JSON.parse` 失敗 | `not-a-save` |
| `version` 缺失或不是有限數字 | `not-a-save` |
| 缺少任一**必填**欄位 | `not-a-save` |
| 有系統不認得的**額外**欄位 | **通過**（FR-017）——保留原樣 |

必填欄位＝`SAVED_STATE_FIELDS` 中在 `SavedState` 上非選填的那些。

> **為什麼額外欄位不算錯**：一份來自較新版本、但版本號恰好相同的存檔（或未來加了欄位又退版）會多出欄位。判嚴的代價是抹掉使用者的資料；判鬆的代價是多存幾個沒用的鍵。**不對稱，所以判鬆。**

---

## 契約 4：升級路徑註冊表

```ts
export type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>

/** 版本 N → N+1。目前刻意是空的：沒有需要升級的版本 */
export const UPGRADES: Record<number, Upgrade> = {}
```

**FR-016 的執行機構**：一支測試斷言「從 1 到 `CURRENT_VERSION` 的每一步都有註冊」。

`CURRENT_VERSION = 1` 時它是恆真的（沒有步驟）；改成 2 而沒有 `UPGRADES[1]` 的那一刻**測試變紅**。

升級是**逐版套用**（1→2→3），不是一步到位——這樣新增一版只需寫一個函式。

**升級失敗**（丟例外或產出仍不合形狀）→ `refused` with `upgrade-failed`，**不得產出半升級的狀態**。

---

## 契約 5：合併（消除，不是偵測）

```ts
const merged: SavedState = {
  ...DEFAULTS,          // 型別為 SavedState，編譯器強制每個必填欄位都在
  ...(existing ?? {}),
  ...definedOnly(state),// 濾掉值為 undefined 的欄位
  version: CURRENT_VERSION,
  lastModified: new Date().toISOString(),
}
```

**不再逐欄位列舉**——結構上不可能漏欄位（research F5）。

`definedOnly` 的必要性：直接展開會讓「這次沒提供」（`undefined`）覆蓋掉「上次存的值」。

**額外欄位隨 `...existing` 一起被帶下去**，滿足 FR-017 的保留要求。

---

## 契約 6：備份鍵

```
semorphe-state            主鍵
semorphe-state.rejected   被拒絕的存檔（覆蓋式，只留一份）
```

**寫入順序不可調換**：先寫備份、確認寫成功，才回報 `refused`。備份寫不進去（例如空間不足）→ 仍回報 `refused`，但 `backedUpTo` 為空字串且**主鍵保持不動**——寧可讓使用者看到「載入失敗」也不冒險。

**只留一份**：留多份需要淘汰策略，而目前沒有任何證據說得出該留幾份（research F3）。

---

## 契約 7：使用者可見的拒絕

用既有的 `showToast(msg, 'warning')`（research F8），**不新增機制**。

用 `'warning'` 不用 `'error'`：使用者沒做錯事、資料也還在。

`restoreState()` 從 `if (!state) return` 改為依 `LoadOutcome` 的 `kind` 分支——`empty` 靜默返回（現況行為），`refused` 出聲。

---

## 五槽對照（本功能不新增任何概念）

本功能**不動語義樹、不動概念註冊表、不新增元件**。它只改存檔層的三個函式與一個新的判定模組。因此沒有五路完備性的影響。
