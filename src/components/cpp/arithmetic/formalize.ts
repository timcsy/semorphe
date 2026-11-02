/** `cpp:arithmetic` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

/**
 * 整數常數運算式（spec 203）：`const int BASE = 3; int cache[BASE * 2];`——全域陣列的長度要是常數運算式（[dcl.array]p1），
 * 兩邊都是整數常數時前端算出值。整數除法往零截斷、餘數的正負號跟被除數（[expr.mul]p4，JS 的 `Math.trunc`／`%` 同語義）。
 * ⚠️ 不猜的地方一律回 null（＝不是常數，由使用端照實標翻不出）：除以零、結果超出 16 位元 int（Uno 的 int 是 16 位元，
 * 溢位的常數運算式不合法——這裡不依板子分辨，保守地只收兩邊都裝得下的值）。
 */
function fold(op: string, a: number, b: number): number | null {
  let v: number
  switch (op) {
    case '+': v = a + b; break
    case '-': v = a - b; break
    case '*': v = a * b; break
    case '/': if (b === 0) return null; v = Math.trunc(a / b); break
    case '%': if (b === 0) return null; v = a % b; break
    default: return null
  }
  return Number.isSafeInteger(v) && v >= -32768 && v <= 32767 ? v : null
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:arithmetic', (n, f) => f.binary(n))
  r.constInt('cpp:arithmetic', (n, f) => {
    const a = f.constInt(f.one(n, 'left')), b = f.constInt(f.one(n, 'right'))
    return a === null || b === null ? null : fold(String(n.properties?.operator ?? ''), a, b)
  })
}
