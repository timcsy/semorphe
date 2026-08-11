// ⚠️ 問**性狀**不問身分——一份身分集合擋住那三顆搬進膠囊。
import { needsParenInCout, isBinaryOperator } from '../../core/node-traits'

// Bitwise/comparison/logic operators have lower precedence than <<
const LOW_PREC_OPS = new Set(['&', '|', '^', '&&', '||', '>', '<', '>=', '<=', '==', '!='])

/**
 * ⚠️ **匯出它，因為 `cpp:print` 搬進膠囊了。**
 * 「哪些東西放進 `cout <<` 要加括號」是 `<<` 的排版知識，
 * 不是那顆元件的實作——**共用的是演算法，不是身分。**
 */
export function needsParensInCout(v: import('../../../../core/types').SemanticNode): boolean {
  if (needsParenInCout(v.conceptId)) return true
  // ⚠️ 只換掉身分那一半——**清單留著**，那是 `<<` 的排版知識，
  // 不是任何一顆元件的性質。
  if (isBinaryOperator(v.conceptId) && LOW_PREC_OPS.has(String(v.properties.operator ?? ''))) return true
  return false
}

/**
 * ⚠️ **這個模組不再註冊任何產生器**——`cpp:print`／`cpp:input` 都進膠囊了。
 * 檔案留著因為 `needsParensInCout` 是 `<<` 的排版演算法（見上面的匯出）。
 */
