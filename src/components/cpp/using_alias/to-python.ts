/**
 * 這顆元件寫成 Python（453）：整數／浮點型別的別名登記成型別別名，引擎在型別文字上展開；本身不寫（Python 沒有型別宣告）。
 * 其餘型別（struct、容器、指標）的別名照實保留。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

const ARITH = /^(?:(?:unsigned|signed)\s+)?(?:long long|long double|long|int|short|double|float|char|bool)(?:\s+int)?$|^unsigned$/
const orig = (n: { properties: Record<string, unknown> }): string => String(n.properties.orig_type ?? '').trim()

export function registerToPython(r: ToPythonRegistrar): void {
  r.typeAlias((n) => (ARITH.test(orig(n)) ? { name: String(n.properties.alias ?? ''), type: orig(n) } : undefined))
  r.stmt((n, py) => (ARITH.test(orig(n)) ? [] : [py.keep(n, 'outside-subset', `型別別名「${String(n.properties.alias ?? '')}」= ${orig(n)} 還沒有對應`)]))
}
