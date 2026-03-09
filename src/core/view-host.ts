import type { SemanticNode } from './types'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'

// ─── View Configuration ───

export interface ViewConfig {
  language: string
  style?: Record<string, unknown>
}

// ─── View Capabilities ───

export interface ViewCapabilities {
  editable: boolean
  needsLanguageProjection: boolean
  consumedAnnotations: string[]
}

// ─── Events: Core → View ───

export interface SemanticUpdateEvent {
  tree: SemanticNode
}

export interface ExecutionStateEvent {
  status: ExecutionStatus
  step?: StepInfo
}

// ─── ViewHost Interface ───

export interface ViewHost {
  readonly viewId: string
  readonly viewType: string
  readonly capabilities: ViewCapabilities

  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void
}
