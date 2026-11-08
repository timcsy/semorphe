/** `fixed`／`scientific` 的建構子——C → C++ 把 `%.2f` 換成 `fixed << setprecision(2)` 時用（2026-11-08）。身分只寫在這顆膠囊裡。 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function buildIoModeNumber(notation: 'fixed' | 'scientific'): SemanticNode {
  return createNode('cpp:io_mode_number', { notation })
}
