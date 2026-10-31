/** `cpp:array_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isCharStringInit } from './char-string-init'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const len = f.constInt(f.one(n, 'size'))
    if (len === null) { f.miss(n, '陣列長度不是整數字面（VLA 或常數名字還沒有對應）'); return [] }
    const t = f.k('tArr', { t: elem, n: len })
    const values = n.slots?.values ?? []
    // 字元陣列的字串初值是一個運算式（iE），不是初值串列——判準與 generate.ts 相同（第 394 刀）
    const init = isCharStringInit(n) ? f.initOf(values[0])
      : values.length > 0 ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
