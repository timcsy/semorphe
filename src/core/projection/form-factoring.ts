/**
 * **形態的因子化**：同樣的宣告，組出更多形態（2026-09-25）
 *
 * ## 🔴 它修的是什麼
 *
 * 第 219 刀讓一顆元件可以有多條形態軸，而選擇的方式是
 * **依 `priority` 取一個軸，其餘的丟掉**。而那個「丟掉」有一個看得見的代價：
 *
 * ```
 * 一顆【堆疊】的 push 出現在運算式位置
 *   形狀  output           ← role 贏了（priority 1）
 *   文字  「放進」          🔴 container_kind 的「推入堆疊」被丟掉
 * ```
 *
 * 那就是這個 repo 最有名的一個缺陷（標籤說謊）的機制根源
 * ——十八條護欄一條都不叫，而學生第一眼看出來。
 *
 * ## 判準：**條件獨立**（而它是量得出來的）
 *
 * `Transformers learn factored representations`（arXiv 2602.02385）：
 *
 * > **因子化在因子【條件獨立】時無損**，否則犧牲保真度。
 * > 而乘積的維度**指數**成長，因子化**線性**成長。
 *
 * 在形態這件事上，「條件獨立」有一個直接的讀法：
 *
 * > **每條軸動的 `blockDef` 欄位，彼此不相交嗎？**
 *
 * `cpp:container_push` 實測（2026-09-25）：
 *
 * ```
 * container_kind 動   message0 · tooltip                            ← 文字
 * role 動             previousStatement · nextStatement · output     ← 形狀
 * 交集                ∅                                             🟢 獨立
 * ```
 *
 * ⟹ 合併就是一次淺層 merge，沒有衝突要解。而收益是：
 *
 * ```
 * 取一個軸   4 個宣告 → 4 顆積木,而【組合是缺的】
 * 乘積       6 個宣告 → 6 顆積木
 * 🟢 因子化   4 個宣告 → 6 顆積木   ← 多出來的兩顆【免費】
 * ```
 *
 * ## ⚠️ 而機制【檢查】獨立性，不【假設】它
 *
 * 母體今天是 **1**（全庫只有一顆元件有兩條軸），所以「軸是獨立的」
 * 是在唯一一個實例上驗證的。而 3D 的軸（LOD × 用途）幾乎確定**不**獨立
 * ——watertight 與細分程度都動幾何。
 *
 * 🔴 **交集非空就不產生組合**，並把那個交集說出來。
 * 假設獨立的話，症狀是**安靜地組出一個錯的形態**。
 *
 * > **對因子化的偏好是一種歸納偏誤（那篇論文量到 transformer 也有）。
 * > 所以判準要是【檢查】，不是【慣例】。**
 */
import type { BlockSpec } from '../types'

/** `type` 是身分不是外觀——比較欄位時要排除它。 */
const IDENTITY_FIELD = 'type'

/** 一個變體相對於基底，**改了哪些欄位**。 */
export function changedFields(
  base: Record<string, unknown>,
  variant: Record<string, unknown>,
): Set<string> {
  const out = new Set<string>()
  for (const k of new Set([...Object.keys(base), ...Object.keys(variant)])) {
    if (k === IDENTITY_FIELD) continue
    if (JSON.stringify(base[k]) !== JSON.stringify(variant[k])) out.add(k)
  }
  return out
}

export interface FactoringReport {
  componentId: string
  /** 軸名 → 它動到的欄位 */
  readonly touched: ReadonlyMap<string, ReadonlySet<string>>
  /** 空 ＝ 獨立，可以因子化 */
  readonly collisions: readonly string[]
}

