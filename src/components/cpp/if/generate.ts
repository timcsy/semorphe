/** `cpp:if` 的 **generate** 路——從共用檔原封剪過來（批次第四十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { StylePreset } from '../../../core/types'
// ⚠️ **共用的是演算法，不是身分。** `cpp:if` 與 `cpp:if_else` 的產生器是同一個
// ——那正是它們以前搬不動的原因（可搬性第 5 條）。
import { ifGeneratorFor } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  g.set('cpp:if', ifGeneratorFor(style))
}
