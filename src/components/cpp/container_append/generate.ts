/** `cpp:container_append` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_append', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].push_back(x)` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      const val = generateExpression((node.slots.value ?? [])[0], ctx)
      /**
       * 🔴 **產出使用者寫的那個方法名**（2026-09-19）——見 `component.json` 的 `_properties_why`。
       * ⚠️ 沒有這一格時退回預設，**那是積木上新拖出來的那一顆**（它沒有原文）。
       */
      const method = String(node.properties.method ?? 'push_back')
      return `${indent(ctx)}${obj}.${method}(${val});\n`
    })
}
