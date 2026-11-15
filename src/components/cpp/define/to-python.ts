/**
 * 這顆元件寫成 Python（453：StudyCpp 218 支裡 55 支有 `#define`，最常見的是 `#define ll long long`）。
 * - 型別巨集（值是整數／浮點型別）：登記成型別別名，引擎在型別文字上展開；本身不寫
 * - 數字巨集（`#define MAXN 100005`）：寫成一個 Python 常數（用到的地方照名字讀）
 * - pair 的型別巨集（466：`#define pii pair<int,int>`，StudyCpp 6 支）：同上；兩格是哪些型別、換不換得過去由 pair 那幾顆判
 * - 成員巨集（466：`#define F first`／`#define y second`，StudyCpp 17 支）：登記成成員別名，引擎把 `p.F` 展開成 `p.first`；
 *   **那個名字整支程式只當成員名用**才展開（C++ 的巨集到處都換——`int x` 也會變成 `int first`），否則照實保留
 * - 其餘（`#define pb push_back`、運算式、字串、函式巨集是另一顆）：照實保留——不猜它展開之後長什麼樣
 *   （`v.pb(x)` lift 成一個叫 pb 的方法呼叫，不是推入那顆——要換得在 lift 之前展開，不在這裡）
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

/** 值後面的註解不是值（同 formalize.ts） */
const valueOf = (n: { properties?: Record<string, unknown> }): string => String(n.properties?.value ?? '').replace(/\/\/.*$|\/\*.*?\*\//g, '').trim()
const ARITH = /^(?:(?:unsigned|signed)\s+)?(?:long long|long double|long|int|short|double|float|char|bool)(?:\s+int)?$|^unsigned$/
const ARITH_WORD = '(?:(?:unsigned|signed)\\s+)?(?:long long|long double|long|int|short|double|float|char|bool)(?:\\s+int)?|unsigned|[A-Za-z_]\\w*'
/** `pair<int,int>`、`pair<ll, ll>`（格裡的詞可以是別的型別巨集，引擎展開之後再由 pair 那幾顆判型別） */
const PAIR = new RegExp(`^(?:std::)?pair\\s*<\\s*(?:${ARITH_WORD})\\s*,\\s*(?:${ARITH_WORD})\\s*>$`)
const isType = (v: string): boolean => ARITH.test(v) || PAIR.test(v)

export function registerToPython(r: ToPythonRegistrar): void {
  r.typeAlias((n) => {
    const v = valueOf(n), name = String(n.properties.name ?? '')
    return isType(v) ? { name, type: v } : v === 'first' || v === 'second' ? { name, member: v } : undefined
  })
  r.stmt((n, py, depth) => {
    const v = valueOf(n)
    const name = String(n.properties.name ?? '')
    if (isType(v)) return []
    if ((v === 'first' || v === 'second') && py.isExpandedAlias(name)) return []
    if (v === 'first' || v === 'second') return [py.keep(n, 'outside-subset', `巨集「${name}」（${v}）在別處也當名字用——C++ 會連那裡一起換掉，不猜`)]
    if (/^\d+$/.test(v)) return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${v}`]
    return [py.keep(n, 'outside-subset', `巨集「${String(n.properties.name ?? '')}」的值「${v}」不是型別或整數——不猜它展開之後長什麼樣`)]
  })
}
