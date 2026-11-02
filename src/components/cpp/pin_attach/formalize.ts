/**
 * `cpp:pin_attach` 的 **formalize** 路（spec 201）。契約見 `core/formalize-contract.ts`。
 *
 * 這顆的值在**屬性** `pin`（積木上是一個數字欄位，不是插槽），名字在 `name`，原本的寫法在 `style`——三種形式翻法不同：
 *
 * ```
 * const int ledPin = 13;   → 常數宣告（tConst int）
 * int ledPin = 13;         → 一般宣告（int）
 * #define ledPin 13        → 物件巨集：不產生項目，值由核心展開在使用處（同 `#define` 那一顆）
 * ```
 *
 * ⚠️ 巨集形式**不宣告名字**（作用域走訪若把它當宣告，`digitalWrite(ledPin, …)` 會指到一個不存在的宣告）。
 */
import type { FormalizeContext, FormalizeRegistrar, CellaJson } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

const isMacro = (n: SemanticNode): boolean => n.properties?.style === 'define'
const pinOf = (n: SemanticNode): number | null => {
  const s = String(n.properties?.pin ?? '')
  return /^[0-9]+$/.test(s) ? Number(s) : null
}

function declare(n: SemanticNode, f: FormalizeContext, global: boolean): CellaJson[] {
  if (isMacro(n)) return []
  const pin = pinOf(n)
  if (pin === null) return [f.miss(n, `接線的腳位不是整數字面（${String(n.properties?.pin)}）`)]
  const int = f.type('int', n)
  if (!int) return []
  const t = n.properties?.style === 'plain' ? int : f.k('tConst', { t: int })
  return f.declInit(n, t, f.k('iE', { e: f.k('eNum', { n: `${n.id}/pin`, v: pin }) }), global)
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:pin_attach', declare)
  // `#define ledPin 13`：登記成物件巨集，核心展開在使用處
  r.definesMacro('cpp:pin_attach', (n) => (isMacro(n) ? { name: String(n.properties?.name ?? ''), value: String(n.properties?.pin ?? '') } : null))
  // 作用域：只有宣告形式才宣告名字（巨集不是變數）
  r.scope('cpp:pin_attach', (n, w) => { if (!isMacro(n)) w.declare(String(n.properties?.name ?? ''), n.id) })
  // 編譯期整數：const 形式（`int a[ledPin]` 用得到；一般 int 不是常數，不註冊值）
  r.constInt('cpp:pin_attach', (n) => (n.properties?.style === 'plain' || isMacro(n) ? null : pinOf(n)))
}
