/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { pyStr, cEscapedValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 字元字面量 → 長度 1 的字串（印出、比較都一樣；拿來算的在 arithmetic 那顆保留）
  // 語義樹存的是寫法（`'\n'` 的 char 是兩個字），先解成值（453：原本跳脫兩次）
  r.expr((n, py) => {
    const v = cEscapedValue(String(n.properties.char ?? ''))
    return v === undefined ? py.keep(n, 'char', '十六進位／八進位跳脫的字元是位元組，Python 的字串是碼點') : pyStr(v)
  })
}
