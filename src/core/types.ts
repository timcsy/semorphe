// ─── Property Values ───

export type PropertyValue = string | number | boolean | string[]

// ─── Concept IDs ───

/** Universal 概念（所有程式語言共通） */
export type UniversalConcept =
  | 'program'
  | 'var_declare'
  | 'var_assign'
  | 'var_ref'
  | 'number_literal'
  | 'string_literal'
  | 'arithmetic'
  | 'compare'
  | 'logic'
  | 'logic_not'
  | 'negate'
  | 'if'
  | 'count_loop'
  | 'while_loop'
  | 'break'
  | 'continue'
  | 'func_def'
  | 'func_call'
  | 'return'
  | 'print'
  | 'input'
  | 'endl'
  | 'array_declare'
  | 'array_access'

/** 語言特有概念使用 `lang:concept` 格式 */
export type LanguageSpecificConcept = `${string}:${string}`

/** ConceptId 是 universal 或 language-specific 概念的聯集 */
export type ConceptId = UniversalConcept | LanguageSpecificConcept

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

export type ConfidenceLevel = 'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'
export type DegradationCause = 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'

export interface NodeMetadata {
  syntaxPreference?: string
  confidence?: ConfidenceLevel
  degradationCause?: DegradationCause
  rawCode?: string
  sourceRange?: SourceRange
  /** Block ID from which this node was extracted (for block↔code highlight mapping) */
  sourceBlockId?: string
}

export interface SourceRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

/** 程式級呈現資訊 */
export interface ProgramMetadata {
  detectedStyle?: Record<string, unknown>
  lineCount?: number
}

/** SemanticModel — 程式的完整語義表示 */
export interface SemanticModel {
  readonly program: SemanticNode
  metadata: ProgramMetadata
}

// ─── Concept System ───

export type ConceptLayer = 'universal' | 'lang-core' | 'lang-library'

export interface ConceptDef {
  id: string
  layer: ConceptLayer
  abstractConcept?: string
  propertyNames: string[]
  childNames: string[]
  semanticContract?: SemanticContract
  annotations?: Record<string, unknown>
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
  version: string
  concept: ConceptMapping
  blockDef: Record<string, unknown>
  codeTemplate: CodeTemplate
  astPattern: AstPattern
  renderMapping?: RenderMapping
}

export interface ConceptMapping {
  conceptId: string
  abstractConcept?: string
  properties?: string[]
  children?: Record<string, string>
  role?: 'statement' | 'expression' | 'both'
  annotations?: Record<string, unknown>
}

export interface CodeTemplate {
  pattern: string
  imports: string[]
  order: number
}

export interface AstPattern {
  nodeType: string
  constraints: AstConstraint[]
  patternType?: 'simple' | 'operatorDispatch' | 'chain' | 'composite' | 'unwrap' | 'contextTransform' | 'multiResult'
  fieldMappings?: FieldMapping[]
  operatorDispatch?: OperatorDispatchDef
  chain?: ChainDef
  composite?: CompositeDef
  unwrapChild?: number | string
  contextTransform?: ContextTransformDef
  multiResult?: MultiResultDef
  liftStrategy?: string
}

export interface AstConstraint {
  field: string
  text?: string
  nodeType?: string
  match?: 'exact' | 'startsWith'
}

export interface FieldMapping {
  semantic: string
  ast: string
  extract: 'text' | 'lift' | 'liftBody' | 'liftChildren'
  transform?: string
}

export interface OperatorDispatchDef {
  operatorField: string
  routes: Record<string, string>
  fieldMappings?: FieldMapping[]
}

export interface ChainDef {
  operator: string
  direction: 'left' | 'right'
  rootMatch: { text: string }
  collectField: string
  specialNodes?: Record<string, string>
}

export interface CompositeDef {
  checks: Array<{
    field: string
    typeIs?: string
    operatorIn?: string[]
  }>
  extract: Record<string, ExtractRule>
}

export interface ContextTransformDef {
  liftChild: number | string
  transformRules: Array<{
    fromConcept: string
    toConcept: string
  }>
}

export interface MultiResultDef {
  iterateOver: string
  perItemPatterns?: Record<string, ExtractRule>
  wrapInCompound: boolean
}

export interface ExtractRule {
  source: 'text' | 'lift' | 'liftBody' | 'path' | 'nodeText' | 'operator'
  path?: string
  field?: string
}

// ─── Render Mapping (JSON-driven) ───

export interface RenderMapping {
  fields: Record<string, string>
  inputs: Record<string, string>
  statementInputs: Record<string, string>
  dynamicInputs?: DynamicInputDef
  strategy?: string
  /** Block type to use when this statement block appears in expression context */
  expressionCounterpart?: string
  /** Declarative rules for dynamic block structure (variable-count inputs, multi-mode slots, etc.) */
  dynamicRules?: DynamicRule[]
  /** Extra state flags: set extraState[key] = true when children[childSlot] is non-empty */
  extraStateFlags?: Record<string, string>
}

export interface DynamicInputDef {
  semanticChild: string
  inputPrefix: string
  countProperty?: string
}

