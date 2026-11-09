/** `cpp:var_ref` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_ref', (n, f) => {
    const x = f.declOf(n.id)
    const name = String(n.properties?.name ?? '')
    // 🟢 名字交給 Cella 依作用域解析（eName，cella 0.1.202611052225——「意思歸 Cella」）：區域／參數／檔案範圍 → eVar，
    //    方法裡的欄位 → eSelf（隱含的 this），都查不到 → 串流／程式的函式名／eConst。Cella 用我們的語料比過：7797 個 eVar、
    //    38 個 eSelf、66 個 eConst、1 個 eFunc 與我們原本填的逐一相同。
    // 🟢 限定名（`C::n`、`L::current`、巢狀類別、命名空間、基底的成員）也交給 Cella 解析（cella 0.1.202611082213）——
    //    361 先照實翻不出（送 eName 當時會被判 undeclared）；這一版 Cella 認得了，找不到時照 clang 報 no member named
    if (x) return f.k('eName', { n: n.id, name })
    // 板子與函式庫的名字（LED_BUILTIN、DHT11、A0、WL_CONNECTED）今天被 lift 成一般的參照、指不到宣告。
    // cella 2026-10-31 定的分工：**程式自己沒宣告、來自標頭的名字**一律送 eConst（同 cpp_to_tree.py）；
    // 存不存在由 Cella 依板子與 include 判（不存在時判決指回這個節點）。學生自己宣告的（`const int LED = 13;`）
    // 已經由作用域走訪解析成 eVar，不會走到這裡。⚠️ 判準不是「全大寫」——`Serial`、`A0` 也是標頭的名字。
    // 🟢 C／C++ 也一樣（spec 194；cella 0.1.202610312349 起認得標準標頭的巨集常數：INT_MAX、RAND_MAX、EXIT_SUCCESS……）：
    //    引入了定義它的標頭才有值；沒引入、或根本不存在（打錯字）由 Cella 判 reject／unknown，判決指回這個節點——不再在我們這側標 unknown。
    // 物件巨集（spec 197）：前端展開——值代進使用處，標籤用使用處的 id（判決指回這一格）
    const m = f.macro(name)
    if (m) return m.expr(n.id)
    // 其餘（串流物件、函式名當值、標頭的常數與板子的物件）也交給 Cella：查不到宣告時它依序判 eStdin／eStdout／eStderr、
    // eFunc、eConst（找不到就是 undeclared，指回這一格）。⚠️ 巨集要在這之前展開——那是前端的事，Cella 看不到 #define 的值
    return f.k('eName', { n: n.id, name })
  })
  // 陣列長度寫成巨集名（`int a[N];`）：沒有宣告、而且是物件巨集 → 照值算（spec 197）
  // 常數名（`const int N = 100; int a[N];`）：指到的宣告是 const、初值是整數字面 → 照值算（spec 199：學生的程式 16 支；
  // clang 也把它當定長陣列）。`int a[n]` 的 n 不是常數——仍是 null，由陣列那一顆照實標 unknown
  r.constInt('cpp:var_ref', (n, f) => {
    const x = f.declOf(n.id)
    if (!x) return f.macro(String(n.properties?.name ?? ''))?.int ?? null
    // 值是不是編譯期常數，由那個宣告自己回答（它註冊了 constInt 才算；可變的變數不註冊）
    const d = f.nodeById(x)
    return d ? f.constInt(d) : null
  })
  // 作用域：一個名字的參照——指到宣告它的那個節點
  r.scope('cpp:var_ref', (n, w) => w.resolve(n.id, String(n.properties?.name ?? '')))
}
