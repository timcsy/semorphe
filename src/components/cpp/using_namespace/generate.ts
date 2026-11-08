/** `cpp:using_namespace` 的 **generate** 路——從共用檔原封剪過來（批次第三十一批：兩顆鷹架）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'
import { isCDialect } from '../../../languages/cpp/target-dialect'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:using_namespace', (node, ctx) => {
    const ns = node.properties.ns ?? 'std'
    // C 目標（C++ → C，357）：C 沒有命名空間，而 `std` 那一句在 C 裡不帶任何意思（標頭已換成 C 的名字、cout 已換成 printf）
    // ⟹ 不輸出。別的命名空間照舊輸出——那支程式本來就不是 C（還有 namespace 的定義），讓 Cella 照實說，不替它藏。
    if (ns === 'std' && ctx.style && isCDialect(ctx.style)) return ''
    return `${indent(ctx)}using namespace ${ns};\n`
  })
}
