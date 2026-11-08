/**
 * `cpp:new` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftNewExpression', …)`。
 *
 * ## ⚠️ `new int[n]` 的 `[n]` 原本整個掉了
 *
 * 這裡只抓 `argument_list`（`new int(5)` 的建構引數），而**陣列大小是
 * `new_declarator`**，不在那個分支裡。於是：
 *
 * ```
 * new int[n]   → cpp:new { type: 'int' }   ← [n] 不見了
 * new int      → cpp:new { type: 'int' }   ← 與上面完全相同
 * ```
 *
 * 🔴 **兩個不同的東西產出同一棵樹**，而產生器也只寫得出 `new int`
 * ——**辨識掉、產生也掉，對稱**，所以來回轉換比對一直是綠的。
 * 這是同一天內遇到的第二個對稱遺失（第一個是 `pair` 的初始值）。
 *
 * > **一個對稱的資料遺失不會讓任何比對變紅——它只會讓執行結果變成別的程式。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftNewExpression', (node, ctx) => {
    /**
     * 🔴 **型別讀 `type` 欄位，讀不到就讓開，不猜 `int`**（2026-11-06，元件管線 311 量到）：原本只認三種節點型別，
     * `new vector<int>()`（`template_type`）、`new std::string`（`qualified_identifier`）都找不到 ⟹ 安靜地變成 `int`，
     * 於是 Cella 判「int * 不能轉成 vector<int> *」——一支合法的程式被說成錯的（P6）。
     */
    const typeNode = node.childForFieldName('type') ?? node.namedChildren.find(c =>
      c.type === 'type_identifier' || c.type === 'primitive_type' || c.type === 'sized_type_specifier' || c.type === 'template_type' || c.type === 'qualified_identifier')
    if (!typeNode) return null
    const type = typeNode.text
    // `new Node{v, head}`（大括號初始化）：引數在 initializer_list 裡。🔴 原本只找 argument_list，大括號整段丟掉 → `new Node`，
    //    值從「指定好的」變成「未初始化」（2026-11-06，元件管線 313 的盲測）。記成屬性 `brace`，產回去照原本的括號
    const braceList = node.namedChildren.find(c => c.type === 'initializer_list')
    const argList = node.namedChildren.find(c => c.type === 'argument_list') ?? braceList
    // 🔴 引數是**運算式**，逐一 lift 成槽（2026-11-07，328）——原本是一串文字屬性，formalize 只能照實回 unknown
    const argNodes = argList ? argList.namedChildren.filter(a => a.type !== 'comment') : []
    const args = argNodes.map(a => ctx.lift(a)).filter((x): x is NonNullable<typeof x> => x != null)
    // 有一個引數 lift 不出來 → 讓開（誠實降級成原文），不送少一個引數的樹
    if (args.length !== argNodes.length) return null

    // `new int[n]` —— 大小住在 `new_declarator` 裡（`[` 運算式 `]`）。
    const declarator = node.namedChildren.find(c => c.type === 'new_declarator')
    const sizeExpr = declarator?.namedChildren[0]
    const size = sizeExpr ? ctx.lift(sizeExpr) : null

    const slots: Record<string, ReturnType<typeof createNode>[]> = {}
    if (args.length > 0) slots.args = args
    if (size) slots.size = [size]
    const made = createNode('cpp:new', { type }, slots)
    // 🔴 **一對空括號是意思，不是排版**（2026-11-06）：`new int()` 把值初始化成 0，`new int` 的值是未定的（[expr.new]p18）。
    //    原本兩者都成了「沒有引數」→ 產回去少了括號、意思變了。記成屬性 `valueInit`，產碼與 formalize 都讀它
    //    🔴 而它是【屬性】不是 layoutHints：layoutHints 走一趟積木就丟了（form-invariance (c)），積木上由 renderMapping.hints 帶著
    if (argList && args.length === 0 && !braceList) made.properties.valueInit = 'true'
    if (braceList) made.properties.brace = 'true'
    return made
  })
}

/** `new T` 或 `new T[count]`——C → C++ 把 `malloc` 換成它時用（`src/languages/cpp/c-to-cpp.ts`；身分只寫在這顆膠囊裡）。 */
export function buildNew(type: string, count: SemanticNode | null): SemanticNode {
  return createNode('cpp:new', { type }, count ? { size: [count] } : {})
}
