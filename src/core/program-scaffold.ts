// ─── ProgramScaffold: Language-agnostic boilerplate management ───

import type { SemanticNode } from './types'

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
  /** Max enabled tree depth: 0=hidden, 1=ghost, 2+=editable */
  scaffoldDepth: number
  manualImports?: string[]
  pinnedItems?: string[]
}

export interface ProgramScaffold {
  resolve(tree: SemanticNode, config: ScaffoldConfig): ScaffoldResult
  /**
   * 目前用的是哪一份骨架宣告（各語言 `skeletons/` 目錄下那些 JSON 的 `id`）。
   *
   * 🔴 產生器要問它「**骨架已經生出來了嗎**」（`skeletonPresent`）——
   * 在此之前那裡寫死 `name === 'main'`，於是 Arduino 的 `setup`／`loop`
   * 永遠不算骨架（2026-08-28）。
   *
   * ⚠️ **選用**：`board-library-headers-output` 那族的假鷹架沒有它。
   */
  skeleton?(): string
}

/**
 * Determine visibility based on scaffold depth and pin state.
 * scaffoldDepth 0 = hidden (like old L0), 1 = ghost (like old L1), 2+ = editable (like old L2)
 */
export function resolveVisibility(
  scaffoldDepth: number,
  pinned: boolean,
): ScaffoldVisibility {
  if (pinned) return 'editable'
  if (scaffoldDepth === 0) return 'hidden'
  if (scaffoldDepth === 1) return 'ghost'
  return 'editable'
}
