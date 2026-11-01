/** `cpp:literal_number` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

/**
 * 沒有後綴的整數字面 → 值（第 391 刀）。十六進位 `0x27`（I2C LCD 的位址）、八進位 `017`、二進位 `0b101`、分隔符 `1'000`。
 * 🔴 在此之前只認 `[0-9]+`，於是 `017` 被當成十進位 17（C++ 是 15）。
 * ⚠️ 非十進位而超過 int 的（`0x80000000` 是 unsigned int，與十進位的規則不同）不在這裡收——回 null，誠實 unknown。
 */
function intValue(raw: string): number | null {
  const v = raw.replace(/'/g, '')
  let big: bigint
  if (/^0[xX][0-9a-fA-F]+$/.test(v) || /^0[bB][01]+$/.test(v)) big = BigInt(v)
  else if (/^0[0-7]+$/.test(v)) big = BigInt('0o' + v.slice(1))
  else if (/^[0-9]+$/.test(v)) return Number(v)
  else return null
  return big < 2n ** 31n ? Number(big) : null
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_number', (n, f) => {
    const v = String(n.properties?.value ?? '')
    const iv = intValue(v)
    if (iv !== null) return f.k('eNum', { n: n.id, v: iv })
    // 負數字面：Cella 的 eNum 是整數值，負號照 C++ 的文法是一元運算子
    const neg = v.startsWith('-') ? intValue(v.slice(1)) : null
    if (neg !== null) return f.k('eUn', { n: n.id, op: f.k('opNeg'), a: f.k('eNum', { n: `${n.id}/abs`, v: neg }) })
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
  r.constInt('cpp:literal_number', (n) => intValue(String(n.properties?.value ?? '')))
  // 巨集展開（spec 197）：這種文字是數字字面量（十進位／十六進位／八進位／二進位、分隔符、負號、整數後綴）——值由上面的 expr 翻
  r.literal('cpp:literal_number', (text) => /^-?(0[xXbB][0-9a-fA-F']+|[0-9][0-9']*)([uU]?[lL]{0,2}|[lL]{1,2}[uU])$/.test(text.trim()))
}
