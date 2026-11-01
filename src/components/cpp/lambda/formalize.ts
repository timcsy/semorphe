/** `cpp:lambda` 的 **formalize** 路（第 206 刀：學生的程式 5 支用 `auto f = [&](int x){ … };`；形狀是 cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

const CAPTURE_ALL: Record<string, string> = { '&': 'capAllByReference', '=': 'capAllByCopy' }

export function registerFormalize(r: FormalizeRegistrar): void {
  // 運算式位置是 eLambda；定義（擷取、參數、回傳、本體）是同一個節點的 sLambda，放在用到它的那一句前面（hoist）
  r.expr('cpp:lambda', (n, f) => {
    const cap = String(n.properties?.capture ?? '&').trim()
    if (cap !== '' && !CAPTURE_ALL[cap]) return f.miss(n, `擷取「[${cap}]」（明列名字）還沒有對應`)
    const captures: CellaJson[] = cap === '' ? [] : [f.k(CAPTURE_ALL[cap])]
    const params = (n.slots?.params ?? []).map((q) =>
      f.k('param', { x: q.id, name: String(q.properties?.name ?? ''), t: f.type(q.properties?.type, q), dflt: null }))
    const rt = String(n.properties?.return_type ?? '').trim()
    const result = rt === '' ? null : f.type(rt, n)
    f.hoist(f.k('sLambda', { n: n.id, captures, params, result, mutable: false, body: f.block(n, 'body') }))
    return f.k('eLambda', { n: n.id })
  })
  // 作用域：參數與本體自己一層——參數不得漏到外面
  r.scope('cpp:lambda', (n, w) => w.inScope(() => {
    w.walkSlot(n, 'params')
    w.inScope(() => w.walkSlot(n, 'body'))
  }))
}
