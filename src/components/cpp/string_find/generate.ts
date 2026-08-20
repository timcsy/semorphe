/** `cpp:string_find` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_find', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      const argNodes = node.children.arg ?? []
      const arg = argNodes.length > 0 ? generateExpression(argNodes[0], ctx) : '""'
      // 🔴 **起始位置不得被丟掉。** `str.find(x, 5)` 的 `5` 由 lift 產出
      //（`registerMethodComponent('find', …, ['arg', 'from'])`），而第一版的
      // 產生器只讀 `arg` —— 症狀是 `str.find(x, 5)` 被產成 `str.find(x)`，
      // **而那會從第 0 個字元開始找**，結果不同而沒有任何地方出聲。
      //
      // ⚠️ 沒有第二個引數時**不得產出空的逗號**（`find(x,)` 編不過）。
      const fromNodes = node.children.from ?? []
      if (fromNodes.length > 0) {
        return `${obj}.find(${arg}, ${generateExpression(fromNodes[0], ctx)})`
      }
      return `${obj}.find(${arg})`
    })
}
