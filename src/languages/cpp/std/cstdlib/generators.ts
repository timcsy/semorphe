import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp:random_next', () => {
    return `rand()`
  })










}
