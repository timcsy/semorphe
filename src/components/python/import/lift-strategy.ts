/**
 * `python:import` 的 **lift** 路——`import math` 與 `import math as m`。
 *
 * ⚠️ **一行多個（`import os, sys`）與點狀路徑（`import os.path`）回 `null`**：
 * 前者是一行裡的兩個宣告（積木上只有一格），後者這個直譯器沒有。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_import', (node, ctx) => {
    void ctx
    const items = node.namedChildren
    if (items.length !== 1) return null
    const it = items[0]
    if (it.type === 'dotted_name') {
      if (it.namedChildren.length !== 1) return null
      return createNode('python:import', { name: it.text, alias: '' }, {})
    }
    if (it.type === 'aliased_import') {
      const nm = it.childForFieldName('name'), al = it.childForFieldName('alias')
      if (!nm || !al || nm.namedChildren.length !== 1) return null
      return createNode('python:import', { name: nm.text, alias: al.text }, {})
    }
    return null
  })
}
