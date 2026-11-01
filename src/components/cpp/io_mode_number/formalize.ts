/** `cpp:io_mode_number` 的 **formalize** 路（spec 201：學生的程式用 fixed／hex；形狀是 cella 2026-11-01 給的）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

// 屬性的值就是 C++ 的那個字（generate.ts）→ Cella 的 Manipulator 建構子
const M: Record<string, string> = {
  fixed: 'mFixed', scientific: 'mScientific', defaultfloat: 'mDefaultfloat', left: 'mLeft', right: 'mRight',
  hex: 'mHex', dec: 'mDec', oct: 'mOct', boolalpha: 'mBoolalpha', noboolalpha: 'mNoboolalpha',
  showpos: 'mShowpos', noshowpos: 'mNoshowpos', showbase: 'mShowbase', noshowbase: 'mNoshowbase',
  uppercase: 'mUppercase', nouppercase: 'mNouppercase',
}

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:io_mode_number', (n, f) => {
    const m = M[String(n.properties?.notation ?? 'fixed')]
    return m ? f.k('eManip', { n: n.id, m: f.k(m) }) : f.miss(n, `操縱子「${String(n.properties?.notation)}」還沒有對應`)
  })
}
