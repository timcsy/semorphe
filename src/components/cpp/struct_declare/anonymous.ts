import type { SemanticNode } from '../../../core/types'

/**
 * 結構裡的匿名成員（`struct P { char k; union { int code; char flag; }; };`，C11 6.7.2.1p13）：名字留空、沒有另名（358）。
 * 共用的類別成員 lift 把沒有宣告子的 `union {…};`／`struct {…};` 交給這裡。不是這顆的回 null。
 */
export function asAnonymousStructMember(lifted: SemanticNode | null): SemanticNode | null {
  if (!lifted || lifted.componentId !== 'cpp:struct_declare') return null
  return { ...lifted, properties: { ...lifted.properties, name: '' } }
}
