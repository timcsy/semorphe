/** `cpp:loop_range` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateBody, indented, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:loop_range', (node, ctx) => {
      const varType = node.properties.var_type ?? 'auto'
      /**
       * 🔴 **迴圈變數可能是一串名字**（`for (auto [w, to] : ar[P])`）——
       * `targets` 有東西時**它是唯一的真實**，`var_name` 是它的第一格。
       * 兩者不是兩份真相：舊存檔沒有 `targets`，那時第一格就是全部。
       */
      const targets = node.slots.targets ?? []
      const varName = targets.length > 0
        ? `[${targets.map((t) => String(t.properties.name ?? '')).join(', ')}]`
        : (node.properties.var_name ?? 'x')
      /**
       * 🔴 **走訪的對象是一棵樹**（2026-09-18）——`d2[pt]`／`m[k]` 都是運算式，
       * 而一個欄位只裝得下一串文字。接不到東西時產一個看得出來的空位，
       * **不要假裝有一個叫 `vec` 的容器**。
       */
      const iterable = (node.slots.iterable ?? [])[0]
      const container = iterable ? generateExpression(iterable, ctx) : ''
      const bodyNodes = node.slots.body ?? []
      const bodyCode = generateBody(bodyNodes, indented(ctx))
      const ind = indent(ctx)
      return `${ind}for (${varType} ${varName} : ${container}) {\n${bodyCode}${ind}}\n`
    })
}
