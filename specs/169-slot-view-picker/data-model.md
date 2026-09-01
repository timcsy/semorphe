# Data Model：槽的指派

## SlotAssignment（新）

```ts
/**
 * 使用者對「哪一層放哪一格」的覆寫——**存成層與層的置換**，不是「槽 → 層」。
 *
 * 🔴 **槽沒有穩定的身分**（版面一換槽數就變），而層有。
 */
export type SlotAssignment = Readonly<Record<UnderstandingLayer, UnderstandingLayer>>

/** 每一個版面各自一份（不同版面的槽數不同）。 */
export type Assignments = Readonly<Partial<Record<LayoutPresetId, SlotAssignment>>>
```

## 不變式

| # | 不變式 | 為什麼 |
|---|---|---|
| A1 | 置換是**雙射**（每一層恰好對到一層，且互為反函數） | 「選到已在別處的就對調」的定義本身；也保證不會有兩個槽同一層 |
| A2 | 套用置換之後，`areas` 仍然滿足 I1／I2／I4／I5 | 置換只換名字不換形狀，所以矩形／實心／state 必在都保住 |
| A3 | ⚠️ **I3 不再對套用後的結果成立** | 這是這一刀的代價：左右從「語義」降成「**預設**是語義」 |
| A4 | 沒有覆寫時，置換是**恆等** | 「什麼都沒動」與「動了又動回來」要分不出來 |

## 衍生

```
effectiveAreas(preset, assignment, focusLayer)   → 套用置換之後的格子表
slotTabs(host)                                   → 分頁列的選項（所有槽共用同一份）
swapTo(assignment, from, to)                     → 把 from 那一格換成 to（＝對調）
```

🟢 三個都是純函數。`areas` 一個字都不用改——**六條不變式仍然驗宣告，而宣告仍然是預設**。
