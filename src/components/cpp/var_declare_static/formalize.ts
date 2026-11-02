/**
 * `cpp:var_declare_static` 的 **formalize** 路（spec 202）。契約見 `core/formalize-contract.ts`。
 *
 * 區塊裡的 `static T x = v;`：靜態儲存期（[stmt.dcl]p3：第一次經過時初始化一次）——包成 `sStatic {n: <id>:static, d: <宣告>}`
 * （形狀照 cella 的 `cpp_to_tree.py` 的 `local`）。
 * 檔案範圍的 `static`：只改連結性（internal linkage），單一翻譯單元裡與一般的全域變數同義 ⟹ 照 `iVar`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.decl('cpp:var_declare_static', (n, f, global) => {
    const t = f.type(n.properties?.type ?? 'int', n)
    if (!t) return []
    const made = f.declVar(n, t, global)
    return global ? made : made.map((d) => f.k('sStatic', { n: `${n.id}:static`, d }))
  })
}
