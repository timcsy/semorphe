import type { TransformRegistry } from '../../../../core/registry/transform-registry'

export function registerCppTransforms(registry: TransformRegistry): void {
  registry.register('cpp:stripComment', (text) => {
    if (text.startsWith('//')) return text.slice(2).trim()
    if (text.startsWith('/*') && text.endsWith('*/')) return text.slice(2, -2).trim()
    return text
  })

  registry.register('cpp:stripBlockComment', (text) => {
    if (text.startsWith('/*') && text.endsWith('*/')) return text.slice(2, -2).trim()
    return text
  })
}
