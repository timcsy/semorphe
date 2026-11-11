/** `cpp:vector_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:vector_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const t = f.k('tVector', { t: elem })
    let init: CellaJson | null = null
    let args: CellaJson[] | null = null
    if ((n.slots?.values ?? []).length > 0) init = f.braceList(n, 'values')
    // 一段範圍（第 409 刀）：兩個建構引數照原樣交給 Cella，由它依型別找到範圍建構子
    else if (f.one(n, 'source') && f.one(n, 'source_end')) args = [f.exprOf(n, 'source'), f.exprOf(n, 'source_end')]
    else if (f.one(n, 'source')) init = f.k('iE', { e: f.expr(f.one(n, 'source')!) })
    else if (f.one(n, 'size')) args = [f.exprOf(n, 'size'), ...(f.one(n, 'fill') ? [f.exprOf(n, 'fill')] : [])]
    if (args) return f.declCtor(n, t, args, global)
    return f.declInit(n, t, init, global)
  })
}
