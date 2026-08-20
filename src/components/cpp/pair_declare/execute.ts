/**
 * `cpp:pair_declare` 的 **execute** 路
 *
 * ## ⚠️ 這一路曾經被宣告成「顯式的空」，而那個宣告是錯的
 *
 * `component.json` 原本寫著 `skipPaths: ["execute"]`、
 * `skipReasons: { execute: "declarative" }`，`_execute_why` 逐字說
 * 「這顆沒有獨立的執行語義。**顯式的空，不是遺漏。**」
 *
 * 🔴 而 `pair<int,int> p;` **當然有執行語義**——它要宣告一個變數。
 * 症狀：`p.first` 丟 `UNDECLARED_VAR: p`，佔第三十二條護欄 18 段缺口裡的 **5 段**。
 *
 * > **一個假的「顯式的空」比一個誠實的遺漏危險：
 * > 完備性護欄看到它會變綠，而缺陷還在。**
 *
 * 這是 `concepts/執行機構.md` 那一串的又一個形狀——**殼有了一張合格證**。
 *
 * ## pair 就是一個只有兩個欄位的結構
 *
 * 值用 `type: 'object'` ＋ `Map{first, second}`，與 `cpp:struct_declare` 建出來的
 * 實例**同一種形狀**——所以 `p.first`（`struct_at_member`）與 `p.first = 1`
 * （`var_assign` 的帶點號名字）**兩條既有的路直接就通了**，不必為 pair 各寫一份。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import type { RuntimeValue } from '../../../interpreter/types'

/** `pair` 的欄位名是語言定的，不是我們取的。 */
const FIELDS = ['first', 'second'] as const

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:pair_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'p')

    // `pair<int,string> p = make_pair(42, "hi")` —— 初始值是一整個運算式。
    // ⚠️ 這個接點在 2026-08-13 之前不存在，於是初始值**被辨識與產生兩邊對稱地丟掉**，
    // 而來回轉換比對因此一直是綠的（見 `strategies.ts` 的 `hasInitSourceDecl` 檔頭）。
    const source = (node.children.source ?? [])[0]
    if (source) {
      const produced = await ctx.evaluate(source)
      // 不複製的話，兩個 pair 會共用同一個 Map——改一個另一個跟著變。
      // 這與 `vector_declare` 的初始值處置是同一條理由。
      const copied =
        produced.type === 'object' && produced.value instanceof Map
          ? new Map(produced.value as Map<string, RuntimeValue>)
          : new Map<string, RuntimeValue>()
      ctx.scope.declare(name, { type: 'object', value: copied, structName: 'pair' })
      return
    }

    const fields = new Map<string, RuntimeValue>()
    fields.set(FIELDS[0], defaultValue(String(node.properties.type1 ?? 'int')))
    fields.set(FIELDS[1], defaultValue(String(node.properties.type2 ?? 'int')))
    ctx.scope.declare(name, { type: 'object', value: fields, structName: 'pair' })
  })
}
