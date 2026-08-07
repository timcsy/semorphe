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
  conceptId: string
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
  /**
   * 這顆積木對應的概念。
   *
   * 舊名 `concept`——與 `SemanticNode.concept`（一個**字串**）同名而不同義，
   * 是 2026-08-06 那次改名翻車的直接原因：腳本分不出「值是物件」與「值是
   * 字串」的兩種 `concept`，而測試檔不在型別檢查範圍內，改錯了照樣編得過。
   *
   * 改名讓「`concept`」在專案裡的意思收斂。見 experience「同一個欄位名長在
   * 三個不同型別上時」。
   */
  conceptMapping: ConceptMapping
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

/**
 * 形態選擇軸——**具名**，而不是寫死的兩個欄位。
 *
 * 目前有兩條軸在跑，而且**取值來源不同**：
 *
 * | 軸 | `from` | 例 |
 * |---|---|---|
 * | `role` | `position`——由呈現位置決定 | 敘述版／運算式版 |
 * | `container_kind` | `property`——讀節點屬性 | 堆疊／佇列 |
 *
 * 寫死兩個欄位裝不下第二條軸，而 P3 說「新增不得改變既有」。
 * **但不建外掛系統**——軸的解析就是一張表，加一條軸就是加一列。
 */
export interface FormAxis {
  /** 軸名，只用於診斷訊息 */
  name: string
  /** 值從哪來 */
  from: 'position' | 'property'
  /** `from: 'property'` 時讀哪個屬性 */
  property?: string
}

/**
 * 一個元件身分可對應的所有積木形態，以及**怎麼選**。
 *
 * 不變式 FS-1..FS-4 見 `specs/097-multi-form-projection/data-model.md`，
 * 由 `validateFormSet()` 檢查。
 */
export interface FormSet {
  conceptId: string
  /** null = 只有一個形態（絕大多數元件） */
  axis: FormAxis | null
  /** 軸值 → 積木型別 */
  forms: Record<string, string>
  /** 選不出時用哪個。MUST 在 `forms` 的值域裡（FS-2） */
  fallback: string
}

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

/** 五路完備性的路徑名 */
export type PathName = 'lift' | 'render' | 'extract' | 'generate' | 'execute'

/** Concept definition in concepts.json (semantic layer) */
export interface ConceptDefJSON {
  conceptId: string
  layer: ConceptLayer
  abstractConcept?: string | null
  properties: string[]
  children: Record<string, string>
  role: 'statement' | 'expression' | 'both'
  annotations?: Record<string, unknown>
  /**
   * 本概念**刻意**不提供的路徑。
   *
   * **這不再只是文件——執行引擎會讀它。** 在此之前「哪些概念不執行」寫死在
   * 核心直譯器的一份清單裡，而這個欄位一個概念都沒用過；同一個事實有兩處
   * 記載，且兩處從未一致。現在只有一處：概念自己說。
   *
   * 未宣告的空實作一律判為「殼」——正確的空與缺失的空長得一樣，
   * 所以要求正確的那個出聲。見 knowledge/concepts/執行機構.md。
   */
  skipPaths?: PathName[]
  /**
   * 每條被跳過的路徑**為什麼**被跳過。有 `skipPaths` 就必須有它。
   *
   * 沒有理由的宣告是**把缺陷洗成設計**——而且宣告下去之後，護欄會替它背書。
   * 實測 34 個「無執行行為」的概念裡，只有 12 個說得出理由（見
   * `specs/053-declare-noop-execute/classification.md`）。
   */
  skipReasons?: Partial<Record<PathName, SkipReason>>
}

/**
 * 一條路徑被刻意跳過的理由。**只有兩個值，而且不得增加。**
 *
 * 第三個值就是在替「還沒做」找一個體面的名字。
 */
/**
 * 為什麼這個概念刻意不走某條路。
 *
 * ⚠️ **值域必須小，而且每個值都要能機械查證。** `history/018` 的原話：
 * 「理由只有固定幾個值且不得增加——第三個值就是在替『還沒做』找一個體面的
 * 名字。」所以第三個值的門檻要比前兩個更硬：
 * `skip-declaration-gate` 會去驗每一個宣告的**事實依據**，不只驗它有理由。
 */
export type SkipReason =
  /** 這個概念在執行期沒有任何可觀察效果（註解、include、define…） */
  | 'declarative'
  /**
   * **由降級抵達，不由辨識抵達。**
   *
   * 有些概念是別人的抽象父概念——它們不會出現在任何原始碼裡，而是在具體
   * 概念不可用時**被降級成**的目標（`cpp_ternary` → `if_else`）。
   *
   * 完備性假設「每個概念都該從產出的程式碼辨識得回來」，而那個假設對降級
   * 目標**不成立**。
   *
   * 門檻（`skip-declaration-gate` 會驗）：
   *   ① 必須真的有概念宣告它為 `abstractConcept`
   *   ② 必須不在工具箱裡——使用者拖得到的話它就該辨識得回來
   */
  | 'degradation-target'
  /** 有子槽，但由父概念的執行器負責走訪（cpp_case ← cpp_switch） */
  | 'consumed-by-parent'

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
