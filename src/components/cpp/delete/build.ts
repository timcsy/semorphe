/**
 * `delete p`／`delete[] p` 的建構子——C → C++ 把 `free(p)` 換成它時用（`src/languages/cpp/c-to-cpp.ts`，2026-11-08）。
 * 身分只寫在這顆膠囊裡；共用檔呼叫它，不寫 `cpp:delete`。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildDelete(ptr: SemanticNode, isArray: boolean): SemanticNode {
  return createNode('cpp:delete', { is_array: isArray ? 'true' : 'false' }, { ptr: [ptr] })
}
