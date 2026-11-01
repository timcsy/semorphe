/**
 * `cpp:define` 的 **formalize** 路（spec 197）——物件巨集由前端展開（cella 2026-11-01：巨集是前處理器的事，語意樹上不該出現），
 * 所以它本身不產生任何項目：它登記「我定義了一個巨集」，核心把值展開在使用處（`var_ref` 的 formalize 與陣列長度）。
 * ⚠️ 值要是某顆元件認得的字面量（目前是數字）；運算式、字串照實標 unknown（不猜它展開之後長什麼樣）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 值後面的註解不是值（`#define ll long long //要longlong打ll就好`——spec 199 量到）
  const valueOf = (n: { properties?: Record<string, unknown> }): string => String(n.properties?.value ?? '').replace(/\/\/.*$|\/\*.*?\*\//g, '').trim()
  r.definesMacro('cpp:define', (n) => ({ name: String(n.properties?.name ?? ''), value: valueOf(n) }))
  // 字面量巨集在用到的地方展開（`macro`）；型別巨集（`#define ll long long`）在 `type()` 展開（spec 199）——兩者本身都不產生程式
  // 記號替換巨集（`#define F first`）：值是一個識別字——用到的地方（成員名、方法名、函式名）由 identMacro 展開（第 205 刀）
  r.item('cpp:define', (n, f) => (f.macro(String(n.properties?.name ?? '')) || f.isTypeText(valueOf(n)) || /^[A-Za-z_]\w*$/.test(valueOf(n))
    ? [] : [f.miss(n, '巨集的值不是認得的字面量、型別或識別字（運算式、字串還沒有展開）')]))
}
