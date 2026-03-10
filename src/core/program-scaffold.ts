// ─── ProgramScaffold: Language-agnostic boilerplate management ───

import type { CognitiveLevel, SemanticNode } from './types'

export type ScaffoldVisibility = 'hidden' | 'ghost' | 'editable'

export type ScaffoldSection = 'imports' | 'preamble' | 'entryPoint' | 'epilogue'

export interface ScaffoldItem {
  code: string
  visibility: ScaffoldVisibility
  reason?: string
  section: ScaffoldSection
  pinned?: boolean
}

export interface ScaffoldResult {
  imports: ScaffoldItem[]
  preamble: ScaffoldItem[]
  entryPoint: ScaffoldItem[]
  epilogue: ScaffoldItem[]
}

export interface ScaffoldConfig {
  cognitiveLevel: CognitiveLevel
  manualImports?: string[]
  pinnedItems?: string[]
}

export interface ProgramScaffold {
  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult
}

/**
 * Determine visibility based on cognitive level and pin state.
 */
export function resolveVisibility(
  level: CognitiveLevel,
  pinned: boolean,
): ScaffoldVisibility {
  if (pinned) return 'editable'
  if (level === 0) return 'hidden'
  if (level === 1) return 'ghost'
  return 'editable'
}
