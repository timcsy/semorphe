/** `python:array_make_for` 的 **generate** 路——`[x * x for x in xs if x > 0]`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { componentTraits } from '../../../core/component/traits'
import type { SemanticNode } from '../../../core/types'
import { targetPatternText } from '../tuple_make/target-pattern'

/**
 * 🔴 **這顆產生器運算式是不是某個呼叫【唯一的】引數**（第 419 刀，盲測抓到）。
 *
 * 只有那個位置它可以和呼叫共用一對括號（`sum(x for x in r)`）；其他位置都要自己的括號——
 * `f(a, (x for x in r))`、`g = (x for x in r)`、`print(*(x for x in r))`、`max((x for x in r), default=0)`。
 * 以前一律不帶，產回去全是不合法的 Python。
 *
 * ⚠️ **問結構，不記排版**：第一版在 lift 時記「原文沒帶括號」，而積木那一路不存排版註記，
 * 學生最常寫的 `"".join(… for …)` 走一趟積木就多一對括號。改成產碼時從根找到自己的父節點，
 * 看它宣告的引數格（`traits.callArguments`）合起來是不是只有自己一個——語義樹的結構走過積木還在。
 * 沒宣告的父元件、找不到根的時候一律帶括號（多一對但仍合法）。
 */
function soleCallArgument(node: SemanticNode, root: SemanticNode | undefined): boolean {
  if (!root) return false
  const find = (n: SemanticNode): { parent: SemanticNode; slot: string } | null => {
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      for (const k of kids ?? []) {
        if (k === node || (node.id !== undefined && k.id === node.id)) return { parent: n, slot }
        const hit = find(k)
        if (hit) return hit
      }
    }
    return null
  }
  const hit = find(root)
  const args = hit ? componentTraits(hit.parent.componentId)?.callArguments : undefined
  if (!hit || !Array.isArray(args) || !args.includes(hit.slot)) return false
  return args.reduce((n: number, s: string) => n + (hit.parent.slots[s]?.length ?? 0), 0) === 1
}

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:array_make_for', (node, ctx) => {
    const one = (k: 'expression' | 'iterable' | 'condition' | 'outer'): string => {
      const n = (node.slots[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    // 名字以 `targets` 為準（第 411 刀起單一名字也在裡面）；沒有時才退回 `obj`（只剩手組的樹）
    // 目標是樣式時（第 422 刀，`[x for i, (x, y) in …]`）住在 `pattern`，最外層的元組不帶括號
    const pattern = (node.slots.pattern ?? [])[0]
    const targets = node.slots.targets ?? []
    const names = pattern ? targetPatternText(pattern, ctx) : targets.length > 0
      ? targets.map((t) => String(t.properties.name ?? '')).join(', ')
      : String(node.properties.obj ?? 'x')
    const cond = one('condition')
    // ⚠️ **外層先寫**：原文的順序是從外到內，而語義樹是從內指向外
    const outer = one('outer')
    const inner = `${one('expression')} ${outer ? `${outer} ` : ''}for ${names} in ${one('iterable')}${cond ? ` if ${cond}` : ''}`
    // ⚠️ 產生器運算式的括號：只有它是呼叫唯一的引數時才和呼叫共用那一對（見上面 `soleCallArgument`）
    const wrap = String(node.properties.wrap ?? '')
    if (wrap === 'generator') return soleCallArgument(node, ctx.root) ? inner : `(${inner})`
    return wrap === 'set' ? `{${inner}}` : `[${inner}]`
  })
}
