/**
 * `delete p`／`delete[] p` 的建構子——C → C++ 把 `free(p)` 換成它時用（`src/languages/cpp/c-to-cpp.ts`，2026-11-08）。
 * 身分只寫在這顆膠囊裡；共用檔呼叫它，不寫 `cpp:delete`。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildDelete(ptr: SemanticNode, isArray: boolean): SemanticNode {
  return createNode('cpp:delete', { is_array: isArray ? 'true' : 'false' }, { ptr: [ptr] })
}

/** `delete p`／`delete[] p` 的 p 與是不是陣列形式（不是 delete 就回 null）——C++ → C 配對 new／delete 時用（357）。 */
export function deletedPointer(n: SemanticNode): { ptr: SemanticNode; isArray: boolean } | null {
  if (n.componentId !== 'cpp:delete') return null
  const ptr = n.slots.ptr?.[0]
  return ptr ? { ptr, isArray: String(n.properties.is_array) === 'true' } : null
}
