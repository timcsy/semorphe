import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(_g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // No cmath-specific generators yet — math functions use func_call_expr
}
