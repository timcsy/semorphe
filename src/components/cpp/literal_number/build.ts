/** 數字字面的建構子——C → C++ 把 `%.2f` 換成 `setprecision(2)` 時用（`src/languages/cpp/c-to-cpp.ts`，2026-11-08）。身分只寫在這顆膠囊裡。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildLiteralNumber(value: string): SemanticNode {
  return createNode('cpp:literal_number', { value })
}
