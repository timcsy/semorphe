/**
 * 這顆元件寫成 Python（453：StudyCpp 218 支裡 55 支有 `#define`，最常見的是 `#define ll long long`）。
 * - 型別巨集（值是整數／浮點型別）：登記成型別別名，引擎在型別文字上展開；本身不寫
 * - 數字巨集（`#define MAXN 100005`）：寫成一個 Python 常數（用到的地方照名字讀）
 * - 其餘（`#define F first`、運算式、字串、函式巨集是另一顆）：照實保留——不猜它展開之後長什麼樣
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

/** 值後面的註解不是值（同 formalize.ts） */
const valueOf = (n: { properties?: Record<string, unknown> }): string => String(n.properties?.value ?? '').replace(/\/\/.*$|\/\*.*?\*\//g, '').trim()
const ARITH = /^(?:(?:unsigned|signed)\s+)?(?:long long|long double|long|int|short|double|float|char|bool)(?:\s+int)?$|^unsigned$/

export function registerToPython(r: ToPythonRegistrar): void {
  r.typeAlias((n) => (ARITH.test(valueOf(n)) ? { name: String(n.properties.name ?? ''), type: valueOf(n) } : undefined))
  r.stmt((n, py, depth) => {
    const v = valueOf(n)
    if (ARITH.test(v)) return []
    if (/^\d+$/.test(v)) return [`${py.indent(depth)}${py.name(String(n.properties.name ?? ''))} = ${v}`]
    return [py.keep(n, 'outside-subset', `巨集「${String(n.properties.name ?? '')}」的值「${v}」不是型別或整數——不猜它展開之後長什麼樣`)]
  })
}
