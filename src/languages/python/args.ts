/**
 * **引數列的求值只有一份**——因為 `*xs` 的攤開是「有幾格」的決定，
 * 而那個決定散在四處的話會一處一處地漏（`math.sqrt(*a)` 對、
 * `obj.method(*a)` 錯，而兩邊都不會報錯）。
 */
import type { RuntimeValue } from '../../interpreter/types'
import type { SemanticNode } from '../../core/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../interpreter/errors'
import { componentTraits } from '../../core/component/traits'

/** 這一格是不是「攤開」——**問性狀不問身分**（見那顆膠囊的 `_traits_why`）。 */
export function isSpread(n: SemanticNode): boolean {
  return componentTraits(n.componentId)?.spread === true
}

/** 攤開的那個來源運算式（`*nums` 的 `nums`），不是攤開時回 `null`。 */
export function spreadSourceOf(n: SemanticNode): SemanticNode | null {
  return isSpread(n) ? ((n.children?.value ?? [])[0] ?? null) : null
}

/**
 * 把引數節點求值成一串值，**沿路攤開 `*xs`**。
 *
 * ⚠️ `**d`（關鍵字引數的攤開）在這裡**出聲**：這個直譯器的呼叫是照位置綁的，
 * 靜默忽略的話 `f(**d)` 會變成一個沒有引數的呼叫。
 */
export async function evalPythonArgs(
  nodes: SemanticNode[],
  ctx: { evaluate(n: SemanticNode): Promise<RuntimeValue> },
): Promise<RuntimeValue[]> {
  const out: RuntimeValue[] = []
  for (const n of nodes) {
    if (isSpread(n)) {
      const inner = (n.children?.value ?? [])[0]
      if (!inner) continue
      const v = await ctx.evaluate(inner)
      if (n.properties?.kind === 'dict') {
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': '** 攤開成關鍵字引數' })
      }
      if (v.type !== 'array') {
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': `* 攤不開這種東西（${v.type}）` })
      }
      out.push(...(v.value as RuntimeValue[]))
      continue
    }
    out.push(await ctx.evaluate(n))
  }
  return out
}
