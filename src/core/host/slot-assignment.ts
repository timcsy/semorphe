/**
 * **使用者把哪一層放在哪一格**——存成**層與層的置換**，不是「槽 → 層」。
 *
 * 🔴 **為什麼是置換**（2026-09-01，spec 169）：**槽沒有穩定的身分**
 * （版面一換槽數就變，`槽索引 → 層` 在切版面時意義改變 ＝ 資料遺失），
 * 而**層有**。
 *
 * 🟢 而它讓「選到一個已經在別的槽的視圖 ⟹ 兩槽對調」變成**定義本身**：
 * 置換就是對調。不必另外寫一條規則，也就不會有人忘了寫。
 *
 * > **把規則寫進資料的形狀裡，就不必再寫一次規則。**
 *
 * ⚠️ 版面宣告（`layout-presets.ts` 的 `areas`）**一個字都不動**——
 * 它仍然是**預設**，而第八十一條的六條不變式仍然驗它。
 * 🔴 而這一刀讓 I3（左右是 `LAYER_ORDER` 的子序列）在**套用後的結果**上
 * 不再成立：使用者可以把積木放左邊。那是這一刀的代價，見 spec 169 的 Assumptions①。
 */
import { LAYER_ORDER, type UnderstandingLayer } from '../view-host'
import type { LayoutPresetSpec, LayoutSlot } from './layout-presets'

/** 一張**雙射**表：這一格宣告的是哪一層 → 實際要顯示哪一層。 */
export type SlotAssignment = Readonly<Record<UnderstandingLayer, UnderstandingLayer>>

/** 什麼都沒換——每一層對到自己。 */
export function identityAssignment(): SlotAssignment {
  return Object.fromEntries(LAYER_ORDER.map((l) => [l, l])) as SlotAssignment
}

/**
 * 把**現在顯示 `from` 的那一格**改成顯示 `to`。
 *
 * ⚠️ 這是**對調**不是覆蓋：原本顯示 `to` 的那一格會改成顯示 `from`。
 * 少了這一條，同一層會同時出現在兩個槽——而那是兩份狀態。
 */
export function swapTo(
  a: SlotAssignment, from: UnderstandingLayer, to: UnderstandingLayer,
): SlotAssignment {
  if (from === to) return a
  // 這張表是「**宣告的**那一層 → **實際顯示**的那一層」，所以要先反查
  const keyOf = (shown: UnderstandingLayer): UnderstandingLayer | undefined =>
    LAYER_ORDER.find((k) => a[k] === shown)
  const kf = keyOf(from), kt = keyOf(to)
  if (kf === undefined || kt === undefined) return a
  return { ...a, [kf]: to, [kt]: from }
}

/** 套用置換之後的格子表。⚠️ 只換名字**不換形狀**。 */
export function effectiveAreas(
  preset: LayoutPresetSpec, a: SlotAssignment, focusLayer: UnderstandingLayer = 'element',
): readonly (readonly UnderstandingLayer[])[] {
  return preset.areas.map((row) => row.map((v) => a[resolveSlot(v, focusLayer)]))
}

/** 這一份宣告用到的層（`'*'` 用 `focusLayer` 代換）。 */
export const resolveSlot = (v: LayoutSlot, focusLayer: UnderstandingLayer): UnderstandingLayer =>
  v === '*' ? focusLayer : v

export { LAYER_ORDER }
