/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.expr((n, py) => {
    // `100LL`、`1.5f`：去掉後綴（Python 的整數沒有上限、浮點就是 double）
    // `10'0000'0000`：C++14 的數字分隔符號，Python 寫成 `_`（453：原樣搬過去是不合法的 Python）
    const v = String(n.properties.value ?? '0')
      .replace(/(?<=\d)[uUlL]+$/, '')
      .replace(/(?<=\d\.?\d*)[fF]$/, '')
      .replace(/'/g, '_')
    // `017` 在 C++ 是八進位，Python 要寫 `0o17`（`0` 開頭的十進位在 Python 不合法）
    if (/^0[0-7_]+$/.test(v)) return '0o' + v.slice(1).replace(/^_/, '')
    // 十六進位浮點（`0x1p3`）Python 沒有對應的字面量
    if (/^0[xX].*[pP]/.test(v)) return py.keep(n, 'outside-subset', '十六進位浮點字面量 Python 沒有對應的寫法')
    return v
  })
}
