/** `cpp:literal_number` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeContext, FormalizeRegistrar } from '../../../core/formalize-contract'

/**
 * 沒有後綴的整數字面 → 值（第 391 刀）。十六進位 `0x27`（I2C LCD 的位址）、八進位 `017`、二進位 `0b101`、分隔符 `1'000`。
 * 🔴 在此之前只認 `[0-9]+`，於是 `017` 被當成十進位 17（C++ 是 15）。
 * ⚠️ 非十進位而超過 int 的（`0x80000000` 是 unsigned int，與十進位的規則不同）不在這裡收——回 null，交給下面的 `nonDecimal`。
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

/**
 * 非十進位（十六進位／二進位／八進位）的整數字面，**超過 int 或帶後綴**的那些（spec 203：`0xDEADBEEF`、`0xDEADBEEFUL`、`0b1011U`）。
 * 型別照 C++17 [lex.icon] 表 7：非十進位沒有後綴時依序試 int、unsigned、long、unsigned long、long long、unsigned long long
 *（與十進位不同——十進位不會變成無號的）；`u` 只試無號的、`l` 從 long 起、`ll` 從 long long 起。
 * 寬度用 LP64（int 32、long 64、long long 64）——與 Cella「< 2^31 是 int、< 2^63 是 long」那條規則同一個假設。
 * 值超過 2^53（JSON 的數字放不精確）→ null，誠實 unknown。
 */
function nonDecimal(raw: string, id: string, f: FormalizeContext): CellaJson | null {
  const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+)([uU]?(?:ll|LL|l|L)?|(?:ll|LL|l|L)[uU])$/.exec(raw.replace(/'/g, ''))
  if (!m) return null
  const digits = m[1]
  const val = /^0[0-7]+$/.test(digits) ? BigInt('0o' + digits.slice(1)) : BigInt(digits)
  if (val > BigInt(Number.MAX_SAFE_INTEGER)) return null
  const suf = m[2].toLowerCase()
  const unsigned = suf.includes('u')
  const start = suf.includes('ll') ? 4 : suf.includes('l') ? 2 : 0
  const ladder: [string, bigint][] = [['tInt', 2n ** 31n], ['tUnsigned', 2n ** 32n], ['tLong', 2n ** 63n], ['tULong', 2n ** 64n], ['tLongLong', 2n ** 63n], ['tULongLong', 2n ** 64n]]
  const t = ladder.slice(start).find(([name, lim]) => (!unsigned || name.startsWith('tU')) && val < lim)?.[0]
  if (!t) return null
  const byValue = val < 2n ** 31n ? 'tInt' : 'tLong'
  const num = f.k('eNum', { n: t === byValue ? id : `${id}/value`, v: Number(val) })
  return t === byValue ? num : f.k('eCast', { n: id, t: f.k(t), a: num })
}

/** 一段數字字面的文字 → Cella 的運算式；認不得回 null。`id` 是最外層那一個的標籤。 */
function literal(v: string, id: string, f: FormalizeContext): CellaJson | null {
  // 負數字面：Cella 的 eNum／eFloat 不帶正負號，負號照 C++ 的文法是一元運算子（整數、浮點數都是——`-1e9` 是 spec 199 量到的）
  if (v.startsWith('-')) {
    const abs = literal(v.slice(1), `${id}/abs`, f)
    return abs && f.k('eUn', { n: id, op: f.k('opNeg'), a: abs })
  }
  const iv = intValue(v)
  if (iv !== null) return f.k('eNum', { n: id, v: iv })
  const nd = nonDecimal(v, id, f)
  if (nd) return nd
  // 帶後綴（`1LL`）：Cella 的 eNum 沒有後綴，型別要靠轉型保住——`1000000LL * 1000000LL` 不能變成 int 的溢位
  const suf = /^([0-9]+)(ll|LL|l|L|u|U|ul|UL|ull|ULL|lu|LU|llu|LLU)$/.exec(v)
  if (suf) {
    const t = ({ ll: 'tLongLong', l: 'tLong', u: 'tUnsigned', ul: 'tULong', lu: 'tULong', ull: 'tULongLong', llu: 'tULongLong' } as Record<string, string>)[suf[2].toLowerCase()]
    // cella 的規則：字面的型別和「靠值本身決定的型別」（< 2^31 是 int、< 2^63 是 long）不同時才包 eCast
    const val = BigInt(suf[1])
    const byValue = val < 2n ** 31n ? 'tInt' : val < 2n ** 63n ? 'tLong' : null
    const num = f.k('eNum', { n: t === byValue ? id : `${id}/value`, v: Number(suf[1]) })
    return t === byValue ? num : f.k('eCast', { n: id, t: f.k(t), a: num })
  }
  if (FLOAT.test(v)) return f.k('eFloat', { n: id, text: v.replace(/[fF]$/, ''), single: /[fF]$/.test(v) })
  return null
}

const FLOAT = /^[0-9]*\.[0-9]*([eE][-+]?[0-9]+)?[fF]?$|^[0-9]+[eE][-+]?[0-9]+[fF]?$/

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:literal_number', (n, f) => {
    const v = String(n.properties?.value ?? '')
    return literal(v, n.id, f) ?? f.miss(n, `數字字面「${v}」還沒有對應`)
  })
  // 陣列長度要的「編譯期的非負整數字面」——引擎問這一條，不問身分
  r.constInt('cpp:literal_number', (n) => intValue(String(n.properties?.value ?? '')))
  // 巨集展開（spec 197）：這種文字是數字字面量（十進位／十六進位／八進位／二進位、分隔符、負號、整數後綴）——值由上面的 expr 翻
  // 浮點數（`#define INF 1e9`）也是——spec 199 量到學生的程式這樣寫
  r.literal('cpp:literal_number', (text) => /^-?(0[xXbB][0-9a-fA-F']+|[0-9][0-9']*)([uU]?[lL]{0,2}|[lL]{1,2}[uU])$/.test(text.trim()) || FLOAT.test(text.trim().replace(/^-/, '')))
}
