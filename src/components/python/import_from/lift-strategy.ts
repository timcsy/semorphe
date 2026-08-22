/**
 * `python:import_from` 的 **lift** 路——`from math import sqrt, floor`。
 *
 * ⚠️ **萬用與相對匯入回 `null`**：`from x import *` 帶進來的名字要到執行期才知道，
 * `from . import y` 需要「這個檔在哪個套件裡」——兩者這個工具都沒有。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_import_from', (node, ctx) => {
    void ctx
    const parts = node.namedChildren
    if (parts.length < 2) return null
    if (parts.some((c) => c.type === 'wildcard_import' || c.type === 'relative_import' || c.type === 'import_prefix')) {
      return null
    }
    if (parts.some((c) => c.type !== 'dotted_name')) return null // `as` 別名還沒收
    return createNode('python:import_from', {
      module: parts[0].text,
      names: parts.slice(1).map((c) => c.text).join(', '),
    }, {})
  })
}
