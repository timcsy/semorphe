// ─── Property Values ───

export type PropertyValue = string | number | boolean | string[]

// ─── Semantic Tree ───

export interface SemanticNode {
  id: string
  concept: string
  properties: Record<string, PropertyValue>
  children: Record<string, SemanticNode[]>
  annotations?: Annotation[]
  metadata?: NodeMetadata
}

export interface Annotation {
  type: 'comment' | 'pragma' | 'lint_directive'
  text: string
  position: 'before' | 'after' | 'inline'
}

export interface NodeMetadata {
  syntaxPreference?: string
  confidence?: 'high' | 'inferred'
  rawCode?: string
  sourceRange?: SourceRange
  blockId?: string
}

export interface SourceRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

// ─── Concept System ───

export type ConceptLayer = 'universal' | 'lang-core' | 'lang-library'
export type CognitiveLevel = 0 | 1 | 2

export interface ConceptDef {
  id: string
  layer: ConceptLayer
  level: CognitiveLevel
  abstractConcept?: string
  propertyNames: string[]
  childNames: string[]
  semanticContract?: SemanticContract
}

export interface SemanticContract {
  effect: 'pure' | 'mutate_self' | 'mutate_arg'
  returnSemantics: 'void' | 'self' | 'new_value'
  chainable: boolean
}

// ─── Block Spec (JSON-driven) ───

export interface BlockSpec {
  id: string
  language: string
  category: string
  level: CognitiveLevel
  version: string
  concept: ConceptMapping
  blockDef: Record<string, unknown>
  codeTemplate: CodeTemplate
  astPattern: AstPattern
}

export interface ConceptMapping {
  conceptId: string
  abstractConcept?: string
}

export interface CodeTemplate {
  pattern: string
  imports: string[]
  order: number
}

export interface AstPattern {
  nodeType: string
  constraints: AstConstraint[]
}

export interface AstConstraint {
  field: string
  text?: string
  nodeType?: string
}

// ─── Style ───

export interface StylePreset {
  id: string
  name: Record<string, string>
  io_style: 'cout' | 'printf'
  naming_convention: 'camelCase' | 'snake_case'
  indent_size: number
  brace_style: 'K&R' | 'Allman'
  namespace_style: 'using' | 'explicit'
  header_style: 'bits' | 'individual'
}

// ─── Lift Context ───

export interface Declaration {
  name: string
  type: string
  scope: number
}

export interface LiftContextData {
  declarations: Declaration[]
  usingDirectives: string[]
  includes: string[]
  macroDefinitions: string[]
  scopeStack: ScopeFrame[]
}

export interface ScopeFrame {
  level: number
  declarations: Declaration[]
}

// ─── Workspace State (Persistence) ───

export interface WorkspaceState {
  version: number
  tree: SemanticNode
  language: string
  style: string
  locale: string
  level: CognitiveLevel
}

// ─── Lift Result ───

export interface LiftError {
  message: string
  sourceRange?: SourceRange
  level: 'warning' | 'error'
}

export interface LiftResult {
  tree: SemanticNode
  errors: LiftError[]
  hasUnresolved: boolean
}