/** 這顆元件的幾條軸，動的欄位彼此不相交嗎。 */
export function checkIndependence(
  base: Record<string, unknown>,
  byAxis: ReadonlyMap<string, readonly Record<string, unknown>[]>,
): { touched: Map<string, Set<string>>; collisions: string[] } {
  const touched = new Map<string, Set<string>>()
  for (const [axis, variants] of byAxis) {
    const all = new Set<string>()
    for (const v of variants) for (const f of changedFields(base, v)) all.add(f)
    touched.set(axis, all)
  }
  const collisions: string[] = []
  const axes = [...touched.keys()]
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      for (const f of touched.get(axes[i]!)!) {
        if (touched.get(axes[j]!)!.has(f)) collisions.push(`${axes[i]}×${axes[j]}:${f}`)
      }
    }
  }
  return { touched, collisions }
}

/**
 * 產出組合形態。
 *
 * ⚠️ 命名依**軸名的字母序**（`container_kind` < `role` ⟹ `_stack_expression`）
 * ——**刻意不用 `priority`**：priority 是「誰先問」，它會因為調整選擇順序而改，
 * 而**積木型別的名字不可以因為那樣就變**。
 */
export function deriveFactoredSpecs(specs: readonly BlockSpec[]): {
  derived: BlockSpec[]
  reports: FactoringReport[]
} {
  const byComponent = new Map<string, BlockSpec[]>()
  for (const s of specs) {
    const id = s.componentMapping?.componentId
    if (id) byComponent.set(id, [...(byComponent.get(id) ?? []), s])
  }

  const derived: BlockSpec[] = []
  const reports: FactoringReport[] = []

  for (const [componentId, group] of byComponent) {
    const base = group.find((s) => s.form === undefined)
    if (!base) continue
    const byAxis = new Map<string, BlockSpec[]>()
    for (const s of group) {
      if (!s.form) continue
      byAxis.set(s.form.axis, [...(byAxis.get(s.form.axis) ?? []), s])
    }
    if (byAxis.size < 2) continue

    const baseDef = (base.blockDef ?? {}) as Record<string, unknown>
    const defsByAxis = new Map<string, Record<string, unknown>[]>(
      [...byAxis].map(([a, ss]) => [a, ss.map((s) => (s.blockDef ?? {}) as Record<string, unknown>)]),
    )
    const { touched, collisions } = checkIndependence(baseDef, defsByAxis)
    reports.push({ componentId, touched, collisions })
    // 🔴 不獨立就不產生 —— 見檔頭：假設獨立的症狀是【安靜地組出一個錯的形態】。
    if (collisions.length > 0) continue

    const axes = [...byAxis.keys()].sort()
    const combos = axes.reduce<BlockSpec[][]>(
      (acc, a) => acc.flatMap((row) => byAxis.get(a)!.map((s) => [...row, s])),
      [[]],
    )
    for (const combo of combos) {
      const suffix = combo.map((s) => s.form!.value).join('_')
      const type = `${String(baseDef[IDENTITY_FIELD])}_${suffix}`
      if (specs.some((s) => (s.blockDef as Record<string, unknown> | undefined)?.[IDENTITY_FIELD] === type)) continue
      const merged: Record<string, unknown> = { ...baseDef }
      for (const s of combo) {
        for (const f of changedFields(baseDef, (s.blockDef ?? {}) as Record<string, unknown>)) {
          merged[f] = (s.blockDef as Record<string, unknown>)[f]
        }
      }
      merged[IDENTITY_FIELD] = type
      derived.push({
        ...base,
        // 🔴 **`id` 要換**——登錄表用它當鍵（`specs.set(spec.id, …)`）。
        //    第一版繼承了 base 的 id，於是組合形態互相蓋掉、還把【中性那一顆】蓋掉了，
        //    而症狀不是報錯：是登錄表裡少了三顆積木。
        id: `${base.id}_${suffix}`,
        blockDef: merged as BlockSpec['blockDef'],
        // 🔴 組合形態的 `form` 帶**全部**的軸值——選擇時先問整組，再退回單軸。
        forms: combo.map((s) => s.form!),
        form: undefined,
      } as BlockSpec)
    }
  }
  return { derived, reports }
}
