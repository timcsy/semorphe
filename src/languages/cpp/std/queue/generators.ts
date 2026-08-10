import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {


  g.set('cpp:priority_queue_peek', (node) => {
    const obj = node.properties.obj ?? 'pq'
    return `${obj}.top()`
  })




}
