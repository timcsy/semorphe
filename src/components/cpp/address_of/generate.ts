/** `cpp:address_of` 的 **generate** 路——從共用檔原封剪過來（批次第三十二批：一元運算子族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/lang/generators/expressions'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:address_of', (node, ctx) => {
      /**
       * 🔴 **子運算式的優先級比自己低時要包括號**（2026-09-19）。
       *
       * 在此之前這裡是 `generateExpression(...)`，於是括號只有在
       * **使用者自己寫過**（`layoutHints.parenthesized`）時才在。而積木上**沒有 metadata**
       * ——走一趟積木回來之後那個註記就沒了：
       *
       * ```
       * 寫的        *(v.end() - 1)
       * 走一趟回來   *v.end() - 1     ← 先解參考 end()（未定義行為）再減一
       * ```
       *
       * > **一個靠「使用者寫過」才補的括號，在學生動過積木之後就不見了
       * > ——而產出的仍然是一段合法的程式，只是它算的是別的東西。**
       *
       * ⚠️ 同族五顆裡只有 `cpp:negate` 與 `cpp:logic_not` 用了 `genChild`，
       *    另外三顆（解參考／取位址／位元反轉）都漏了——**同一個病三個地方**。
       */
      const v = genChild((node.slots.var ?? [])[0], precedence(node), ctx)
      return `&${v}`
    })
}
