/** `cpp:literal_number` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_number', (n, f) => {
    const v = String(n.properties?.value ?? '')
    if (/^[0-9]+$/.test(v)) return f.k('eNum', { n: n.id, v: Number(v) })
    // 負數字面：Cella 的 eNum 是整數值，負號照 C++ 的文法是一元運算子
    if (/^-[0-9]+$/.test(v)) return f.k('eUn', { n: n.id, op: f.k('opNeg'), a: f.k('eNum', { n: `${n.id}/abs`, v: Number(v.slice(1)) }) })
    // 帶後綴（`1LL`）：Cella 的 eNum 沒有後綴，型別要靠轉型保住——`1000000LL * 1000000LL` 不能變成 int 的溢位
    const suf = /^([0-9]+)(ll|LL|l|L|u|U|ul|UL|ull|ULL|lu|LU|llu|LLU)$/.exec(v)
    if (suf) {
      const t = ({ ll: 'tLongLong', l: 'tLong', u: 'tUnsigned', ul: 'tULong', lu: 'tULong', ull: 'tULongLong', llu: 'tULongLong' } as Record<string, string>)[suf[2].toLowerCase()]
      // cella 的規則：字面的型別和「靠值本身決定的型別」（< 2^31 是 int、< 2^63 是 long）不同時才包 eCast
      const val = BigInt(suf[1])
      const byValue = val < 2n ** 31n ? 'tInt' : val < 2n ** 63n ? 'tLong' : null
      const num = f.k('eNum', { n: t === byValue ? n.id : `${n.id}/value`, v: Number(suf[1]) })
      return t === byValue ? num : f.k('eCast', { n: n.id, t: f.k(t), a: num })
    }
    if (/^[0-9]*\.[0-9]*([eE][-+]?[0-9]+)?[fF]?$|^[0-9]+[eE][-+]?[0-9]+[fF]?$/.test(v)) {
      return f.k('eFloat', { n: n.id, text: v.replace(/[fF]$/, ''), single: /[fF]$/.test(v) })
    }
    return f.miss(n, `數字字面「${v}」還沒有對應`)
  })
  // 陣列長度要的「編譯期的非負整數字面」——引擎問這一條，不問身分
  r.constInt('cpp:literal_number', (n) => /^[0-9]+$/.test(String(n.properties?.value)) ? Number(n.properties?.value) : null)
}
