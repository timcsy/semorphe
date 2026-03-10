import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(_g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // This module's concepts use codeTemplate-based generation
  // No explicit NodeGenerator registrations needed
}