// ─── Dynamic Rules (unified extract/render for dynamic blocks) ───

/**
 * A declarative rule describing how to extract/render dynamic block structure.
 * Each rule maps a variable-count set of inputs/fields to a semantic children slot.
 */
export interface DynamicRule {
  /** Path in extraState to get the element count (e.g., "argCount", "args.length") */
  countSource: string
  /** Semantic children slot name to populate */
  childSlot: string
  /** Input name pattern with {i} placeholder (e.g., "ARG_{i}") — reads input_value */
  inputPattern?: string
  /** Field name pattern with {i} placeholder (e.g., "TYPE_{i}") — reads field value */
  fieldPattern?: string
  /** Path in extraState to get each element's mode (e.g., "args[{i}].mode") */
  modeSource?: string
  /** Mode-specific extraction rules */
  modes?: Record<string, ModeExtractRule>
  /** Concept to create for each element (used with fieldPattern groups) */
  childConcept?: string
  /** Map of field patterns → property names for childConcept nodes */
  childFields?: Record<string, string>
  /** If true, the inputPattern refers to statement inputs (chains) rather than expression inputs */
  isStatementInput?: boolean
}

/** Describes how to extract a value in a specific mode (select, input, expression, etc.) */
export interface ModeExtractRule {
  /** Path in extraState to read the value (for select/input modes) */
  field?: string
  /** Wrap the value as this concept (e.g., "var_ref", "number_literal") */
  wrap?: string
  /** Read from block input (for expression/compose modes) */
  input?: string
}

// ─── Split JSON Formats (Phase 3: concept/blockDef separation) ───

/** Concept definition in concepts.json (semantic layer) */
export interface ConceptDefJSON {
  conceptId: string
  layer: ConceptLayer
  abstractConcept?: string | null
  properties: string[]
  children: Record<string, string>
  role: 'statement' | 'expression' | 'both'
  annotations?: Record<string, unknown>
}

/** Block projection in block-specs.json (projection layer) */
export interface BlockProjectionJSON {
  id: string
  conceptId: string
  language: string
  category: string
  version: string
  blockDef: Record<string, unknown>
  codeTemplate?: CodeTemplate
  astPattern?: AstPattern
  renderMapping?: RenderMapping
}

/** Language manifest for manifest-driven loading */
export interface LanguageManifest {
  id: string
  name: string
  version: string
  parser: {
    type: 'tree-sitter'
    language: string
  }
  provides: {
    concepts: string[]
    blocks: string[]
    templates: string[]
    liftPatterns: string[]
  }
}

// ─── Universal Template (Language-specific code templates for universal concepts) ───

export interface UniversalTemplate {
  conceptId: string
  pattern?: string
  styleVariants?: Record<string, CodeTemplate>
  styleKey?: string
  order: number
  imports?: string[]
}

// ─── Lift Pattern (JSON-driven AST→Semantic patterns) ───

export interface LiftPattern {
  id: string
  astNodeType: string
  concept?: { conceptId: string }
  patternType?: AstPattern['patternType']
  constraints?: AstConstraint[]
  fieldMappings?: FieldMapping[]
  operatorDispatch?: OperatorDispatchDef
  chain?: ChainDef
  composite?: CompositeDef
  unwrapChild?: number | string
  contextTransform?: ContextTransformDef
  multiResult?: MultiResultDef
  extract?: Record<string, ExtractRule>
  priority?: number
  liftStrategy?: string
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
  topicId: string
  enabledBranches: string[]
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

// ─── Toolbox ───

type ExtraBlockDef = string | { type: string; extraState?: Record<string, unknown> }

export interface ToolboxCategoryDef {
  key: string
  nameKey: string
  fallback: string
  colorKey: string
  registryCategories: string[]
  extraTypes?: ExtraBlockDef[]
  excludeTypes?: string[]
  /** If true, this category uses the I/O builder (iostream/cstdio sorting) */
  isIoCategory?: boolean
  /** Custom content builder for special categories */
  buildContents?: (registry: import('./block-spec-registry').BlockSpecRegistry, visibleConcepts: Set<string>, ioPreference: 'iostream' | 'cstdio') => { kind: string; type: string }[]
}

// ─── Topic System ───

/** Topic 代表一個使用情境的投影組態 */
export interface Topic {
  id: string
  language: string
  name: string
  default?: boolean
  description?: string
  levelTree: LevelNode
  blockOverrides?: Record<string, BlockOverride>
}

/** 層級樹中的一個節點 */
export interface LevelNode {
  id: string
  level: number
  label: string
  concepts: string[]
  children: LevelNode[]
}

/** Topic 對特定概念的積木呈現覆蓋 */
export interface BlockOverride {
  message?: string
  tooltip?: string
  args?: BlockArgOverride[]
  renderMapping?: Partial<RenderMapping>
}

/** BlockOverride 中的 arg 覆蓋項目 */
export interface BlockArgOverride {
  name: string
  type?: string
  options?: Array<[string, string]>
  _remove?: boolean
  _insert?: string
  [key: string]: unknown
}
