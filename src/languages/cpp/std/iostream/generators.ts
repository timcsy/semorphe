// ⚠️ 問**性狀**不問身分——一份身分集合擋住那三顆搬進膠囊。
import { needsParenInCout, isBinaryOperator } from '../../lang/node-traits'

// Bitwise/comparison/logic operators have lower precedence than <<
/**
 * 🔴 **`<<` 與 `>>` 自己也要在裡面**（2026-09-19，一排位元那一刀的 round-trip 抓到）。
 *
 * ```
 * 寫的               走一趟積木回來        後果
 * cout << (n << 1);  cout << n << 1;      印 51 而不是 10
 * ```
 *
 * 它們與串流的 `<<` **同一個優先級**，而 `<<` 是左結合——
 * `cout << n << 1` 讀成 `(cout << n) << 1`，於是那個位移**整個消失**。
 *
 * ⚠️ **而程式碼那一路一直是對的**：括號由 `layoutHints` 帶。
 * 積木上沒有 metadata，所以**走一趟積木就沒了**——與第 197 刀那三顆
 * 一元運算子是**同一個病的第四次**。
 *
 * > **一個靠排版提示帶的括號，在經過一次投影之後就不再存在
 * > ——而它保護的那個結合律仍然需要它。**
 *
 * 🟢 而這個修法**不會多加括號**：一個位移只有在使用者真的寫了括號時才會
 * 成為 `cout <<` 的一個值（沒寫括號的話它本來就被讀成兩次串流插入）。
 */
const LOW_PREC_OPS = new Set([
  '&', '|', '^', '&&', '||', '>', '<', '>=', '<=', '==', '!=', '<<', '>>',
])

/**
 * ⚠️ **匯出它，因為 `cpp:print` 搬進膠囊了。**
 * 「哪些東西放進 `cout <<` 要加括號」是 `<<` 的排版知識，
 * 不是那顆元件的實作——**共用的是演算法，不是身分。**
 */
export function needsParensInCout(v: import('../../../../core/types').SemanticNode): boolean {
  if (needsParenInCout(v.componentId)) return true
  // ⚠️ 只換掉身分那一半——**清單留著**，那是 `<<` 的排版知識，
  // 不是任何一顆元件的性質。
  if (isBinaryOperator(v.componentId) && LOW_PREC_OPS.has(String(v.properties.operator ?? ''))) return true
  return false
}

/**
 * ⚠️ **這個模組不再註冊任何產生器**——`cpp:print`／`cpp:input` 都進膠囊了。
 * 檔案留著因為 `needsParensInCout` 是 `<<` 的排版演算法（見上面的匯出）。
 */
