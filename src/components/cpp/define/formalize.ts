/**
 * `cpp:define` 的 **formalize** 路（spec 197）——物件巨集由前端展開（cella 2026-11-01：巨集是前處理器的事，語意樹上不該出現），
 * 所以它本身不產生任何項目：值在使用處代進去（`var_ref` 的 formalize 與陣列長度的 `constInt`）。
 * ⚠️ 只認數字字面量；值是運算式或字串的照實標 unknown（不猜它展開之後長什麼樣）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.item('cpp:define', (n, f) => (f.macroValue(String(n.properties?.name ?? '')) ? [] : [f.miss(n, '巨集的值不是數字字面量（運算式、字串還沒有展開）')]))
}
