/** `cpp:string_append_char` 的 **generate** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_append_char', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      // 🔴 **接點名有兩個，而它們來自兩條不同的路。**
      //
      // lift 走共用的型別方法表（`registerTypedMethodConcept`），而那條路用
      // 一組共用的槽名對應——`push_back` 對到 **`value`**。
      // ⚠️ 而這個產生器原本只讀 `char`，於是：
      //
      // ```
      // s.push_back('Z');   →   s.push_back('a');    🔴 字元被換成預設值
      // ```
      //
      // **沒有任何地方出聲**：語法對、型別對、只有那個字元不是他寫的。
      //
      // > **一個「找不到就用預設值」的讀法，
      // > 在槽名改變時不會報錯——它會安靜地產出一個看起來合理的東西。**
      //
      // 兩個都讀，🔴 而**找不到就丟錯**，不要再用預設值掩蓋一次。
      const charNodes = node.children.char ?? node.children.value ?? []
      if (charNodes.length === 0) {
        throw new Error(`${String(obj)}.push_back() 少了要加的字元——接點 char／value 都是空的`)
      }
      const ch = generateExpression(charNodes[0], ctx)
      return `${indent(ctx)}${obj}.push_back(${ch});\n`
    })
}
