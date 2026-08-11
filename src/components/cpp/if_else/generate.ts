/** `cpp:if_else` 的 **generate** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { StylePreset } from '../../../core/types'
// ⚠️ **共用的是演算法，不是身分。** `if_else` 與 `if` 的產生器是同一個
// ——那正是它以前搬不動的原因（可搬性第 5 條）。`ifGeneratorFor` 提升成
// 模組層級之後，兩顆各自 `g.set` 自己的身分，而排版邏輯只有一份。
import { ifGeneratorFor } from '../../../languages/cpp/core/generators/statements'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  g.set('cpp:if_else', ifGeneratorFor(style))
}
