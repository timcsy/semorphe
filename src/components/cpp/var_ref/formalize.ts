/** `cpp:var_ref` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_ref', (n, f) => {
    const x = f.declOf(n.id)
    if (x) return f.k('eVar', { n: n.id, x })
    // 板子與函式庫的名字（LED_BUILTIN、DHT11、A0、WL_CONNECTED）今天被 lift 成一般的參照、指不到宣告。
    // cella 2026-10-31 定的分工：**程式自己沒宣告、來自標頭的名字**一律送 eConst（同 cpp_to_tree.py）；
    // 存不存在由 Cella 依板子與 include 判（不存在時判決指回這個節點）。學生自己宣告的（`const int LED = 13;`）
    // 已經由作用域走訪解析成 eVar，不會走到這裡。⚠️ 判準不是「全大寫」——`Serial`、`A0` 也是標頭的名字。
    const name = String(n.properties?.name ?? '')
    if (f.options.board) return f.k('eConst', { n: n.id, name })
    return f.miss(n, `名字「${name}」指不到宣告`)
  })
  // 作用域：一個名字的參照——指到宣告它的那個節點
  r.scope('cpp:var_ref', (n, w) => w.resolve(n.id, String(n.properties?.name ?? '')))
}
