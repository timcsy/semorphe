/**
 * 這顆元件寫成 Python（453）：敘述位置的 `a, b;` 等於 `a; b;`（逗號運算子有序列點、值丟掉）——
 * 每一個運算元當一句敘述寫（同 `formalize.ts` 的敘述翻法）。學生最常見的是 `ios::sync_with_stdio(0),cin.tie(0);`（135 支）。
 * 運算式位置（`for (…; …; i++, j--)`、`x = (a, b)`）不登記 ⟹ 照實保留。
 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // block 給空結果補的 pass 濾掉（運算元是運算式，自己不會產生縮排的 pass）
  r.stmt((n, py, depth) => (n.slots.exprs ?? []).flatMap((c) => py.block([c], depth).filter((l) => l.trim() !== 'pass')))
}
