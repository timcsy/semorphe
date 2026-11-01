/** `cpp:var_ref` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:var_ref', (n, f) => {
    const x = f.declOf(n.id)
    // 成員函式裡的裸名字指到欄位：隱含的 this（cpp_to_tree.py 的 eSelf；spec 201）
    if (x && f.isMemberField(x)) return f.k('eSelf', { n: n.id, x: String(n.properties?.name ?? '') })
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
    // 標準串流物件（`cin.ignore()` 的接收者）：eStdin／eStdout／eStderr（spec 201：送成 eConst 會被判 undeclared identifier）
    const stream = f.options.isC ? undefined : ({ cin: 'eStdin', cout: 'eStdout', cerr: 'eStderr' } as Record<string, string>)[name.replace(/^std::/, '')]
    if (stream) return f.k(stream, { n: n.id })
    // 函式名當值（`sort(a, a + n, cmp)`）：eFunc（spec 201：送成 eConst 會被判 undeclared identifier）
    if (f.isFunctionName(name)) return f.k('eFunc', { n: n.id, f: name })
    return f.k('eConst', { n: n.id, name })
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
