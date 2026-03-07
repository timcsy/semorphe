import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { registerLanguage } from '../../../core/projection/code-generator'
import { registerDeclarationGenerators } from './declarations'
import { registerExpressionGenerators } from './expressions'
import { registerStatementGenerators } from './statements'
import { registerIOGenerators } from './io'

function createCppGenerators(style: StylePreset): Map<string, NodeGenerator> {
  const g = new Map<string, NodeGenerator>()
  registerStatementGenerators(g, style)
  registerDeclarationGenerators(g)
  registerExpressionGenerators(g)
  registerIOGenerators(g, style)
  return g
}

export function registerCppLanguage(): void {
  registerLanguage('cpp', createCppGenerators)
}
