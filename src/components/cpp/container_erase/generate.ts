/** `cpp:container_erase` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_erase', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      /**
       * 🔴 **兩個位置界定一段範圍時，第二個也要產回去**（2026-09-18）。
       * 少了它的症狀不是「產出少一個引數」——是**來回轉換就換了一個意思**：
       * `ms.erase(a, b)` 變成 `ms.erase(a)`（只刪一格），而那**編得過**。
       */
      const keys = (node.slots.key ?? []).map((k) => generateExpression(k, ctx))
      return `${indent(ctx)}${obj}.erase(${keys.join(', ')});\n`
    })
}
