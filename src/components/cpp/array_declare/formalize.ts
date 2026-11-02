/** `cpp:array_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { isCharStringInit } from './char-string-init'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:array_declare', (n, f, global) => {
    const elem = f.type(n.properties?.type, n)
    if (!elem) return []
    const values = n.slots?.values ?? []
    // `int a[] = {7, 8}`：沒寫大小時，長度由大括號初值串列的項數決定（[dcl.init.aggr]/7，spec 202）。
    // ⚠️ 字元陣列的字串初值（`char s[] = "ab"`）長度要算跳脫與結尾 NUL——不在這裡猜，照舊標翻不出
    const len = f.one(n, 'size') === undefined && values.length > 0 && !isCharStringInit(n)
      ? values.length
      : f.constInt(f.one(n, 'size'))
    if (len === null) {
      // 可變長度陣列（`int d[n]`，GNU 的擴充）：Cella 0.1.202611012223 起照 g++ 執行，判決帶假設 {"implementation":"gcc","choice":"vla"}（第 217 刀）。
      // ⚠️ 只有區域變數、不帶初始化子才是 VLA——全域的長度一定是常數運算式；元素是 class（`vector<int> ar[n]`）照送，Cella 照實判 unknown
      if (global || values.length > 0) { f.miss(n, '陣列長度不是整數字面（全域或帶初值時長度要是常數）'); return [] }
      return [f.k('sDeclV', { n: n.id, x: n.id, name: String(n.properties?.name ?? ''), elem, len: f.exprOf(n, 'size') })]
    }
    const t = f.k('tArr', { t: elem, n: len })
    // 字元陣列的字串初值是一個運算式（iE），不是初值串列——判準與 generate.ts 相同（第 394 刀）
    const init = isCharStringInit(n) ? f.initOf(values[0])
      : values.length > 0 ? f.braceList(n, 'values') : null
    return f.declInit(n, t, init, global)
  })
}
