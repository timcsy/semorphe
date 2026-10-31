/** `cpp:ultrasonic_trigger` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.stmt('cpp:ultrasonic_trigger', (n, f) => {
    // 一顆積木、五行程式碼：拉低 → 2 µs → 拉高 → 10 µs → 拉低。標籤 <id>/<第幾行>，判決指回這塊積木
    const pin = f.exprOf(n, 'pin')
    const w = (i: number, v: string): CellaJson => f.k('sExpr', { n: `${n.id}/${i}`, e: f.k('eCall', { n: `${n.id}/${i}/call`, f: 'digitalWrite', args: [pin, f.k('eConst', { n: `${n.id}/${i}/v`, name: v })] }) })
    const d = (i: number, us: number): CellaJson => f.k('sExpr', { n: `${n.id}/${i}`, e: f.k('eCall', { n: `${n.id}/${i}/call`, f: 'delayMicroseconds', args: [f.k('eNum', { n: `${n.id}/${i}/us`, v: us })] }) })
    return [f.k('sBlock', { n: n.id, body: [w(1, 'LOW'), d(2, 2), w(3, 'HIGH'), d(4, 10), w(5, 'LOW')] })]
  })
}
