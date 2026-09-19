/** `cpp:cast` 的 **generate** 路——從共用檔原封剪過來（批次第二十七批：轉型族）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { precedence, genChild } from '../../../languages/cpp/lang/generators/expressions'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:cast', (node, ctx) => {
      const targetType = node.properties.target_type ?? 'int'
      const valueNode = (node.slots.value ?? [])[0]
      /**
       * 🔴 **沒有運算元時產出函式式轉型**（2026-09-19，語料 `basic/4_variable.cpp`）。
       *
       * `int varible_666 = int();` 的 `int()` 是**值初始化**（＝0），而它 lift 成
       * 一顆 `cpp:cast` 而 `value` 是空的。在此之前這裡產出 `(int)`
       * ——**那不是合法的 C++**，於是再 lift 一次整段就走樣了
       *（語義不動點那一關量到的：`同一棵 218 → 216`）。
       *
       * > **一個新的 lift 認領了一種寫法，而產生器產不回那種寫法
       * > ——形狀上是「多支援了一種語法」，實際上是「多了一種會壞掉的程式」。**
       */
      if (!valueNode) return `${targetType}()`
      /**
       * 🔴 **運算元的優先級比轉型低時要包括號**（同上，`w/APCS/f638_2t.cpp`）。
       *
       * `(ll)(x+1)*z` 的運算元是 `x+1`。在此之前這裡直接串接，產出
       * `(ll)x+1*z`——**一段合法而算另一件事的程式**。
       * ⚠️ 括號原本是靠 `layoutHints` 帶的，而**積木上沒有 metadata**：
       *    走一趟積木回來就沒了。與同族三顆一元運算子是**同一個病**。
       */
      return `(${targetType})${genChild(valueNode, precedence(node), ctx)}`
    })
}
