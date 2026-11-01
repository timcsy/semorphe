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
    // 🟢 C／C++ 也一樣（spec 194；cella 0.1.202610312349 起認得標準標頭的巨集常數：INT_MAX、RAND_MAX、EXIT_SUCCESS……）：
    //    引入了定義它的標頭才有值；沒引入、或根本不存在（打錯字）由 Cella 判 reject／unknown，判決指回這個節點——不再在我們這側標 unknown。
    const name = String(n.properties?.name ?? '')
    // 物件巨集（spec 197）：前端展開——值代進使用處，標籤用使用處的 id（判決指回這一格）
    const m = f.macro(name)
    if (m) return m.expr(n.id)
    return f.k('eConst', { n: n.id, name })
  })
  // 陣列長度寫成巨集名（`int a[N];`）：沒有宣告、而且是物件巨集 → 照值算（spec 197）
  // 常數名（`const int N = 100; int a[N];`）：指到的宣告是 const、初值是整數字面 → 照值算（spec 199：學生的程式 16 支；
  // clang 也把它當定長陣列）。`int a[n]` 的 n 不是常數——仍是 null，由陣列那一顆照實標 unknown
  r.constInt('cpp:var_ref', (n, f) => {
    const x = f.declOf(n.id)
    if (!x) return f.macro(String(n.properties?.name ?? ''))?.int ?? null
    const d = f.nodeById(x)
    const isConst = d && (d.componentId === 'cpp:var_declare_const' || /^const\s/.test(String(d.properties?.type ?? '')) || /^\s*const\b/.test(String(d.properties?.qualifier ?? '')))
    return isConst ? f.constInt(f.one(d!, 'initializer')) : null
  })
  // 作用域：一個名字的參照——指到宣告它的那個節點
  r.scope('cpp:var_ref', (n, w) => w.resolve(n.id, String(n.properties?.name ?? '')))
}
