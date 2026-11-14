/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { pyStr, cEscapedValue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 語義樹存的是寫法（`\n` 是兩個字），先解成值再寫成 Python 的字面量（453：原本跳脫兩次）
  r.expr((n, py) => {
    const v = cEscapedValue(String(n.properties.value ?? ''))
    return v === undefined ? py.keep(n, 'outside-subset', '字串裡的十六進位／八進位跳脫是位元組，Python 的字串是碼點') : pyStr(v)
  })
}
