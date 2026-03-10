import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { registerLanguage } from '../../../core/projection/code-generator'
import { registerStatementGenerators } from '../core/generators/statements'
import { registerDeclarationGenerators } from '../core/generators/declarations'
import { registerExpressionGenerators } from '../core/generators/expressions'
import { allStdModules } from '../std'

function createCppGenerators(style: StylePreset): Map<string, NodeGenerator> {
  const g = new Map<string, NodeGenerator>()
  // Core generators (no #include needed)
  registerStatementGenerators(g, style)
  registerDeclarationGenerators(g)
  registerExpressionGenerators(g)
  // Std module generators (each header's generators)
  for (const mod of allStdModules) {
    mod.registerGenerators(g, style)
  }
  return g
}

export function registerCppLanguage(): void {
  registerLanguage('cpp', createCppGenerators)
}
