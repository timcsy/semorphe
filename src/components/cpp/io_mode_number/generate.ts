/** `cpp:io_mode_number` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // ⚠️ 屬性的值**就是** C++ 的那個字（`fixed`／`scientific`）——
  //    而那是刻意的：一個需要對應表的屬性，在對應表少一列時會安靜地產錯字。
  g.set('cpp:io_mode_number', (node) => String(node.properties.notation ?? 'fixed'))
}
