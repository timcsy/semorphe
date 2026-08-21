/**
 * `python:container_substr` 的 **generate** 路——`xs[1:3]`／`xs[:2]`／`xs[-2:]`。
 *
 * 🔴 **沒有的那一端就不寫**——填一個 0 會讓 `xs[:2]` 產回 `xs[0:2]`：
 * 語義相同**而使用者的碼被改了**。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:container_substr', (node, ctx) => {
    const one = (k: 'obj' | 'from' | 'to'): string => {
      const n = (node.children[k] ?? [])[0]
      return n ? generateExpression(n, ctx) : ''
    }
    return `${one('obj')}[${one('from')}:${one('to')}]`
  })
}
