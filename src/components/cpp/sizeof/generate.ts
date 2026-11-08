/** `cpp:sizeof` 的 **generate** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { cTypeText } from '../../../languages/cpp/target-dialect'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:sizeof', (node, ctx) => {
    // C 目標：`sizeof(P)` → `sizeof(struct P)`（只有宣告過的 struct 名字；變數名不會在名單上——357）
    const target = String(node.properties.target ?? 'int')
    return `sizeof(${ctx._structNames ? cTypeText(target, ctx._structNames) : target})`
  })
}
